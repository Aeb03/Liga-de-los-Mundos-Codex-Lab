(()=>{'use strict';

/*
  Liga de los Mundos — v0.6.29-v02
  REWORK ONOD — bloque aislado

  Germinar / Marchitar = acciones propias.
  6 habilidades equipables.
  Simbiosis usa curación real y daño REAL de Veneno.
  Vines / Spores / Awakening usan el sistema global de preview AoE.
*/

const ONOD_ID='onod';
const ONOD_SKILLS=new Set(['thorn','vines','sap','spores','awakening','reabsorption']);
const ONOD_OWN_ACTIONS=new Set(['onodGerminate','onodWither']);

const ONOD_DEF={
  hp:95,pa:6,pm:3,ini:4,
  passive:{
    name:'Simbiosis',
    text:'Cuando Onod cura PV reales a un objetivo, todos sus Brotes ortogonalmente adyacentes a ese objetivo recuperan 4 PV, hasta su máximo de 12. Además, cuando un enemigo recibe daño REAL de Veneno mientras está ortogonalmente adyacente a Brotes de Onod, todos esos Brotes recuperan una cantidad de PV igual al daño real de Veneno recibido.'
  },
  abilities:[
    {
      id:'thorn',icon:'☠️',name:'Espina Venenosa',
      cost:2,range:4,damage:6,maxUsesPerTurn:2,
      text:'6 de daño + Veneno 1. Alcance 4. Requiere línea de visión. Máximo 2 usos por turno.'
    },
    {
      id:'vines',icon:'🌿',name:'Enredaderas',
      cost:3,range:3,aoePreview:{pattern:'cross1'},
      text:'Elegí una casilla a alcance 3. Área en cruz de 5 casillas: centro 6 de daño y las 4 cardinales 4 de daño. Los combatientes enemigos alcanzados pierden 1 PM en su próximo turno. Requiere línea de visión hacia la casilla central.'
    },
    {
      id:'sap',icon:'💚',name:'Savia Vital',
      cost:3,range:3,maxUsesPerTurn:2,
      text:'Cura 8 PV a Onod o a un aliado a alcance 3. Cura 12 si el objetivo está ortogonalmente adyacente a un Brote propio. Máximo 2 usos por turno. Requiere línea de visión.'
    },
    {
      id:'spores',icon:'🌬️',name:'Esporas Tóxicas',
      cost:4,range:99,noLOS:true,
      text:'Elegí cualquier Brote propio activo, sin límite de distancia desde Onod. El Brote no se consume. Los 8 espacios que lo rodean se previsualizan; cada enemigo dentro recibe 8 de daño y Veneno 1.'
    },
    {
      id:'awakening',icon:'🌳',name:'Despertar del Bosque',
      cost:4,range:0,noLOS:true,
      text:'Activa simultáneamente TODOS los Brotes propios sin consumirlos. Cada Brote inflige 8 de daño a enemigos ortogonalmente adyacentes. El daño se acumula: un enemigo alcanzado por 2 Brotes recibe 16; por 3, recibe 24.'
    },
    {
      id:'reabsorption',icon:'♻️',name:'Reabsorción',
      cost:0,range:0,noLOS:true,maxUsesPerTurn:1,
      text:'Absorbe obligatoriamente TODOS los Brotes propios creados en turnos anteriores. Los Brotes creados este turno no pueden absorberse. Cada Brote absorbido desaparece y otorga +1 PA. Después de usar Reabsorción, Germinar queda bloqueado durante el resto del turno.'
    }
  ]
};

function installOnodDefinition(){
  const c=CHAMPIONS?.[ONOD_ID];
  if(!c)return false;
  c.hp=ONOD_DEF.hp;c.pa=ONOD_DEF.pa;c.pm=ONOD_DEF.pm;c.ini=ONOD_DEF.ini;
  c.passive={...ONOD_DEF.passive};
  c.abilities=ONOD_DEF.abilities.map(a=>({...a}));
  BOT_LOADOUTS.onod=['thorn','vines','sap','spores'];
  return true;
}
installOnodDefinition();

function isOnod(u){return !!u&&u.championId===ONOD_ID}
function onodTurnSerial(u){return Math.max(0,u?.onodTurnSerial||0)}
function sproutCap(){return 3}

function createSprout(u,x,y){
  const n=B.nextObjectId++;
  const s={
    id:`sprout${n}`,number:n,type:'sprout',kind:'object',
    ownerId:u.id,side:u.side,name:`Brote ${n}`,icon:'🌱',
    x,y,hp:12,maxHp:12,alive:true,shieldStacks:[],blocksLOS:false,
    createdByOnodTurn:onodTurnSerial(u)
  };
  B.pillars.push(s);
  return s;
}
function ownSproutAt(u,x,y){
  const z=entityAt(x,y);
  return z?.alive&&z.type==='sprout'&&z.ownerId===u.id?z:null;
}
function sproutCreatedThisTurn(u,s){
  return !!(s?.ownerId===u.id&&s.createdByOnodTurn===onodTurnSerial(u));
}
function absorbableSprouts(u){
  return ownedSprouts(u).filter(s=>!sproutCreatedThisTurn(u,s));
}

function germinateAvailable(u){
  return !!(
    isOnod(u)&&u.alive&&u.pa>=1&&
    !u.onodGerminateBlockedThisTurn&&
    (u.onodGerminateUses||0)<2&&
    ownedSprouts(u).length<sproutCap()
  );
}
function witherAvailable(u){
  return !!(
    isOnod(u)&&u.alive&&!u.onodWitherUsedThisTurn&&ownedSprouts(u).length>0
  );
}
function onodOwnActionValid(u,action,x,y){
  if(!isOnod(u)||!u.alive||B?.busy)return false;
  const pos={x,y};

  if(action==='onodGerminate'){
    return germinateAvailable(u)&&free(x,y)&&inRange(u,pos,3)&&clearLOS(u,pos);
  }

  if(action==='onodWither'){
    return witherAvailable(u)&&!!ownSproutAt(u,x,y);
  }

  return false;
}
function selectOnodOwnAction(action){
  const u=cur();
  if(!isOnod(u)||u.controller!=='human'||B.busy)return;
  if(action==='onodGerminate'&&!germinateAvailable(u))return;
  if(action==='onodWither'&&!witherAvailable(u))return;

  globalThis.LDMCombatCore?.aoe?.clear?.();
  B.selectedAction=B.selectedAction===action?null:action;
  B.skillsOpen=false;
  B.onodSporesSproutId=null;
  renderBattle();
}
function executeOnodOwnAction(action,x,y){
  const u=cur();
  if(!onodOwnActionValid(u,action,x,y))return false;

  if(action==='onodGerminate'){
    u.pa-=1;
    u.onodGerminateUses=(u.onodGerminateUses||0)+1;
    const s=createSprout(u,x,y);
    B.selectedAction=null;
    try{window.LigaAudio?.play?.('onod.germinar',{dedupe:`ability:${u.id}:germinate`,dedupeMs:120})}catch(_){}
    log(`🌱 Germinar: ${u.name} crea ${s.name} con 12 PV.`);
    spendPAAfterAction(u);
    renderBattle();
    checkBattleEnd();
    return true;
  }

  if(action==='onodWither'){
    const s=ownSproutAt(u,x,y);
    const name=s.name;
    destroyPillar(s);
    u.onodWitherUsedThisTurn=true;
    B.selectedAction=null;
    log(`🍂 Marchitar: ${u.name} retira ${name} sin obtener beneficio.`);
    renderBattle();
    return true;
  }

  return false;
}

// ------------------------------------------------------------
// Simbiosis
// ------------------------------------------------------------

function healAdjacentSprouts(u,target,amount,reason){
  if(!isOnod(u)||!target||amount<=0)return 0;
  let total=0,count=0;

  for(const s of ownedSprouts(u).filter(s=>adjCardinal(s,target))){
    const got=heal(s,amount);
    if(got>0){total+=got;count++}
  }

  if(count>0){
    log(`🌿 Simbiosis: ${count} Brote${count!==1?'s':''} recuper${count!==1?'an':'a'} ${amount} PV máx. por ${reason}.`);
  }
  return total;
}

function triggerHealSymbiosis(u,target,realHeal){
  if(realHeal<=0)return 0;
  return healAdjacentSprouts(u,target,4,'la curación');
}

function triggerPoisonSymbiosis(victim,realPoisonDamage){
  if(!victim?.alive&&realPoisonDamage<=0)return;
  if(realPoisonDamage<=0)return;

  for(const onod of (B?.units||[]).filter(z=>z.alive&&isOnod(z)&&z.side!==victim.side)){
    const adjacent=ownedSprouts(onod).filter(s=>adjCardinal(s,victim));
    if(!adjacent.length)continue;

    let healed=0;
    for(const s of adjacent){
      healed+=heal(s,realPoisonDamage);
    }

    if(healed>0){
      log(`🌿 Simbiosis: el Veneno causa ${realPoisonDamage} daño real a ${victim.name}; ${adjacent.length} Brote${adjacent.length!==1?'s':''} de ${onod.name} se regenera${adjacent.length!==1?'n':''}.`);
    }
  }
}

// Desactivar la Simbiosis histórica (3 PV / una vez por turno).
triggerSymbiosis=function(){};

const _onodBaseTriggerPoison=triggerPoisonOnAbility;
triggerPoisonOnAbility=function(victim){
  if(!victim?.alive)return _onodBaseTriggerPoison(victim);

  const poisonBefore=Math.max(0,victim.status?.poison||0);
  const hpBefore=Math.max(0,victim.hp||0);

  const out=_onodBaseTriggerPoison(victim);

  const hpAfter=Math.max(0,victim.hp||0);
  const realLost=Math.max(0,hpBefore-hpAfter);

  if(poisonBefore>0&&realLost>0){
    triggerPoisonSymbiosis(victim,realLost);
  }
  return out;
};

// ------------------------------------------------------------
// Ciclo de turno
// ------------------------------------------------------------

const _onodBaseMakeUnit=makeUnit;
makeUnit=function(...args){
  const u=_onodBaseMakeUnit(...args);
  if(isOnod(u)){
    u.onodTurnSerial=0;
    u.onodGerminateUses=0;
    u.onodWitherUsedThisTurn=false;
    u.onodGerminateBlockedThisTurn=false;
  }
  return u;
};

const _onodBaseBeginTurn=beginTurn;
beginTurn=function(){
  const u=cur?.();
  if(isOnod(u)){
    u.onodTurnSerial=(u.onodTurnSerial||0)+1;
    u.onodGerminateUses=0;
    u.onodWitherUsedThisTurn=false;
    u.onodGerminateBlockedThisTurn=false;
    B.onodSporesSproutId=null;
  }
  return _onodBaseBeginTurn();
};

// ------------------------------------------------------------
// Validación / alcance
// ------------------------------------------------------------

function vinesCells(x,y){
  return [
    {x,y,zone:'center'},
    {x:x+1,y,zone:'arm'},
    {x:x-1,y,zone:'arm'},
    {x,y:y+1,zone:'arm'},
    {x,y:y-1,zone:'arm'}
  ].filter(c=>inside(c.x,c.y));
}
function sporesCells(s){
  const out=[];
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    if(dx===0&&dy===0)continue;
    const x=s.x+dx,y=s.y+dy;
    if(inside(x,y))out.push({x,y,zone:'effect'});
  }
  return out;
}
function awakeningCells(u){
  const map=new Map();
  for(const s of ownedSprouts(u)){
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const x=s.x+dx,y=s.y+dy;
      if(!inside(x,y))continue;
      const k=`${x},${y}`;
      const prev=map.get(k)||{x,y,hits:0,zone:'effect'};
      prev.hits++;
      prev.zone=prev.hits>=3?'stack3':prev.hits===2?'stack2':'effect';
      map.set(k,prev);
    }
  }
  return [...map.values()];
}

const _onodBaseAbilityRangeState=abilityRangeState;
abilityRangeState=function(u,id,x,y){
  if(!isOnod(u))return _onodBaseAbilityRangeState(u,id,x,y);

  const a=ability(ONOD_ID,id),target=entityAt(x,y),pos={x,y};

  if(id==='thorn'){
    if(!inRange(u,pos,4))return null;
    return {inside:true,blocked:!clearLOS(u,pos)};
  }

  if(id==='vines'){
    if(!inRange(u,pos,3))return null;
    return {inside:true,blocked:!clearLOS(u,pos)};
  }

  if(id==='sap'){
    if(target?.id===u.id)return {inside:true,blocked:false};
    if(!inRange(u,pos,3))return null;
    return {inside:true,blocked:!clearLOS(u,pos)};
  }

  if(id==='spores'){
    return ownSproutAt(u,x,y)?{inside:true,blocked:false}:null;
  }

  if(id==='awakening'||id==='reabsorption'){
    return x===u.x&&y===u.y?{inside:true,blocked:false}:null;
  }

  return _onodBaseAbilityRangeState(u,id,x,y);
};

const _onodBaseCanUseAbility=canUseAbility;
canUseAbility=function(u,id,x,y){
  if(!isOnod(u)||!ONOD_SKILLS.has(id))return _onodBaseCanUseAbility(u,id,x,y);

  const a=ability(ONOD_ID,id);
  if(!a||!u.loadout.includes(id)||u.pa<a.cost||B.busy||!skillUseAllowed(u,id))return false;
  const target=entityAt(x,y),pos={x,y};

  if(id==='thorn'){
    return !!(
      damageableEnemy(u,target)&&
      inRange(u,target,4)&&clearLOS(u,target)
    );
  }

  if(id==='vines'){
    return !!(inRange(u,pos,3)&&clearLOS(u,pos));
  }

  if(id==='sap'){
    return !!(
      target?.kind==='unit'&&target.side===u.side&&
      (target.id===u.id||(inRange(u,target,3)&&clearLOS(u,target)))
    );
  }

  if(id==='spores'){
    return !!ownSproutAt(u,x,y);
  }

  if(id==='awakening'){
    return x===u.x&&y===u.y&&ownedSprouts(u).length>0;
  }

  if(id==='reabsorption'){
    return x===u.x&&y===u.y&&absorbableSprouts(u).length>0;
  }

  return false;
};

const _onodBaseInvalidReason=invalidAbilityReason;
invalidAbilityReason=function(u,id,x,y){
  if(!isOnod(u)||!ONOD_SKILLS.has(id))return _onodBaseInvalidReason(u,id,x,y);

  const a=ability(ONOD_ID,id),target=entityAt(x,y);
  if(!a)return 'Habilidad no disponible.';
  if(u.pa<a.cost)return 'PA insuficientes.';
  if(!skillUseAllowed(u,id))return `${a.name}: límite de usos por turno alcanzado.`;

  if(id==='thorn'){
    if(!damageableEnemy(u,target))return 'Elegí una entidad enemiga.';
    if(!inRange(u,target,4))return 'Fuera de alcance.';
    if(!clearLOS(u,target))return 'Sin línea de visión.';
  }

  if(id==='vines'){
    if(!inRange(u,{x,y},3))return 'Fuera de alcance.';
    if(!clearLOS(u,{x,y}))return 'Sin línea de visión hacia el centro del área.';
  }

  if(id==='sap'){
    if(!target||target.kind!=='unit'||target.side!==u.side)return 'Elegí a Onod o a un aliado.';
    if(target.id!==u.id&&!inRange(u,target,3))return 'Fuera de alcance.';
    if(target.id!==u.id&&!clearLOS(u,target))return 'Sin línea de visión.';
  }

  if(id==='spores'&&!ownSproutAt(u,x,y))return 'Elegí cualquier Brote propio activo.';

  if(id==='awakening'){
    if(ownedSprouts(u).length===0)return 'Despertar del Bosque requiere al menos un Brote propio.';
    if(x!==u.x||y!==u.y)return 'Tocá a Onod para ejecutar Despertar del Bosque.';
  }

  if(id==='reabsorption'){
    if(absorbableSprouts(u).length===0)return 'No hay Brotes de turnos anteriores para Reabsorber.';
    if(x!==u.x||y!==u.y)return 'Tocá a Onod para ejecutar Reabsorción.';
  }

  return 'Objetivo no válido.';
};

const _onodBaseValidTargetTile=validTargetTile;
validTargetTile=function(x,y,action){
  const u=cur();
  if(isOnod(u)&&ONOD_OWN_ACTIONS.has(action))return onodOwnActionValid(u,action,x,y);
  return _onodBaseValidTargetTile(x,y,action);
};

const _onodBaseActionInfo=actionInfo;
actionInfo=function(id){
  const u=cur();
  if(isOnod(u)){
    if(id==='onodGerminate'){
      return {
        name:'Germinar',cost:'1 PA',
        text:'Crea un Brote de 12 PV. Alcance 3 + LOS. Máximo 2 usos por turno y máximo 3 Brotes activos. Reabsorción bloquea Germinar durante el resto del turno.',
        target:'Casilla libre',range:'Alcance 3 + LOS'
      };
    }
    if(id==='onodWither'){
      return {
        name:'Marchitar',cost:'0 PA',
        text:'Retira un Brote propio sin obtener beneficio. Máximo 1 vez por turno.',
        target:'Brote propio',range:'Cualquier Brote propio'
      };
    }
  }
  return _onodBaseActionInfo(id);
};

// ------------------------------------------------------------
// Ejecución de habilidades
// ------------------------------------------------------------

async function beginOnodSkill(u,id,x,y){
  if(!canUseAbility(u,id,x,y))return null;
  const a=ability(ONOD_ID,id),target=entityAt(x,y);

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
    B.notice='';
    B.selectedAction=null;
    B.busy=false;
    renderBattle();
    checkBattleEnd();
    return {aborted:true};
  }
  return {a,target};
}
async function finishOnodSkill(u,a){
  if((a?.cost||0)>0)spendPAAfterAction(u);
  B.notice='';
  B.selectedAction=null;
  B.busy=false;
  B.onodSporesSproutId=null;
  renderBattle();

  if(checkBattleEnd())return true;
  if(B.pendingTimeout&&!B.ended)nextTurn();
  return true;
}

const _onodBaseExecuteAbility=executeAbility;
executeAbility=async function(u,id,x,y,fromAI=false){
  if(!isOnod(u)||!ONOD_SKILLS.has(id)){
    return _onodBaseExecuteAbility(u,id,x,y,fromAI);
  }

  const ctx=await beginOnodSkill(u,id,x,y);
  if(!ctx)return false;
  if(ctx.aborted)return true;

  const {a,target}=ctx;

  if(id==='thorn'){
    applyDamage(target,6,false);
    log(`☠️ Espina Venenosa: ${target.name} recibe 6 daño.`);
    if(target.alive&&target.kind==='unit'){
      addStatus(target,'poison',1);
      log(`☠️ ${target.name} obtiene Veneno ${target.status.poison}.`);
    }
  }

  else if(id==='vines'){
    const cells=vinesCells(x,y);

    for(const c of cells){
      const z=entityAt(c.x,c.y);
      if(!z?.alive||z.side===u.side)continue;

      const dmg=c.zone==='center'?6:4;
      applyDamage(z,dmg,false);
      log(`🌿 Enredaderas (${c.zone==='center'?'centro':'lateral'}): ${z.name} recibe ${dmg} daño.`);

      if(z.alive&&z.kind==='unit'){
        z.status.pmPenaltyNext=Math.max(z.status.pmPenaltyNext||0,1);
        feedback(z,'PM -1 próximo','status');
      }
    }
  }

  else if(id==='sap'){
    const boosted=ownedSprouts(u).some(s=>adjCardinal(s,target));
    const amount=boosted?12:8;
    const got=heal(target,amount);
    log(`💚 Savia Vital: ${target.name} recupera ${got} PV${boosted?' junto a un Brote':''}.`);
    triggerHealSymbiosis(u,target,got);
  }

  else if(id==='spores'){
    const sprout=target;
    const cells=sporesCells(sprout);
    log(`🌬️ Esporas Tóxicas se liberan desde ${sprout.name}.`);

    for(const z of allEntities().filter(z=>
      z.alive&&z.side!==u.side&&cells.some(c=>c.x===z.x&&c.y===z.y)
    )){
      applyDamage(z,8,false);

      if(z.alive&&z.kind==='unit'){
        addStatus(z,'poison',1);
        log(`🌬️ ${z.name} recibe 8 daño y Veneno ${z.status.poison}.`);
      }else{
        log(`🌬️ ${z.name} recibe 8 daño.`);
      }
    }
  }

  else if(id==='awakening'){
    const sprouts=ownedSprouts(u).slice();
    const victims=allEntities().filter(z=>z.alive&&z.side!==u.side);

    log(`🌳 Despertar del Bosque activa ${sprouts.length} Brote${sprouts.length!==1?'s':''}.`);

    for(const z of victims){
      const hits=sprouts.filter(s=>adjCardinal(s,z)).length;
      if(!hits)continue;
      const dmg=8*hits;
      applyDamage(z,dmg,false);
      log(`🌳 ${z.name} recibe ${dmg} daño por ${hits} Brote${hits!==1?'s':''}.`);
    }
  }

  else if(id==='reabsorption'){
    const eligible=absorbableSprouts(u).slice();

    if(!eligible.length){
      // Seguridad: no debería ocurrir porque canUseAbility ya lo valida.
      B.busy=false;B.notice='';B.selectedAction=null;renderBattle();
      return false;
    }

    for(const s of eligible)destroyPillar(s);
    u.pa+=eligible.length;
    u.onodGerminateBlockedThisTurn=true;

    feedback(u,`+${eligible.length} PA`,'pa');
    log(`♻️ Reabsorción: ${eligible.length} Brote${eligible.length!==1?'s':''} desaparece${eligible.length!==1?'n':''}; ${u.name} obtiene +${eligible.length} PA. Germinar queda bloqueado este turno.`);
  }

  renderBattle();
  await sleep(160);
  return finishOnodSkill(u,a);
};

// ------------------------------------------------------------
// Preview global de áreas
// ------------------------------------------------------------

function startSporesPreview(u,sprout){
  const aoe=globalThis.LDMCombatCore?.aoe;
  if(!aoe||!sprout?.alive)return false;

  B.onodSporesSproutId=sprout.id;

  const started=aoe.start({
    abilityId:'spores',
    origin:{x:sprout.x,y:sprout.y},
    pattern:()=>sporesCells(sprout),
    validTarget:(x,y)=>x===sprout.x&&y===sprout.y,
    onCommit:async ()=>{
      const live=getEntity(sprout.id);
      if(!live?.alive||live.ownerId!==u.id)return false;
      aoe.clear();
      await executeAbility(u,'spores',live.x,live.y,false);
      return true;
    }
  });

  if(!started)return false;
  aoe.update(sprout.x,sprout.y);
  aoe.lock();
  return true;
}

function startAwakeningPreview(u){
  const aoe=globalThis.LDMCombatCore?.aoe;
  if(!aoe||ownedSprouts(u).length===0)return false;

  const started=aoe.start({
    abilityId:'awakening',
    origin:{x:u.x,y:u.y},
    pattern:()=>awakeningCells(u),
    validTarget:(x,y)=>x===u.x&&y===u.y,
    onCommit:async ()=>{
      if(!u.alive||cur()?.id!==u.id)return false;
      aoe.clear();
      await executeAbility(u,'awakening',u.x,u.y,false);
      return true;
    }
  });

  if(!started)return false;
  aoe.update(u.x,u.y);
  aoe.lock();
  return true;
}

const _onodBaseBattleTap=battleTap;
battleTap=async function(e){
  if(!B||B.ended||B.busy||cur()?.controller!=='human')return _onodBaseBattleTap(e);

  const tile=e.target.closest('.tile');
  if(!tile)return _onodBaseBattleTap(e);

  const x=+tile.dataset.x,y=+tile.dataset.y,u=cur(),z=entityAt(x,y);
  if(!isOnod(u))return _onodBaseBattleTap(e);

  if(ONOD_OWN_ACTIONS.has(B.selectedAction)){
    if(!executeOnodOwnAction(B.selectedAction,x,y)){
      showNotice('Objetivo o casilla no válida para esta acción.');
    }
    return;
  }

  if(B.selectedAction==='spores'&&!globalThis.LDMCombatCore?.aoe?.state?.()?.active){
    const sprout=ownSproutAt(u,x,y);
    if(!sprout){
      showNotice('Esporas Tóxicas: elegí cualquier Brote propio activo.');
      return;
    }

    if(!startSporesPreview(u,sprout)){
      showNotice('No se pudo iniciar la previsualización de Esporas.');
      return;
    }

    renderBattle();
    showNotice('🌬️ Área fijada alrededor del Brote. Tocá otra vez el Brote para lanzar.',1200);
    return;
  }

  return _onodBaseBattleTap(e);
};

const _onodBaseRenderBattle=renderBattle;
renderBattle=function(...args){
  const u=cur?.();

  if(!isOnod(u)||B?.selectedAction!=='spores')B.onodSporesSproutId=null;

  const out=_onodBaseRenderBattle(...args);

  if(!B||B.ended||!isOnod(u)||u.controller!=='human'||B.dollPhase)return out;

  let holder=document.querySelector('.special-actions');
  if(!holder){
    const drawer=document.querySelector('.skill-drawer');
    if(drawer){
      holder=document.createElement('div');
      holder.className='special-actions';
      drawer.insertAdjacentElement('afterend',holder);
    }
  }

  if(holder){
    const count=ownedSprouts(u).length;
    const gDisabled=!germinateAvailable(u);
    const wDisabled=!witherAvailable(u);

    holder.innerHTML=`
      <button data-onod-own="onodGerminate"
        class="${B.selectedAction==='onodGerminate'?'active-action':''}"
        ${gDisabled?'disabled':''}>
        Germinar · 1 PA
        <small>${count}/3 · ${(u.onodGerminateUses||0)}/2 este turno${u.onodGerminateBlockedThisTurn?' · BLOQUEADO':''}</small>
      </button>
      <button data-onod-own="onodWither"
        class="${B.selectedAction==='onodWither'?'active-action':''}"
        ${wDisabled?'disabled':''}>
        Marchitar · 0 PA
        <small>${u.onodWitherUsedThisTurn?'Usado este turno':'1/turno'}</small>
      </button>`;

    holder.querySelectorAll('[data-onod-own]').forEach(btn=>{
      btn.addEventListener('click',ev=>{
        ev.stopPropagation();
        selectOnodOwnAction(btn.dataset.onodOwn);
      });
    });
  }

  // Despertar muestra inmediatamente la unión de todas las áreas.
  if(B.selectedAction==='awakening'&&ownedSprouts(u).length>0){
    const aoe=globalThis.LDMCombatCore?.aoe;
    if(aoe&&!aoe.state?.()?.active){
      startAwakeningPreview(u);
    }
  }

  const help=document.querySelector('.combat-help');
  if(help&&B.onodSporesSproutId){
    const s=getEntity(B.onodSporesSproutId);
    if(s?.alive)help.textContent=`Esporas: ${s.name} seleccionado. El magenta muestra sus 8 casillas afectadas; tocá otra vez el Brote para lanzar.`;
  }

  return out;
};

// Cambiar de habilidad cancela previews manuales de Onod.
document.addEventListener('click',e=>{
  const b=e.target.closest?.('[data-skill]');
  if(!b||!B)return;

  if(b.dataset.skill!=='spores')B.onodSporesSproutId=null;

  if(!['spores','awakening'].includes(b.dataset.skill)){
    globalThis.LDMCombatCore?.aoe?.clear?.();
  }
},true);

// ------------------------------------------------------------
// API para IA
// ------------------------------------------------------------

function bestGerminateTiles(u,focus=null){
  const out=[];
  if(!germinateAvailable(u))return out;

  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    if(!onodOwnActionValid(u,'onodGerminate',x,y))continue;
    const p={x,y};

    let score=4;
    if(focus){
      const d=md(p,focus);
      if(d===1)score+=9;
      else if(d===2)score+=6;
      else if(d===3)score+=3;
    }

    for(const ally of teamUnits(u,true)){
      if(aiLikeMissingHp(ally)>=6&&adjCardinal(p,ally))score+=4;
    }

    for(const enemy of enemyUnits(u,true)){
      if((enemy.status?.poison||0)>0&&adjCardinal(p,enemy))score+=5;
    }

    out.push({x,y,score});
  }

  return out.sort((a,b)=>b.score-a.score);
}

function aiLikeMissingHp(z){return Math.max(0,(z?.maxHp||0)-(z?.hp||0))}

function witherCandidates(u,focus=null){
  if(!witherAvailable(u))return [];
  if(ownedSprouts(u).length<3||!germinateAvailableAfterWither(u))return [];

  const sprouts=ownedSprouts(u).slice();
  return sprouts.map(s=>{
    const foeDist=enemyUnits(u,true).length
      ?Math.min(...enemyUnits(u,true).map(e=>md(s,e)))
      :99;
    const allyUtility=teamUnits(u,true).some(a=>adjCardinal(a,s)&&aiLikeMissingHp(a)>=6);
    const poisonedUtility=enemyUnits(u,true).some(e=>adjCardinal(e,s)&&(e.status?.poison||0)>0);

    let score=foeDist>=6?8:foeDist>=5?5:foeDist>=4?2:-4;
    if(allyUtility)score-=6;
    if(poisonedUtility)score-=6;
    if(focus&&md(s,focus)<=3)score-=3;
    return {sprout:s,score};
  }).sort((a,b)=>b.score-a.score);
}
function germinateAvailableAfterWither(u){
  return !!(
    isOnod(u)&&u.alive&&u.pa>=1&&
    !u.onodGerminateBlockedThisTurn&&
    (u.onodGerminateUses||0)<2
  );
}

globalThis.LDMOnod0629={
  definition:ONOD_DEF,
  germinateAvailable,
  witherAvailable,
  ownActionValid:onodOwnActionValid,
  executeOwnAction:executeOnodOwnAction,
  absorbableSprouts,
  sproutCreatedThisTurn,
  vinesCells,
  sporesCells,
  awakeningCells,
  bestGerminateTiles,
  witherCandidates,
  triggerHealSymbiosis,
  triggerPoisonSymbiosis
};

})();