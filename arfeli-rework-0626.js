(()=>{'use strict';

/*
  Liga de los Mundos — v0.6.26-v02
  REWORK ARFELI — bloque aislado

  Esta capa se carga DESPUÉS de balance-playtest / parches de Coloso
  y ANTES de ai-tactical, de modo que:
  - Arfeli tiene una única definición efectiva de ficha/textos;
  - las reglas viejas de Berserker / Martillo adyacente quedan anuladas;
  - IA táctica lee la ficha nueva;
  - no se modifica ningún otro campeón.
*/

const ARFELI_ID='arfeli';
const ARFELI_ABILITY_IDS=new Set(['sword','daggers','bow','spear','shield','hammer']);

const ARFELI_DEF={
  hp:100,
  pa:6,
  pm:3,
  ini:5,
  passive:{
    name:'Maestría con Armas',
    text:'Al encadenar habilidades distintas en el mismo turno, la primera se resuelve sin bonificación, la segunda obtiene +1, la tercera +2 y así sucesivamente. Las habilidades de daño suman la bonificación al daño y Portación de Escudo la suma al Escudo. Moverse no rompe la cadena. Si repetís una habilidad ya usada ese turno, la cadena se reinicia y esa habilidad se resuelve sin bonificación. La cadena se reinicia al finalizar el turno.'
  },
  abilities:[
    {
      id:'sword',icon:'⚔️',name:'Corte con Espada',
      cost:2,range:1,damage:10,maxUsesPerTurn:2,
      text:'10 de daño. Alcance 1. Máximo 2 usos por turno. Maestría con Armas puede aumentar el daño.'
    },
    {
      id:'daggers',icon:'🩸',name:'Dagas Danzantes',
      cost:3,range:1,damage:10,maxUsesPerTurn:1,
      text:'10 de daño + Herida 2. Alcance 1. Máximo 1 uso por turno. Maestría con Armas puede aumentar el daño.'
    },
    {
      id:'bow',icon:'🏹',name:'Disparo con Arco',
      cost:3,range:4,damage:8,
      text:'8 de daño. Alcance 4. Requiere línea de visión. Maestría con Armas puede aumentar el daño.'
    },
    {
      id:'spear',icon:'🔱',name:'Arte de la Lanza',
      cost:3,range:2,damage:10,
      text:'10 de daño y atrae al objetivo 1 casilla hacia Arfeli. Alcance 2. Requiere línea de visión. Maestría con Armas puede aumentar el daño.'
    },
    {
      id:'shield',icon:'🛡️',name:'Portación de Escudo',
      cost:3,range:0,shield:15,maxUsesPerTurn:1,
      text:'Arfeli obtiene 15 de Escudo. Máximo 1 uso por turno. Maestría con Armas suma su bonificación al Escudo. El Escudo dura hasta el inicio del próximo turno de Arfeli o hasta romperse.'
    },
    {
      id:'hammer',icon:'🔨',name:'Golpe de Martillo',
      cost:4,range:3,damage:13,noLOS:true,
      text:'Elegí una entidad enemiga a alcance 3. Arfeli salta a una casilla cardinal libre adyacente al objetivo, ignorando obstáculos y línea de visión, e inflige 13 de daño. Si el objetivo es un combatiente, pierde 1 PM en su próximo turno. Las entidades inmóviles reciben el daño pero no sufren la pérdida de PM. Maestría con Armas puede aumentar el daño.'
    }
  ]
};

function installArfeliDefinition(){
  const c=CHAMPIONS?.[ARFELI_ID];
  if(!c)return false;
  c.hp=ARFELI_DEF.hp;
  c.pa=ARFELI_DEF.pa;
  c.pm=ARFELI_DEF.pm;
  c.ini=ARFELI_DEF.ini;
  c.passive={...ARFELI_DEF.passive};
  c.abilities=ARFELI_DEF.abilities.map(a=>({...a}));
  return true;
}
installArfeliDefinition();

// Berserker queda retirado del diseño vigente.
try{
  berserkerBonus=function(){return 0};
}catch(_){}

function ensureMastery(u){
  if(!u||u.championId!==ARFELI_ID)return [];
  if(!Array.isArray(u.arfeliMasteryChain))u.arfeliMasteryChain=[];
  return u.arfeliMasteryChain;
}
function resetMastery(u){
  if(!u||u.championId!==ARFELI_ID)return;
  u.arfeliMasteryChain=[];
  u.arfeliMasteryLastBonus=0;
}
function masteryPreviewBonus(u,id){
  if(!u||u.championId!==ARFELI_ID||!ARFELI_ABILITY_IDS.has(id))return 0;
  const chain=ensureMastery(u);
  return chain.includes(id)?0:chain.length;
}
function masteryCommit(u,id){
  if(!u||u.championId!==ARFELI_ID||!ARFELI_ABILITY_IDS.has(id))return {bonus:0,reset:false};
  const chain=ensureMastery(u);
  if(chain.includes(id)){
    u.arfeliMasteryChain=[id];
    u.arfeliMasteryLastBonus=0;
    return {bonus:0,reset:true};
  }
  const bonus=chain.length;
  chain.push(id);
  u.arfeliMasteryLastBonus=bonus;
  return {bonus,reset:false};
}
function masteryAmount(u,a,id){
  const base=id==='shield'?(a.shield||0):(a.damage||0);
  return base+masteryPreviewBonus(u,id);
}

const _arfeliBaseMakeUnit=makeUnit;
makeUnit=function(...args){
  const u=_arfeliBaseMakeUnit(...args);
  if(u?.championId===ARFELI_ID)resetMastery(u);
  return u;
};

const _arfeliBaseBeginTurn=beginTurn;
beginTurn=function(){
  const u=cur?.();
  // Seguridad adicional: si por una interrupción no se cerró correctamente
  // el turno anterior, el nuevo turno siempre empieza con cadena vacía.
  if(u?.championId===ARFELI_ID)resetMastery(u);
  return _arfeliBaseBeginTurn();
};

const _arfeliBaseEndTurnEffects=endTurnEffects;
endTurnEffects=function(u){
  const out=_arfeliBaseEndTurnEffects(u);
  if(u?.championId===ARFELI_ID)resetMastery(u);
  return out;
};

const HAMMER_DIRS=[[1,0],[-1,0],[0,1],[0,-1]];

function hammerLandingCandidates(u,target){
  if(!u||!target)return [];
  const out=[];

  // Si Arfeli ya está cardinalmente adyacente, puede golpear desde su casilla.
  if(adjCardinal(u,target))out.push({x:u.x,y:u.y,stay:true});

  for(const [dx,dy] of HAMMER_DIRS){
    const x=target.x+dx,y=target.y+dy;
    if(!inside(x,y))continue;
    if(x===u.x&&y===u.y){
      if(!out.some(p=>p.x===x&&p.y===y))out.push({x,y,stay:true});
      continue;
    }
    if(free(x,y))out.push({x,y,stay:false});
  }

  out.sort((a,b)=>{
    const da=md(u,a),db=md(u,b);
    if(da!==db)return da-db;
    // Desempate determinista para que humano e IA vean el mismo resultado.
    if(a.y!==b.y)return a.y-b.y;
    return a.x-b.x;
  });
  return out;
}
function hammerLanding(u,target){
  return hammerLandingCandidates(u,target)[0]||null;
}
function hammerTargetValid(u,target){
  const a=ability(ARFELI_ID,'hammer');
  return !!(
    u?.championId===ARFELI_ID &&
    target &&
    damageableEnemy(u,target) &&
    md(u,target)>=1 &&
    md(u,target)<=a.range &&
    hammerLanding(u,target)
  );
}

const _arfeliBaseAbilityRangeState=abilityRangeState;
abilityRangeState=function(u,id,x,y){
  if(u?.championId===ARFELI_ID&&id==='hammer'){
    const d=md(u,{x,y});
    return d>=1&&d<=ability(ARFELI_ID,'hammer').range
      ?{inside:true,blocked:false}
      :null;
  }
  return _arfeliBaseAbilityRangeState(u,id,x,y);
};

const _arfeliBaseCanUseAbility=canUseAbility;
canUseAbility=function(u,id,x,y){
  if(u?.championId===ARFELI_ID&&id==='hammer'){
    const a=ability(ARFELI_ID,id);
    if(!a||!u.loadout.includes(id)||u.pa<a.cost||B.busy||!skillUseAllowed(u,id))return false;
    return hammerTargetValid(u,entityAt(x,y));
  }
  return _arfeliBaseCanUseAbility(u,id,x,y);
};

const _arfeliBaseInvalidAbilityReason=invalidAbilityReason;
invalidAbilityReason=function(u,id,x,y){
  if(u?.championId===ARFELI_ID&&id==='hammer'){
    const target=entityAt(x,y);
    if(!target)return 'Golpe de Martillo requiere seleccionar una entidad enemiga.';
    if(!damageableEnemy(u,target))return 'Golpe de Martillo sólo puede seleccionar una entidad enemiga válida.';
    if(md(u,target)>3)return 'Golpe de Martillo tiene alcance 3.';
    if(!hammerLanding(u,target))return 'No hay una casilla cardinal libre adyacente al objetivo para que Arfeli aterrice.';
  }
  return _arfeliBaseInvalidAbilityReason(u,id,x,y);
};

async function beginArfeliAction(u,id,x,y){
  if(!canUseAbility(u,id,x,y))return null;
  const a=ability(ARFELI_ID,id),target=entityAt(x,y);
  const mastery=masteryCommit(u,id);

  B.busy=true;
  B.noticeSeq++;
  B.notice=`${u.icon} ${u.name} — ${a.icon} ${a.name}`;
  if(target)faceTarget(u,target);
  registerSkillUse(u,id);
  u.pa-=a.cost;

  if(mastery.reset){
    log(`⚔️ Maestría con Armas: ${a.name} se repite; la cadena se reinicia y esta habilidad no recibe bonificación.`);
  }else if(mastery.bonus>0){
    log(`⚔️ Maestría con Armas: ${a.name} obtiene +${mastery.bonus} ${id==='shield'?'Escudo':'daño'}.`);
  }

  triggerPoisonOnAbility(u);
  renderBattle();
  await sleep(150);

  if(!u.alive){
    B.notice='';
    B.selectedAction=null;
    B.busy=false;
    renderBattle();
    checkBattleEnd();
    return {aborted:true};
  }
  return {a,target,mastery};
}

async function finishArfeliAction(u){
  spendPAAfterAction(u);
  B.notice='';
  B.selectedAction=null;
  B.busy=false;
  renderBattle();

  if(checkBattleEnd())return true;
  if(B.pendingTimeout&&!B.ended){
    nextTurn();
    return true;
  }
  return true;
}

async function hammerJump(u,target,landing){
  if(!landing)return false;
  const start={x:u.x,y:u.y};
  const distance=md(start,landing);

  if(distance>0){
    u.x=landing.x;
    u.y=landing.y;
    faceTarget(u,target);
    renderBattle();
    await sleep(140);

    // Herida se aplica por cada casilla lógica recorrida por la habilidad.
    for(let i=0;i<distance&&u.alive;i++){
      if(u.status?.wound>0){
        applyWoundStep(u);
        renderBattle();
        await sleep(95);
        if(!u.alive||checkBattleEnd())break;
      }
    }

    // Es un salto: no pisa casillas intermedias, pero sí entra en la casilla de aterrizaje.
    if(u.alive){
      await triggerTrapAt(u);
      if(!u.alive||checkBattleEnd())return false;
    }
  }
  return u.alive;
}

const _arfeliBaseExecuteAbility=executeAbility;
executeAbility=async function(u,id,x,y,fromAI=false){
  if(u?.championId!==ARFELI_ID||!ARFELI_ABILITY_IDS.has(id)){
    return _arfeliBaseExecuteAbility(u,id,x,y,fromAI);
  }

  const landing=id==='hammer'?hammerLanding(u,entityAt(x,y)):null;
  const ctx=await beginArfeliAction(u,id,x,y);
  if(!ctx)return false;
  if(ctx.aborted)return true;

  const {a,target,mastery}=ctx;
  const bonus=mastery.bonus||0;
  const objectTarget=isCombatObject(target);

  if(id==='shield'){
    const amount=(a.shield||15)+bonus;
    addShield(u,amount,'Portación de Escudo',u.id);
    log(`🛡️ Portación de Escudo: ${u.name} obtiene ${amount} de Escudo.`);
    renderBattle();
    await sleep(170);
    return finishArfeliAction(u);
  }

  if(id==='hammer'){
    const landed=await hammerJump(u,target,landing);
    if(!landed)return finishArfeliAction(u);

    const dmg=(a.damage||13)+bonus;
    applyDamage(target,dmg,false);
    log(`🔨 Golpe de Martillo: ${dmg} daño a ${target.name}.`);

    if(!objectTarget&&target.alive&&target.kind==='unit'){
      target.status.pmPenaltyNext=Math.max(target.status.pmPenaltyNext||0,1);
      feedback(target,'PM -1 próximo','status');
      log(`🔨 ${target.name} perderá 1 PM al comenzar su próximo turno.`);
    }

    renderBattle();
    await sleep(190);
    return finishArfeliAction(u);
  }

  const dmg=(a.damage||0)+bonus;
  applyDamage(target,dmg,false);
  log(`${a.icon} ${a.name}: ${dmg} daño a ${target.name}.`);

  if(id==='daggers'&&!objectTarget&&target.alive){
    addStatus(target,'wound',2);
    log(`🩸 ${target.name} obtiene Herida ${target.status.wound}.`);
  }

  renderBattle();
  await sleep(180);

  if(id==='spear'&&!objectTarget&&target.alive){
    await forcedMove(target,u,1,false,'Atracción');
  }

  return finishArfeliAction(u);
};

// API pequeña para que la IA pueda valorar la misma pasiva sin duplicar reglas.
globalThis.LDMArfeli0626={
  definition:ARFELI_DEF,
  previewBonus:masteryPreviewBonus,
  previewAmount:masteryAmount,
  commit:masteryCommit,
  reset:resetMastery,
  landing:hammerLanding,
  targetValid:hammerTargetValid
};

})();