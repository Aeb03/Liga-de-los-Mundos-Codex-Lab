(()=>{'use strict';

/*
  Liga de los Mundos — v0.6.30-v02
  REWORK KORGAN — bloque aislado

  - Trampas invisibles para el rival, visibles semitransparentes para el propio equipo.
  - Máximo 3 activas.
  - Desarmar Trampa = acción propia 0 PA, 1/turno, +1 PA.
  - Granada usa preview AoE global.
  - Gancho permite elegir atracción 1 o 2 sin cartel modal.
*/

const KORGAN_ID='korgan';
const KORGAN_SKILLS=new Set(['trap_spikes','trap_mine','grenade','shot','hook','hunterstep']);
const KORGAN_OWN_ACTIONS=new Set(['korganDisarm']);

const KORGAN_DEF={
  hp:100,pa:6,pm:4,ini:4,
  passive:{
    name:'Preparación Oculta',
    text:'Korgan puede mantener hasta 3 trampas activas. Sus trampas son invisibles para el equipo rival y semitransparentes para su propio equipo. Se activan cuando un enemigo entra en su casilla mediante cualquier tipo de desplazamiento, se revelan al activarse y luego se consumen.'
  },
  abilities:[
    {
      id:'trap_spikes',icon:'🪤',name:'Trampa de Pinchos',
      cost:2,range:3,maxUsesPerTurn:2,
      text:'Coloca una trampa invisible a alcance 3. Máximo 2 colocaciones por turno y máximo 3 trampas activas. Al activarse: 10 de daño + Herida 1. Se consume.'
    },
    {
      id:'trap_mine',icon:'⚡',name:'Mina Eléctrica',
      cost:3,range:3,maxUsesPerTurn:1,
      text:'Coloca una mina invisible a alcance 3. Máximo 1 colocación por turno y máximo 3 trampas activas. Al activarse: 8 de daño y el combatiente pierde 1 PA en su próximo turno. Se consume.'
    },
    {
      id:'grenade',icon:'💣',name:'Granada',
      cost:3,range:3,aoePreview:{pattern:'cross1'},
      text:'Elegí una casilla, incluso vacía, a alcance 3 con línea de visión. Área en cruz: centro 10 de daño sin empuje; las 4 cardinales reciben 6 de daño y, si son combatientes, empuje 1 hacia afuera. El área se previsualiza antes de lanzar.'
    },
    {
      id:'shot',icon:'🏹',name:'Disparo de Caza',
      cost:3,range:5,damage:10,
      text:'10 de daño. Alcance 5, sólo en la misma fila o columna que Korgan. Requiere línea de visión.'
    },
    {
      id:'hook',icon:'🪝',name:'Gancho',
      cost:3,range:3,damage:6,
      text:'6 de daño a un combatiente enemigo a alcance 3 con línea de visión. Korgan elige atraerlo 1 o 2 casillas, paso a paso. Herida y trampas se activan normalmente durante la atracción.'
    },
    {
      id:'hunterstep',icon:'🏃',name:'Paso del Cazador',
      cost:1,range:2,maxUsesPerTurn:1,noLOS:true,
      text:'Korgan se desplaza 1 o 2 casillas en línea sin gastar PM. El recorrido debe estar libre. Herida y trampas se resuelven por cada casilla recorrida. Máximo 1 uso por turno.'
    }
  ]
};

function installKorganDefinition(){
  const c=CHAMPIONS?.[KORGAN_ID];
  if(!c)return false;
  c.hp=KORGAN_DEF.hp;c.pa=KORGAN_DEF.pa;c.pm=KORGAN_DEF.pm;c.ini=KORGAN_DEF.ini;
  c.passive={...KORGAN_DEF.passive};
  c.abilities=KORGAN_DEF.abilities.map(a=>({...a}));
  BOT_LOADOUTS.korgan=['trap_spikes','trap_mine','shot','hook'];
  return true;
}
installKorganDefinition();

function isKorgan(u){return !!u&&u.championId===KORGAN_ID}
function korganTurnSerial(u){return Math.max(0,u?.korganTurnSerial||0)}
function activeOwnTraps(u){return (B?.traps||[]).filter(t=>t.active&&t.ownerId===u.id)}
function trapCapAvailable(u){return activeOwnTraps(u).length<3}

function ownActiveTrapAt(u,x,y){
  return activeOwnTraps(u).find(t=>t.x===x&&t.y===y)||null;
}
function trapPlacementValid(u,x,y){
  if(!isKorgan(u)||!u.alive||B?.busy||!trapCapAvailable(u))return false;
  const pos={x,y};

  // Una misma casilla no puede acumular dos trampas de Korgan.
  // Se consulta sólo su propia red para no filtrar trampas enemigas ocultas.
  if(ownActiveTrapAt(u,x,y))return false;

  return free(x,y)&&inRange(u,pos,3)&&clearLOS(u,pos);
}

function createKorganTrap(u,id,x,y){
  const trapType=id==='trap_spikes'?'spikes':'mine';
  const icon=trapType==='spikes'?'🪤':'⚡';
  const trap={
    id:`trap${B.nextTrapId++}`,
    trapType,icon,x,y,ownerId:u.id,side:u.side,active:true,
    hidden:true,createdByKorganTurn:korganTurnSerial(u)
  };
  B.traps.push(trap);
  return trap;
}

function trapPlacementLog(u,a){
  const human=humanUnit?.();
  if(human&&u.side!==human.side){
    log(`🕶️ ${u.name} prepara una trampa.`);
  }else{
    log(`${a.icon} ${u.name} coloca ${a.name}.`);
  }
}

function ownTrapAt(u,x,y){
  return (B?.traps||[]).find(t=>t.active&&t.ownerId===u.id&&t.x===x&&t.y===y)||null;
}

function disarmAvailable(u){
  return !!(isKorgan(u)&&u.alive&&!u.korganDisarmUsedThisTurn&&activeOwnTraps(u).length>0);
}
function disarmValid(u,x,y){
  return !!(disarmAvailable(u)&&ownTrapAt(u,x,y));
}
function selectDisarm(){
  const u=cur();
  if(!isKorgan(u)||u.controller!=='human'||B.busy||!disarmAvailable(u))return;
  B.selectedAction=B.selectedAction==='korganDisarm'?null:'korganDisarm';
  B.skillsOpen=false;
  B.korganHookTargetId=null;
  globalThis.LDMCombatCore?.aoe?.clear?.();
  renderBattle();
}
function executeDisarm(u,x,y){
  if(!disarmValid(u,x,y))return false;
  const trap=ownTrapAt(u,x,y);
  trap.active=false;
  u.korganDisarmUsedThisTurn=true;
  u.pa+=1;
  B.selectedAction=null;
  feedback(u,'+1 PA','pa');
  log(`🛠️ ${u.name} desarma una trampa propia y obtiene +1 PA.`);
  renderBattle();
  return true;
}

// ------------------------------------------------------------
// Trampas: visibilidad y activación
// ------------------------------------------------------------

const _korganBaseIsoTrapMarkup=isoTrapMarkup;
isoTrapMarkup=function(trap,x,y){
  const human=humanUnit?.();

  // El rival no recibe ninguna pista visual de la ubicación.
  if(trap?.hidden&&human&&trap.side!==human.side)return '';

  let html=_korganBaseIsoTrapMarkup(trap,x,y);

  // Para el propio equipo, conservar la pieza pero marcarla semitransparente.
  if(trap?.hidden&&human&&trap.side===human.side){
    html=html.replace('aria-hidden="true"','data-korgan-friendly-trap="1" aria-hidden="true"');
  }
  return html;
};

triggerTrapAt=async function(target){
  const trap=(B?.traps||[]).find(t=>
    t.active&&t.side!==target.side&&t.x===target.x&&t.y===target.y
  );
  if(!trap)return false;

  trap.active=false;

  if(trap.trapType==='spikes'){
    applyDamage(target,10,false);
    if(target.alive&&target.kind==='unit')addStatus(target,'wound',1);
    log(`🪤 Trampa de Pinchos revelada: ${target.name} recibe 10 daño${target.kind==='unit'?' + Herida 1':''}.`);
  }

  if(trap.trapType==='mine'){
    applyDamage(target,8,false);
    if(target.alive&&target.kind==='unit'){
      target.status.paPenaltyNext=Math.max(target.status.paPenaltyNext||0,1);
      feedback(target,'PA -1 próximo','status');
    }
    log(`⚡ Mina Eléctrica revelada: ${target.name} recibe 8 daño${target.kind==='unit'?' y -1 PA en su próximo turno':''}.`);
  }

  renderBattle();
  await sleep(180);
  return true;
};

// ------------------------------------------------------------
// Geometría de habilidades
// ------------------------------------------------------------

function grenadeCells(x,y){
  return [
    {x,y,zone:'center'},
    {x:x+1,y,zone:'arm'},
    {x:x-1,y,zone:'arm'},
    {x,y:y+1,zone:'arm'},
    {x,y:y-1,zone:'arm'}
  ].filter(c=>inside(c.x,c.y));
}

function shotLineValid(u,target){
  return !!(
    target?.alive&&target.side!==u.side&&
    (target.x===u.x||target.y===u.y)&&
    md(u,target)>=1&&md(u,target)<=5&&
    clearLOS(u,target)
  );
}

function hookTargetValid(u,target){
  return !!(
    target?.alive&&target.kind==='unit'&&target.side!==u.side&&
    md(u,target)>=1&&md(u,target)<=3&&
    clearLOS(u,target)
  );
}

function hunterStepValid(u,x,y){
  return isKorgan(u)&&straightDashValidFrom(u,x,y,2);
}

function simulateHookPath(u,target,distance){
  let x=target.x,y=target.y;
  const out=[];
  for(let i=0;i<distance;i++){
    const dx=u.x-x,dy=u.y-y;
    let sx=0,sy=0;
    if(Math.abs(dx)>=Math.abs(dy)&&dx!==0)sx=Math.sign(dx);
    else if(dy!==0)sy=Math.sign(dy);
    else if(dx!==0)sx=Math.sign(dx);

    const nx=x+sx,ny=y+sy;
    if(!inside(nx,ny)||isFixedObstacle(nx,ny)||entityAt(nx,ny))break;
    x=nx;y=ny;out.push({x,y});
  }
  return out;
}

function bestHookDistance(u,target){
  let best=1,bestScore=-1e9;
  for(const dist of [1,2]){
    const path=simulateHookPath(u,target,dist);
    const end=path[path.length-1]||target;
    let score=path.length*2;

    for(const p of path){
      if(activeOwnTraps(u).some(t=>t.x===p.x&&t.y===p.y))score+=14;
    }

    // Korgan es híbrido de rango/control: acercar demasiado al enemigo sin
    // ventaja de trampa es ligeramente peor.
    if(md(u,end)===1&&!path.some(p=>activeOwnTraps(u).some(t=>t.x===p.x&&t.y===p.y)))score-=2;

    if(score>bestScore){bestScore=score;best=dist}
  }
  return best;
}

// ------------------------------------------------------------
// Turno / estado Korgan
// ------------------------------------------------------------

const _korganBaseMakeUnit=makeUnit;
makeUnit=function(...args){
  const u=_korganBaseMakeUnit(...args);
  if(isKorgan(u)){
    u.korganTurnSerial=0;
    u.korganDisarmUsedThisTurn=false;
  }
  return u;
};

const _korganBaseBeginTurn=beginTurn;
beginTurn=function(){
  const u=cur?.();
  if(isKorgan(u)){
    u.korganTurnSerial=(u.korganTurnSerial||0)+1;
    u.korganDisarmUsedThisTurn=false;
    B.korganHookTargetId=null;
    B.korganHookDistanceContext=null;
  }
  return _korganBaseBeginTurn();
};

// ------------------------------------------------------------
// Alcance / validación
// ------------------------------------------------------------

const _korganBaseAbilityRangeState=abilityRangeState;
abilityRangeState=function(u,id,x,y){
  if(!isKorgan(u))return _korganBaseAbilityRangeState(u,id,x,y);

  const target=entityAt(x,y),pos={x,y};

  if(id==='trap_spikes'||id==='trap_mine'){
    if(!inRange(u,pos,3))return null;
    return {inside:true,blocked:!clearLOS(u,pos)};
  }

  if(id==='grenade'){
    if(!inRange(u,pos,3))return null;
    return {inside:true,blocked:!clearLOS(u,pos)};
  }

  if(id==='shot'){
    // El amarillo muestra TODO el corredor válido aunque la casilla esté vacía.
    if(x===u.x&&y===u.y)return null;
    if(!(x===u.x||y===u.y))return null;
    if(!inRange(u,pos,5))return null;
    return {inside:true,blocked:!clearLOS(u,pos)};
  }

  if(id==='hook'){
    // El amarillo muestra todo el alcance 3; el borde de objetivo sólo aparece
    // sobre combatientes enemigos realmente seleccionables.
    if(x===u.x&&y===u.y)return null;
    if(!inRange(u,pos,3))return null;
    return {inside:true,blocked:!clearLOS(u,pos)};
  }

  if(id==='hunterstep'){
    return hunterStepValid(u,x,y)?{inside:true,blocked:false}:null;
  }

  return _korganBaseAbilityRangeState(u,id,x,y);
};

const _korganBaseCanUseAbility=canUseAbility;
canUseAbility=function(u,id,x,y){
  if(!isKorgan(u)||!KORGAN_SKILLS.has(id))return _korganBaseCanUseAbility(u,id,x,y);

  const a=ability(KORGAN_ID,id);
  if(!a||!u.loadout.includes(id)||u.pa<a.cost||B.busy||!skillUseAllowed(u,id))return false;
  const target=entityAt(x,y),pos={x,y};

  if(id==='trap_spikes'||id==='trap_mine'){
    return trapPlacementValid(u,x,y);
  }

  if(id==='grenade'){
    return inRange(u,pos,3)&&clearLOS(u,pos);
  }

  if(id==='shot'){
    return shotLineValid(u,target);
  }

  if(id==='hook'){
    return hookTargetValid(u,target);
  }

  if(id==='hunterstep'){
    return hunterStepValid(u,x,y);
  }

  return false;
};

const _korganBaseInvalidReason=invalidAbilityReason;
invalidAbilityReason=function(u,id,x,y){
  if(!isKorgan(u)||!KORGAN_SKILLS.has(id))return _korganBaseInvalidReason(u,id,x,y);

  const a=ability(KORGAN_ID,id),target=entityAt(x,y),pos={x,y};
  if(!a)return 'Habilidad no disponible.';
  if(u.pa<a.cost)return 'PA insuficientes.';
  if(!skillUseAllowed(u,id))return `${a.name}: límite de usos por turno alcanzado.`;

  if(id==='trap_spikes'||id==='trap_mine'){
    if(!trapCapAvailable(u))return 'Korgan ya tiene 3 trampas activas.';
    if(ownActiveTrapAt(u,x,y))return 'Ya hay una trampa propia activa en esa casilla.';
    if(!free(x,y))return 'La trampa necesita una casilla libre.';
    if(!inRange(u,pos,3))return 'Fuera de alcance.';
    if(!clearLOS(u,pos))return 'Sin línea de visión hacia la casilla de colocación.';
  }

  if(id==='grenade'){
    if(!inRange(u,pos,3))return 'Fuera de alcance.';
    if(!clearLOS(u,pos))return 'Sin línea de visión hacia la casilla central.';
  }

  if(id==='shot'){
    if(!damageableEnemy(u,target))return 'Elegí una entidad enemiga.';
    if(!(target.x===u.x||target.y===u.y))return 'Disparo de Caza sólo funciona en la misma fila o columna.';
    if(md(u,target)>5)return 'Fuera de alcance.';
    if(!clearLOS(u,target))return 'Sin línea de visión.';
  }

  if(id==='hook'){
    if(!hookTargetValid(u,target)){
      if(!target||target.kind!=='unit'||target.side===u.side)return 'Gancho requiere un combatiente enemigo.';
      if(md(u,target)>3)return 'Fuera de alcance.';
      if(!clearLOS(u,target))return 'Sin línea de visión.';
    }
  }

  if(id==='hunterstep'){
    return hunterStepValid(u,x,y)
      ?''
      :'Elegí una casilla libre a 1 o 2 casillas en línea con el recorrido despejado.';
  }

  return 'Objetivo no válido.';
};

const _korganBaseValidTargetTile=validTargetTile;
validTargetTile=function(x,y,action){
  const u=cur();
  if(isKorgan(u)&&action==='korganDisarm')return disarmValid(u,x,y);
  return _korganBaseValidTargetTile(x,y,action);
};

const _korganBaseActionInfo=actionInfo;
actionInfo=function(id){
  const u=cur();
  if(isKorgan(u)&&id==='korganDisarm'){
    return {
      name:'Desarmar Trampa',cost:'0 PA',
      text:'Retira una trampa propia activa y obtiene +1 PA. Máximo 1 vez por turno. Puede desarmar incluso una trampa colocada este mismo turno.',
      target:'Trampa propia',range:'Cualquier trampa propia activa'
    };
  }
  return _korganBaseActionInfo(id);
};

// ------------------------------------------------------------
// Ejecución
// ------------------------------------------------------------

async function beginKorganSkill(u,id,x,y){
  if(!canUseAbility(u,id,x,y))return null;
  const a=ability(KORGAN_ID,id),target=entityAt(x,y);

  B.busy=true;B.noticeSeq++;B.notice=`${u.icon} ${u.name} — ${a.icon} ${a.name}`;
  if(target)faceTarget(u,target);
  registerSkillUse(u,id);
  u.pa-=a.cost;
  triggerPoisonOnAbility(u);
  renderBattle();
  await sleep(130);

  if(!u.alive){
    B.notice='';B.selectedAction=null;B.busy=false;renderBattle();checkBattleEnd();
    return {aborted:true};
  }
  return {a,target};
}

async function finishKorganSkill(u,a){
  if((a?.cost||0)>0)spendPAAfterAction(u);
  B.notice='';
  B.selectedAction=null;
  B.busy=false;
  B.korganHookTargetId=null;
  B.korganHookDistanceContext=null;
  renderBattle();

  if(checkBattleEnd())return true;
  if(B.pendingTimeout&&!B.ended)nextTurn();
  return true;
}

async function executeHookChosen(u,target,distance,fromAI=false){
  if(!hookTargetValid(u,target))return false;
  B.korganHookDistanceContext=Math.max(1,Math.min(2,distance||1));
  return await executeAbility(u,'hook',target.x,target.y,fromAI);
}

const _korganBaseExecuteAbility=executeAbility;
executeAbility=async function(u,id,x,y,fromAI=false){
  if(!isKorgan(u)||!KORGAN_SKILLS.has(id)){
    return _korganBaseExecuteAbility(u,id,x,y,fromAI);
  }

  const ctx=await beginKorganSkill(u,id,x,y);
  if(!ctx)return false;
  if(ctx.aborted)return true;

  const {a,target}=ctx;

  if(id==='trap_spikes'||id==='trap_mine'){
    createKorganTrap(u,id,x,y);
    trapPlacementLog(u,a);
  }

  else if(id==='grenade'){
    const center={x,y};
    const cells=grenadeCells(x,y);
    const victims=allEntities().filter(z=>
      z.alive&&z.side!==u.side&&cells.some(c=>c.x===z.x&&c.y===z.y)
    );

    // Resolver primero el daño de toda el área; después los empujes laterales.
    for(const z of victims){
      const c=cells.find(c=>c.x===z.x&&c.y===z.y);
      const dmg=c.zone==='center'?10:6;
      applyDamage(z,dmg,false);
      log(`💣 Granada (${c.zone==='center'?'centro':'lateral'}): ${z.name} recibe ${dmg} daño.`);
    }

    renderBattle();await sleep(150);

    for(const z of victims){
      if(!z.alive||z.kind!=='unit')continue;
      const c=cells.find(c=>c.x===z.x&&c.y===z.y);
      if(c?.zone!=='arm')continue;
      await forcedMove(z,center,1,true,'Granada');
      if(checkBattleEnd())break;
    }
  }

  else if(id==='shot'){
    applyDamage(target,10,false);
    log(`🏹 Disparo de Caza: ${target.name} recibe 10 daño.`);
  }

  else if(id==='hook'){
    const dist=fromAI
      ?bestHookDistance(u,target)
      :Math.max(1,Math.min(2,B.korganHookDistanceContext||1));

    applyDamage(target,6,false);
    log(`🪝 Gancho: ${target.name} recibe 6 daño y Korgan intenta atraerlo ${dist} casilla${dist!==1?'s':''}.`);

    if(target.alive){
      await forcedMove(target,u,dist,false,'Gancho');
    }
  }

  else if(id==='hunterstep'){
    await dashUnit(u,x,y);
    log(`🏃 Paso del Cazador: ${u.name} se desplaza sin gastar PM.`);
  }

  renderBattle();
  await sleep(150);
  return finishKorganSkill(u,a);
};

// ------------------------------------------------------------
// Interacción humana: Desarmar + Gancho 1/2
// ------------------------------------------------------------

const _korganBaseBattleTap=battleTap;
battleTap=async function(e){
  if(!B||B.ended||B.busy||cur()?.controller!=='human')return _korganBaseBattleTap(e);

  const tile=e.target.closest('.tile');
  if(!tile)return _korganBaseBattleTap(e);

  const x=+tile.dataset.x,y=+tile.dataset.y,z=entityAt(x,y),u=cur();
  if(!isKorgan(u))return _korganBaseBattleTap(e);

  if(B.selectedAction==='korganDisarm'){
    if(!executeDisarm(u,x,y))showNotice('Elegí una trampa propia activa.');
    return;
  }

  if(B.selectedAction==='hook'){
    if(!hookTargetValid(u,z)){
      showNotice(invalidAbilityReason(u,'hook',x,y));
      return;
    }

    B.korganHookTargetId=z.id;
    renderBattle();
    showNotice('🪝 Objetivo fijado. Elegí atraer 1 o 2 casillas.',1000);
    return;
  }

  return _korganBaseBattleTap(e);
};

const _korganBaseRenderBattle=renderBattle;
renderBattle=function(...args){
  const u=cur?.();
  if(!isKorgan(u)||B?.selectedAction!=='hook')B.korganHookTargetId=null;

  const out=_korganBaseRenderBattle(...args);

  if(!B||B.ended||!isKorgan(u)||u.controller!=='human'||B.dollPhase)return out;

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

  const disarmDisabled=!disarmAvailable(u);
  const hookTarget=getEntity(B.korganHookTargetId);

  holder.innerHTML=`
    <button data-korgan-own="korganDisarm"
      class="${B.selectedAction==='korganDisarm'?'active-action':''}"
      ${disarmDisabled?'disabled':''}>
      Desarmar Trampa · 0 PA
      <small>${u.korganDisarmUsedThisTurn?'Usado este turno':'1/turno · +1 PA'}</small>
    </button>
    ${hookTarget?.alive?`
      <button data-hook-distance="1">Atraer 1 <small>${hookTarget.name}</small></button>
      <button data-hook-distance="2">Atraer 2 <small>${hookTarget.name}</small></button>
    `:''}
  `;

  holder.querySelector('[data-korgan-own="korganDisarm"]')?.addEventListener('click',ev=>{
    ev.stopPropagation();selectDisarm();
  });

  holder.querySelectorAll('[data-hook-distance]').forEach(btn=>{
    btn.addEventListener('click',async ev=>{
      ev.stopPropagation();
      const live=getEntity(B.korganHookTargetId);
      if(!live?.alive)return;
      const d=Number(btn.dataset.hookDistance)||1;
      await executeHookChosen(u,live,d,false);
    });
  });

  const help=document.querySelector('.combat-help');
  if(help&&hookTarget?.alive){
    help.textContent=`Gancho: ${hookTarget.name} seleccionado. Elegí Atraer 1 o Atraer 2.`;
  }

  return out;
};

// Cambiar de habilidad cancela la selección intermedia del Gancho.
document.addEventListener('click',e=>{
  const b=e.target.closest?.('[data-skill]');
  if(!b||!B)return;
  if(b.dataset.skill!=='hook'){
    B.korganHookTargetId=null;
    B.korganHookDistanceContext=null;
  }
},true);

// ------------------------------------------------------------
// API para IA
// ------------------------------------------------------------

function trapPlacementScore(u,id,x,y,focus=null){
  if(!trapPlacementValid(u,x,y))return -99;
  const pos={x,y};
  const foes=enemyUnits(u,true);

  let score=3;

  if(focus){
    const d=md(pos,focus);
    if(d===1)score+=10;
    else if(d===2)score+=7;
    else if(d===3)score+=3;
  }

  for(const foe of foes){
    const d=md(pos,foe);
    if(d===1)score+=3;
    if(id==='trap_spikes')score+=Math.min(4,foe.pm||0)*.4;
    if(id==='trap_mine'&&(foe.pa||0)>=4)score+=1.5;
  }

  // Gancho puede convertir una trampa bien colocada en una amenaza inmediata.
  if(u.loadout.includes('hook')&&foes.some(e=>md(pos,e)<=3))score+=3;

  return score;
}

function disarmCandidates(u,focus=null){
  if(!disarmAvailable(u))return [];
  const foes=enemyUnits(u,true);
  return activeOwnTraps(u).map(t=>{
    const nearest=foes.length?Math.min(...foes.map(e=>md(t,e))):99;
    let score=nearest>=6?8:nearest>=5?5:nearest>=4?2:-5;

    // La IA evita colocar y desmontar la misma trampa salvo emergencia de PA.
    if(t.createdByKorganTurn===korganTurnSerial(u))score-=6;

    // Si +1 PA desbloquea una habilidad de coste 3 o 4, sube el valor.
    if(u.pa===2&&u.loadout.some(id=>(ability(KORGAN_ID,id)?.cost||0)===3))score+=5;
    if(u.pa===3&&u.loadout.some(id=>(ability(KORGAN_ID,id)?.cost||0)===4))score+=4;

    if(focus&&md(t,focus)<=2)score-=5;
    return {trap:t,score};
  }).sort((a,b)=>b.score-a.score);
}

globalThis.LDMKorgan0630={
  definition:KORGAN_DEF,
  trapPlacementValid,
  ownActiveTrapAt,
  trapPlacementScore,
  activeOwnTraps,
  disarmAvailable,
  executeDisarm,
  disarmCandidates,
  grenadeCells,
  shotLineValid,
  hookTargetValid,
  bestHookDistance,
  hunterStepValid
};

})();