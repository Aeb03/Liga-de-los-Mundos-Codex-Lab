(()=>{'use strict';

/* Liga de los Mundos — Motor global de combate v0.6.25-v02
   Se carga DESPUÉS de balance, IA, VFX y audio para actuar sobre la cadena
   efectiva de funciones y no ser sobrescrito por capas posteriores.

   Autoridad global para:
   - duración de Escudos por generador;
   - registro de daño real vs. Escudo;
   - infraestructura reutilizable de preview AoE táctil.
*/

const CORE_VERSION='0.6.25h2-v02';
const root=globalThis;
const CombatCore=root.LDMCombatCore=root.LDMCombatCore||{};
CombatCore.version=CORE_VERSION;

// ─────────────────────────────────────────────
// ESCUDOS — autoridad en app.js
// ─────────────────────────────────────────────
//
// La v0.6.25 original intentaba envolver addShield/beginTurn desde esta capa.
// Con la cadena real de wrappers (VFX + audio + balance) eso no resultó
// suficientemente robusto. El hotfix mueve la regla al motor base:
//
//   Escudo aplicado → conserva sourceOwnerId
//   Inicio del próximo turno del generador → expira
//
// combat-core sólo expone los helpers para diagnóstico.
CombatCore.shields={
  expireBySource:(id)=>typeof expireShieldsFromSource==='function'?expireShieldsFromSource(id):0,
  expireOrphaned:()=>typeof expireOrphanedShields==='function'?expireOrphanedShields():0
};

// ─────────────────────────────────────────────
// DAÑO REAL — observar el resultado sin cambiar la mecánica existente
// ─────────────────────────────────────────────

const _coreBaseApplyDamage=applyDamage;
applyDamage=function(target,amount,ignoreShield=false,...rest){
  if(!target)return _coreBaseApplyDamage(target,amount,ignoreShield,...rest);
  const beforeHp=Math.max(0,target.hp||0);
  const beforeShield=typeof shieldTotal==='function'?shieldTotal(target):0;
  const wasAlive=!!target.alive;
  const legacyReturn=_coreBaseApplyDamage(target,amount,ignoreShield,...rest);
  const afterHp=Math.max(0,target.hp||0);
  const afterShield=typeof shieldTotal==='function'?shieldTotal(target):0;
  const result={
    requested:Math.max(0,Number(amount)||0),
    hpLost:Math.max(0,beforeHp-afterHp),
    shieldLost:Math.max(0,beforeShield-afterShield),
    beforeHp,afterHp,beforeShield,afterShield,wasAlive,
    killed:wasAlive&&!target.alive,
    ignoreShield:!!ignoreShield
  };
  target.lastDamageResult=result;
  CombatCore.lastDamage={targetId:target.id||null,...result};
  return legacyReturn;
};
CombatCore.damage=function(target,amount,ignoreShield=false,...rest){
  applyDamage(target,amount,ignoreShield,...rest);
  return target?.lastDamageResult||null;
};

// ─────────────────────────────────────────────
// PREVIEW GLOBAL AoE
// Amarillo = alcance permitido por la habilidad.
// Magenta = casillas realmente afectadas.
// Tocar/arrastrar posiciona; soltar fija; segundo toque sobre el centro ejecuta.
// Las habilidades se conectan declarativamente con:
//   aoePreview:{pattern:'cross1'}
// ─────────────────────────────────────────────

const aoePatterns=new Map();
const cell=(x,y,zone='effect')=>({x,y,zone});
const boardInside=(x,y)=>Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x<SIZE&&y<SIZE;
const compactCells=cells=>{
  const seen=new Set();
  return (cells||[]).filter(c=>{
    if(!c||!boardInside(c.x,c.y))return false;
    const k=`${c.x},${c.y}`;
    if(seen.has(k))return false;
    seen.add(k);return true;
  });
};

aoePatterns.set('center',({x,y})=>[cell(x,y,'center')]);
aoePatterns.set('cross1',({x,y})=>[
  cell(x,y,'center'),cell(x+1,y),cell(x-1,y),cell(x,y+1),cell(x,y-1)
]);
aoePatterns.set('adjacent8',({x,y})=>{
  const out=[];
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy)out.push(cell(x+dx,y+dy));
  return out;
});
aoePatterns.set('centerPlus8',({x,y})=>[cell(x,y,'center'),...aoePatterns.get('adjacent8')({x,y})]);

function registerAoEPattern(name,builder){
  if(typeof name!=='string'||!name||typeof builder!=='function')return false;
  aoePatterns.set(name,builder);return true;
}
function buildAoECells(pattern,target,context={}){
  const builder=typeof pattern==='function'?pattern:aoePatterns.get(pattern);
  if(!builder||!target)return [];
  return compactCells(builder(target,context)||[]);
}
function aoeState(){return B?.aoePreview||null}

function selectedAoEConfig(){
  if(!B||B.ended||B.busy)return null;
  const u=typeof cur==='function'?cur():null;
  if(!u||u.controller!=='human'||!B.selectedAction)return null;
  const a=typeof ability==='function'?ability(u.championId,B.selectedAction):null;
  const cfg=a?.aoePreview;
  if(!cfg)return null;
  return {
    abilityId:B.selectedAction,
    pattern:cfg.pattern||'center',
    context:{...(cfg.context||{}),ability:a}
  };
}

function startAoEPreview(config={}){
  if(!B)return false;
  const pattern=config.pattern||'center';
  if(typeof pattern!=='function'&&!aoePatterns.has(pattern))return false;
  B.aoePreview={
    active:true,
    abilityId:config.abilityId||B.selectedAction||null,
    pattern,
    origin:config.origin||null,
    target:null,
    cells:[],
    locked:false,
    dragging:false,
    committing:false,
    validTarget:typeof config.validTarget==='function'?config.validTarget:null,
    onCommit:typeof config.onCommit==='function'?config.onCommit:null,
    context:config.context||{},
    downTarget:null,
    suppressClickUntil:0
  };
  applyAoEPreviewClasses();
  return true;
}

function updateAoEPreview(x,y){
  const s=aoeState();
  if(!s?.active||!boardInside(x,y))return false;
  if(s.validTarget&&!s.validTarget(x,y,s))return false;
  s.target={x,y};
  s.cells=buildAoECells(s.pattern,s.target,{...s.context,origin:s.origin,state:s});
  applyAoEPreviewClasses();
  return true;
}
function lockAoEPreview(){
  const s=aoeState();if(!s?.active||!s.target)return false;
  s.locked=true;s.dragging=false;applyAoEPreviewClasses();return true;
}
function clearAoEPreview(){
  if(B?.aoePreview)B.aoePreview=null;
  applyAoEPreviewClasses();
}
function sameAoETarget(s,x,y){return !!(s?.target&&s.target.x===x&&s.target.y===y)}

async function commitAoEPreview(){
  const s=aoeState();
  if(!s?.active||!s.locked||!s.target||s.committing||typeof s.onCommit!=='function')return false;
  s.committing=true;
  const payload={
    target:{...s.target},
    cells:s.cells.map(c=>({...c})),
    abilityId:s.abilityId,
    context:s.context
  };
  try{
    return await s.onCommit(payload)!==false;
  }finally{
    const current=aoeState();
    if(current===s)current.committing=false;
  }
}

function decorateAoEUI(){
  if(typeof document==='undefined')return;
  const s=aoeState();
  const legend=document.querySelector('.range-legend');
  if(s?.active&&legend&&!legend.querySelector('[data-aoe-legend]')){
    const item=document.createElement('span');
    item.dataset.aoeLegend='1';
    item.innerHTML='<i class="swatch aoe"></i>Área afectada';
    legend.appendChild(item);
  }
  const help=document.querySelector('.combat-help');
  if(s?.active&&help){
    help.textContent=s.locked
      ?'Área fijada. Arrastrá para cambiarla o tocá otra vez el centro para lanzar.'
      :'Deslizá el área por las casillas válidas. Soltá para fijarla; no se lanza todavía.';
  }
}

function applyAoEPreviewClasses(){
  if(typeof document==='undefined')return;
  const grid=document.querySelector('#grid');
  if(!grid)return;
  grid.classList.remove('aoe-preview-active','aoe-preview-locked-state');
  grid.querySelectorAll('.aoe-preview,.aoe-preview-center,.aoe-preview-anchor,.aoe-preview-locked').forEach(el=>{
    el.classList.remove('aoe-preview','aoe-preview-center','aoe-preview-anchor','aoe-preview-locked');
  });
  const s=aoeState();
  if(!s?.active){return}
  grid.classList.add('aoe-preview-active');
  if(s.locked)grid.classList.add('aoe-preview-locked-state');

  if(s.target){
    const anchor=grid.querySelector(`.tile[data-x="${s.target.x}"][data-y="${s.target.y}"]`);
    if(anchor)anchor.classList.add('aoe-preview-anchor');
  }
  for(const c of s.cells||[]){
    const tile=grid.querySelector(`.tile[data-x="${c.x}"][data-y="${c.y}"]`);
    if(!tile)continue;
    tile.classList.add('aoe-preview');
    if(c.zone==='center')tile.classList.add('aoe-preview-center');
    if(s.locked)tile.classList.add('aoe-preview-locked');
  }
  decorateAoEUI();
}

function tileFromEvent(e){
  let node=e?.target||null;
  if(typeof document!=='undefined'&&Number.isFinite(e?.clientX)&&Number.isFinite(e?.clientY)){
    node=document.elementFromPoint(e.clientX,e.clientY)||node;
  }
  const t=node?.closest?.('#grid .tile');
  if(!t)return null;
  const x=Number(t.dataset.x),y=Number(t.dataset.y);
  return boardInside(x,y)?{tile:t,x,y}:null;
}

function ensureSelectedAoEPreview(){
  const s=aoeState();

  // Algunas habilidades complejas (por ejemplo Colapso) inician el preview
  // manualmente después de una primera selección. Si el preview activo sigue
  // perteneciendo a la acción seleccionada, no debe borrarse por no tener
  // metadata aoePreview declarativa.
  if(s?.active&&s.abilityId===B?.selectedAction)return true;

  const cfg=selectedAoEConfig();
  if(!cfg){
    if(s?.active)clearAoEPreview();
    return false;
  }

  const u=cur();
  return startAoEPreview({
    abilityId:cfg.abilityId,
    pattern:cfg.pattern,
    origin:{x:u.x,y:u.y},
    context:cfg.context,
    validTarget:(x,y)=>{
      const active=cur();
      return !!(active?.controller==='human'&&B?.selectedAction===cfg.abilityId&&!B.busy&&canUseAbility(active,cfg.abilityId,x,y));
    },
    onCommit:async ({target})=>{
      const active=cur();
      if(!active||active.controller!=='human'||B?.busy||B?.selectedAction!==cfg.abilityId)return false;
      if(!canUseAbility(active,cfg.abilityId,target.x,target.y)){
        if(typeof showNotice==='function')showNotice(invalidAbilityReason(active,cfg.abilityId,target.x,target.y));
        return false;
      }
      clearAoEPreview();
      await executeAbility(active,cfg.abilityId,target.x,target.y,false);
      if(!active.alive&&!B.ended)nextTurn();
      return true;
    }
  });
}

if(typeof document!=='undefined'){
  document.addEventListener('pointerdown',e=>{
    const s=aoeState();
    if(!s?.active)return;
    const hit=tileFromEvent(e);
    if(!hit)return;
    // Mientras se apunta un AoE, el arrastre pertenece al selector, no a la cámara.
    e.preventDefault();e.stopPropagation();
    s.downTarget={x:hit.x,y:hit.y};
    if(s.validTarget&&!s.validTarget(hit.x,hit.y,s)){s.dragging=false;return}
    if(s.locked&&sameAoETarget(s,hit.x,hit.y)){s.dragging=false;return}
    s.locked=false;s.dragging=true;
    updateAoEPreview(hit.x,hit.y);
  },true);

  document.addEventListener('pointermove',e=>{
    const s=aoeState();
    if(!s?.active||!s.dragging)return;
    const hit=tileFromEvent(e);
    if(!hit)return;
    e.preventDefault();e.stopPropagation();
    updateAoEPreview(hit.x,hit.y);
  },true);

  document.addEventListener('pointerup',e=>{
    const s=aoeState();
    if(!s?.active)return;
    const hit=tileFromEvent(e);
    if(!hit)return;
    e.preventDefault();e.stopPropagation();

    const secondTap=
      s.locked &&
      sameAoETarget(s,hit.x,hit.y) &&
      s.downTarget &&
      s.downTarget.x===hit.x &&
      s.downTarget.y===hit.y;

    s.suppressClickUntil=Date.now()+450;

    if(secondTap){
      void commitAoEPreview();
      return;
    }

    if(s.dragging){
      updateAoEPreview(hit.x,hit.y);
      lockAoEPreview();
    }
    s.dragging=false;
  },true);

  document.addEventListener('pointercancel',()=>{
    const s=aoeState();if(s)s.dragging=false;
  },true);

  document.addEventListener('click',e=>{
    const s=aoeState();
    if(!s?.active||Date.now()>(s.suppressClickUntil||0))return;
    if(tileFromEvent(e)){e.preventDefault();e.stopPropagation()}
  },true);
}

const _coreBaseRenderBattle=renderBattle;
renderBattle=function(...args){
  const s=aoeState();
  if(s?.active&&s.abilityId&&B?.selectedAction!==s.abilityId)B.aoePreview=null;

  const out=_coreBaseRenderBattle(...args);

  ensureSelectedAoEPreview();

  if(typeof requestAnimationFrame==='function'){
    requestAnimationFrame(()=>{applyAoEPreviewClasses();decorateAoEUI()});
  }else{
    applyAoEPreviewClasses();decorateAoEUI();
  }
  return out;
};

CombatCore.aoe={
  registerPattern:registerAoEPattern,
  buildCells:buildAoECells,
  start:startAoEPreview,
  update:updateAoEPreview,
  lock:lockAoEPreview,
  clear:clearAoEPreview,
  commit:commitAoEPreview,
  state:aoeState,
  ensure:ensureSelectedAoEPreview,
  patterns:aoePatterns
};

})();
