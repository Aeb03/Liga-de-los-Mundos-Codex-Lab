(()=>{'use strict';

/*
  Liga de los Mundos — v0.6.28-v02
  REWORK PIPLUS — bloque aislado

  - Marcar Objetivo pasa a ser acción propia de 0 PA.
  - 6 habilidades equipables.
  - Misma definición para textos y motor.
  - Impulso es sólo de Piplus, atraviesa obstáculos y termina en casilla válida/libre.
*/

const PIPLUS_ID='piplus';
const PIPLUS_SKILLS=new Set(['precise','vector','impulse','interference','rupture','fixation']);
const PIPLUS_OFFENSIVE=new Set(['precise','vector','interference','rupture']);

const PIPLUS_DEF={
  hp:90,pa:6,pm:3,ini:6,
  passive:{
    name:'Sistema de Marca',
    text:'Piplus puede mantener un único enemigo Marcado. Marcar Objetivo es una acción propia de 0 PA, alcance 4 y línea de visión, máximo 1 vez por turno. Varias habilidades mejoran o sólo pueden usarse contra el Marcado. Ruptura de Marca consume la Marca e impide volver a Marcar durante el resto de ese turno.'
  },
  abilities:[
    {
      id:'precise',icon:'🏹',name:'Flecha de Precisión',
      cost:3,range:4,damage:8,
      text:'8 de daño; 10 si el objetivo está Marcado. Alcance 4. Requiere línea de visión salvo que Fijación de Objetivo esté activa sobre ese Marcado.'
    },
    {
      id:'vector',icon:'🧭',name:'Vector',
      cost:3,range:3,damage:6,
      text:'6 de daño + empuje 1. Si el objetivo está Marcado, empuja 2. Alcance 3. Requiere línea de visión salvo que Fijación de Objetivo esté activa.'
    },
    {
      id:'impulse',icon:'💨',name:'Impulso',
      cost:2,range:2,maxUsesPerTurn:1,noLOS:true,
      text:'Piplus se desplaza 1 o 2 casillas en línea sin gastar PM. Puede atravesar obstáculos, pero debe terminar en una casilla válida y libre. Máximo 1 uso por turno. Si empieza adyacente a un enemigo y se desplaza directamente alejándose de él, primero empuja a ese enemigo 1 casilla en dirección opuesta y luego se mueve.'
    },
    {
      id:'interference',icon:'📡',name:'Interferencia',
      cost:2,range:4,
      text:'Sólo contra el enemigo Marcado. Le aplica -1 PM en su próximo turno. Cada rival puede recibir Interferencia como máximo 1 vez por turno de Piplus. Requiere línea de visión salvo que Fijación de Objetivo esté activa.'
    },
    {
      id:'rupture',icon:'💥',name:'Ruptura de Marca',
      cost:4,range:4,damage:14,
      text:'Sólo contra el enemigo Marcado. Inflige 14 de daño y consume la Marca. Después de usarla, Marcar Objetivo queda bloqueado durante el resto del turno. Requiere línea de visión salvo que Fijación de Objetivo esté activa.'
    },
    {
      id:'fixation',icon:'🔒',name:'Fijación de Objetivo',
      cost:2,range:4,
      text:'Sólo contra el enemigo Marcado. La próxima habilidad ofensiva usada contra ese objetivo durante este turno ignora la línea de visión y luego consume la Fijación. La Marca permanece. Si no se usa, Fijación expira al terminar el turno.'
    }
  ]
};

function installPiplusDefinition(){
  const c=CHAMPIONS?.[PIPLUS_ID];
  if(!c)return false;
  c.hp=PIPLUS_DEF.hp;c.pa=PIPLUS_DEF.pa;c.pm=PIPLUS_DEF.pm;c.ini=PIPLUS_DEF.ini;
  c.passive={...PIPLUS_DEF.passive};
  c.abilities=PIPLUS_DEF.abilities.map(a=>({...a}));
  BOT_LOADOUTS.piplus=['precise','vector','impulse','rupture'];
  return true;
}
installPiplusDefinition();

function isPiplus(u){return !!u&&u.championId===PIPLUS_ID}
function markedByPiplus(u,target){
  return !!(u&&target?.alive&&target.kind==='unit'&&getMarkedTarget(u)?.id===target.id);
}
function markAvailable(u){
  return !!(
    isPiplus(u)&&u.alive&&!u.piplusMarkUsedThisTurn&&!u.piplusMarkBlockedThisTurn
  );
}
function markTargetValid(u,target){
  return !!(
    markAvailable(u)&&
    target?.alive&&target.kind==='unit'&&target.side!==u.side&&
    inRange(u,target,4)&&clearLOS(u,target)
  );
}
function executeMarkTarget(u,target){
  if(!markTargetValid(u,target))return false;
  setMarkedTarget(u,target);
  u.piplusMarkUsedThisTurn=true;
  B.selectedAction=null;
  B.skillsOpen=false;
  log(`🎯 Marcar Objetivo: ${target.name} queda Marcado.`);
  feedback(target,'🎯 MARCADO','status');
  renderBattle();
  return true;
}

function fixationActive(u,target){
  return !!(
    isPiplus(u)&&target?.alive&&
    u.piplusFixationTargetId===target.id&&
    getMarkedTarget(u)?.id===target.id
  );
}
function offensiveIgnoresLOS(u,id,target){
  return !!(PIPLUS_OFFENSIVE.has(id)&&fixationActive(u,target));
}
function consumeFixation(u,id,target){
  if(offensiveIgnoresLOS(u,id,target)){
    u.piplusFixationTargetId=null;
    log(`🔒 Fijación de Objetivo se consume con ${ability(PIPLUS_ID,id)?.name||id}.`);
    return true;
  }
  return false;
}

function interferenceUsedOn(u,target){
  return !!(u?.piplusInterferenceTargets||[]).includes(target?.id);
}

function piplusImpulseDestinationValid(u,x,y){
  if(!isPiplus(u)||u.monolith||!inside(x,y)||!free(x,y))return false;
  const dx=x-u.x,dy=y-u.y;
  const d=Math.abs(dx)+Math.abs(dy);
  if(d<1||d>2)return false;
  if(dx!==0&&dy!==0)return false;
  // Importante: no se revisan casillas intermedias. Impulso puede cruzar obstáculos.
  return true;
}
function impulseAwayEnemy(u,x,y){
  const dx=Math.sign(x-u.x),dy=Math.sign(y-u.y);
  if(!dx&&!dy)return null;
  // El enemigo debe estar exactamente detrás de Piplus respecto del movimiento.
  const enemy=entityAt(u.x-dx,u.y-dy);
  return enemy?.alive&&enemy.kind==='unit'&&enemy.side!==u.side?enemy:null;
}

async function executePiplusImpulse(u,x,y){
  const a=ability(PIPLUS_ID,'impulse');
  if(!a||u.pa<a.cost||!skillUseAllowed(u,'impulse')||!piplusImpulseDestinationValid(u,x,y)||B.busy)return false;

  B.busy=true;
  B.noticeSeq++;
  B.notice=`${u.icon} ${u.name} — ${a.icon} ${a.name}`;
  registerSkillUse(u,'impulse');
  u.pa-=a.cost;
  triggerPoisonOnAbility(u);
  renderBattle();
  await sleep(120);

  if(!u.alive){
    B.notice='';B.selectedAction=null;B.busy=false;renderBattle();checkBattleEnd();
    return true;
  }

  const enemy=impulseAwayEnemy(u,x,y);
  if(enemy){
    log(`💨 Impulso: la descarga empuja a ${enemy.name} 1 casilla antes del desplazamiento.`);
    await forcedMove(enemy,u,1,true,'Impulso');
    if(checkBattleEnd()||!u.alive){
      B.notice='';B.selectedAction=null;B.busy=false;renderBattle();
      return true;
    }
  }

  const start={x:u.x,y:u.y};
  const distance=md(start,{x,y});
  u.x=x;u.y=y;
  faceStep(u,start);

  // Herida global: daño por cada casilla recorrida, aunque Impulso cruce obstáculos.
  for(let i=0;i<distance&&u.alive;i++){
    applyWoundStep(u);
    if(!u.alive)break;
  }

  renderBattle();
  await sleep(150);

  // Impulso cruza casillas intermedias; sólo entra físicamente en la casilla final.
  if(u.alive&&!checkBattleEnd())await triggerTrapAt(u);

  spendPAAfterAction(u);
  B.notice='';
  B.selectedAction=null;
  B.pendingImpulseTargetId=null;
  B.busy=false;
  renderBattle();
  if(checkBattleEnd())return true;
  if(B.pendingTimeout&&!B.ended)nextTurn();
  return true;
}

function piplusOwnActionValid(u,action,x,y){
  if(action!=='piplusMark')return false;
  return markTargetValid(u,entityAt(x,y));
}

function selectPiplusMark(){
  const u=cur();
  if(!isPiplus(u)||u.controller!=='human'||B.busy||!markAvailable(u))return;
  B.selectedAction=B.selectedAction==='piplusMark'?null:'piplusMark';
  B.skillsOpen=false;
  B.pendingImpulseTargetId=null;
  renderBattle();
}

const _piplusBaseMakeUnit=makeUnit;
makeUnit=function(...args){
  const u=_piplusBaseMakeUnit(...args);
  if(isPiplus(u)){
    u.piplusMarkUsedThisTurn=false;
    u.piplusMarkBlockedThisTurn=false;
    u.piplusFixationTargetId=null;
    u.piplusInterferenceTargets=[];
  }
  return u;
};

const _piplusBaseBeginTurn=beginTurn;
beginTurn=function(){
  const u=cur?.();
  if(isPiplus(u)){
    u.piplusMarkUsedThisTurn=false;
    u.piplusMarkBlockedThisTurn=false;
    u.piplusFixationTargetId=null;
    u.piplusInterferenceTargets=[];
    B.pendingImpulseTargetId=null;
  }
  return _piplusBaseBeginTurn();
};

const _piplusBaseEndTurn=endTurnEffects;
endTurnEffects=function(u){
  const out=_piplusBaseEndTurn(u);
  if(isPiplus(u)){
    u.piplusFixationTargetId=null;
    u.piplusInterferenceTargets=[];
  }
  return out;
};

// Compatibilidad: cualquier código viejo que consulte el target de Impulso
// sólo reconoce al propio Piplus.
impulseTargetValid=function(u,target){
  return !!(isPiplus(u)&&target?.id===u.id&&target.alive);
};
impulseDestinationValid=function(u,x,y){
  return piplusImpulseDestinationValid(u,x,y);
};
executeImpulse=async function(u,target,x,y){
  if(!isPiplus(u))return false;
  return await executePiplusImpulse(u,x,y);
};

const _piplusBaseAbilityRangeState=abilityRangeState;
abilityRangeState=function(u,id,x,y){
  if(!isPiplus(u))return _piplusBaseAbilityRangeState(u,id,x,y);
  const target=entityAt(x,y),pos={x,y};

  if(id==='impulse'){
    return piplusImpulseDestinationValid(u,x,y)?{inside:true,blocked:false}:null;
  }

  if(['precise','vector','interference','rupture','fixation'].includes(id)){
    const a=ability(PIPLUS_ID,id);
    if(!inRange(u,pos,a.range))return null;

    if(id==='interference'||id==='rupture'||id==='fixation'){
      if(!markedByPiplus(u,target))return null;
    }

    const blocked=
      id!=='fixation' &&
      !offensiveIgnoresLOS(u,id,target) &&
      !clearLOS(u,pos);

    // Fijación en sí respeta la regla global de LOS.
    const fixationBlocked=id==='fixation'&&!clearLOS(u,pos);
    return {inside:true,blocked:blocked||fixationBlocked};
  }

  return _piplusBaseAbilityRangeState(u,id,x,y);
};

const _piplusBaseCanUseAbility=canUseAbility;
canUseAbility=function(u,id,x,y){
  if(!isPiplus(u)||!PIPLUS_SKILLS.has(id))return _piplusBaseCanUseAbility(u,id,x,y);

  const a=ability(PIPLUS_ID,id);
  if(!a||!u.loadout.includes(id)||u.pa<a.cost||B.busy||!skillUseAllowed(u,id))return false;
  const target=entityAt(x,y),pos={x,y};

  if(id==='impulse')return piplusImpulseDestinationValid(u,x,y);

  if(id==='precise'||id==='vector'){
    if(!damageableEnemy(u,target)||!inRange(u,target,a.range))return false;
    return offensiveIgnoresLOS(u,id,target)||clearLOS(u,target);
  }

  if(id==='interference'){
    if(!markedByPiplus(u,target)||interferenceUsedOn(u,target)||!inRange(u,target,4))return false;
    return offensiveIgnoresLOS(u,id,target)||clearLOS(u,target);
  }

  if(id==='rupture'){
    if(!markedByPiplus(u,target)||!inRange(u,target,4))return false;
    return offensiveIgnoresLOS(u,id,target)||clearLOS(u,target);
  }

  if(id==='fixation'){
    return !!(markedByPiplus(u,target)&&inRange(u,target,4)&&clearLOS(u,target));
  }

  return false;
};

const _piplusBaseInvalidReason=invalidAbilityReason;
invalidAbilityReason=function(u,id,x,y){
  if(!isPiplus(u)||!PIPLUS_SKILLS.has(id))return _piplusBaseInvalidReason(u,id,x,y);
  const a=ability(PIPLUS_ID,id),target=entityAt(x,y);
  if(!a)return 'Habilidad no disponible.';
  if(u.pa<a.cost)return 'PA insuficientes.';
  if(!skillUseAllowed(u,id))return `${a.name}: límite de usos por turno alcanzado.`;

  if(id==='impulse'){
    return piplusImpulseDestinationValid(u,x,y)
      ?''
      :'Elegí una casilla libre a 1 o 2 casillas en línea. Impulso puede atravesar obstáculos.';
  }

  if(['interference','rupture','fixation'].includes(id)&&!markedByPiplus(u,target)){
    return 'Esta habilidad sólo puede usarse sobre el enemigo Marcado.';
  }
  if(id==='interference'&&interferenceUsedOn(u,target)){
    return 'Ese rival ya recibió Interferencia este turno.';
  }
  if(!target)return 'Elegí un objetivo válido.';
  if(!inRange(u,target,a.range))return 'Fuera de alcance.';
  if(id==='fixation'&&!clearLOS(u,target))return 'Fijación de Objetivo requiere línea de visión.';
  if(PIPLUS_OFFENSIVE.has(id)&&!offensiveIgnoresLOS(u,id,target)&&!clearLOS(u,target))return 'Sin línea de visión.';
  return 'Objetivo no válido.';
};

const _piplusBaseValidTargetTile=validTargetTile;
validTargetTile=function(x,y,action){
  const u=cur();
  if(isPiplus(u)&&action==='piplusMark')return piplusOwnActionValid(u,action,x,y);
  return _piplusBaseValidTargetTile(x,y,action);
};

const _piplusBaseActionInfo=actionInfo;
actionInfo=function(id){
  const u=cur();
  if(isPiplus(u)&&id==='piplusMark'){
    return {
      name:'Marcar Objetivo',cost:'0 PA',
      text:'Marca a un enemigo a alcance 4 con línea de visión. Máximo 1 vez por turno y sólo puede existir una Marca de Piplus. Ruptura de Marca bloquea esta acción durante el resto del turno.',
      target:'Enemigo',range:'Alcance 4 + LOS'
    };
  }
  return _piplusBaseActionInfo(id);
};

async function beginPiplusSkill(u,id,x,y){
  if(!canUseAbility(u,id,x,y))return null;
  const a=ability(PIPLUS_ID,id),target=entityAt(x,y);

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
async function finishPiplusSkill(u){
  spendPAAfterAction(u);
  B.notice='';
  B.selectedAction=null;
  B.busy=false;
  renderBattle();
  if(checkBattleEnd())return true;
  if(B.pendingTimeout&&!B.ended)nextTurn();
  return true;
}

const _piplusBaseExecuteAbility=executeAbility;
executeAbility=async function(u,id,x,y,fromAI=false){
  if(!isPiplus(u)||!PIPLUS_SKILLS.has(id)){
    return _piplusBaseExecuteAbility(u,id,x,y,fromAI);
  }

  if(id==='impulse')return await executePiplusImpulse(u,x,y);

  const ctx=await beginPiplusSkill(u,id,x,y);
  if(!ctx)return false;
  if(ctx.aborted)return true;
  const {a,target}=ctx;
  const marked=markedByPiplus(u,target);
  const fixed=offensiveIgnoresLOS(u,id,target);

  if(id==='precise'){
    const dmg=marked?10:8;
    applyDamage(target,dmg,false);
    log(`🏹 Flecha de Precisión: ${target.name} recibe ${dmg} daño${marked?' por estar Marcado':''}.`);
  }

  else if(id==='vector'){
    const dist=marked?2:1;
    applyDamage(target,6,false);
    log(`🧭 Vector: ${target.name} recibe 6 daño y es empujado ${dist}.`);
    if(target.alive&&target.kind==='unit')await forcedMove(target,u,dist,true,'Vector');
  }

  else if(id==='interference'){
    u.piplusInterferenceTargets.push(target.id);
    target.status.pmPenaltyNext=Math.max(target.status.pmPenaltyNext||0,1);
    feedback(target,'PM -1 próximo','status');
    log(`📡 Interferencia: ${target.name} perderá 1 PM en su próximo turno.`);
  }

  else if(id==='rupture'){
    applyDamage(target,14,false);
    log(`💥 Ruptura de Marca: ${target.name} recibe 14 daño y la Marca se consume.`);
    clearMarkedTarget(u);
    u.piplusMarkBlockedThisTurn=true;
    u.piplusFixationTargetId=null;
  }

  else if(id==='fixation'){
    u.piplusFixationTargetId=target.id;
    feedback(target,'🔒 FIJADO','status');
    log(`🔒 Fijación de Objetivo: la próxima habilidad ofensiva de Piplus contra ${target.name} ignora línea de visión este turno.`);
  }

  if(fixed&&id!=='rupture')consumeFixation(u,id,target);

  renderBattle();
  await sleep(160);
  return finishPiplusSkill(u);
};

const _piplusBaseBattleTap=battleTap;
battleTap=async function(e){
  if(!B||B.ended||B.busy||cur()?.controller!=='human')return _piplusBaseBattleTap(e);
  const tile=e.target.closest('.tile');
  if(!tile)return _piplusBaseBattleTap(e);
  const x=+tile.dataset.x,y=+tile.dataset.y,z=entityAt(x,y),u=cur();
  if(!isPiplus(u))return _piplusBaseBattleTap(e);

  if(B.selectedAction==='piplusMark'){
    if(!executeMarkTarget(u,z))showNotice('Elegí un enemigo a alcance 4 con línea de visión.');
    return;
  }

  if(B.selectedAction==='impulse'){
    if(!piplusImpulseDestinationValid(u,x,y)){
      showNotice('Impulso: elegí una casilla libre a 1 o 2 casillas en línea. Puede atravesar obstáculos.');
      return;
    }
    await executePiplusImpulse(u,x,y);
    if(!u.alive&&!B.ended)nextTurn();
    return;
  }

  return _piplusBaseBattleTap(e);
};

const _piplusBaseRenderBattle=renderBattle;
renderBattle=function(...args){
  const out=_piplusBaseRenderBattle(...args);
  if(!B||B.ended)return out;
  const u=cur?.();
  if(!isPiplus(u)||u.controller!=='human'||B.dollPhase)return out;

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

  const marked=getMarkedTarget(u);
  const disabled=!markAvailable(u);
  const reason=u.piplusMarkBlockedThisTurn?'Bloqueada por Ruptura':u.piplusMarkUsedThisTurn?'Usada este turno':'Disponible';

  holder.innerHTML=`
    <button data-piplus-own="piplusMark"
      class="${B.selectedAction==='piplusMark'?'active-action':''}"
      ${disabled?'disabled':''}>
      Marcar Objetivo · 0 PA
      <small>${marked?`Marcado: ${marked.name}`:reason}</small>
    </button>`;

  holder.querySelector('[data-piplus-own="piplusMark"]')?.addEventListener('click',ev=>{
    ev.stopPropagation();selectPiplusMark();
  });

  const help=document.querySelector('.combat-help');
  if(help&&u.piplusFixationTargetId){
    const fixed=getEntity(u.piplusFixationTargetId);
    if(fixed?.alive)help.textContent=`🔒 ${fixed.name} fijado: la próxima habilidad ofensiva contra ese objetivo ignora LOS.`;
  }
  return out;
};

globalThis.LDMPiplus0628={
  definition:PIPLUS_DEF,
  markAvailable,
  markTargetValid,
  executeMarkTarget,
  marked:markedByPiplus,
  fixationActive,
  ignoresLOS:offensiveIgnoresLOS,
  impulseDestinationValid:piplusImpulseDestinationValid,
  executeImpulse:executePiplusImpulse
};

})();