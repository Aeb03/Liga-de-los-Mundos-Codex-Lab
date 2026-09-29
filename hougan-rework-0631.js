(()=>{'use strict';

/*
  Liga de los Mundos — v0.6.31-v02
  HOUGAN — BLOQUE 1

  Incluye:
  - Vínculo aliado/enemigo.
  - Muñeco Vudú como acción propia.
  - Muñeco enemigo 16 PV / aliado 20 PV / ambos 3 PM.
  - Asociación fija al personaje Vinculado al crear el Muñeco.
  - Muñeco permanece en tablero pero queda inactivo si cambia/desaparece el Vínculo.
  - Efectos del Muñeco por pérdida REAL de PV.
  - Aguja Vudú, Transferencia, Ritual del Dolor y Maldición.
  - Se elimina la fase automática vieja de movimiento del Muñeco.

  Transferencia de Dolor + Danza Vudú quedan para v0.6.32.
*/

const HOUGAN_ID='houngan';
const HOUGAN_SKILLS=new Set(['needle','transfer','ritual','curse']);

const HOUGAN_DEF={
  hp:90,pa:6,pm:3,ini:5,
  passive:{
    name:'Vínculo Vudú',
    text:'Hougan puede mantener un único personaje Vinculado, aliado o enemigo. Aplicar Vínculo a otro personaje reemplaza el anterior. Los Muñecos conservan la asociación que tenían al ser creados y quedan inactivos si el Vínculo actual deja de coincidir.'
  },
  abilities:[
    {
      id:'needle',icon:'🪡',name:'Aguja Vudú',
      cost:2,range:4,
      text:'Alcance 4 + línea de visión. Enemigo: 6 de daño + Vínculo. Aliado: cura 6 PV + Vínculo. Hougan no puede Vincularse a sí mismo.'
    },
    {
      id:'transfer',icon:'🔄',name:'Transferencia',
      cost:2,range:3,
      text:'Elegí un Muñeco propio a alcance 3 + línea de visión. Hougan recupera hasta 8 PV y el Muñeco pierde exactamente la cantidad de PV realmente recuperada. No puede usarse con Hougan a vida completa. La pérdida real del Muñeco activa normalmente su efecto si está activo.'
    },
    {
      id:'ritual',icon:'👁️',name:'Ritual del Dolor',
      cost:4,range:4,damage:14,
      text:'Sólo contra el enemigo actualmente Vinculado, a alcance 4 + línea de visión. Inflige 14 de daño. Si el Muñeco correspondiente está ortogonalmente adyacente al objetivo, inflige 20 en total. Consume el Vínculo; el Muñeco permanece en tablero pero queda inactivo.'
    },
    {
      id:'curse',icon:'☠️',name:'Maldición',
      cost:3,range:3,damage:8,noLOS:true,maxUsesPerTurn:1,
      text:'8 de daño + Veneno 1 a un enemigo a alcance 3. No requiere Vínculo ni línea de visión. Máximo 1 uso por turno.'
    }
  ]
};

function installHouganDefinition(){
  const c=CHAMPIONS?.[HOUGAN_ID];
  if(!c)return false;
  c.name='Hougan';
  c.hp=HOUGAN_DEF.hp;c.pa=HOUGAN_DEF.pa;c.pm=HOUGAN_DEF.pm;c.ini=HOUGAN_DEF.ini;
  c.passive={...HOUGAN_DEF.passive};
  c.abilities=HOUGAN_DEF.abilities.map(a=>({...a}));
  BOT_LOADOUTS.houngan=['needle','transfer','ritual','curse'];
  return true;
}
installHouganDefinition();

function isHougan(u){return !!u&&u.championId===HOUGAN_ID}
function linked(u){return getLinkedTarget(u)}
function dollFor(u){return ownedDoll(u)}

function dollModeForLink(u,target){
  if(!u||!target)return null;
  return target.side===u.side?'ally':'enemy';
}

function dollAssociationActive(doll){
  if(!doll?.alive||doll.type!=='doll'||!doll.linkedTargetId)return false;
  const owner=getUnit(doll.ownerId);
  const target=getEntity(doll.linkedTargetId);
  return !!(
    owner?.alive&&isHougan(owner)&&
    target?.alive&&target.kind==='unit'&&
    owner.linkedTargetId===doll.linkedTargetId
  );
}

function correspondingDoll(u,target=null){
  const d=dollFor(u);
  if(!d?.alive||!dollAssociationActive(d))return null;
  if(target&&d.linkedTargetId!==target.id)return null;
  return d;
}

function createHouganDoll(u,x,y){
  const target=linked(u);
  if(!target)return null;

  const old=dollFor(u);
  if(old?.alive){
    destroyPillar(old);
    log(`🪆 ${u.name} reemplaza su Muñeco Vudú anterior.`);
  }

  const mode=dollModeForLink(u,target);
  const hp=mode==='ally'?20:16;
  const n=B.nextObjectId++;
  const doll={
    id:`doll${n}`,
    type:'doll',kind:'object',
    ownerId:u.id,side:u.side,
    name:'Muñeco Vudú',icon:'🪆',
    x,y,hp,maxHp:hp,alive:true,
    shieldStacks:[],blocksLOS:false,
    linkedTargetId:target.id,
    linkMode:mode,
    movePm:3,
    facing:u.facing||(u.side==='enemy'?'izquierda':'derecha')
  };

  faceTarget(doll,target);
  B.pillars.push(doll);
  return doll;
}

// ------------------------------------------------------------
// Acción propia — Muñeco Vudú
// ------------------------------------------------------------

function dollActionAvailable(u){
  return !!(isHougan(u)&&u.alive&&u.pa>=2&&linked(u));
}

function dollPlacementValid(u,x,y){
  if(!dollActionAvailable(u)||B?.busy)return false;
  const pos={x,y};
  return free(x,y)&&inRange(u,pos,3)&&clearLOS(u,pos);
}

function selectDollAction(){
  const u=cur();
  if(!isHougan(u)||u.controller!=='human'||B.busy||!dollActionAvailable(u))return;
  globalThis.LDMCombatCore?.aoe?.clear?.();
  B.selectedAction=B.selectedAction==='houganDoll'?null:'houganDoll';
  B.skillsOpen=false;
  renderBattle();
}

function executeDollAction(u,x,y){
  if(!dollPlacementValid(u,x,y))return false;

  u.pa-=2;
  const d=createHouganDoll(u,x,y);
  B.selectedAction=null;

  if(!d)return false;

  const target=getEntity(d.linkedTargetId);
  log(`🪆 ${u.name} crea un Muñeco Vudú ${d.linkMode==='ally'?'aliado':'enemigo'} de ${d.maxHp} PV asociado a ${target?.name||'su Vínculo'}.`);
  spendPAAfterAction(u);
  renderBattle();
  checkBattleEnd();
  return true;
}

// ------------------------------------------------------------
// Daño REAL del Muñeco
// ------------------------------------------------------------
//
// balance-playtest ya tiene una versión histórica del efecto del Muñeco.
// Para no duplicar efectos, ocultamos temporalmente linkedTargetId durante
// la llamada a la cadena anterior y calculamos nosotros el PV real perdido.
//

const _houganBaseApplyDamage=applyDamage;
applyDamage=function(entity,amount,ignoreShield=false,...rest){
  if(entity?.type!=='doll'){
    return _houganBaseApplyDamage(entity,amount,ignoreShield,...rest);
  }

  const storedLink=entity.linkedTargetId||null;
  const beforeHp=Math.max(0,entity.hp||0);

  // Evita que la capa histórica aplique su reflejo antiguo.
  entity.linkedTargetId=null;
  const legacyReturn=_houganBaseApplyDamage(entity,amount,ignoreShield,...rest);
  entity.linkedTargetId=storedLink;

  const afterHp=Math.max(0,entity.hp||0);
  const realLost=Math.max(0,beforeHp-afterHp);

  if(realLost<=0||!storedLink||!dollAssociationActive(entity))return legacyReturn;

  const target=getEntity(storedLink);
  if(!target?.alive||target.kind!=='unit')return legacyReturn;

  const effect=Math.ceil(realLost/2);

  if(entity.linkMode==='enemy'){
    applyDamage(target,effect,false);
    log(`🪆 Muñeco enemigo: ${realLost} PV reales perdidos → ${target.name} recibe ${effect} daño.`);
  }else if(entity.linkMode==='ally'){
    const got=heal(target,effect);
    if(got>0){
      log(`🪆 Muñeco aliado: ${realLost} PV reales perdidos → ${target.name} recupera ${got} PV.`);
    }else{
      log(`🪆 Muñeco aliado: ${realLost} PV reales perdidos, pero ${target.name} ya estaba a vida completa.`);
    }
  }

  return legacyReturn;
};

// ------------------------------------------------------------
// Movimiento del Muñeco tras el turno de Hougan
// ------------------------------------------------------------
//
// Se conserva la fase base del juego:
// - después del turno de Hougan, si su Muñeco está vivo, obtiene 3 PM;
// - puede dividir esos 3 PM;
// - el jugador puede finalizar el movimiento manualmente;
// - esto funciona aunque el Muñeco esté INACTIVO por no coincidir el Vínculo.
//
// Danza Vudú (Bloque 2) se montará SOBRE esta misma fase de movimiento:
// mientras Danza esté activa, cada paso del Muñeco intentará ser copiado
// por el personaje Vinculado.
//
// ------------------------------------------------------------
// Texto del objeto / estado activo
// ------------------------------------------------------------

const _houganBaseObjectDescription=objectDescription;
objectDescription=function(z){
  if(z?.type!=='doll')return _houganBaseObjectDescription(z);

  const target=getEntity(z.linkedTargetId);
  const active=dollAssociationActive(z);
  const mode=z.linkMode==='ally'?'aliado':'enemigo';
  const effect=z.linkMode==='ally'
    ?'cura al asociado el 50% de los PV reales que pierde'
    :'inflige al asociado el 50% de los PV reales que pierde';

  return `Muñeco ${mode}: ${z.maxHp} PV · 3 PM. Asociado a ${target?.name||'objetivo ausente'}. ${active?'ACTIVO':'INACTIVO'}: ${active?effect:'el Vínculo actual ya no coincide con su asociación'}.`;
};

// ------------------------------------------------------------
// Alcance / validación
// ------------------------------------------------------------

const _houganBaseAbilityRangeState=abilityRangeState;
abilityRangeState=function(u,id,x,y){
  if(isHougan(u)&&id==='houganDoll'){
    const pos={x,y};
    if(!inRange(u,pos,3))return null;
    return {inside:true,blocked:!clearLOS(u,pos)};
  }

  if(!isHougan(u)||!HOUGAN_SKILLS.has(id)){
    return _houganBaseAbilityRangeState(u,id,x,y);
  }

  const target=entityAt(x,y),pos={x,y};

  if(id==='needle'){
    if(!inRange(u,pos,4))return null;
    return {inside:true,blocked:!clearLOS(u,pos)};
  }

  if(id==='transfer'){
    if(!inRange(u,pos,3))return null;
    return {inside:true,blocked:!clearLOS(u,pos)};
  }

  if(id==='ritual'){
    if(!inRange(u,pos,4))return null;
    return {inside:true,blocked:!clearLOS(u,pos)};
  }

  if(id==='curse'){
    if(!inRange(u,pos,3))return null;
    return {inside:true,blocked:false};
  }

  return _houganBaseAbilityRangeState(u,id,x,y);
};

const _houganBaseCanUseAbility=canUseAbility;
canUseAbility=function(u,id,x,y){
  if(!isHougan(u)||!HOUGAN_SKILLS.has(id)){
    return _houganBaseCanUseAbility(u,id,x,y);
  }

  const a=ability(HOUGAN_ID,id);
  if(!a||!u.loadout.includes(id)||u.pa<a.cost||B.busy||!skillUseAllowed(u,id))return false;
  const target=entityAt(x,y);

  if(id==='needle'){
    return !!(
      target?.alive&&target.kind==='unit'&&target.id!==u.id&&
      inRange(u,target,4)&&clearLOS(u,target)
    );
  }

  if(id==='transfer'){
    return !!(
      target?.alive&&target.type==='doll'&&target.ownerId===u.id&&
      u.hp<u.maxHp&&inRange(u,target,3)&&clearLOS(u,target)
    );
  }

  if(id==='ritual'){
    const current=linked(u);
    return !!(
      current?.alive&&current.side!==u.side&&
      target?.id===current.id&&
      inRange(u,current,4)&&clearLOS(u,current)
    );
  }

  if(id==='curse'){
    return !!(
      target?.alive&&target.kind==='unit'&&target.side!==u.side&&
      inRange(u,target,3)
    );
  }

  return false;
};

const _houganBaseInvalidReason=invalidAbilityReason;
invalidAbilityReason=function(u,id,x,y){
  if(isHougan(u)&&id==='houganDoll'){
    if(!linked(u))return 'Muñeco Vudú requiere un personaje Vinculado.';
    if(u.pa<2)return 'PA insuficientes.';
    if(!free(x,y))return 'Elegí una casilla libre.';
    if(!inRange(u,{x,y},3))return 'Fuera de alcance.';
    if(!clearLOS(u,{x,y}))return 'Sin línea de visión hacia la casilla.';
    return 'Casilla no válida.';
  }

  if(!isHougan(u)||!HOUGAN_SKILLS.has(id)){
    return _houganBaseInvalidReason(u,id,x,y);
  }

  const a=ability(HOUGAN_ID,id),target=entityAt(x,y);
  if(!a)return 'Habilidad no disponible.';
  if(u.pa<a.cost)return 'PA insuficientes.';
  if(!skillUseAllowed(u,id))return `${a.name}: límite de usos por turno alcanzado.`;

  if(id==='needle'){
    if(!target||target.kind!=='unit'||target.id===u.id)return 'Elegí un aliado o enemigo distinto de Hougan.';
    if(!inRange(u,target,4))return 'Fuera de alcance.';
    if(!clearLOS(u,target))return 'Sin línea de visión.';
  }

  if(id==='transfer'){
    if(u.hp>=u.maxHp)return 'Hougan está a vida completa.';
    if(!target||target.type!=='doll'||target.ownerId!==u.id)return 'Elegí tu Muñeco Vudú.';
    if(!inRange(u,target,3))return 'Fuera de alcance.';
    if(!clearLOS(u,target))return 'Sin línea de visión.';
  }

  if(id==='ritual'){
    const current=linked(u);
    if(!current||current.side===u.side)return 'Ritual del Dolor requiere un enemigo Vinculado.';
    if(target?.id!==current.id)return 'Elegí al enemigo actualmente Vinculado.';
    if(!inRange(u,current,4))return 'Fuera de alcance.';
    if(!clearLOS(u,current))return 'Sin línea de visión.';
  }

  if(id==='curse'){
    if(!target||target.kind!=='unit'||target.side===u.side)return 'Elegí un enemigo.';
    if(!inRange(u,target,3))return 'Fuera de alcance.';
  }

  return 'Objetivo no válido.';
};

const _houganBaseValidTargetTile=validTargetTile;
validTargetTile=function(x,y,action){
  const u=cur();
  if(isHougan(u)&&action==='houganDoll')return dollPlacementValid(u,x,y);
  return _houganBaseValidTargetTile(x,y,action);
};

const _houganBaseActionInfo=actionInfo;
actionInfo=function(id){
  const u=cur();
  if(isHougan(u)&&id==='houganDoll'){
    return {
      name:'Muñeco Vudú',cost:'2 PA',
      text:'Requiere un personaje Vinculado. Crea un Muñeco asociado a ese personaje. Enemigo: 16 PV. Aliado: 20 PV. Ambos tienen 3 PM. Crear uno nuevo reemplaza al anterior. Si cambia el Vínculo, el Muñeco permanece pero queda inactivo.',
      target:'Casilla libre',range:'Alcance 3 + LOS'
    };
  }
  return _houganBaseActionInfo(id);
};

// ------------------------------------------------------------
// Ejecución de las 4 habilidades del bloque
// ------------------------------------------------------------

async function beginHouganSkill(u,id,x,y){
  if(!canUseAbility(u,id,x,y))return null;
  const a=ability(HOUGAN_ID,id),target=entityAt(x,y);

  B.busy=true;
  B.noticeSeq++;
  B.notice=`${u.icon} ${u.name} — ${a.icon} ${a.name}`;
  if(target)faceTarget(u,target);
  registerSkillUse(u,id);
  u.pa-=a.cost;
  triggerPoisonOnAbility(u);
  renderBattle();
  await sleep(130);

  if(!u.alive){
    B.notice='';B.selectedAction=null;B.busy=false;
    renderBattle();checkBattleEnd();
    return {aborted:true};
  }
  return {a,target};
}

async function finishHouganSkill(u){
  spendPAAfterAction(u);
  B.notice='';
  B.selectedAction=null;
  B.busy=false;
  renderBattle();

  if(checkBattleEnd())return true;
  if(B.pendingTimeout&&!B.ended)nextTurn();
  return true;
}

const _houganBaseExecuteAbility=executeAbility;
executeAbility=async function(u,id,x,y,fromAI=false){
  if(!isHougan(u)||!HOUGAN_SKILLS.has(id)){
    return _houganBaseExecuteAbility(u,id,x,y,fromAI);
  }

  const ctx=await beginHouganSkill(u,id,x,y);
  if(!ctx)return false;
  if(ctx.aborted)return true;

  const {target}=ctx;

  if(id==='needle'){
    if(target.side===u.side){
      const got=heal(target,6);
      setLinkedTarget(u,target);
      log(`🪡 Aguja Vudú: ${target.name} recupera ${got} PV y queda Vinculado a ${u.name}.`);
    }else{
      applyDamage(target,6,false);
      if(target.alive){
        setLinkedTarget(u,target);
        log(`🪡 Aguja Vudú: ${target.name} recibe 6 daño y queda Vinculado a ${u.name}.`);
      }else{
        log(`🪡 Aguja Vudú: ${target.name} recibe 6 daño.`);
      }
    }
  }

  else if(id==='transfer'){
    const missing=Math.max(0,u.maxHp-u.hp);
    const requested=Math.min(8,missing);
    const got=heal(u,requested);
    if(got>0){
      applyDamage(target,got,false);
      log(`🔄 Transferencia: ${u.name} recupera ${got} PV y ${target.name} pierde ${got} de daño solicitado.`);
    }
  }

  else if(id==='ritual'){
    const d=correspondingDoll(u,target);
    const bonus=!!(d?.alive&&adjCardinal(d,target));
    const dmg=bonus?20:14;

    applyDamage(target,dmg,false);
    log(`👁️ Ritual del Dolor: ${target.name} recibe ${dmg} daño${bonus?' por resonancia cardinal del Muñeco correspondiente':''}.`);

    clearLinkedTarget(u);
    log(`🔗 El Vínculo de ${u.name} se consume. El Muñeco permanece en tablero pero queda inactivo.`);
  }

  else if(id==='curse'){
    applyDamage(target,8,false);
    log(`☠️ Maldición: ${target.name} recibe 8 daño.`);
    if(target.alive){
      addStatus(target,'poison',1);
      feedback(target,'☠️ +1','status');
      log(`☠️ ${target.name} obtiene Veneno ${target.status.poison}.`);
    }
  }

  renderBattle();
  await sleep(150);
  return finishHouganSkill(u);
};

// ------------------------------------------------------------
// Interacción humana + acción propia
// ------------------------------------------------------------

const _houganBaseBattleTap=battleTap;
battleTap=async function(e){
  if(!B||B.ended||B.busy||cur()?.controller!=='human'){
    return _houganBaseBattleTap(e);
  }

  const tile=e.target.closest('.tile');
  if(!tile)return _houganBaseBattleTap(e);

  const x=+tile.dataset.x,y=+tile.dataset.y,u=cur();
  if(!isHougan(u))return _houganBaseBattleTap(e);

  if(B.selectedAction==='houganDoll'){
    if(!executeDollAction(u,x,y)){
      showNotice(invalidAbilityReason(u,'houganDoll',x,y));
    }
    return;
  }

  return _houganBaseBattleTap(e);
};

const _houganBaseRenderBattle=renderBattle;
renderBattle=function(...args){
  const out=_houganBaseRenderBattle(...args);

  if(!B||B.ended)return out;
  const u=cur?.();
  if(!isHougan(u)||u.controller!=='human'||B.dollPhase)return out;

  let holder=document.querySelector('.special-actions');
  if(!holder){
    const drawer=document.querySelector('.skill-drawer');
    if(drawer){
      holder=document.createElement('div');
      holder.className='special-actions';
      drawer.insertAdjacentElement('afterend',holder);
    }
  }
  if(!holder)return out;

  const current=linked(u);
  const d=dollFor(u);
  const disabled=!dollActionAvailable(u);

  holder.innerHTML=`
    <button data-hougan-own="houganDoll"
      class="${B.selectedAction==='houganDoll'?'active-action':''}"
      ${disabled?'disabled':''}>
      Muñeco Vudú · 2 PA
      <small>${current?`Vínculo: ${current.name}`:'Requiere Vínculo'}${d?.alive?` · reemplaza Muñeco actual`:''}</small>
    </button>
  `;

  holder.querySelector('[data-hougan-own="houganDoll"]')?.addEventListener('click',ev=>{
    ev.stopPropagation();
    selectDollAction();
  });

  const help=document.querySelector('.combat-help');
  if(help&&d?.alive){
    const target=getEntity(d.linkedTargetId);
    help.textContent=`🪆 Muñeco ${d.linkMode==='ally'?'aliado':'enemigo'} asociado a ${target?.name||'objetivo ausente'} · ${dollAssociationActive(d)?'ACTIVO':'INACTIVO'}.`;
  }

  return out;
};

globalThis.LDMHougan0631={
  definition:HOUGAN_DEF,
  linked,
  dollFor,
  dollAssociationActive,
  correspondingDoll,
  dollActionAvailable,
  dollPlacementValid,
  executeDollAction,
  createHouganDoll
};

})();