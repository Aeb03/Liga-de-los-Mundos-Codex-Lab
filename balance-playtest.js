(()=>{'use strict';

/* Liga de los Mundos v0.5.30 — paquete consolidado de balance / playtest.
   Esta capa modifica únicamente reglas y descripciones expresamente aprobadas.
   IDs históricos se conservan para no romper loadouts:
   trap_snare = Mina Eléctrica
   trap_bomb = Granada
   reflected = Transferencia de Dolor
*/

// ─────────────────────────────────────────────
// DATOS / DESCRIPCIONES
// ─────────────────────────────────────────────

Object.assign(CHAMPIONS.arfeli.abilities.find(a=>a.id==='sword'),{
  cost:2,range:1,damage:12,maxUsesPerTurn:1,
  text:'12 de daño. Alcance 1. Máximo 1 uso por turno.'
});
Object.assign(CHAMPIONS.arfeli.abilities.find(a=>a.id==='shield'),{
  cost:3,range:0,shield:20,maxUsesPerTurn:1,
  text:'Obtiene 20 de Escudo. Máximo 1 uso por turno. El Escudo dura 1 turno o hasta ser destruido.'
});
Object.assign(CHAMPIONS.arfeli.abilities.find(a=>a.id==='hammer'),{
  cost:4,range:1,damage:16,
  text:'16 de daño y el objetivo pierde 1 PA en su próximo turno. Sólo puede atacar las 4 casillas ortogonales adyacentes.'
});

Object.assign(CHAMPIONS.coloso.abilities.find(a=>a.id==='pillar'),{
  text:'Crea un Pilar de 20 PV a alcance 3. Puede colocarse adyacente a un enemigo. Máximo 2; en Monolito, 3.'
});
Object.assign(CHAMPIONS.coloso.abilities.find(a=>a.id==='stonearmor'),{
  cost:2,range:3,shield:15,
  text:'Otorga 15 de Escudo a Coloso, un aliado o un Pilar propio. Máximo 1 vez por turno por objetivo. Dura 1 turno.'
});
Object.assign(CHAMPIONS.coloso.abilities.find(a=>a.id==='absorb'),{
  cost:2,range:3,text:'Consume un Pilar propio a alcance 3 y recupera 20 PV.'
});
Object.assign(CHAMPIONS.coloso.abilities.find(a=>a.id==='fusion'),{
  cost:3,range:1,text:'Consume un Pilar propio adyacente y entra en Monolito.'
});
Object.assign(CHAMPIONS.coloso.abilities.find(a=>a.id==='quake'),{
  cost:3,range:1,damage:12,
  text:'Desde Coloso: 12 daño + empuje 1. Desde Pilar: 8 daño + empuje 1. Réplica: sólo Pilares ortogonalmente adyacentes, 6 daño + empuje 1; cada Pilar participa máximo 1 vez.'
});

Object.assign(CHAMPIONS.piplus.abilities.find(a=>a.id==='impulse'),{
  cost:2,range:3,
  text:'Piplus o un aliado a alcance 3 se desplaza hasta 2 casillas en línea sin gastar PM. Herida se aplica normalmente por cada casilla recorrida.'
});
Object.assign(CHAMPIONS.piplus.abilities.find(a=>a.id==='rupture'),{
  cost:4,range:4,damage:16,
  text:'Sólo contra el objetivo Marcado: 16 de daño, empuja 2 y consume la Marca.'
});

CHAMPIONS.onod.passive={
  name:'Simbiosis',
  text:'Una vez por turno, cuando Onod aplica Veneno o realiza una curación, un Brote propio ortogonalmente adyacente al objetivo recupera 3 PV.'
};
Object.assign(CHAMPIONS.onod.abilities.find(a=>a.id==='germinate'),{
  cost:2,range:3,text:'Crea un Brote de 12 PV. Máximo 3 activos. Ocupa casilla pero no bloquea línea de visión.'
});
Object.assign(CHAMPIONS.onod.abilities.find(a=>a.id==='thorn'),{
  cost:2,range:4,damage:7,maxUsesPerTurn:2,
  text:'7 de daño + Veneno 1. Máximo 2 usos por turno.'
});
Object.assign(CHAMPIONS.onod.abilities.find(a=>a.id==='sap'),{
  cost:3,range:3,maxUsesPerTurn:1,
  text:'Cura 10 PV; cura 14 si el objetivo está ortogonalmente adyacente a un Brote propio. Máximo 1 uso por turno.'
});
Object.assign(CHAMPIONS.onod.abilities.find(a=>a.id==='spores'),{
  cost:4,range:3,damage:8,
  text:'Área en cruz: casilla objetivo + sus 4 cardinales. Cada enemigo alcanzado recibe 8 daño + Veneno 1.'
});
Object.assign(CHAMPIONS.onod.abilities.find(a=>a.id==='awakening'),{
  cost:4,range:3,damage:8,
  text:'Seleccioná un Brote propio: despiertan simultáneamente TODOS los Brotes activos. Cada Brote causa 8 daño a enemigos ortogonalmente adyacentes. No consume Brotes ni empuja.'
});

CHAMPIONS.korgan.passive={
  name:'Preparación',
  text:'Máximo 3 trampas activas. Son invisibles para enemigos y visibles con transparencia para Korgan y sus aliados. Puede desarmar 1 trampa propia por turno a 0 PA.'
};
Object.assign(CHAMPIONS.korgan.abilities.find(a=>a.id==='trap_spikes'),{
  icon:'🪤',name:'Trampa de Pinchos',cost:3,range:3,maxUsesPerTurn:2,
  text:'Coloca una trampa. Al entrar un enemigo: 10 daño + Herida 1. Máximo 2 colocaciones por turno. Se consume al activarse.'
});
Object.assign(CHAMPIONS.korgan.abilities.find(a=>a.id==='trap_snare'),{
  icon:'⚡',name:'Mina Eléctrica',cost:3,range:3,maxUsesPerTurn:1,
  text:'Coloca una trampa. Al entrar un enemigo: 8 daño y pierde 1 PA en su próximo turno. Máximo 1 colocación por turno. No reduce PM ni aplica Parálisis.'
});
Object.assign(CHAMPIONS.korgan.abilities.find(a=>a.id==='trap_bomb'),{
  icon:'💣',name:'Granada',cost:3,range:3,damage:12,
  text:'No es una trampa. Área en cruz: centro 12 daño sin empuje; 4 cardinales 8 daño + empuje 1 alejándose del centro. No afecta diagonales.'
});
Object.assign(CHAMPIONS.korgan.abilities.find(a=>a.id==='shot'),{
  cost:3,range:5,damage:12,
  text:'12 de daño. Alcance 5 LINEAL: mismo fila o columna. Requiere línea de visión y no permite diagonales.'
});
Object.assign(CHAMPIONS.korgan.abilities.find(a=>a.id==='hook'),{
  cost:3,range:3,damage:6,
  text:'6 de daño y atrae hasta 2 casillas hacia Korgan, casilla por casilla. Puede activar trampas y Herida durante el recorrido.'
});
Object.assign(CHAMPIONS.korgan.abilities.find(a=>a.id==='hunterstep'),{
  text:'Korgan se desplaza hasta 2 casillas en línea sin gastar PM. Máximo 1 uso por turno. Herida se aplica normalmente.'
});

CHAMPIONS.houngan.passive={
  name:'Vínculo Vudú',
  text:'Puede mantener máximo 1 objetivo Vinculado, enemigo o aliado. Aplicar Vínculo a un nuevo objetivo elimina el anterior.'
};
Object.assign(CHAMPIONS.houngan.abilities.find(a=>a.id==='needle'),{
  cost:2,range:4,damage:7,
  text:'Contra enemigo: 7 daño + Vínculo. Contra aliado: cura 7 + Vínculo. Sólo puede existir 1 objetivo Vinculado.'
});
Object.assign(CHAMPIONS.houngan.abilities.find(a=>a.id==='doll'),{
  cost:3,range:3,
  text:'Invoca máximo 1 Muñeco. Vínculo enemigo: 16 PV y refleja 50% del daño recibido. Vínculo aliado: 30 PV, PM 4 y cura al aliado el 50% del daño recibido, redondeando hacia arriba.'
});
Object.assign(CHAMPIONS.houngan.abilities.find(a=>a.id==='transfer'),{
  cost:2,range:3,
  text:'Hougan recupera hasta 8 PV y el Muñeco recibe exactamente la misma cantidad de daño. Ese daño activa normalmente el efecto del Muñeco.'
});
Object.assign(CHAMPIONS.houngan.abilities.find(a=>a.id==='curse'),{
  cost:3,range:3,damage:9,noLOS:true,maxUsesPerTurn:1,
  text:'9 de daño + Veneno 1. Alcance 3. Máximo 1 uso por turno. No requiere Vínculo.'
});
Object.assign(CHAMPIONS.houngan.abilities.find(a=>a.id==='reflected'),{
  icon:'🪆',name:'Transferencia de Dolor',cost:3,range:0,damage:0,
  text:'Requiere Vínculo aliado y Muñeco asociado. Permanece activa hasta que ese Muñeco muera o desaparezca. El daño a Hougan se reparte 50/50; si es impar, Hougan recibe la porción mayor.'
});
Object.assign(CHAMPIONS.houngan.abilities.find(a=>a.id==='ritual'),{
  cost:4,range:4,damage:14,
  text:'Sólo contra enemigo Vinculado: 14 daño y consume el Vínculo. +6 si el Muñeco asociado está ortogonalmente adyacente al objetivo. Total 20.'
});

// ─────────────────────────────────────────────
// ESTADOS GLOBALES
// ─────────────────────────────────────────────

const MAX_WOUND=3,MAX_POISON=3,MAX_BURN=4;

function addWoundStatus(target,n=1){
  return addStatus(target,'wound',n);
}
function addPoisonStatus(target,n=1){
  return addStatus(target,'poison',n);
}
function addBurnStatus(target,n=1){
  return addStatus(target,'burn',n);
}
async function woundTravelStep(target){
  if(target?.kind!=='unit'||!target.alive)return;
  const dealt=applyWoundStep(target);
  if(dealt<=0)return;
  renderBattle();
  await sleep(120);
}

// ─────────────────────────────────────────────
// ESCUDOS
// ─────────────────────────────────────────────
// La duración global de Escudo se resuelve en combat-core-0625.js.
// Esta capa de balance conserva las llamadas addShield(...) existentes, pero no
// vuelve a definir ni a envejecer pilas de escudo por su cuenta.

// ─────────────────────────────────────────────
// UNIDADES / INICIO-FIN DE TURNO
// ─────────────────────────────────────────────

const _makeUnit=makeUnit;
makeUnit=function(...args){
  const u=_makeUnit(...args);
  u.sproutRemovedThisTurn=false;
  u.trapRemovedThisTurn=false;
  u.painTransferActiveDollId=null;
  return u;
};

const _beginTurn=beginTurn;
beginTurn=function(){
  const u=cur();
  if(u?.alive){
    u.sproutRemovedThisTurn=false;
    u.trapRemovedThisTurn=false;
  }
  // El motor base v0.6.19 ya resuelve una sola vez: límites de estados,
  // Quemadura al inicio, PA/PM y reinicios de turno.
  return _beginTurn();
};

const _balanceBaseEndTurnEffects=endTurnEffects;
endTurnEffects=function(u){
  // El motor base resuelve una sola vez Quemadura final + reducción a la mitad.
  // combat-core-0625.js neutraliza el envejecimiento antiguo de escudos.
  return _balanceBaseEndTurnEffects(u);
};

spendPAAfterAction=function(u){
  // Veneno se dispara al USAR la habilidad (al pagar PA), no al finalizarla.
  // Aquí sólo se mantiene la resolución de Maldición heredada.
  if(u?.alive&&u.status?.curseDamage>0){
    const n=u.status.curseDamage;
    u.status.curseDamage=0;
    applyDamage(u,n,false);
    log(`☠️ Maldición: ${u.name} recibe ${n} daño por gastar PA.`);
  }
};

// ─────────────────────────────────────────────
// MOVIMIENTO — HERIDA POR CADA CASILLA
// ─────────────────────────────────────────────

moveUnit=async function(u,x,y){
  const reach=movementMap(u),cost=reach.get(key(x,y));
  if(cost==null||B.busy)return;
  const path=gridPath(u,{x,y});if(path.length<2)return;
  B.busy=true;
  let steps=0;

  for(let i=1;i<path.length&&u.alive;i++){
    const adj=adjacentEnemies(u);
    if(adj.length){
      const dmg=adj.length*2;
      applyDamage(u,dmg,true);
      log(`⚠️ Oportunidad: ${u.name} recibe ${dmg} daño directo al moverse junto a un enemigo cardinal.`);
      renderBattle();await sleep(180);
      if(checkBattleEnd())break;
    }

    const old={x:u.x,y:u.y};
    u.x=path[i][0];u.y=path[i][1];faceStep(u,old);steps++;
    renderBattle();await sleep(100);
    await woundTravelStep(u);
    if(!u.alive||checkBattleEnd())break;
    await triggerTrapAt(u);
    if(!u.alive||checkBattleEnd())break;
  }

  u.pm=Math.max(0,u.pm-steps);
  if(steps)log(`👣 ${u.name} se mueve ${steps} casilla${steps!==1?'s':''}.`);
  B.selectedAction=null;B.busy=false;renderBattle();
  if(B.pendingTimeout&&!B.ended)nextTurn();
};

dashUnit=async function(u,x,y){
  const dx=Math.sign(x-u.x),dy=Math.sign(y-u.y),steps=md(u,{x,y});
  for(let i=0;i<steps&&u.alive;i++){
    const old={x:u.x,y:u.y};
    u.x+=dx;u.y+=dy;faceStep(u,old);
    renderBattle();await sleep(100);
    await woundTravelStep(u);
    if(!u.alive||checkBattleEnd())break;
    await triggerTrapAt(u);
    if(!u.alive||checkBattleEnd())break;
  }
};

forcedMove=async function(target,source,distance=1,away=true,label='Empuje'){
  const [dx,dy]=forcedDirection(source,target,away);
  if(!dx&&!dy)return;

  for(let i=0;i<distance&&target.alive;i++){
    const nx=target.x+dx,ny=target.y+dy;
    if(!inside(nx,ny)||isFixedObstacle(nx,ny)||entityAt(nx,ny)){
      const remaining=distance-i,collision=2*remaining,blocker=inside(nx,ny)?entityAt(nx,ny):null;
      applyDamage(target,collision,false);
      log(`💥 Colisión: ${target.name} recibe ${collision} daño.`);
      if(blocker&&blocker.id!==target.id){
        const half=Math.floor(collision/2);
        applyDamage(blocker,half,false);
        log(`💥 ${blocker.name} recibe ${half} daño por la colisión.`);
      }
      renderBattle();await sleep(220);
      break;
    }

    const old={x:target.x,y:target.y};
    target.x=nx;target.y=ny;faceStep(target,old);
    renderBattle();await sleep(120);
    await woundTravelStep(target);
    if(!target.alive||checkBattleEnd())break;
    await triggerTrapAt(target);
    if(!target.alive||checkBattleEnd())break;
  }
};

// ─────────────────────────────────────────────
// VÍNCULO / MUÑECO / TRANSFERENCIA DE DOLOR
// ─────────────────────────────────────────────

const _destroyPillar=destroyPillar;
destroyPillar=function(p){
  if(!p)return;
  if(p.type==='doll'){
    const owner=getUnit(p.ownerId);
    if(owner?.painTransferActiveDollId===p.id){
      owner.painTransferActiveDollId=null;
      log(`🪆 Transferencia de Dolor termina porque ${p.name} desaparece.`);
    }
  }
  _destroyPillar(p);
};

applyDamage=function(e,n,ignoreShield=false,bypassPainTransfer=false){
  if(!e||!e.alive||n<=0)return 0;

  if(!bypassPainTransfer&&e.kind==='unit'&&e.championId==='houngan'&&e.painTransferActiveDollId){
    const doll=getEntity(e.painTransferActiveDollId);
    if(doll?.alive&&doll.type==='doll'){
      const greater=Math.ceil(n/2),lesser=Math.floor(n/2);
      log(`🪆 Transferencia de Dolor: ${n} daño se reparte ${greater}/${lesser}.`);
      const absorbed=applyDamage(e,greater,ignoreShield,true);
      if(lesser>0&&doll.alive)applyDamage(doll,lesser,ignoreShield,true);
      return absorbed;
    }
    e.painTransferActiveDollId=null;
  }

  let remaining=n,absorbed=0;
  if(!ignoreShield){
    for(const s of e.shieldStacks||[]){
      if(remaining<=0)break;
      const take=Math.min(s.amount,remaining);
      s.amount-=take;remaining-=take;absorbed+=take;
    }
    e.shieldStacks=(e.shieldStacks||[]).filter(s=>s.amount>0&&s.turns>0);
  }

  const before=e.hp,rawHp=Math.max(0,remaining),actualHp=Math.min(before,rawHp);
  if(rawHp>0)e.hp-=rawHp;

  if(absorbed&&actualHp)feedback(e,`🛡️-${absorbed}  ❤️-${actualHp}`,'damage');
  else if(absorbed)feedback(e,`🛡️-${absorbed}`,'shield-hit');
  else if(actualHp)feedback(e,`-${actualHp}`,'damage');

  if(e.hp<=0){
    e.hp=0;e.alive=false;
    if(isCombatObject(e))log(`${e.icon||'◼️'} ${e.name} fue destruido.`);
    else log(`📣 ${e.name} queda fuera de combate.`);
  }

  if(e.type==='doll'&&actualHp>0&&e.linkedTargetId){
    const linked=getEntity(e.linkedTargetId);
    const owner=getUnit(e.ownerId);
    const mode=e.linkMode||(linked&&owner?(linked.side===owner.side?'ally':'enemy'):null);

    if(linked?.alive&&linked.kind==='unit'){
      if(mode==='ally'){
        const amount=Math.ceil(actualHp/2);
        const got=heal(linked,amount);
        if(got>0)log(`🪆 Muñeco aliado: ${linked.name} recupera ${got} PV.`);
      }else if(mode==='enemy'){
        const echo=Math.floor(actualHp/2);
        if(echo>0){
          applyDamage(linked,echo,false);
          log(`🪆 Muñeco enemigo: ${linked.name} recibe ${echo} daño normal.`);
        }
      }
    }
  }

  if(e.type==='doll'&&!e.alive){
    const owner=getUnit(e.ownerId);
    if(owner?.painTransferActiveDollId===e.id){
      owner.painTransferActiveDollId=null;
      log(`🪆 Transferencia de Dolor termina porque ${e.name} fue destruido.`);
    }
  }

  return absorbed;
};

startDollPhase=function(owner,doll){
  if(!B||B.ended||!owner?.alive||!doll?.alive)return advanceTurn();
  clearInterval(timerId);
  const maxPm=doll.movePm||3;
  B.dollPhase={ownerId:owner.id,dollId:doll.id,pm:maxPm,maxPm};
  B.selectedAction=null;B.pendingImpulseTargetId=null;B.skillsOpen=false;B.busy=false;B.pendingTimeout=false;B.selectedUnitId=doll.id;
  log(`🪆 ${doll.name} dispone de ${maxPm} PM después del turno de ${owner.name}.`);
  renderBattle();
  if(owner.controller==='ai')setTimeout(aiDollPhase,380);
};

const _objectDescription=objectDescription;
objectDescription=function(z){
  if(z?.type!=='doll')return _objectDescription(z);
  const linked=getEntity(z.linkedTargetId);
  if(z.linkMode==='ally')return `Muñeco Vudú aliado: ${z.maxHp} PV, ${z.movePm||4} PM. Al recibir daño cura al aliado Vinculado un 50% redondeando hacia arriba.`;
  if(z.linkMode==='enemy')return `Muñeco Vudú enemigo: ${z.maxHp} PV, ${z.movePm||3} PM. Al recibir daño refleja un 50% como daño normal al enemigo Vinculado.`;
  return `Muñeco Vudú sin Vínculo: ${z.maxHp} PV, ${z.movePm||3} PM.`;
};

// ─────────────────────────────────────────────
// SIMBIOSIS / BROTES
// ─────────────────────────────────────────────

triggerSymbiosis=function(u,target){
  if(u.championId!=='onod'||u.symbiosisUsed||!target)return;
  const s=ownedSprouts(u).find(s=>adjCardinal(s,target)&&s.hp<s.maxHp);
  if(!s)return;
  const got=heal(s,3);
  if(got){
    u.symbiosisUsed=true;
    log(`🌿 Simbiosis: ${s.name} recupera ${got} PV.`);
  }
};

selectRemoveSprout=function(){
  const u=cur();
  if(!u||u.controller!=='human'||u.championId!=='onod'||!ownedSprouts(u).length||B.busy||u.sproutRemovedThisTurn)return;
  B.selectedAction=B.selectedAction==='removeSprout'?null:'removeSprout';
  B.skillsOpen=false;
  renderBattle();
};

removeSproutFree=function(x,y){
  const u=cur();
  if(!u||u.sproutRemovedThisTurn||!validRemoveSprout(x,y))return;
  const s=entityAt(x,y),name=s.name;
  destroyPillar(s);
  u.sproutRemovedThisTurn=true;
  B.selectedAction=null;
  log(`🌱 ${u.name} retira ${name} sin gastar PA. Máximo 1 retirada este turno.`);
  renderBattle();
};

// ─────────────────────────────────────────────
// TRAMPAS KORGAN
// ─────────────────────────────────────────────

isoTrapMarkup=function(trap,x,y){
  const viewer=humanUnit();
  if(viewer&&trap.side!==viewer.side)return '';
  return `<div class="iso-entity iso-trap friendly-trap" style="${isoEntityStyle(x,y,4)}" aria-hidden="true"><span>${trap.icon}</span></div>`;
};

triggerTrapAt=async function(target){
  const trap=B?.traps.find(t=>t.active&&t.side!==target.side&&t.x===target.x&&t.y===target.y);
  if(!trap)return;

  trap.active=false;

  if(trap.trapType==='spikes'){
    applyDamage(target,10,false);
    if(target.kind==='unit'&&target.alive){
      addWoundStatus(target,1);
      feedback(target,'🩸 +1','status');
      log(`🪤 Trampa de Pinchos: ${target.name} recibe 10 daño + Herida ${target.status.wound}.`);
    }else log(`🪤 Trampa de Pinchos: ${target.name} recibe 10 daño.`);
  }

  if(trap.trapType==='mine'){
    applyDamage(target,8,false);
    if(target.kind==='unit'&&target.alive){
      target.status.paPenaltyNext=Math.max(target.status.paPenaltyNext||0,1);
      feedback(target,'PA -1 próximo','status');
      log(`⚡ Mina Eléctrica: ${target.name} recibe 8 daño y perderá 1 PA en su próximo turno.`);
    }else log(`⚡ Mina Eléctrica: ${target.name} recibe 8 daño.`);
  }

  renderBattle();
  await sleep(180);
};

function validOwnTrap(u,x,y){
  const trap=trapAt(x,y);
  return !!(u?.championId==='korgan'&&trap?.active&&trap.ownerId===u.id);
}
function selectDisarmTrap(){
  const u=cur();
  if(!u||u.controller!=='human'||u.championId!=='korgan'||u.trapRemovedThisTurn||!activeTraps(u).length||B.busy)return;
  B.selectedAction=B.selectedAction==='disarmTrap'?null:'disarmTrap';
  B.skillsOpen=false;
  renderBattle();
}
function disarmTrapFree(x,y){
  const u=cur(),trap=trapAt(x,y);
  if(!u||u.trapRemovedThisTurn||!validOwnTrap(u,x,y))return;
  trap.active=false;
  u.trapRemovedThisTurn=true;
  B.selectedAction=null;
  log(`🪤 ${u.name} desarma voluntariamente una trampa propia. 0 PA.`);
  renderBattle();
}

const _validTargetTile=validTargetTile;
validTargetTile=function(x,y,action){
  if(action==='disarmTrap')return validOwnTrap(cur(),x,y);
  return _validTargetTile(x,y,action);
};

// ─────────────────────────────────────────────
// VALIDACIÓN DE HABILIDADES
// ─────────────────────────────────────────────

const _abilityRangeState=abilityRangeState;
abilityRangeState=function(u,id,x,y){
  const a=ability(u.championId,id),pos={x,y};
  if(!a)return null;

  if(id==='hammer')return adjCardinal(u,pos)?{inside:true,blocked:false}:null;

  if(id==='shot'){
    const d=md(u,pos);
    if(d<1||d>a.range||!(x===u.x||y===u.y))return null;
    return {inside:true,blocked:!clearLOS(u,pos)};
  }

  if(id==='curse'){
    if(!inRange(u,pos,a.range))return null;
    return {inside:true,blocked:!clearLOS(u,pos)};
  }

  if(id==='reflected'){
    const linked=getLinkedTarget(u),doll=ownedDoll(u);
    return linked&&linked.side===u.side&&doll?.linkedTargetId===linked.id&&linked.x===x&&linked.y===y?{inside:true,blocked:false}:null;
  }

  if(id==='disarmTrap')return null;

  return _abilityRangeState(u,id,x,y);
};

const _canUseAbility=canUseAbility;
canUseAbility=function(u,id,x,y){
  const a=ability(u.championId,id);
  if(!a||!u.loadout.includes(id)||u.pa<a.cost||B.busy||!skillUseAllowed(u,id))return false;

  const target=entityAt(x,y),pos={x,y};

  if(id==='hammer'){
    return !!(damageableEnemy(u,target)&&adjCardinal(u,target));
  }

  if(id==='germinate'){
    return ownedSprouts(u).length<3&&free(x,y)&&tileInRangeLOS(u,pos,a);
  }

  if(id==='trap_spikes'||id==='trap_snare'){
    return activeTraps(u).length<3&&free(x,y)&&tileInRangeLOS(u,pos,a);
  }

  if(id==='trap_bomb'){
    return tileInRangeLOS(u,pos,a);
  }

  if(id==='shot'){
    return !!(damageableEnemy(u,target)&&md(u,target)<=a.range&&md(u,target)>0&&(u.x===target.x||u.y===target.y)&&clearLOS(u,target));
  }

  if(id==='needle'){
    if(!target||target.kind!=='unit'||target.id===u.id)return false;
    if(target.side!==u.side&&!damageableEnemy(u,target))return false;
    return tileInRangeLOS(u,target,a);
  }

  if(id==='curse'){
    return !!(target?.kind==='unit'&&target.side!==u.side&&tileInRangeLOS(u,target,a));
  }

  if(id==='reflected'){
    const linked=getLinkedTarget(u),doll=ownedDoll(u);
    return !!(linked&&linked.side===u.side&&target?.id===linked.id&&doll?.alive&&doll.linkedTargetId===linked.id);
  }

  if(id==='ritual'){
    const linked=getLinkedTarget(u);
    return !!(linked&&linked.side!==u.side&&target?.id===linked.id&&tileInRangeLOS(u,linked,a));
  }

  return _canUseAbility(u,id,x,y);
};

const _invalidAbilityReason=invalidAbilityReason;
invalidAbilityReason=function(u,id,x,y){
  if(id==='germinate'&&ownedSprouts(u).length>=3)return 'Máximo de 3 Brotes activos.';
  if((id==='trap_spikes'||id==='trap_snare')&&activeTraps(u).length>=3)return 'Máximo de 3 trampas activas.';
  if(id==='shot'&&entityAt(x,y)&&!(x===u.x||y===u.y))return 'Disparo de Caza sólo permite objetivos en la misma fila o columna.';
  if(id==='hammer'&&entityAt(x,y)&&!adjCardinal(u,entityAt(x,y)))return 'Golpe de Martillo sólo alcanza las 4 casillas ortogonales adyacentes.';
  if(id==='reflected'){
    const linked=getLinkedTarget(u),doll=ownedDoll(u);
    if(!linked||linked.side!==u.side)return 'Transferencia de Dolor requiere un Vínculo aliado.';
    if(!doll?.alive||doll.linkedTargetId!==linked.id)return 'Transferencia de Dolor requiere un Muñeco asociado a ese aliado.';
  }
  if(id==='ritual'){
    const linked=getLinkedTarget(u);
    if(!linked||linked.side===u.side)return 'Ritual del Dolor requiere un enemigo Vinculado.';
  }
  return _invalidAbilityReason(u,id,x,y);
};

// ─────────────────────────────────────────────
// RÉPLICA COLOSO — ORTOGONAL
// ─────────────────────────────────────────────

triggerReplicas=async function(u,target,quakeId){
  const used=new Set();
  while(target.alive){
    const p=ownedPillars(u).find(p=>!used.has(p.id)&&p.lastReplicaQuakeId!==quakeId&&adjCardinal(p,target));
    if(!p)break;

    used.add(p.id);
    p.lastReplicaQuakeId=quakeId;
    applyDamage(target,6,false);
    log(`🌋 ${p.name} — Réplica: 6 daño a ${target.name}.`);
    renderBattle();await sleep(180);

    if(!target.alive)break;
    await forcedMove(target,p,1,true,'Réplica');
  }
};

// ─────────────────────────────────────────────
// EJECUCIÓN DE HABILIDADES MODIFICADAS
// ─────────────────────────────────────────────

const _executeAbility=executeAbility;

async function beginBalancedAction(u,id,x,y){
  if(!canUseAbility(u,id,x,y))return null;
  const a=ability(u.championId,id),target=entityAt(x,y);
  B.busy=true;
  B.noticeSeq++;
  B.notice=`${u.icon} ${u.name} — ${a.icon} ${a.name}`;
  if(target)faceTarget(u,target);
  registerSkillUse(u,id);
  u.pa-=a.cost;
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
  return {a,target,objectTarget:isCombatObject(target)};
}

async function finishBalancedAction(u){
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

executeAbility=async function(u,id,x,y,fromAI=false){
  const custom=new Set([
    'daggers','shield','rupture',
    'thorn','sap','spores','awakening',
    'trap_spikes','trap_snare','trap_bomb','shot','hook',
    'needle','reflected','doll','curse','ritual'
  ]);

  if(!custom.has(id))return _executeAbility(u,id,x,y,fromAI);

  const ctx=await beginBalancedAction(u,id,x,y);
  if(!ctx)return false;
  if(ctx.aborted)return true;
  const {a,target,objectTarget}=ctx;

  if(id==='daggers'){
    const dmg=skillDamage(u,a);
    applyDamage(target,dmg,false);
    log(`🩸 Dagas Danzantes: ${dmg} daño a ${target.name}.`);
    if(!objectTarget&&target.alive){
      addWoundStatus(target,1);
      feedback(target,'🩸 +1','status');
      log(`🩸 ${target.name} obtiene Herida ${target.status.wound}.`);
    }
  }

  else if(id==='shield'){
    addShield(u,20,'Portación de Escudo');
    log(`🛡️ ${u.name} obtiene 20 de Escudo.`);
  }

  else if(id==='rupture'){
    applyDamage(target,16,false);
    log(`💥 Ruptura de Marca: 16 daño a ${target.name}.`);
    if(target.alive)await forcedMove(target,u,2,true,'Empuje');
    clearMarkedTarget(u);
  }

  else if(id==='thorn'){
    applyDamage(target,7,false);
    log(`☠️ Espina Venenosa: 7 daño a ${target.name}.`);
    if(!objectTarget&&target.alive){
      addPoisonStatus(target,1);
      feedback(target,'☠️ +1','status');
      log(`☠️ ${target.name} obtiene Veneno ${target.status.poison}.`);
      triggerSymbiosis(u,target);
    }
  }

  else if(id==='sap'){
    const near=ownedSprouts(u).some(s=>adjCardinal(s,target));
    const got=heal(target,near?14:10);
    log(`💚 Savia Vital: ${target.name} recupera ${got} PV${near?' junto a un Brote ortogonal':''}.`);
    triggerSymbiosis(u,target);
  }

  else if(id==='spores'){
    const cells=[{x,y},{x:x+1,y},{x:x-1,y},{x,y:y+1},{x,y:y-1}];
    const victims=allEntities().filter(z=>z.alive&&z.side!==u.side&&cells.some(c=>c.x===z.x&&c.y===z.y));
    for(const z of victims){
      applyDamage(z,8,false);
      if(z.kind==='unit'&&z.alive){
        addPoisonStatus(z,1);
        log(`🌬️ Esporas: ${z.name} recibe 8 daño + Veneno ${z.status.poison}.`);
        triggerSymbiosis(u,z);
      }else log(`🌬️ Esporas: ${z.name} recibe 8 daño.`);
    }
  }

  else if(id==='awakening'){
    const sprouts=[...ownedSprouts(u)];
    const hits=new Map();
    for(const enemy of B.units.filter(z=>z.alive&&z.side!==u.side)){
      const count=sprouts.filter(s=>adjCardinal(s,enemy)).length;
      if(count>0)hits.set(enemy.id,count);
    }
    log(`🌳 ${u.name} despierta simultáneamente ${sprouts.length} Brote${sprouts.length!==1?'s':''}.`);
    for(const [enemyId,count] of hits){
      const enemy=getUnit(enemyId);
      if(!enemy?.alive)continue;
      const dmg=8*count;
      applyDamage(enemy,dmg,false);
      log(`🌳 ${enemy.name} recibe ${dmg} daño desde ${count} Brote${count!==1?'s':''}.`);
    }
  }

  else if(id==='trap_spikes'||id==='trap_snare'){
    const trapType=id==='trap_spikes'?'spikes':'mine';
    const icon=id==='trap_spikes'?'🪤':'⚡';
    B.traps.push({id:`trap${B.nextTrapId++}`,trapType,icon,x,y,ownerId:u.id,side:u.side,active:true});
    log(`${icon} ${u.name} coloca ${a.name}.`);
  }

  else if(id==='trap_bomb'){
    const center={x,y};
    const centerTarget=entityAt(x,y);
    if(centerTarget?.alive){
      applyDamage(centerTarget,12,false);
      log(`💣 Granada: ${centerTarget.name} recibe 12 daño en el centro.`);
    }

    const cardinal=[[1,0],[-1,0],[0,1],[0,-1]];
    const adjacent=[];
    for(const [dx,dy] of cardinal){
      const z=entityAt(x+dx,y+dy);
      if(z?.alive)adjacent.push(z);
    }

    for(const z of adjacent){
      applyDamage(z,8,false);
      log(`💥 Granada: ${z.name} recibe 8 daño en el área.`);
      if(z.kind==='unit'&&z.alive)await forcedMove(z,center,1,true,'Granada');
    }
  }

  else if(id==='shot'){
    applyDamage(target,12,false);
    log(`🏹 Disparo de Caza: 12 daño a ${target.name}.`);
  }

  else if(id==='hook'){
    applyDamage(target,6,false);
    log(`🪝 Gancho: 6 daño a ${target.name}.`);
    if(!objectTarget&&target.alive)await forcedMove(target,u,2,false,'Gancho');
  }

  else if(id==='needle'){
    if(target.side===u.side){
      const got=heal(target,7);
      setLinkedTarget(u,target);
      log(`🪡 Aguja Vudú: ${target.name} recupera ${got} PV y queda Vinculado a ${u.name}.`);
    }else{
      applyDamage(target,7,false);
      if(target.alive){
        setLinkedTarget(u,target);
        log(`🪡 Aguja Vudú: ${target.name} recibe 7 daño y queda Vinculado a ${u.name}.`);
      }else log(`🪡 Aguja Vudú: ${target.name} recibe 7 daño.`);
    }
  }

  else if(id==='reflected'){
    const linked=getLinkedTarget(u),doll=ownedDoll(u);
    if(linked&&doll?.alive&&doll.linkedTargetId===linked.id){
      u.painTransferActiveDollId=doll.id;
      log(`🪆 ${u.name} activa Transferencia de Dolor con ${doll.name}.`);
    }
  }

  else if(id==='doll'){
    const n=B.nextObjectId++,linked=getLinkedTarget(u);
    const mode=linked?(linked.side===u.side?'ally':'enemy'):null;
    const hp=mode==='ally'?30:16;
    const movePm=mode==='ally'?4:3;
    const d={
      id:`doll${n}`,type:'doll',kind:'object',ownerId:u.id,side:u.side,
      name:'Muñeco Vudú',icon:'🪆',x,y,hp,maxHp:hp,alive:true,
      shieldStacks:[],blocksLOS:false,linkedTargetId:linked?.id||null,
      linkMode:mode,movePm
    };
    B.pillars.push(d);
    log(`🪆 ${u.name} invoca un Muñeco Vudú de ${hp} PV${linked?` asociado a ${linked.name}`:''}.`);
  }

  else if(id==='curse'){
    applyDamage(target,9,false);
    log(`☠️ Maldición: ${target.name} recibe 9 daño.`);
    if(target.alive){
      addPoisonStatus(target,1);
      feedback(target,'☠️ +1','status');
      log(`☠️ ${target.name} obtiene Veneno ${target.status.poison}.`);
    }
  }

  else if(id==='ritual'){
    const doll=ownedDoll(u);
    const associated=!!(doll?.alive&&doll.linkedTargetId===target.id&&adjCardinal(doll,target));
    const dmg=associated?20:14;
    applyDamage(target,dmg,false);
    log(`👁️ Ritual del Dolor: ${target.name} recibe ${dmg} daño${associated?' con +6 del Muñeco asociado':''}.`);
    clearLinkedTarget(u);
  }

  return finishBalancedAction(u);
};

// ─────────────────────────────────────────────
// IMPULSO — HERIDA YA SE RESUELVE EN dashUnit
// ─────────────────────────────────────────────

executeImpulse=async function(u,target,x,y){
  const a=ability(u.championId,'impulse');
  if(!a||u.pa<a.cost||!skillUseAllowed(u,'impulse')||!impulseTargetValid(u,target)||!straightDashValidFrom(target,x,y,2))return false;

  B.busy=true;
  B.noticeSeq++;
  B.notice=`${u.icon} ${u.name} — ${a.icon} ${a.name}`;
  registerSkillUse(u,'impulse');
  u.pa-=a.cost;
  triggerPoisonOnAbility(u);
  renderBattle();await sleep(140);
  if(!u.alive){
    B.notice='';B.selectedAction=null;B.pendingImpulseTargetId=null;B.busy=false;
    renderBattle();checkBattleEnd();return true;
  }

  await dashUnit(target,x,y);
  log(`💨 Impulso: ${target.name} se desplaza sin gastar PM. Herida se resolvió por cada casilla recorrida.`);

  spendPAAfterAction(u);
  B.notice='';
  B.selectedAction=null;
  B.pendingImpulseTargetId=null;
  B.busy=false;
  renderBattle();

  if(checkBattleEnd())return true;
  if(B.pendingTimeout&&!B.ended){nextTurn();return true}
  return true;
};

// ─────────────────────────────────────────────
// INFO DE HABILIDADES / ESTADOS
// ─────────────────────────────────────────────

const _actionInfo=actionInfo;
actionInfo=function(id){
  if(id==='disarmTrap')return {name:'Desarmar trampa',cost:'0 PA',text:'Korgan puede desarmar voluntariamente 1 trampa propia por turno.',target:'Trampa propia',range:'Sin alcance'};
  if(id==='removeSprout')return {name:'Retirar Brote',cost:'0 PA',text:'Onod puede retirar voluntariamente 1 Brote propio por turno.',target:'Brote propio',range:'Sin alcance'};

  const z=_actionInfo(id);
  if(!z)return z;

  if(id==='needle'){z.target='Enemigo o aliado';z.range='Alcance 4'}
  if(id==='curse'){z.target='Enemigo';z.range='Alcance 3'}
  if(id==='reflected'){z.target='Aliado Vinculado';z.range='Requiere Muñeco asociado'}
  if(id==='ritual'){z.target='Enemigo Vinculado';z.range='Alcance 4'}
  if(id==='trap_bomb'){z.target='Casilla objetivo';z.range='Alcance 3'}
  if(id==='shot'){z.target='Enemigo/objeto en línea';z.range='Alcance 5 lineal'}
  if(id==='trap_spikes'||id==='trap_snare'){z.target='Casilla libre';z.range='Alcance 3'}
  return z;
};

const _statusText=statusText,_statusChips=statusChips,_statusIcons=statusIcons;
statusText=function(u){
  let s=_statusText(u);
  if(u?.painTransferActiveDollId){
    if(s==='Sin estados')s='';
    s+=(s?' · ':'')+'🪆 Transferencia de Dolor';
  }
  return s||'Sin estados';
};
statusChips=function(u){
  let s=_statusChips(u);
  if(u?.painTransferActiveDollId){
    if(s.includes('state-empty'))s='';
    s+='<span class="state-chip control">🪆 Transferencia de Dolor</span>';
  }
  return s||'<span class="state-empty">Sin estados</span>';
};
statusIcons=function(u){
  const s=_statusIcons(u);
  return `${s}${s&&u?.painTransferActiveDollId?' ':''}${u?.painTransferActiveDollId?'🪆':''}`;
};

// ─────────────────────────────────────────────
// TAP DE TABLERO — DESARMAR TRAMPA
// ─────────────────────────────────────────────

battleTap=async function(e){
  if(!B||B.ended||B.busy||cur().controller!=='human')return;
  const t=e.target.closest('.tile');if(!t)return;
  const x=+t.dataset.x,y=+t.dataset.y,z=entityAt(x,y),u=cur();

  if(B.dollPhase){
    const doll=getEntity(B.dollPhase.dollId);
    if(z?.id===doll?.id){B.selectedUnitId=z.id;renderBattle();return}
    const ok=await moveDoll(x,y);
    if(!ok)showNotice('El Muñeco puede moverse sólo por casillas libres usando sus PM.');
    return;
  }

  if(!B.selectedAction){
    if(z){B.selectedUnitId=z.id;renderBattle()}
    return;
  }

  if(B.selectedAction==='move'){
    await moveUnit(u,x,y);
    if(!u.alive&&!B.ended)nextTurn();
    return;
  }
  if(B.selectedAction==='consumePillar'){consumePillarForPA(x,y);return}
  if(B.selectedAction==='removeSprout'){removeSproutFree(x,y);return}
  if(B.selectedAction==='disarmTrap'){disarmTrapFree(x,y);return}

  if(B.selectedAction==='impulse'){
    if(!B.pendingImpulseTargetId){
      if(!impulseTargetValid(u,z)){
        showNotice('Elegí a Piplus o a un aliado dentro de alcance 3.');
        return;
      }
      B.pendingImpulseTargetId=z.id;
      B.selectedUnitId=z.id;
      showNotice(`💨 Elegí el destino de ${z.name}: hasta 2 casillas en línea.`,1200);
      renderBattle();
      return;
    }
    const target=getUnit(B.pendingImpulseTargetId);
    if(!impulseDestinationValid(u,x,y)){
      showNotice('Destino inválido: hasta 2 casillas en línea y sin obstáculos.');
      return;
    }
    await executeImpulse(u,target,x,y);
    if(!u.alive&&!B.ended)nextTurn();
    return;
  }

  if(!canUseAbility(u,B.selectedAction,x,y)){
    showNotice(invalidAbilityReason(u,B.selectedAction,x,y));
    return;
  }

  await executeAbility(u,B.selectedAction,x,y,false);
  if(!u.alive&&!B.ended)nextTurn();
};

// ─────────────────────────────────────────────
// OFENSIVA / IA
// ─────────────────────────────────────────────

offensiveIds=function(u){
  return u.loadout.filter(id=>[
    'sword','daggers','bow','spear','hammer',
    'rock','quake',
    'marker','precise','vector','rupture',
    'thorn','vines','spores',
    'trap_bomb','shot','hook',
    'needle','curse','ritual'
  ].includes(id));
};

bestAttackPlay=function(u){
  let best=null,bestScore=-1e9;
  for(const target of enemyUnits(u,true)){
    for(const id of offensiveIds(u)){
      const a=ability(u.championId,id);
      if(!a||u.pa<a.cost||!canUseAbility(u,id,target.x,target.y))continue;

      let dmg=a.damage||0;
      if(id==='precise'&&getMarkedTarget(u)?.id===target.id)dmg=14;
      if(id==='ritual'){
        const doll=ownedDoll(u);
        if(doll?.alive&&doll.linkedTargetId===target.id&&adjCardinal(doll,target))dmg=20;
        else dmg=14;
      }

      const score=dmg*4+(1-target.hp/target.maxHp)*15-md(u,target);
      if(score>bestScore){bestScore=score;best={id,target}}
    }
  }
  return best;
};

aiTurn=async function(){
  if(!B||B.ended||cur().controller!=='ai'||B.busy)return;
  const u=cur();
  let t=chooseEnemyTarget(u);
  if(!t){checkBattleEnd();return}
  await sleep(350);

  if(shouldAIExitMonolith(u,t)){
    leaveMonolith(u,'La IA necesita recuperar movilidad.');
    B.notice=`🤖 ${u.name} sale de Monolito para volver a presionar.`;
    renderBattle();await sleep(280);B.notice='';
  }

  for(let cycle=0;cycle<8&&u.alive;cycle++){
    if(checkBattleEnd())return;
    t=chooseEnemyTarget(u);if(!t)break;

    if(u.championId==='piplus'&&u.loadout.includes('pulse')&&u.pa>=3){
      const ally=chooseHealTarget(u,'pulse');
      if(ally){await executeAbility(u,'pulse',ally.x,ally.y,true);await sleep(180);continue}
    }
    if(u.championId==='onod'&&u.loadout.includes('sap')&&u.pa>=3){
      const ally=chooseHealTarget(u,'sap');
      if(ally){await executeAbility(u,'sap',ally.x,ally.y,true);await sleep(180);continue}
    }
    if(u.championId==='coloso'&&u.loadout.includes('stonearmor')&&u.pa>=2){
      const ally=chooseStoneArmorTarget(u);
      if(ally&&ally.hp/ally.maxHp<.75){await executeAbility(u,'stonearmor',ally.x,ally.y,true);await sleep(180);continue}
    }

    if(u.championId==='piplus'&&!getMarkedTarget(u)&&u.loadout.includes('marker')&&canUseAbility(u,'marker',t.x,t.y)){
      await executeAbility(u,'marker',t.x,t.y,true);await sleep(180);continue;
    }

    if(u.championId==='onod'&&u.loadout.includes('germinate')&&ownedSprouts(u).length>=3&&!u.sproutRemovedThisTurn&&ownedSprouts(u).every(s=>md(s,t)>4)){
      const s=[...ownedSprouts(u)].sort((a,b)=>md(b,t)-md(a,t))[0];
      u.sproutRemovedThisTurn=true;
      destroyPillar(s);
      log(`🌱 IA: ${u.name} retira ${s.name} para reubicarlo.`);
      renderBattle();await sleep(140);continue;
    }

    if(u.championId==='onod'&&u.loadout.includes('germinate')&&ownedSprouts(u).length<3&&u.pa>=2){
      const pt=bestFreeTile(u,t,3,true);
      if(pt&&canUseAbility(u,'germinate',pt.x,pt.y)){
        await executeAbility(u,'germinate',pt.x,pt.y,true);await sleep(180);continue;
      }
    }

    if(u.championId==='korgan'&&activeTraps(u).length<3&&u.pa>=3){
      const trapIds=['trap_spikes','trap_snare'].filter(id=>u.loadout.includes(id)&&skillUseAllowed(u,id)&&u.pa>=ability(u.championId,id).cost);
      let trapPlay=null;
      for(const trapId of trapIds){
        const pt=bestFreeTile(u,t,3,true);
        if(pt&&canUseAbility(u,trapId,pt.x,pt.y)){trapPlay={trapId,pt};break}
      }
      if(trapPlay){
        await executeAbility(u,trapPlay.trapId,trapPlay.pt.x,trapPlay.pt.y,true);await sleep(180);continue;
      }
    }

    if(u.championId==='houngan'&&!getLinkedTarget(u)&&u.loadout.includes('needle')&&canUseAbility(u,'needle',t.x,t.y)){
      await executeAbility(u,'needle',t.x,t.y,true);await sleep(180);continue;
    }

    if(u.championId==='houngan'&&u.loadout.includes('curse')&&canUseAbility(u,'curse',t.x,t.y)){
      await executeAbility(u,'curse',t.x,t.y,true);await sleep(180);continue;
    }

    if(u.championId==='houngan'&&getLinkedTarget(u)&&u.loadout.includes('doll')&&!ownedDoll(u)&&u.pa>=3){
      const linked=getLinkedTarget(u),pt=bestFreeTile(u,linked||t,3,false);
      if(pt&&canUseAbility(u,'doll',pt.x,pt.y)){
        await executeAbility(u,'doll',pt.x,pt.y,true);await sleep(180);continue;
      }
    }

    if(u.championId==='coloso'&&u.monolith&&!u.monolithPillarGainUsed&&ownedPillars(u).length&&u.pa<3&&u.loadout.includes('rock')){
      const p=ownedPillars(u)[0],name=p.name;
      destroyPillar(p);u.pa+=1;u.monolithPillarGainUsed=true;
      feedback(u,'+1 PA','pa');log(`⚡ ${u.name} consume ${name} y obtiene +1 PA.`);
      renderBattle();await sleep(180);continue;
    }

    if(u.championId==='coloso'&&u.loadout.includes('absorb')&&u.hp/u.maxHp<.55&&u.pa>=2){
      const p=ownedPillars(u).find(p=>inRange(u,p,3)&&clearLOS(u,p));
      if(p){await executeAbility(u,'absorb',p.x,p.y,true);await sleep(180);continue}
    }

    const attack=bestAttackPlay(u);
    if(attack){
      await executeAbility(u,attack.id,attack.target.x,attack.target.y,true);
      await sleep(220);
      if(checkBattleEnd())return;
      continue;
    }

    const hostile=B.pillars.filter(p=>p.alive&&p.side!==u.side).sort((a,b)=>a.hp-b.hp);
    let objectPlay=null;
    for(const p of hostile){
      const ids=offensiveIds(u)
        .filter(id=>u.pa>=ability(u.championId,id).cost&&canUseAbility(u,id,p.x,p.y))
        .sort((a,b)=>(ability(u.championId,b).damage||0)-(ability(u.championId,a).damage||0));
      if(ids.length){objectPlay={p,id:ids[0]};break}
    }
    if(objectPlay){
      await executeAbility(u,objectPlay.id,objectPlay.p.x,objectPlay.p.y,true);
      await sleep(200);continue;
    }

    if(u.championId==='coloso'&&u.loadout.includes('fusion')&&!u.monolith&&!u.exitedMonolithThisTurn&&u.pa>=3){
      const p=ownedPillars(u).find(p=>adj8(u,p));
      if(p){await executeAbility(u,'fusion',p.x,p.y,true);await sleep(200);continue}
    }

    if(u.championId==='coloso'&&u.loadout.includes('pillar')&&u.pa>=2&&ownedPillars(u).length<(u.monolith?3:2)){
      const pt=bestPillarTile(u,t);
      if(pt&&md(u,t)>1){await executeAbility(u,'pillar',pt.x,pt.y,true);await sleep(180);continue}
    }

    if(u.championId==='arfeli'&&u.loadout.includes('shield')&&u.pa>=3&&shieldTotal(u)<8&&u.hp/u.maxHp<.8&&canUseAbility(u,'shield',u.x,u.y)){
      await executeAbility(u,'shield',u.x,u.y,true);await sleep(180);continue;
    }

    const mv=bestMoveForAI(u,t);
    if(mv&&mv.cost>0&&u.pm>0){
      await moveUnit(u,mv.x,mv.y);
      await sleep(190);
      if(checkBattleEnd())return;
      continue;
    }
    break;
  }

  if(!B.ended)setTimeout(nextTurn,350);
};

// ─────────────────────────────────────────────
// UI AUXILIAR: RETIRAR BROTE / DESARMAR TRAMPA
// ─────────────────────────────────────────────

function enhanceBalanceUI(){
  if(!B||B.ended)return;
  const u=cur();
  if(!u||u.controller!=='human')return;

  const removeSproutBtn=document.querySelector('#removeSprout');
  if(removeSproutBtn&&u.championId==='onod'){
    removeSproutBtn.disabled=!!u.sproutRemovedThisTurn;
    if(u.sproutRemovedThisTurn)removeSproutBtn.textContent='Retirar Brote · usado';
  }

  if(u.championId==='korgan'){
    const panel=document.querySelector('.battle-command-panel');
    if(panel&&!panel.querySelector('#disarmTrap')){
      let special=panel.querySelector('.special-actions');
      if(!special){
        special=document.createElement('div');
        special.className='special-actions balance-special-actions';
        const drawer=panel.querySelector('.skill-drawer');
        if(drawer)drawer.insertAdjacentElement('afterend',special);
      }

      const btn=document.createElement('button');
      btn.id='disarmTrap';
      btn.type='button';
      btn.textContent=u.trapRemovedThisTurn?'Desarmar trampa · usado':'Desarmar trampa · 0 PA';
      btn.disabled=!!u.trapRemovedThisTurn||!activeTraps(u).length;
      if(B.selectedAction==='disarmTrap')btn.classList.add('active-action');
      btn.addEventListener('click',e=>{
        e.stopPropagation();
        selectDisarmTrap();
      });
      special.appendChild(btn);
    }

    if(B.selectedAction==='disarmTrap'){
      const legend=panel?.querySelector('.range-legend');
      if(legend)legend.style.display='none';
    }
  }
}

let uiQueued=false;
new MutationObserver(()=>{
  if(uiQueued)return;
  uiQueued=true;
  requestAnimationFrame(()=>{
    uiQueued=false;
    enhanceBalanceUI();
  });
}).observe(document.querySelector('#app')||document.body,{childList:true,subtree:true});

enhanceBalanceUI();

})();