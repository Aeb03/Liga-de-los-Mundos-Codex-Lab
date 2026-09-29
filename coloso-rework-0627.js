(()=>{'use strict';

/*
  Liga de los Mundos — v0.6.27-v02
  REWORK COLOSO — bloque aislado

  Cargado después de balance-playtest y del rework de Arfeli.
  Sustituye las reglas viejas de Coloso sin tocar los demás campeones.
*/

const COLOSO_ID='coloso';
const COLOSO_SKILLS=new Set(['rock','stonearmor','absorb','quake','collapse','magnetism']);
const COLOSO_OWN_ACTIONS=new Set(['colosoCreatePillar','colosoFusion','colosoRecycle']);

const COLOSO_DEF={
  hp:115,pa:6,pm:3,ini:3,
  passive:{
    name:'Dominio Rocoso',
    text:'Coloso controla Pilares de 15 PV. Al inicio de su turno puede crear 1 Pilar a 0 PA y alcance 5; si se mueve o realiza otra acción antes, pierde esa oportunidad. Puede mantener hasta 2 Pilares normalmente y hasta 3 en Monolito. Fusión de Pilar, Reciclaje Rocoso y Salir de Monolito son acciones propias y no ocupan un espacio de habilidad.'
  },
  abilities:[
    {
      id:'rock',icon:'💥',name:'Lanzar Roca',cost:3,range:4,damage:8,
      text:'8 de daño. Alcance 4; en Monolito, alcance 5. Requiere línea de visión.'
    },
    {
      id:'stonearmor',icon:'🛡️',name:'Armadura de Piedra',cost:2,range:3,shield:10,maxUsesPerTurn:2,
      text:'Otorga 10 de Escudo a Coloso, un aliado o un Pilar propio a alcance 3. Máximo 2 usos por turno y cada objetivo sólo puede recibirla 1 vez por turno. El Escudo expira al inicio del próximo turno de Coloso o al romperse.'
    },
    {
      id:'absorb',icon:'🧲',name:'Absorción Rocosa',cost:2,range:3,
      text:'Consume un Pilar propio a alcance 3 y cura hasta 15 PV reales a Coloso. No puede consumir un Pilar creado durante el mismo turno. Requiere línea de visión.'
    },
    {
      id:'quake',icon:'🌋',name:'Golpe Sísmico',cost:3,range:1,damage:10,
      text:'Desde Coloso: 10 de daño + empuje 1. En Monolito también puede originarse desde un Pilar: 8 de daño + empuje 1. Después pueden activarse Réplicas desde Pilares propios ortogonalmente adyacentes: 6 de daño + empuje 1 por Pilar, máximo 1 vez cada uno. Un empuje bloqueado añade +2 de daño de colisión.'
    },
    {
      id:'collapse',icon:'🪨',name:'Colapso',cost:3,range:3,
      text:'Seleccioná un Pilar propio a alcance 3; en Monolito, alcance 5. Se consume y libera un cono de 3/2/1 casillas. Daño según los PV reales del Pilar: fila cercana máx.(3, PV−6), media máx.(3, PV−3), lejana máx.(3, PV). El área se previsualiza antes de lanzar.'
    },
    {
      id:'magnetism',icon:'🧲',name:'Magnetismo de Pilar',cost:3,range:3,
      text:'Seleccioná un Pilar propio a alcance 3; en Monolito, alcance 5. Luego elegí un combatiente a distancia Manhattan 5 del Pilar y atraelo hasta 2 casillas hacia él. Herida y trampas se activan normalmente durante el desplazamiento.'
    }
  ]
};

function installColosoDefinition(){
  const c=CHAMPIONS?.[COLOSO_ID];
  if(!c)return false;
  c.hp=COLOSO_DEF.hp;c.pa=COLOSO_DEF.pa;c.pm=COLOSO_DEF.pm;c.ini=COLOSO_DEF.ini;
  c.passive={...COLOSO_DEF.passive};
  c.abilities=COLOSO_DEF.abilities.map(a=>({...a}));
  BOT_LOADOUTS.coloso=['rock','stonearmor','quake','collapse'];
  return true;
}
installColosoDefinition();

function isColoso(u){return !!u&&u.championId===COLOSO_ID}
function colosoPillarCap(u){return u?.monolith?3:2}
function colosoTurnSerial(u){return Math.max(0,u?.colosoTurnSerial||0)}
function colosoCreateAvailable(u){
  return !!(
    isColoso(u)&&u.alive&&u.colosoCreateWindow&&!u.colosoPillarCreatedThisTurn&&
    ownedPillars(u).length<colosoPillarCap(u)
  );
}
function closeCreateWindow(u){
  if(isColoso(u))u.colosoCreateWindow=false;
}
function pillarCreatedThisTurn(u,p){
  return !!(isColoso(u)&&p?.ownerId===u.id&&p.createdByColosoTurn===colosoTurnSerial(u));
}
function createPillarEntity(u,x,y){
  const number=B.nextPillarId++;
  const p={
    id:`pillar${number}`,number,type:'pillar',kind:'object',ownerId:u.id,side:u.side,
    name:`Pilar ${number}`,icon:'🗿',x,y,hp:15,maxHp:15,alive:true,shieldStacks:[],
    blocksLOS:true,lastReplicaQuakeId:null,createdByColosoTurn:colosoTurnSerial(u)
  };
  B.pillars.push(p);
  return p;
}
function ownPillarAt(u,x,y){
  const p=entityAt(x,y);
  return p?.alive&&p.type==='pillar'&&p.ownerId===u.id?p:null;
}
function colosoSourceRange(u){return u?.monolith?5:3}
function colosoOwnActionValid(u,action,x,y){
  const p={x,y},z=entityAt(x,y);
  if(!isColoso(u)||!u.alive||B?.busy)return false;

  if(action==='colosoCreatePillar'){
    return colosoCreateAvailable(u)&&free(x,y)&&inRange(u,p,5)&&clearLOS(u,p);
  }

  if(action==='colosoFusion'){
    return !u.monolith&&!u.exitedMonolithThisTurn&&u.pa>=3&&
      z?.type==='pillar'&&z.ownerId===u.id&&adj8(u,z);
  }

  if(action==='colosoRecycle'){
    return u.monolith&&!u.colosoRecycleUsed&&
      z?.type==='pillar'&&z.ownerId===u.id;
  }

  return false;
}

function selectColosoOwnAction(action){
  const u=cur();
  if(!isColoso(u)||u.controller!=='human'||B.busy)return;
  B.selectedAction=B.selectedAction===action?null:action;
  B.skillsOpen=false;
  B.pendingImpulseTargetId=null;
  B.colosoMagnetPillarId=null;
  B.colosoCollapsePillarId=null;
  globalThis.LDMCombatCore?.aoe?.clear?.();
  renderBattle();
}

function executeColosoOwnAction(action,x,y){
  const u=cur();
  if(!colosoOwnActionValid(u,action,x,y))return false;
  const target=entityAt(x,y);

  if(action==='colosoCreatePillar'){
    const p=createPillarEntity(u,x,y);
    u.colosoPillarCreatedThisTurn=true;
    closeCreateWindow(u);
    B.selectedAction=null;
    log(`🗿 ${u.name} crea ${p.name} con 15 PV.`);
    renderBattle();
    return true;
  }

  closeCreateWindow(u);

  if(action==='colosoFusion'){
    const name=target.name;
    u.pa-=3;
    destroyPillar(target);
    u.monolithStoredPm=u.pm;
    u.monolith=true;
    u.pm=0;
    B.selectedAction=null;
    log(`🗿 ${u.name} consume ${name} y entra en Monolito.`);
    renderBattle();
    return true;
  }

  if(action==='colosoRecycle'){
    const sacrificed=target;
    const name=sacrificed.name;
    destroyPillar(sacrificed);
    u.colosoRecycleUsed=true;
    B.selectedAction=null;

    const damaged=ownedPillars(u)
      .filter(p=>p.hp<p.maxHp)
      .sort((a,b)=>a.hp-b.hp||(a.number||0)-(b.number||0))[0];

    if(damaged){
      const before=damaged.hp;
      damaged.hp=15;
      const repaired=15-before;
      feedback(damaged,`+${repaired} ❤️`,'heal');
      log(`♻️ Reciclaje Rocoso: ${name} se sacrifica y ${damaged.name} vuelve a 15 PV.`);
    }else{
      addShield(u,6,'Reciclaje Rocoso',u.id);
      log(`♻️ Reciclaje Rocoso: ${name} se sacrifica y ${u.name} obtiene 6 de Escudo.`);
    }
    renderBattle();
    return true;
  }

  return false;
}

function exitColosoMonolith(){
  const u=cur();
  if(!isColoso(u)||u.controller!=='human'||!u.monolith||B.busy)return false;
  closeCreateWindow(u);
  leaveMonolith(u);
  B.selectedAction=null;
  renderBattle();
  return true;
}

const _colosoBaseMakeUnit=makeUnit;
makeUnit=function(...args){
  const u=_colosoBaseMakeUnit(...args);
  if(isColoso(u)){
    u.colosoTurnSerial=0;
    u.colosoCreateWindow=false;
    u.colosoPillarCreatedThisTurn=false;
    u.colosoRecycleUsed=false;
  }
  return u;
};

const _colosoBaseBeginTurn=beginTurn;
beginTurn=function(){
  const u=cur?.();
  if(isColoso(u)){
    u.colosoTurnSerial=(u.colosoTurnSerial||0)+1;
    u.colosoCreateWindow=true;
    u.colosoPillarCreatedThisTurn=false;
    u.colosoRecycleUsed=false;
    u.stoneArmorTargetsUsed=[];
    B.colosoMagnetPillarId=null;
    B.colosoCollapsePillarId=null;
    B.colosoExecutionContext=null;
  }
  return _colosoBaseBeginTurn();
};

const _colosoBaseMoveUnit=moveUnit;
moveUnit=async function(u,x,y){
  if(isColoso(u)&&u.monolith)return false;
  const valid=isColoso(u)&&movementMap(u).has(key(x,y));
  if(valid)closeCreateWindow(u);
  return await _colosoBaseMoveUnit(u,x,y);
};

const _colosoBaseEffectiveRange=effectiveRange;
effectiveRange=function(u,a){
  if(isColoso(u)&&a?.id==='rock')return u.monolith?5:4;
  if(isColoso(u)&&['collapse','magnetism'].includes(a?.id))return u.monolith?5:3;
  return _colosoBaseEffectiveRange(u,a);
};

function colosoQuakeOrigin(u,target){
  if(!u||!target)return null;
  if(adj8(u,target))return u;
  if(u.monolith){
    return ownedPillars(u)
      .filter(p=>adj8(p,target))
      .sort((a,b)=>(a.number||0)-(b.number||0))[0]||null;
  }
  return null;
}

function collapseCells(pillar,dx,dy){
  if(!pillar||Math.abs(dx)+Math.abs(dy)!==1)return [];
  const perp={x:-dy,y:dx},out=[];
  for(const off of [-1,0,1])out.push({x:pillar.x+dx+perp.x*off,y:pillar.y+dy+perp.y*off,band:'near'});
  for(const off of [-1,1])out.push({x:pillar.x+dx*2+perp.x*off,y:pillar.y+dy*2+perp.y*off,band:'middle'});
  out.push({x:pillar.x+dx*3,y:pillar.y+dy*3,band:'far'});
  return out.filter(c=>inside(c.x,c.y));
}
function collapseDamageByBand(hp,band){
  if(band==='near')return Math.max(3,hp-6);
  if(band==='middle')return Math.max(3,hp-3);
  return Math.max(3,hp);
}

function magnetTargetValid(u,pillar,target){
  return !!(
    isColoso(u)&&pillar?.alive&&pillar.type==='pillar'&&pillar.ownerId===u.id&&
    target?.alive&&target.kind==='unit'&&
    md(pillar,target)>=1&&md(pillar,target)<=5&&
    !(u.monolith&&target.id===u.id)
  );
}

const _colosoBaseAbilityRangeState=abilityRangeState;
abilityRangeState=function(u,id,x,y){
  if(!isColoso(u))return _colosoBaseAbilityRangeState(u,id,x,y);

  const target=entityAt(x,y),pos={x,y};

  if(id==='stonearmor'){
    if(target?.id===u.id)return {inside:true,blocked:false};
    const r=3;
    if(!inRange(u,pos,r))return null;
    return {inside:true,blocked:!clearLOS(u,pos)};
  }

  if(id==='absorb'){
    if(!inRange(u,pos,3))return null;
    return {inside:true,blocked:!clearLOS(u,pos)};
  }

  if(id==='quake'){
    if(adj8(u,pos))return {inside:true,blocked:false};
    if(u.monolith&&ownedPillars(u).some(p=>adj8(p,pos)))return {inside:true,blocked:false};
    return null;
  }

  if(id==='collapse'){
    const limit=colosoSourceRange(u);
    if(target?.type==='pillar'&&target.ownerId===u.id&&inRange(u,target,limit)){
      return {inside:true,blocked:!clearLOS(u,target)};
    }
    return null;
  }

  if(id==='magnetism'){
    if(B?.colosoMagnetPillarId){
      const pillar=getEntity(B.colosoMagnetPillarId);
      if(!pillar?.alive)return null;
      const d=md(pillar,pos);
      return d>=1&&d<=5?{inside:true,blocked:false}:null;
    }
    const limit=colosoSourceRange(u);
    if(target?.type==='pillar'&&target.ownerId===u.id&&inRange(u,target,limit)){
      return {inside:true,blocked:!clearLOS(u,target)};
    }
    return null;
  }

  return _colosoBaseAbilityRangeState(u,id,x,y);
};

const _colosoBaseCanUseAbility=canUseAbility;
canUseAbility=function(u,id,x,y){
  if(!isColoso(u)||!COLOSO_SKILLS.has(id))return _colosoBaseCanUseAbility(u,id,x,y);

  const a=ability(COLOSO_ID,id);
  if(!a||!u.loadout.includes(id)||u.pa<a.cost||B.busy||!skillUseAllowed(u,id))return false;
  const target=entityAt(x,y),pos={x,y};

  if(id==='rock'){
    return !!(
      damageableEnemy(u,target)&&
      inRange(u,target,effectiveRange(u,a))&&
      clearLOS(u,target)
    );
  }

  if(id==='stonearmor'){
    if(!target||u.stoneArmorTargetsUsed.includes(target.id))return false;
    if(target.id===u.id)return true;
    if(target.kind==='unit'&&target.side===u.side)return inRange(u,target,3)&&clearLOS(u,target);
    return target.type==='pillar'&&target.ownerId===u.id&&inRange(u,target,3)&&clearLOS(u,target);
  }

  if(id==='absorb'){
    return !!(
      target?.type==='pillar'&&target.ownerId===u.id&&
      !pillarCreatedThisTurn(u,target)&&
      u.hp<u.maxHp&&
      inRange(u,target,3)&&clearLOS(u,target)
    );
  }

  if(id==='quake'){
    return !!(damageableEnemy(u,target)&&colosoQuakeOrigin(u,target));
  }

  if(id==='collapse'){
    const limit=colosoSourceRange(u);
    return !!(
      target?.type==='pillar'&&target.ownerId===u.id&&
      inRange(u,target,limit)&&clearLOS(u,target)
    );
  }

  if(id==='magnetism'){
    if(B?.colosoMagnetPillarId){
      const pillar=getEntity(B.colosoMagnetPillarId);
      return magnetTargetValid(u,pillar,target);
    }
    const limit=colosoSourceRange(u);
    return !!(
      target?.type==='pillar'&&target.ownerId===u.id&&
      inRange(u,target,limit)&&clearLOS(u,target)
    );
  }

  return false;
};

const _colosoBaseInvalidReason=invalidAbilityReason;
invalidAbilityReason=function(u,id,x,y){
  if(!isColoso(u)||!COLOSO_SKILLS.has(id))return _colosoBaseInvalidReason(u,id,x,y);
  const a=ability(COLOSO_ID,id),target=entityAt(x,y);
  if(!a)return 'Acción no disponible.';
  if(!skillUseAllowed(u,id))return `${a.name}: límite de usos por turno alcanzado.`;
  if(u.pa<a.cost)return 'PA insuficientes.';

  if(id==='stonearmor'){
    if(!target)return 'Elegí a Coloso, un aliado o un Pilar propio.';
    if(u.stoneArmorTargetsUsed.includes(target.id))return 'Ese objetivo ya recibió Armadura de Piedra este turno.';
  }
  if(id==='absorb'){
    if(!target||target.type!=='pillar'||target.ownerId!==u.id)return 'Elegí un Pilar propio.';
    if(pillarCreatedThisTurn(u,target))return 'Absorción Rocosa no puede consumir un Pilar creado este mismo turno.';
    if(u.hp>=u.maxHp)return 'Coloso ya tiene todos sus PV.';
  }
  if(id==='quake'&&!target)return 'Elegí una entidad enemiga.';
  if(id==='collapse'&&(!target||target.type!=='pillar'||target.ownerId!==u.id))return 'Elegí un Pilar propio como origen de Colapso.';
  if(id==='magnetism'){
    if(B?.colosoMagnetPillarId){
      const p=getEntity(B.colosoMagnetPillarId);
      if(!magnetTargetValid(u,p,target))return 'Elegí un combatiente a Manhattan 5 desde el Pilar.';
    }else if(!target||target.type!=='pillar'||target.ownerId!==u.id){
      return 'Elegí un Pilar propio como origen de Magnetismo.';
    }
  }
  const rs=abilityRangeState(u,id,x,y);
  if(!rs?.inside)return 'Fuera de alcance.';
  if(rs.blocked)return 'Sin línea de visión.';
  return 'Objetivo no válido.';
};

const _colosoBaseValidTargetTile=validTargetTile;
validTargetTile=function(x,y,action){
  const u=cur();
  if(isColoso(u)&&COLOSO_OWN_ACTIONS.has(action))return colosoOwnActionValid(u,action,x,y);
  return _colosoBaseValidTargetTile(x,y,action);
};

const _colosoBaseActionInfo=actionInfo;
actionInfo=function(id){
  const u=cur();
  if(isColoso(u)){
    if(id==='colosoCreatePillar')return {name:'Crear Pilar',cost:'0 PA',text:'Sólo mientras siga abierta la oportunidad inicial del turno. Crea 1 Pilar de 15 PV. Si Coloso se mueve o realiza otra acción primero, pierde esta oportunidad.',target:'Casilla libre',range:'Alcance 5 + LOS'};
    if(id==='colosoFusion')return {name:'Fusión de Pilar',cost:'3 PA',text:'Consume un Pilar propio adyacente y entra en Monolito. En Monolito Coloso no puede moverse.',target:'Pilar propio adyacente',range:'Alcance 1'};
    if(id==='colosoRecycle')return {name:'Reciclaje Rocoso',cost:'0 PA',text:'Sólo en Monolito, máximo 1 vez por turno. Sacrifica un Pilar. Si queda otro Pilar propio dañado, lo restaura a 15 PV; si no, Coloso obtiene 6 de Escudo.',target:'Pilar propio',range:'Cualquier Pilar propio'};
    if(id==='collapse'){
      const a=ability(COLOSO_ID,id);
      return {name:a.name,cost:`${a.cost} PA`,text:a.text,target:'Pilar propio → dirección',range:`Alcance ${colosoSourceRange(u)}`};
    }
    if(id==='magnetism'){
      const a=ability(COLOSO_ID,id);
      return {name:a.name,cost:`${a.cost} PA`,text:a.text,target:B?.colosoMagnetPillarId?'Combatiente':'Pilar propio',range:B?.colosoMagnetPillarId?'Manhattan 5 desde Pilar':`Alcance ${colosoSourceRange(u)}`};
    }
  }
  return _colosoBaseActionInfo(id);
};

async function quakePush(target,source,label){
  if(!target?.alive||target.kind!=='unit')return;
  const [dx,dy]=forcedDirection(source,target,true);
  if(!dx&&!dy)return;
  const nx=target.x+dx,ny=target.y+dy;
  const blocker=inside(nx,ny)?entityAt(nx,ny):null;
  if(!inside(nx,ny)||isFixedObstacle(nx,ny)||blocker){
    // Empuje 1 tendría 2 de colisión global; Golpe Sísmico añade +2.
    const collision=4;
    applyDamage(target,collision,false);
    log(`💥 ${label}: empuje bloqueado; ${target.name} recibe ${collision} daño de colisión.`);
    if(blocker&&blocker.id!==target.id){
      const half=Math.ceil(collision/2);
      applyDamage(blocker,half,false);
      log(`💥 ${blocker.name} recibe ${half} daño por la colisión.`);
    }
    renderBattle();await sleep(180);
    return;
  }
  const old={x:target.x,y:target.y};
  target.x=nx;target.y=ny;faceStep(target,old);
  applyWoundStep(target);
  renderBattle();await sleep(140);
  if(target.alive&&!checkBattleEnd())await triggerTrapAt(target);
}

async function triggerColosoReplicas(u,target,initialOrigin){
  if(!target?.alive||target.kind!=='unit')return;
  const used=new Set();
  if(initialOrigin?.type==='pillar')used.add(initialOrigin.id);

  while(target.alive){
    const p=ownedPillars(u)
      .filter(p=>!used.has(p.id)&&adjCardinal(p,target))
      .sort((a,b)=>(a.number||0)-(b.number||0))[0];
    if(!p)break;
    used.add(p.id);
    applyDamage(target,6,false);
    log(`🌋 ${p.name} activa Réplica: 6 daño a ${target.name}.`);
    renderBattle();await sleep(150);
    if(!target.alive||checkBattleEnd())break;
    await quakePush(target,p,'Réplica');
  }
}

function bestCollapsePlan(u,pillar){
  if(!pillar?.alive)return null;
  const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
  let best=null;
  for(const [dx,dy] of dirs){
    const cells=collapseCells(pillar,dx,dy);
    let value=0,hits=0;
    for(const c of cells){
      const z=entityAt(c.x,c.y);
      if(!z?.alive||z.side===u.side)continue;
      const dmg=collapseDamageByBand(pillar.hp,c.band);
      const effective=Math.min(dmg,(z.hp||0)+shieldTotal(z));
      value+=effective*1.45+(z.hp<=dmg?7:0);
      hits++;
    }
    if(hits>1)value+=(hits-1)*3;
    if(!best||value>best.value)best={dx,dy,cells,value,hits};
  }
  return best||{dx:1,dy:0,cells:collapseCells(pillar,1,0),value:0,hits:0};
}

function nearestEnemyDistanceFrom(u,pos){
  const foes=enemyUnits(u,true);
  if(!foes.length)return 99;
  return Math.min(...foes.map(e=>md(pos,e)));
}
function simulatePullEnd(pillar,target,steps=2){
  let x=target.x,y=target.y;
  const out=[];
  for(let i=0;i<steps;i++){
    const dx=Math.sign(pillar.x-x),dy=Math.sign(pillar.y-y);
    let nx=x,ny=y;
    if(Math.abs(pillar.x-x)>=Math.abs(pillar.y-y)&&dx)nx+=dx;
    else if(dy)ny+=dy;
    else if(dx)nx+=dx;
    if(nx===pillar.x&&ny===pillar.y)break;
    if(!inside(nx,ny)||isFixedObstacle(nx,ny)||entityAt(nx,ny))break;
    x=nx;y=ny;out.push({x,y});
  }
  return {x,y,steps:out.length};
}
function bestMagnetismTarget(u,pillar){
  if(!pillar?.alive)return null;
  let best=null;
  for(const target of B.units.filter(z=>z.alive&&md(pillar,z)>=1&&md(pillar,z)<=5)){
    if(u.monolith&&target.id===u.id)continue;
    const end=simulatePullEnd(pillar,target,2);
    let value=0;
    if(target.side!==u.side){
      value=6+end.steps*2;
      const before=nearestEnemyDistanceFrom(target,target);
      const allyPressure=teamUnits(u,true).filter(a=>a.id!==target.id).some(a=>md(a,end)<=2);
      if(allyPressure)value+=5;
      if(md(pillar,target)<=2)value-=1;
    }else{
      const foes=enemyUnits(u,true);
      const before=foes.length?Math.min(...foes.map(e=>md(target,e))):99;
      const after=foes.length?Math.min(...foes.map(e=>md(end,e))):99;
      value=(after-before)*3+(target.hp/target.maxHp<.45?4:0);
      if(target.id===u.id)value-=1;
    }
    if(!best||value>best.value)best={target,end,value};
  }
  return best;
}

async function beginColosoSkill(u,id,x,y){
  if(!canUseAbility(u,id,x,y))return null;
  const a=ability(COLOSO_ID,id),target=entityAt(x,y);
  closeCreateWindow(u);
  B.busy=true;B.noticeSeq++;B.notice=`${u.icon} ${u.name} — ${a.icon} ${a.name}`;
  if(target)faceTarget(u,target);
  registerSkillUse(u,id);
  u.pa-=a.cost;
  triggerPoisonOnAbility(u);
  renderBattle();
  await sleep(140);
  if(!u.alive){
    B.notice='';B.selectedAction=null;B.busy=false;renderBattle();checkBattleEnd();
    return {aborted:true};
  }
  return {a,target};
}
async function finishColosoSkill(u){
  spendPAAfterAction(u);
  B.notice='';
  B.selectedAction=null;
  B.busy=false;
  B.colosoExecutionContext=null;
  B.colosoMagnetPillarId=null;
  B.colosoCollapsePillarId=null;
  renderBattle();
  if(checkBattleEnd())return true;
  if(B.pendingTimeout&&!B.ended)nextTurn();
  return true;
}

const _colosoBaseExecuteAbility=executeAbility;
executeAbility=async function(u,id,x,y,fromAI=false){
  if(!isColoso(u)||!COLOSO_SKILLS.has(id)){
    return _colosoBaseExecuteAbility(u,id,x,y,fromAI);
  }

  let context=B?.colosoExecutionContext||null;

  if(fromAI&&id==='collapse'&&!context){
    const pillar=entityAt(x,y);
    const plan=bestCollapsePlan(u,pillar);
    if(plan)context={kind:'collapse',pillarId:pillar?.id,dx:plan.dx,dy:plan.dy};
  }
  if(fromAI&&id==='magnetism'&&!context){
    const pillar=entityAt(x,y);
    const plan=bestMagnetismTarget(u,pillar);
    if(plan)context={kind:'magnetism',pillarId:pillar?.id,targetId:plan.target.id};
  }

  const ctx=await beginColosoSkill(u,id,x,y);
  if(!ctx)return false;
  if(ctx.aborted)return true;
  const {a,target}=ctx;

  if(id==='rock'){
    applyDamage(target,8,false);
    log(`💥 Lanzar Roca: ${target.name} recibe 8 daño.`);
    renderBattle();await sleep(160);
    return finishColosoSkill(u);
  }

  if(id==='stonearmor'){
    u.stoneArmorTargetsUsed.push(target.id);
    addShield(target,10,'Armadura de Piedra',u.id);
    log(`🛡️ Armadura de Piedra: ${target.name} obtiene 10 de Escudo.`);
    renderBattle();await sleep(150);
    return finishColosoSkill(u);
  }

  if(id==='absorb'){
    const name=target.name;
    destroyPillar(target);
    const got=heal(u,15);
    log(`🧲 Absorción Rocosa: ${u.name} consume ${name} y recupera ${got} PV reales.`);
    renderBattle();await sleep(150);
    return finishColosoSkill(u);
  }

  if(id==='quake'){
    const origin=colosoQuakeOrigin(u,target)||u;
    const projected=origin.type==='pillar';
    const dmg=projected?8:10;
    applyDamage(target,dmg,false);
    log(projected
      ?`🌋 ${origin.name} proyecta Golpe Sísmico: ${target.name} recibe ${dmg} daño.`
      :`🌋 Golpe Sísmico: ${target.name} recibe ${dmg} daño.`);
    renderBattle();await sleep(150);

    if(target.alive&&target.kind==='unit'){
      await quakePush(target,origin,projected?'Golpe Sísmico proyectado':'Golpe Sísmico');
      if(u.monolith&&target.alive)await triggerColosoReplicas(u,target,origin);
    }
    return finishColosoSkill(u);
  }

  if(id==='collapse'){
    const pillar=getEntity(context?.pillarId||target?.id);
    const dx=context?.dx,dy=context?.dy;
    if(!pillar?.alive||pillar.ownerId!==u.id||Math.abs(dx||0)+Math.abs(dy||0)!==1){
      // La selección dejó de ser válida entre preview y ejecución.
      u.pa+=a.cost;
      B.busy=false;B.notice='';B.selectedAction=id;B.colosoExecutionContext=null;
      renderBattle();
      showNotice('El Pilar o la dirección de Colapso ya no son válidos.');
      return false;
    }
    const hp=pillar.hp;
    const cells=collapseCells(pillar,dx,dy);
    const name=pillar.name;
    destroyPillar(pillar);
    log(`🪨 Colapso: ${name} se consume con ${hp} PV reales.`);
    for(const c of cells){
      const z=entityAt(c.x,c.y);
      if(!z?.alive||z.side===u.side)continue;
      const dmg=collapseDamageByBand(hp,c.band);
      applyDamage(z,dmg,false);
      log(`🪨 Colapso (${c.band}): ${z.name} recibe ${dmg} daño.`);
    }
    renderBattle();await sleep(180);
    return finishColosoSkill(u);
  }

  if(id==='magnetism'){
    const pillar=getEntity(context?.pillarId||target?.id);
    const pullTarget=getEntity(context?.targetId);
    if(!pillar?.alive||pillar.ownerId!==u.id||!magnetTargetValid(u,pillar,pullTarget)){
      u.pa+=a.cost;
      B.busy=false;B.notice='';B.selectedAction=id;B.colosoExecutionContext=null;
      renderBattle();
      showNotice('El Pilar o el objetivo de Magnetismo ya no son válidos.');
      return false;
    }
    log(`🧲 Magnetismo de Pilar: ${pillar.name} atrae a ${pullTarget.name}.`);
    await forcedMove(pullTarget,pillar,2,false,'Magnetismo');
    return finishColosoSkill(u);
  }

  return finishColosoSkill(u);
};

function startCollapsePreview(u,pillar){
  const aoe=globalThis.LDMCombatCore?.aoe;
  if(!aoe)return false;
  B.colosoCollapsePillarId=pillar.id;
  B.colosoMagnetPillarId=null;

  const started=aoe.start({
    abilityId:'collapse',
    origin:{x:pillar.x,y:pillar.y},
    pattern:(dirTarget)=>{
      const dx=dirTarget.x-pillar.x,dy=dirTarget.y-pillar.y;
      return collapseCells(pillar,dx,dy).map(c=>({...c,zone:c.band}));
    },
    validTarget:(x,y)=>Math.abs(x-pillar.x)+Math.abs(y-pillar.y)===1,
    onCommit:async ({target})=>{
      const live=getEntity(pillar.id);
      if(!live?.alive)return false;
      const dx=target.x-live.x,dy=target.y-live.y;
      aoe.clear();
      B.colosoExecutionContext={kind:'collapse',pillarId:live.id,dx,dy};
      await executeAbility(u,'collapse',live.x,live.y,false);
      return true;
    }
  });

  if(!started)return false;

  // Mostrar el cono inmediatamente. Elegimos como orientación inicial la
  // dirección cardinal que más se aproxima al enemigo más cercano.
  const foes=enemyUnits(u,true);
  const nearest=foes.slice().sort((a,b)=>md(pillar,a)-md(pillar,b))[0]||null;
  const candidates=[[1,0],[-1,0],[0,1],[0,-1]]
    .map(([dx,dy])=>({dx,dy,x:pillar.x+dx,y:pillar.y+dy}))
    .filter(p=>inside(p.x,p.y));

  candidates.sort((a,b)=>{
    if(!nearest)return 0;
    return md({x:a.x,y:a.y},nearest)-md({x:b.x,y:b.y},nearest);
  });

  const initial=candidates[0];
  if(initial){
    aoe.update(initial.x,initial.y);
    aoe.lock();
  }
  return true;
}

const _colosoBaseBattleTap=battleTap;
battleTap=async function(e){
  if(!B||B.ended||B.busy||cur()?.controller!=='human')return _colosoBaseBattleTap(e);
  const tile=e.target.closest('.tile');
  if(!tile)return _colosoBaseBattleTap(e);
  const x=+tile.dataset.x,y=+tile.dataset.y,z=entityAt(x,y),u=cur();
  if(!isColoso(u))return _colosoBaseBattleTap(e);

  if(COLOSO_OWN_ACTIONS.has(B.selectedAction)){
    if(!executeColosoOwnAction(B.selectedAction,x,y)){
      showNotice('Objetivo o casilla no válida para esta acción.');
    }
    return;
  }

  if(B.selectedAction==='collapse'&&!globalThis.LDMCombatCore?.aoe?.state?.()?.active){
    if(!canUseAbility(u,'collapse',x,y)){
      showNotice(invalidAbilityReason(u,'collapse',x,y));return;
    }
    if(!startCollapsePreview(u,z)){
      showNotice('No se pudo iniciar la previsualización de Colapso.');return;
    }
    renderBattle();
    showNotice('🪨 Deslizá el cono para elegir dirección. Soltá para fijarlo y tocá otra vez el centro para lanzar.',1400);
    return;
  }

  if(B.selectedAction==='magnetism'){
    if(!B.colosoMagnetPillarId){
      if(!canUseAbility(u,'magnetism',x,y)){
        showNotice(invalidAbilityReason(u,'magnetism',x,y));return;
      }
      B.colosoMagnetPillarId=z.id;
      B.colosoCollapsePillarId=null;
      renderBattle();
      showNotice('🧲 Ahora elegí un combatiente a Manhattan 5 desde el Pilar.',1200);
      return;
    }
    const pillar=getEntity(B.colosoMagnetPillarId);
    if(!magnetTargetValid(u,pillar,z)){
      showNotice('Elegí un combatiente a Manhattan 5 desde el Pilar.');return;
    }
    B.colosoExecutionContext={kind:'magnetism',pillarId:pillar.id,targetId:z.id};

    // Ya elegimos el segundo objetivo. Limpiamos el marcador de etapa antes
    // de entrar a executeAbility para que la validación inicial vuelva a
    // validar el Pilar (etapa 1), mientras el objetivo real queda guardado
    // en colosoExecutionContext.
    B.colosoMagnetPillarId=null;

    await executeAbility(u,'magnetism',pillar.x,pillar.y,false);
    return;
  }

  return _colosoBaseBattleTap(e);
};

const _colosoBaseRenderBattle=renderBattle;
renderBattle=function(...args){
  const u=cur?.();
  if(!isColoso(u)||B?.selectedAction!=='magnetism')B.colosoMagnetPillarId=null;
  if(!isColoso(u)||B?.selectedAction!=='collapse')B.colosoCollapsePillarId=null;

  const out=_colosoBaseRenderBattle(...args);

  if(!B||B.ended||!isColoso(u)||u.controller!=='human'||B.dollPhase)return out;

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

  const count=ownedPillars(u).length;
  const cap=colosoPillarCap(u);
  const createDisabled=!colosoCreateAvailable(u);
  const fusionDisabled=u.monolith||u.exitedMonolithThisTurn||u.pa<3||!ownedPillars(u).some(p=>adj8(u,p));
  const recycleDisabled=!u.monolith||u.colosoRecycleUsed||count===0;

  holder.innerHTML=[
    `<button data-coloso-own="colosoCreatePillar" class="${B.selectedAction==='colosoCreatePillar'?'active-action':''}" ${createDisabled?'disabled':''}>Crear Pilar · 0 PA <small>${count}/${cap}</small></button>`,
    !u.monolith?`<button data-coloso-own="colosoFusion" class="${B.selectedAction==='colosoFusion'?'active-action':''}" ${fusionDisabled?'disabled':''}>Fusión de Pilar · 3 PA</button>`:'',
    u.monolith?`<button id="colosoExitMonolith">Salir de Monolito · 0 PA</button>`:'',
    u.monolith?`<button data-coloso-own="colosoRecycle" class="${B.selectedAction==='colosoRecycle'?'active-action':''}" ${recycleDisabled?'disabled':''}>Reciclaje Rocoso · 0 PA</button>`:''
  ].join('');

  // El botón viejo de Consumo +1 PA ya no pertenece al diseño vigente.
  document.querySelector('#consumePillar')?.remove();
  document.querySelector('#exitMonolith')?.remove();

  holder.querySelectorAll('[data-coloso-own]').forEach(btn=>{
    btn.addEventListener('click',e=>{
      e.stopPropagation();
      selectColosoOwnAction(btn.dataset.colosoOwn);
    });
  });
  holder.querySelector('#colosoExitMonolith')?.addEventListener('click',e=>{
    e.stopPropagation();exitColosoMonolith();
  });

  const help=document.querySelector('.combat-help');
  if(help&&B.colosoMagnetPillarId){
    const p=getEntity(B.colosoMagnetPillarId);
    help.textContent=`Magnetismo: ${p?.name||'Pilar'} seleccionado. Elegí un combatiente a Manhattan 5.`;
  }

  return out;
};

// Si el jugador elige otra habilidad, cancelar etapas de Coloso.
document.addEventListener('click',e=>{
  const b=e.target.closest?.('[data-skill]');
  if(!b||!B)return;
  if(b.dataset.skill!=='collapse'){
    B.colosoCollapsePillarId=null;
    globalThis.LDMCombatCore?.aoe?.clear?.();
  }
  if(b.dataset.skill!=='magnetism')B.colosoMagnetPillarId=null;
},true);

// ---------------- IA helpers públicos ----------------

function bestCreatePillarTile(u){
  if(!colosoCreateAvailable(u))return null;
  const foes=enemyUnits(u,true);
  let best=null;
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    if(!colosoOwnActionValid(u,'colosoCreatePillar',x,y))continue;
    const pos={x,y};
    const enemyDist=foes.length?Math.min(...foes.map(e=>md(pos,e))):99;
    let score=0;
    if(enemyDist===1)score+=12;
    else if(enemyDist===2)score+=9;
    else if(enemyDist===3)score+=6;
    else if(enemyDist===4)score+=3;
    score-=md(u,pos)*.25;
    if(adj8(u,pos)&&!u.monolith)score+=2;
    if(!best||score>best.score)best={x,y,score};
  }
  return best;
}
function chooseRecycleSacrifice(u){
  const pillars=ownedPillars(u);
  if(!pillars.length)return null;
  const damaged=pillars.filter(p=>p.hp<15).sort((a,b)=>a.hp-b.hp)[0]||null;
  const foes=enemyUnits(u,true);
  const scoreP=p=>{
    const d=foes.length?Math.min(...foes.map(e=>md(p,e))):99;
    const isRepair=damaged&&p.id===damaged.id;
    return d+(p.hp===15?2:0)-(isRepair?8:0);
  };
  return pillars.slice().sort((a,b)=>scoreP(b)-scoreP(a))[0]||null;
}
async function aiPrepareTurn(u){
  if(!isColoso(u)||u.controller!=='ai'||B.busy)return;

  // Si Monolito quedó fuera del frente, recuperar movilidad.
  const foes=enemyUnits(u,true);
  const nearest=foes.length?Math.min(...foes.map(e=>md(u,e))):99;
  if(u.monolith&&nearest>5){
    closeCreateWindow(u);
    leaveMonolith(u,'El frente quedó fuera de alcance.');
    log(`🤖 ${u.name} sale de Monolito para reposicionarse.`);
    renderBattle();await sleep(120);
  }

  // La oportunidad de crear Pilar sólo existe antes de cualquier otra acción.
  if(colosoCreateAvailable(u)){
    const plan=bestCreatePillarTile(u);
    if(plan&&plan.score>=3){
      executeColosoOwnAction('colosoCreatePillar',plan.x,plan.y);
      await sleep(120);
    }
  }

  // Reciclaje si puede reparar un Pilar o si necesita protección.
  if(u.monolith&&!u.colosoRecycleUsed&&ownedPillars(u).length){
    const damaged=ownedPillars(u).some(p=>p.hp<15);
    const needShield=u.hp/u.maxHp<.48&&shieldTotal(u)<4&&ownedPillars(u).length>1;
    if(damaged||needShield){
      const sacrifice=chooseRecycleSacrifice(u);
      if(sacrifice){
        executeColosoOwnAction('colosoRecycle',sacrifice.x,sacrifice.y);
        await sleep(120);
      }
    }
  }

  // Fusión propia cuando el combate ya está cerca y existe un Pilar adyacente.
  if(!u.monolith&&!u.exitedMonolithThisTurn&&u.pa>=3){
    const adjacent=ownedPillars(u).filter(p=>adj8(u,p));
    const closeEnemy=foes.some(e=>md(u,e)<=4);
    const monoKit=(u.loadout||[]).some(id=>['rock','quake','collapse','magnetism'].includes(id));
    if(adjacent.length&&closeEnemy&&monoKit){
      executeColosoOwnAction('colosoFusion',adjacent[0].x,adjacent[0].y);
      await sleep(130);
    }
  }
}

globalThis.LDMColoso0627={
  definition:COLOSO_DEF,
  createAvailable:colosoCreateAvailable,
  ownActionValid:colosoOwnActionValid,
  executeOwnAction:executeColosoOwnAction,
  collapseCells,
  collapseDamageByBand,
  bestCollapsePlan,
  bestMagnetismTarget,
  bestCreatePillarTile,
  aiPrepareTurn,
  quakeOrigin:colosoQuakeOrigin,
  pillarCreatedThisTurn,
  magnetTargetValid
};

})();