const app=document.querySelector('#app');
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const SIZE=12, VERSION='0.6.20-v02';



const HUD_POSITIONS_KEY='arena-tactica-hud-v045';
const HUD_DEFAULTS={
  player:{x:null,y:null,collapsed:false,orientation:'vertical'},
  enemy:{x:null,y:null,collapsed:false,orientation:'vertical'},
  command:{x:null,y:null,collapsed:false,orientation:'horizontal'},
  round:{x:null,y:null,collapsed:false,orientation:'horizontal'},
  camera:{x:null,y:null,collapsed:false,orientation:'horizontal'}
};
function syncVisualViewport(){
  const vv=window.visualViewport;
  const h=Math.max(240,Math.round(vv?.height||window.innerHeight||document.documentElement.clientHeight||600));
  document.documentElement.style.setProperty('--app-height',`${h}px`);
}
syncVisualViewport();
window.addEventListener('resize',syncVisualViewport,{passive:true});
window.addEventListener('orientationchange',()=>setTimeout(syncVisualViewport,80),{passive:true});
window.visualViewport?.addEventListener('resize',syncVisualViewport,{passive:true});
window.visualViewport?.addEventListener('scroll',syncVisualViewport,{passive:true});

function loadHudPositions(){
  try{return JSON.parse(localStorage.getItem(HUD_POSITIONS_KEY)||'{}')||{}}catch{return{}}
}
function hudSetting(key){
  const all=loadHudPositions();
  return {...(HUD_DEFAULTS[key]||{}),...(all[key]||{})};
}
function saveHudSetting(key,patch){
  const data=loadHudPositions();
  data[key]={...(HUD_DEFAULTS[key]||{}),...(data[key]||{}),...patch};
  localStorage.setItem(HUD_POSITIONS_KEY,JSON.stringify(data));
}
function hudIsFixed(panel){
  return getComputedStyle(panel).position==='fixed';
}
function hudViewportBox(){
  const vv=window.visualViewport;
  return {
    left:Math.round(vv?.offsetLeft||0),
    top:Math.round(vv?.offsetTop||0),
    width:Math.max(1,Math.round(vv?.width||window.innerWidth||document.documentElement.clientWidth||1)),
    height:Math.max(1,Math.round(vv?.height||window.innerHeight||document.documentElement.clientHeight||1))
  };
}
function saveHudPosition(key,panel,container){
  const pr=panel.getBoundingClientRect();
  const fixed=hudIsFixed(panel);
  const cr=fixed?hudViewportBox():container.getBoundingClientRect();
  const usableX=Math.max(1,cr.width-pr.width),usableY=Math.max(1,cr.height-pr.height);
  saveHudSetting(key,{
    x:Math.max(0,Math.min(1,(pr.left-cr.left)/usableX)),
    y:Math.max(0,Math.min(1,(pr.top-cr.top)/usableY))
  });
}
function setHudCoords(panel,x,y){
  panel.style.setProperty('left',`${Math.round(x)}px`,'important');
  panel.style.setProperty('top',`${Math.round(y)}px`,'important');
  panel.style.setProperty('right','auto','important');
  panel.style.setProperty('bottom','auto','important');
  panel.style.setProperty('transform','none','important');
}
function applyHudPosition(key,panel,container){
  const pos=hudSetting(key);if(pos.x==null||pos.y==null)return;
  const fixed=hudIsFixed(panel);
  const cr=fixed?hudViewportBox():container.getBoundingClientRect();
  const pr=panel.getBoundingClientRect();
  const maxX=Math.max(2,cr.width-pr.width-2),maxY=Math.max(2,cr.height-pr.height-2);
  const relX=Math.round(Math.max(2,Math.min(maxX,pos.x*Math.max(1,cr.width-pr.width))));
  const relY=Math.round(Math.max(2,Math.min(maxY,pos.y*Math.max(1,cr.height-pr.height))));
  setHudCoords(panel,fixed?cr.left+relX:relX,fixed?cr.top+relY:relY);
}
function bindDraggableHud(panel,key,container,handleSelector='.hud-drag-handle'){
  const handle=panel?.querySelector(handleSelector);if(!panel||!handle||!container)return;
  applyHudPosition(key,panel,container);
  let pointer=null,startX=0,startY=0,left=0,top=0,moved=false,raf=0,nextX=0,nextY=0;
  const fixed=hudIsFixed(panel);
  const moveFrame=()=>{raf=0;setHudCoords(panel,nextX,nextY)};
  handle.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'&&e.button!==0)return;
    e.preventDefault();e.stopPropagation();
    pointer=e.pointerId;moved=false;
    const pr=panel.getBoundingClientRect(),cr=fixed?hudViewportBox():container.getBoundingClientRect();
    startX=e.clientX;startY=e.clientY;
    left=fixed?pr.left:(pr.left-cr.left);
    top=fixed?pr.top:(pr.top-cr.top);
    handle.setPointerCapture?.(pointer);
    panel.classList.add('dragging');
  });
  handle.addEventListener('pointermove',e=>{
    if(pointer!==e.pointerId)return;
    const dx=e.clientX-startX,dy=e.clientY-startY;
    if(!moved&&Math.hypot(dx,dy)<1.5)return;
    moved=true;e.preventDefault();
    const pr=panel.getBoundingClientRect(),cr=fixed?hudViewportBox():container.getBoundingClientRect();
    const minX=fixed?cr.left:2,minY=fixed?cr.top:2;
    const maxX=fixed?(cr.left+cr.width-pr.width-2):(cr.width-pr.width-2);
    const maxY=fixed?(cr.top+cr.height-pr.height-2):(cr.height-pr.height-2);
    nextX=Math.max(minX,Math.min(maxX,left+dx));
    nextY=Math.max(minY,Math.min(maxY,top+dy));
    if(!raf)raf=requestAnimationFrame(moveFrame);
  });
  const finish=e=>{
    if(pointer!==e.pointerId)return;
    if(raf){cancelAnimationFrame(raf);raf=0;setHudCoords(panel,nextX,nextY)}
    if(moved)saveHudPosition(key,panel,container);
    panel.classList.remove('dragging');
    try{handle.releasePointerCapture?.(pointer)}catch{}
    pointer=null;
  };
  handle.addEventListener('pointerup',finish);
  handle.addEventListener('pointercancel',finish);
  handle.addEventListener('lostpointercapture',e=>{if(pointer===e.pointerId)finish(e)});
}
function resetHudPositions(){localStorage.removeItem(HUD_POSITIONS_KEY)}
function toggleHudCollapsed(key){const h=hudSetting(key);saveHudSetting(key,{collapsed:!h.collapsed})}
function toggleHudOrientation(key){const h=hudSetting(key);saveHudSetting(key,{orientation:h.orientation==='vertical'?'horizontal':'vertical'})}
function hudClass(key){const h=hudSetting(key);return `${h.collapsed?'collapsed':''} hud-${h.orientation}`.trim()}
function hudControls(key,collapsedLabel=''){
  const h=hudSetting(key);
  return `<button class="hud-tool hud-drag-handle" type="button" aria-label="Mover panel" title="Mover">⠿</button><button class="hud-tool" data-hud-orient="${key}" type="button" aria-label="Cambiar orientación" title="Horizontal / vertical">${h.orientation==='vertical'?'↔':'↕'}</button><button class="hud-tool" data-hud-collapse="${key}" type="button" aria-label="Plegar o desplegar" title="Plegar / desplegar">${collapsedLabel||(h.collapsed?'＋':'−')}</button>`;
}

const CHAMPIONS={
  arfeli:{id:'arfeli',name:'Arfeli',title:'Guerrera versátil',role:'Agresión / versatilidad',icon:'⚔️',hp:100,pa:6,pm:3,ini:5,
    passive:{name:'Maestría con Armas',text:'Encadenar habilidades diferentes en el mismo turno aumenta daño o Escudo: +0, +1, +2… Repetir una habilidad reinicia la cadena.'},
    abilities:[
      {id:'sword',icon:'⚔️',name:'Corte con Espada',cost:2,range:1,damage:10,maxUsesPerTurn:2,text:'10 daño. Máximo 2 usos/turno.'},
      {id:'daggers',icon:'🩸',name:'Dagas Danzantes',cost:3,range:1,damage:10,maxUsesPerTurn:1,text:'10 daño + Herida 2. Máximo 1 uso/turno.'},
      {id:'bow',icon:'🏹',name:'Disparo con Arco',cost:3,range:4,damage:8,text:'8 daño. Requiere línea de visión.'},
      {id:'spear',icon:'🔱',name:'Arte de la Lanza',cost:3,range:2,damage:10,text:'10 daño + atracción 1.'},
      {id:'shield',icon:'🛡️',name:'Portación de Escudo',cost:3,range:0,shield:15,maxUsesPerTurn:1,text:'15 Escudo. Máximo 1 uso/turno.'},
      {id:'hammer',icon:'🔨',name:'Golpe de Martillo',cost:4,range:3,damage:13,noLOS:true,text:'Selecciona enemigo válido. Arfeli salta a una casilla libre adyacente, causa 13 daño y aplica -1 PM al próximo turno.'}
    ]},
  coloso:{id:'coloso',name:'Coloso',title:'Guardián rocoso',role:'Territorio / resistencia',icon:'🪨',hp:115,pa:6,pm:3,ini:3,
    passive:{name:'Conexión Rocosa',text:'Pilares propios de 15 PV reales. Máximo 2 normalmente y 3 en Monolito.'},
    abilities:[
      {id:'rock',icon:'💥',name:'Lanzar Roca',cost:3,range:4,damage:8,text:'8 daño. Alcance 5 en Monolito.'},
      {id:'stonearmor',icon:'🛡️',name:'Armadura de Piedra',cost:2,range:3,shield:10,maxUsesPerTurn:2,text:'10 Escudo. Máximo 2 usos/turno y cada objetivo una vez/turno.'},
      {id:'absorb',icon:'🧲',name:'Absorción Rocosa',cost:2,range:3,text:'Consume Pilar no creado este turno y cura a Coloso sus PV reales actuales, máximo 15.'},
      {id:'quake',icon:'🌋',name:'Golpe Sísmico',cost:3,range:1,damage:10,text:'Normal: 10 daño + empuje 1. Monolito: origen desde Pilar, 8 daño + empuje 1 y Réplicas de 6.'},
      {id:'collapse',icon:'🪨',name:'Derrumbe',cost:3,range:3,text:'Selecciona Pilar propio y dirección. Cono 3/2/1; daño depende de PV reales del Pilar.'},
      {id:'magnetism',icon:'🧲',name:'Magnetismo de Pilar',cost:3,range:3,text:'Selecciona Pilar y luego personaje a Manhattan 5; atrae hasta 2 casillas hacia el Pilar.'}
    ]},
  piplus:{id:'piplus',name:'Piplus',title:'Tirador de apoyo',role:'Rango / apoyo / control',icon:'🎯',hp:90,pa:6,pm:3,ini:6,
    passive:{name:'Objetivo Marcado',text:'Acción propia Marca Objetivo: 0 PA, alcance 4, línea de visión, máximo 1/turno.'},
    abilities:[
      {id:'precise',icon:'🏹',name:'Disparo Preciso',cost:3,range:4,damage:8,text:'8 daño; 10 contra Marcado.'},
      {id:'vector',icon:'💥',name:'Impacto Vectorial',cost:3,range:3,damage:6,text:'6 daño + empuje 1; contra Marcado empuja 2.'},
      {id:'impulse',icon:'💨',name:'Impulso',cost:2,range:2,maxUsesPerTurn:1,noLOS:true,text:'Piplus se mueve hasta 2 sin PM y puede cruzar obstáculos; termina en casilla válida.'},
      {id:'interference',icon:'📡',name:'Interferencia',cost:2,range:4,maxUsesPerTurn:1,text:'Sólo Marcado: -1 PM próximo turno.'},
      {id:'rupture',icon:'💥',name:'Ruptura de Marca',cost:4,range:4,damage:14,text:'Sólo Marcado: 14 daño y consume Marca. Bloquea nueva Marca ese turno.'},
      {id:'fixation',icon:'🎯',name:'Fijación de Objetivo',cost:2,range:4,text:'Sólo Marcado. La próxima habilidad ofensiva contra él ese turno ignora línea de visión.'}
    ]},
  onod:{id:'onod',name:'Onod',title:'Guardián del bosque',role:'Desgaste / control natural',icon:'🌿',hp:95,pa:6,pm:3,ini:4,
    passive:{name:'Simbiosis',text:'Curar sana 4 a todos los Brotes propios ortogonalmente adyacentes al objetivo; daño real de Veneno sana esa misma cantidad a esos Brotes.'},
    abilities:[
      {id:'thorn',icon:'☠️',name:'Espina Venenosa',cost:2,range:4,damage:6,maxUsesPerTurn:2,text:'6 daño + Veneno 1. Máximo 2/turno.'},
      {id:'vines',icon:'🌿',name:'Enredaderas',cost:3,range:3,text:'Área cruz: centro 6, laterales 4; todos -1 PM próximo turno.'},
      {id:'sap',icon:'💚',name:'Savia Vital',cost:3,range:3,maxUsesPerTurn:2,text:'Cura 8; cura 12 junto a Brote propio. Máximo 2/turno.'},
      {id:'spores',icon:'🌬️',name:'Esporas Tóxicas',cost:4,range:99,noLOS:true,text:'Elige cualquier Brote propio. Afecta las 8 casillas alrededor: 8 daño + Veneno 1.'},
      {id:'awakening',icon:'🌳',name:'Despertar del Bosque',cost:4,range:0,noLOS:true,text:'Activa todos los Brotes: 8 daño por cada Brote ortogonalmente adyacente a cada enemigo.'},
      {id:'reabsorb',icon:'♻️',name:'Reabsorción',cost:0,range:0,noLOS:true,text:'Absorbe TODOS los Brotes de turnos anteriores; +1 PA por Brote. Bloquea Germinar ese turno.'}
    ]},
  korgan:{id:'korgan',name:'Korgan',title:'Cazador de Arena',role:'Trampas / control del terreno',icon:'🪤',hp:100,pa:6,pm:4,ini:4,
    passive:{name:'Preparación',text:'Máximo 3 trampas activas. Invisibles para el rival; el equipo propio las ve semitransparentes.'},
    abilities:[
      {id:'trap_spikes',icon:'🪤',name:'Trampa de Pinchos',cost:2,range:3,maxUsesPerTurn:2,text:'10 daño + Herida 1 al entrar. Máximo 2 colocaciones/turno.'},
      {id:'trap_electric',icon:'⚡',name:'Mina Eléctrica',cost:3,range:3,maxUsesPerTurn:1,text:'8 daño + -1 PA próximo turno. Máximo 1 colocación/turno.'},
      {id:'grenade',icon:'💣',name:'Granada',cost:3,range:3,text:'Selecciona casilla. Cruz: centro 10; laterales 6 + empuje 1 hacia afuera.'},
      {id:'shot',icon:'🏹',name:'Disparo de Caza',cost:3,range:5,damage:10,text:'10 daño. Sólo misma fila/columna y con línea de visión.'},
      {id:'hook',icon:'🪝',name:'Gancho',cost:3,range:3,damage:6,text:'6 daño; Korgan elige atraer 1 o 2 casillas.'},
      {id:'hunterstep',icon:'🏃',name:'Paso del Cazador',cost:1,range:2,maxUsesPerTurn:1,text:'Se mueve hasta 2 en línea sin gastar PM. Herida se aplica normalmente.'}
    ]},
  houngan:{id:'houngan',name:'Houngan',title:'Maestro Vudú',role:'Vínculos / maldiciones',icon:'🪆',hp:90,pa:6,pm:3,ini:5,
    passive:{name:'Vínculo Vudú',text:'Máximo 1 personaje Vinculado. El Muñeco queda asociado al personaje que estaba Vinculado al crearlo.'},
    abilities:[
      {id:'needle',icon:'🪡',name:'Aguja Vudú',cost:2,range:4,text:'Enemigo: 6 daño + Vínculo. Aliado: cura 6 + Vínculo.'},
      {id:'transfer',icon:'🔄',name:'Transferencia',cost:2,range:3,text:'Houngan cura hasta 8; el Muñeco pierde exactamente los PV realmente recuperados.'},
      {id:'ritual',icon:'👁️',name:'Ritual del Dolor',cost:4,range:4,damage:14,text:'Sólo enemigo Vinculado: 14 daño; 20 si su Muñeco correspondiente está ortogonalmente adyacente. Consume Vínculo.'},
      {id:'curse',icon:'☠️',name:'Maldición',cost:3,range:3,damage:8,maxUsesPerTurn:1,text:'8 daño + Veneno 1. Máximo 1/turno.'},
      {id:'paintransfer',icon:'🩸',name:'Transferencia de Dolor',cost:3,range:0,noLOS:true,text:'Persistente mientras existan Vínculo y Muñeco correspondientes: daño a Houngan se divide 50/50.'},
      {id:'dance',icon:'💃',name:'Danza Vudú',cost:3,range:0,noLOS:true,text:'Durante todo el movimiento disponible del Muñeco, el Vinculado intenta copiar cada paso en la misma dirección.'}
    ]}
};

const BOT_LOADOUTS={
  arfeli:['sword','daggers','bow','shield'],
  coloso:['rock','stonearmor','absorb','quake'],
  piplus:['precise','vector','impulse','rupture'],
  onod:['thorn','vines','sap','spores'],
  korgan:['trap_spikes','trap_electric','grenade','shot'],
  houngan:['needle','transfer','ritual','curse']
};

function makeUnit(championId,side,id,controller='ai',customLoadout=null,aiDifficulty='normal'){
  const c=champ(championId);
  return{
    id,kind:'unit',type:'unit',championId,side,controller,aiDifficulty:aiDifficulty==='expert'?'expert':'normal',name:c.name,icon:c.icon,
    x:-1,y:-1,hp:c.hp,maxHp:c.hp,pa:c.pa,maxPa:c.pa,pm:c.pm,maxPm:c.pm,ini:c.ini,
    alive:true,facing:side==='player'?'derecha':'izquierda',
    status:{wound:0,poison:0,burn:0,paPenaltyNext:0,pmPenaltyNext:0,curseDamage:0,markedBy:null,linkedBy:null},shieldStacks:[],
    monolith:false,monolithStoredPm:0,exitedMonolithThisTurn:false,monolithPillarGainUsed:false,
    stoneArmorTargetsUsed:[],skillUsesThisTurn:{},symbiosisUsed:false,markedTargetId:null,linkedTargetId:null,
    ownActions:{pillarCreated:false,markUsed:false,markBlocked:false,germinated:0,witherUsed:false,disarmUsed:false,reabsorbUsed:false,rockRecycleUsed:false},
    arfeliChain:[],fixationTargetId:null,painTransferDollId:null,painTransferLinkId:null,danceDollId:null,danceLinkId:null,
    loadout:customLoadout?[...customLoadout]:[...BOT_LOADOUTS[championId]]
  };
}

function skillUseCount(u,id){return u?.skillUsesThisTurn?.[id]||0}
function skillUsesRemaining(u,id){
  const a=ability(u.championId,id);
  if(!a?.maxUsesPerTurn)return Infinity;
  return Math.max(0,a.maxUsesPerTurn-skillUseCount(u,id));
}
function skillUseAllowed(u,id){return skillUsesRemaining(u,id)>0}
function registerSkillUse(u,id){
  if(!u.skillUsesThisTurn)u.skillUsesThisTurn={};
  u.skillUsesThisTurn[id]=skillUseCount(u,id)+1;
}

const STATUS_MAX={wound:3,poison:3,burn:4};
function addStatus(u,type,amount=1){
  if(!u?.status||!STATUS_MAX[type]||amount<=0)return 0;
  const before=Math.max(0,u.status[type]||0),after=Math.min(STATUS_MAX[type],before+amount);
  u.status[type]=after;const gained=after-before;
  if(gained>0){const icon=type==='wound'?'🩸':type==='poison'?'☠️':'🔥';feedback(u,`${icon} +${gained}`,'status')}
  return gained;
}
function halveStatusEndTurn(u,type){if(u?.status)u.status[type]=Math.floor(Math.max(0,u.status[type]||0)/2)}
function applyWoundStep(u){
  if(!u?.alive||u.kind!=='unit'||!u.status?.wound)return 0;
  const n=u.status.wound;applyDamage(u,n,false);log(`🩸 Herida ${n}: ${u.name} recibe ${n} daño por recorrer 1 casilla.`);return n;
}
function triggerPoisonOnAbility(u){
  if(!u?.alive||!u.status?.poison)return 0;
  const n=u.status.poison,actual=applyDamage(u,n,false);
  log(`☠️ Veneno ${n}: ${u.name} recibe ${actual} daño real al utilizar una habilidad.`);
  if(actual>0)symbiosisFromPoisonDamage(u,actual);
  return actual;
}
function shieldTotal(e){return (e?.shieldStacks||[]).reduce((n,s)=>n+s.amount,0)}
function addShield(e,amount,label='Escudo'){if(!e||!e.alive)return;e.shieldStacks.push({amount,turns:2,label});feedback(e,`+${amount} 🛡️`,'shield')}
function ageShieldStacks(e){
  if(!e?.shieldStacks)return;
  e.shieldStacks.forEach(s=>s.turns--);
  e.shieldStacks=e.shieldStacks.filter(s=>s.turns>0&&s.amount>0);
}
function ownedPillars(u){return B?.pillars.filter(p=>p.alive&&p.type==='pillar'&&p.ownerId===u.id)||[]}
function ownedSprouts(u){return B?.pillars.filter(p=>p.alive&&p.type==='sprout'&&p.ownerId===u.id)||[]}
function ownedDoll(u){return B?.pillars.find(p=>p.alive&&p.type==='doll'&&p.ownerId===u.id)||null}
function activeTraps(u){return B?.traps.filter(t=>t.active&&t.ownerId===u.id)||[]}
function isCombatObject(z){return !!z&&z.kind==='object'}
function damageableEnemy(u,z){return !!z&&z.alive&&z.side!==u.side&&(z.kind==='unit'||isCombatObject(z))}
function allEntities(){return B?[...B.units.filter(u=>u.alive),...B.pillars.filter(p=>p.alive)]:[]}
function entityAt(x,y){return allEntities().find(e=>e.x===x&&e.y===y)||null}
function unitAt(x,y){return B?.units.find(u=>u.alive&&u.x===x&&u.y===y)||null}
function pillarAt(x,y){return B?.pillars.find(p=>p.alive&&p.type==='pillar'&&p.x===x&&p.y===y)||null}
function isFixedObstacle(x,y){return FIXED_OBS.has(key(x,y))}
function free(x,y){return inside(x,y)&&!isFixedObstacle(x,y)&&!entityAt(x,y)}
function cur(){return B?.units.find(u=>u.id===B.order[B.turn])||null}
function player(){return B?.units.find(u=>u.id==='player')||B?.units.find(u=>u.side==='player')||null}
function enemy(){return B?.units.find(u=>u.side==='enemy'&&u.alive)||B?.units.find(u=>u.side==='enemy')||null}
function teamUnits(u,aliveOnly=true){return B?.units.filter(z=>z.side===u.side&&(!aliveOnly||z.alive))||[]}
function enemyUnits(u,aliveOnly=true){return B?.units.filter(z=>z.side!==u.side&&(!aliveOnly||z.alive))||[]}
function opponent(u){return enemyUnits(u,true)[0]||null}
function humanUnit(){return B?.units.find(u=>u.controller==='human')||null}
function getUnit(id){return B?.units.find(u=>u.id===id)||null}
function getEntity(id){return allEntities().find(e=>e.id===id)||null}
function teamLabel(u){return u.controller==='human'?'Tu campeón':u.side==='player'?'Aliado IA':'Rival IA'}

function log(msg){
  if(!B)return;
  B.log.push(msg);
  if(B.log.length>40)B.log.shift();
}
function feedback(e,text,type='damage'){
  if(!B||!e)return;
  const token=++B.fxSeq;
  e.feedback={text,type,token};
  setTimeout(()=>{
    if(e?.feedback?.token===token){
      e.feedback=null;
      if(B&&!B.ended)renderBattle();
    }
  },620);
}
function showNotice(msg,ms=950){
  if(!B||B.ended)return;
  const token=++B.noticeSeq;
  B.notice=msg;
  renderBattle();
  setTimeout(()=>{
    if(B&&!B.ended&&B.noticeSeq===token&&!B.busy){
      B.notice='';
      renderBattle();
    }
  },ms);
}

function faceTarget(a,b){
  if(!a||!b)return;
  let dx=b.x-a.x,dy=b.y-a.y;
  if(Math.abs(dx)>Math.abs(dy))a.facing=dx>0?'derecha':'izquierda';
  else if(dy!==0)a.facing=dy>0?'abajo':'arriba';
}
function faceStep(u,old){
  let dx=u.x-old.x,dy=u.y-old.y;
  if(Math.abs(dx)>Math.abs(dy))u.facing=dx>0?'derecha':'izquierda';
  else if(dy!==0)u.facing=dy>0?'abajo':'arriba';
}

function showStart(){
  clearInterval(timerId);B=null;
  app.innerHTML=`<section class="screen start-screen">
    <div class="start-card">
      <div class="start-stars" aria-hidden="true">✦</div>
      <div class="start-brand">
        <span>ARENA</span>
        <b>TÁCTICA</b>
      </div>
      <p class="start-kicker">CIRCUITO GALÁCTICO DE COMBATE TÁCTICO</p>
      <div class="start-divider"></div>
      <p class="start-motto">Distintos mundos. Una sola Arena.</p>
      <button class="start-enter" id="enterCircuit"><span>⚔️</span><b>ENTRAR AL CIRCUITO</b></button>
      <small class="start-version">v${VERSION}</small>
    </div>
  </section>`;
  $('#enterCircuit').onclick=showLobby;
}

function showLobby(){
  clearInterval(timerId);B=null;
  const winRate=profile.played?Math.round(profile.wins/profile.played*100):0;
  app.innerHTML=`<section class="screen lobby-screen">
    <div class="lobby-topbar">
      <div class="brand-block"><span class="brand-mark">✦</span><div><b>ARENA TÁCTICA</b><small>Circuito Galáctico · v${VERSION}</small></div></div>
      <div class="profile-chip"><span>👤</span><div><b>${profile.name}</b><small>${profile.played} combates</small></div></div>
    </div>

    <div class="lobby-season card">
      <div><small>PRETEMPORADA</small><b>El circuito abre sus puertas</b></div>
      <span class="season-badge">✦ GALÁCTICA</span>
    </div>

    <div class="lobby-hero lobby-promo card">
      <div class="lobby-promo-shade"></div>
      <div class="lobby-promo-copy">
        <small>LIGAS GALÁCTICAS</small>
        <b>Distintos mundos. Una sola Arena.</b>
      </div>
      <button class="play-main promo-play" id="playMain"><span>⚔️</span><b>JUGAR</b></button>
    </div>

    <div class="lobby-nav">
      <button data-lobby-nav="champions"><span>🛡️</span><b>Campeones</b><small>Plantel y habilidades</small></button>
      <button data-lobby-nav="league"><span>🏆</span><b>Liga</b><small>Pretemporada</small></button>
      <button data-lobby-nav="profile"><span>👤</span><b>Perfil</b><small>${profile.wins}V · ${profile.losses}D</small></button>
    </div>

    <div class="lobby-strip">
      <div><small>TRANSMISIÓN DEL CIRCUITO</small><b>Distintos mundos. Una sola Arena.</b></div>
      <span>${profile.played?`${winRate}% victorias registradas`:'Tu historial comienza en la v0.3'}</span>
    </div>
  </section>`;
  $('#playMain').onclick=showModeSelect;
  $$('[data-lobby-nav]').forEach(b=>b.onclick=()=>{
    const route=b.dataset.lobbyNav;
    if(route==='champions')showChampionCollection();
    if(route==='league')showLeague();
    if(route==='profile')showProfile();
  });
}

function showModeSelect(){
  clearInterval(timerId);B=null;
  app.innerHTML=`<section class="screen mode-screen">
    <div class="topbar"><b>⚔️ Jugar</b><span>Circuito Galáctico</span></div>
    <div class="section-title"><h2>Elegí el formato</h2><small>La Arena está lista</small></div>
    <div class="mode-select-grid">
      <button class="mode-card" id="duel">
        <span class="mode-icon">⚔️</span><b>Duelo 1v1</b><small>Tu campeón contra un rival IA.</small><em>Combate individual</em>
      </button>
      <button class="mode-card" id="teamfight">
        <span class="mode-icon">⚔️⚔️</span><b>Combate 2v2</b><small>Vos + aliado IA contra dos rivales IA.</small><em>Combate por equipos</em>
      </button>
      <button class="mode-card online-mode-card" id="onlineDuel">
        <span class="mode-icon">🌐</span><b>1v1 ONLINE</b><small>Conectá dos celulares mediante código de sala.</small><em>PRUEBA · SIN COMBATE</em>
      </button>
    </div>
    <div class="actions"><button class="secondary" id="backLobby">Volver al Lobby</button></div>
  </section>`;
  $('#duel').onclick=()=>{setup.mode='1v1';showChampionSelect()};
  $('#teamfight').onclick=()=>{setup.mode='2v2';ensureTeamSetup();showChampionSelect()};
  $('#onlineDuel').onclick=()=>window.LigaOnline?.show();
  window.LigaOnlineBack=showModeSelect;
  $('#backLobby').onclick=showLobby;
}

function collectionCards(activeId){
  return Object.values(CHAMPIONS).map(c=>`<button class="champion-card compact ${activeId===c.id?'active':''}" data-collection-champ="${c.id}">
    <span class="champ-icon">${c.icon}</span><b>${c.name}</b><small>${c.role}</small>
  </button>`).join('');
}
function showChampionCollection(activeId=profile.favorite||setup.championId){
  const c=champ(activeId)||Object.values(CHAMPIONS)[0];
  const abilities=c.abilities.map(a=>`<div class="collection-skill"><span>${a.icon}</span><div><b>${a.name}</b><small>${a.cost} PA · ${a.text}</small></div></div>`).join('');
  app.innerHTML=`<section class="screen collection-screen">
    <div class="topbar"><b>🛡️ Campeones</b><span>${Object.keys(CHAMPIONS).length} disponibles</span></div>
    <div class="champion-grid roster-grid">${collectionCards(c.id)}</div>
    <div class="champion-detail card collection-detail">
      <div class="champion-detail-head"><div class="detail-icon">${c.icon}</div><div><h3>${c.name}</h3><small>${c.title} · ${c.role}</small></div></div>
      <div class="stats-line detail-stats"><span>❤️ ${c.hp}</span><span>PA ${c.pa}</span><span>PM ${c.pm}</span><span>⚡ ${c.ini}</span></div>
      <div class="passive"><b>Pasiva — ${c.passive.name}:</b> ${c.passive.text}</div>
      <div class="collection-skills">${abilities}</div>
      <button class="favorite-btn ${profile.favorite===c.id?'is-favorite':''}" id="favorite">${profile.favorite===c.id?'★ Campeón destacado':'☆ Marcar como destacado'}</button>
    </div>
    <div class="actions"><button class="secondary" id="backLobby">Volver al Lobby</button><button id="playWith">Jugar con ${c.name}</button></div>
  </section>`;
  $$('[data-collection-champ]').forEach(b=>b.onclick=()=>showChampionCollection(b.dataset.collectionChamp));
  $('#favorite').onclick=()=>{profile.favorite=c.id;saveProfile(profile);showChampionCollection(c.id)};
  $('#playWith').onclick=()=>{setup.championId=c.id;setup.loadout=c.abilities.slice(0,4).map(a=>a.id);showModeSelect()};
  $('#backLobby').onclick=showLobby;
}

function showLeague(){
  const rate=profile.played?Math.round(profile.wins/profile.played*100):0;
  app.innerHTML=`<section class="screen league-screen">
    <div class="topbar"><b>🏆 Liga</b><span>Pretemporada</span></div>
    <div class="league-hero card">
      <div class="league-emblem">🏆</div>
      <div><small>CIRCUITO GALÁCTICO</small><h2>Clasificación en preparación</h2><p>Esta versión registra tus combates, pero todavía no asigna divisiones ni puntos oficiales.</p></div>
    </div>
    <div class="league-stats">
      <div><b>${profile.played}</b><small>Combates</small></div>
      <div><b>${profile.wins}</b><small>Victorias</small></div>
      <div><b>${profile.losses}</b><small>Derrotas</small></div>
      <div><b>${profile.played?rate+'%':'—'}</b><small>Victorias</small></div>
    </div>
    <div class="card roadmap-card"><b>Próxima etapa de Liga</b><p>Divisiones, puntos de temporada y recompensas se definirán después de validar el flujo completo de la v0.3.</p></div>
    <div class="actions"><button class="secondary" id="backLobby">Volver al Lobby</button><button id="playLeague">Jugar</button></div>
  </section>`;
  $('#backLobby').onclick=showLobby;$('#playLeague').onclick=showModeSelect;
}

function showProfile(){
  const fav=champ(profile.favorite)||champ(setup.championId);
  app.innerHTML=`<section class="screen profile-screen">
    <div class="topbar"><b>👤 Perfil</b><span>Competidor del circuito</span></div>
    <div class="profile-card card">
      <div class="profile-avatar">${fav.icon}</div>
      <div><small>IDENTIDAD DE JUGADOR</small><h2>${profile.name}</h2><p>Campeón destacado: <b>${fav.name}</b></p></div>
    </div>
    <div class="profile-stats">
      <div><span>🎮</span><b>${profile.played}</b><small>Combates</small></div>
      <div><span>🏆</span><b>${profile.wins}</b><small>Victorias</small></div>
      <div><span>📺</span><b>${profile.losses}</b><small>Derrotas</small></div>
    </div>
    <div class="card small"><b>v0.4 · Perfil local</b><br>Estos datos se guardan en este dispositivo. Cuentas y sincronización online quedan para una etapa posterior.</div>
    <div class="actions"><button class="secondary" id="backLobby">Volver al Lobby</button><button id="viewChamp">Ver campeones</button></div>
  </section>`;
  $('#backLobby').onclick=showLobby;$('#viewChamp').onclick=()=>showChampionCollection(fav.id);
}

function showHome(){showLobby()}

function ensureTeamSetup(){
  const ids=Object.keys(CHAMPIONS);
  if(setup.allyId===setup.championId)setup.allyId=ids.find(x=>x!==setup.championId)||setup.allyId;
  if(setup.mode==='1v1'&&setup.enemyId===setup.championId)setup.enemyId='random';
  if(setup.enemyId!=='random'&&setup.enemy2Id===setup.enemyId)setup.enemy2Id='random';
}
function championOptions(selected,excluded=[],allowRandom=true){
  const blocked=new Set(excluded.filter(Boolean));
  let out=allowRandom?`<option value="random" ${selected==='random'?'selected':''}>Aleatorio</option>`:'';
  out+=Object.values(CHAMPIONS).map(c=>`<option value="${c.id}" ${selected===c.id?'selected':''} ${blocked.has(c.id)?'disabled':''}>${c.name}</option>`).join('');
  return out;
}
function showChampionSelect(){
  ensureTeamSetup();
  const selected=champ(setup.championId);
  const cards=Object.values(CHAMPIONS).map(c=>`<button class="champion-card compact ${setup.championId===c.id?'active':''}" data-champ="${c.id}">
    <span class="champ-icon">${c.icon}</span><b>${c.name}</b><small>${c.role}</small>
  </button>`).join('');
  const duelPicker=setup.mode==='1v1'?`<label class="rival-picker">Rival IA <select id="rivalSelect">${championOptions(setup.enemyId,[setup.championId],true)}</select></label>`:'';
  const difficultyPicker=`<label class="rival-picker ai-difficulty-picker"><span>🧠 Dificultad IA</span><select id="aiDifficultySelect"><option value="normal" ${setup.aiDifficulty==='normal'?'selected':''}>NORMAL</option><option value="expert" ${setup.aiDifficulty==='expert'?'selected':''}>EXPERTO</option></select></label>`;
  const teamPickers=setup.mode==='2v2'?`<div class="team-setup">
      <label class="rival-picker"><span>🤖 Aliado IA</span><select id="allySelect">${championOptions(setup.allyId,[setup.championId],false)}</select></label>
      <label class="rival-picker"><span>🔴 Rival IA 1</span><select id="rivalSelect">${championOptions(setup.enemyId,[],true)}</select></label>
      <label class="rival-picker"><span>🔴 Rival IA 2</span><select id="rival2Select">${championOptions(setup.enemy2Id,setup.enemyId!=='random'?[setup.enemyId]:[],true)}</select></label>
      <div class="team-note">🔵 Vos + aliado IA &nbsp; vs &nbsp; 🔴 2 rivales IA</div>
    </div>`:'';
  app.innerHTML=`<section class="screen select-screen" data-mode="${setup.mode}">
    <div class="topbar"><b>${setup.mode==='2v2'?'Equipo 2v2':'Duelo 1v1'} · Selección</b><span>v${VERSION}</span></div>
    <div class="section-title"><h2>Plantel de la Liga</h2><small>6 campeones de prueba</small></div>
    <div class="champion-grid roster-grid">${cards}</div>
    <div class="champion-detail card">
      <div class="champion-detail-head"><div class="detail-icon">${selected.icon}</div><div><h3>${selected.name}</h3><small>${selected.title} · ${selected.role}</small></div></div>
      <div class="stats-line detail-stats"><span>❤️ ${selected.hp}</span><span>PA ${selected.pa}</span><span>PM ${selected.pm}</span><span>⚡ ${selected.ini}</span></div>
      <div class="passive"><b>${selected.passive.name}:</b> ${selected.passive.text}</div>
      ${duelPicker}${teamPickers}${difficultyPicker}
    </div>
    <div class="actions"><button class="secondary" id="back">Volver</button><button id="continue">Elegir habilidades</button></div>
  </section>`;
  $$('[data-champ]').forEach(b=>b.onclick=()=>{
    setup.championId=b.dataset.champ;
    setup.loadout=CHAMPIONS[setup.championId].abilities.slice(0,4).map(a=>a.id);
    ensureTeamSetup();showChampionSelect();
  });
  $('#allySelect')?.addEventListener('change',e=>{setup.allyId=e.target.value;showChampionSelect()});
  $('#rivalSelect')?.addEventListener('change',e=>{setup.enemyId=e.target.value;if(setup.mode==='2v2'&&setup.enemy2Id===setup.enemyId&&setup.enemyId!=='random')setup.enemy2Id='random';showChampionSelect()});
  $('#rival2Select')?.addEventListener('change',e=>{setup.enemy2Id=e.target.value});
  $('#aiDifficultySelect')?.addEventListener('change',e=>{setup.aiDifficulty=e.target.value==='expert'?'expert':'normal'});
  $('#back').onclick=showModeSelect;
  $('#continue').onclick=showLoadout;
}

function showLoadout(){
  const c=champ(setup.championId);
  const rows=c.abilities.map(a=>`<button class="ability-choice ${setup.loadout.includes(a.id)?'selected':''}" data-ability="${a.id}">
    <span class="cost">${a.cost} PA</span>${setup.loadout.includes(a.id)?'<span class="equipped-badge">✓ Equipada</span>':''}<b>${a.icon} ${a.name}</b><small>${a.text}</small>
  </button>`).join('');
  app.innerHTML=`<section class="screen loadout-screen">
    <div class="topbar"><b>${c.icon} ${c.name}</b><span>Preparación</span></div>
    <div class="section-title"><h2>Elegí 4 habilidades</h2><small>${setup.mode==='2v2'?'Sólo configurás a tu campeón; el aliado IA usa su set de prueba.':'Quedan bloqueadas durante el combate.'}</small></div>
    <div class="selection-count">${setup.loadout.length}/4 seleccionadas</div>
    <div class="loadout-list">${rows}</div>
    <div class="card small"><b>Pasiva — ${c.passive.name}</b><br>${c.passive.text}</div>
    <div class="actions"><button class="secondary" id="back">Cambiar campeón</button><button id="fight" ${setup.loadout.length===4?'':'disabled'}>Ir al despliegue</button></div>
  </section>`;
  $$('[data-ability]').forEach(b=>b.onclick=()=>{
    const id=b.dataset.ability;
    if(setup.loadout.includes(id))setup.loadout=setup.loadout.filter(x=>x!==id);
    else if(setup.loadout.length<4)setup.loadout.push(id);
    showLoadout();
  });
  $('#back').onclick=showChampionSelect;
  $('#fight').onclick=startBattle;
}

function resolveEnemyPair(){
  const first=setup.enemyId==='random'?randomChampionExcluding([]):setup.enemyId;
  const second=setup.enemy2Id==='random'?randomChampionExcluding([first]):setup.enemy2Id;
  return [first,second===first?randomChampionExcluding([first]):second];
}
function startBattle(){
  const p=makeUnit(setup.championId,'player','player','human',setup.loadout);
  let units=[p];
  if(setup.mode==='2v2'){
    ensureTeamSetup();
    const allyId=setup.allyId===setup.championId?randomChampionExcluding([setup.championId]):setup.allyId;
    const [enemy1Id,enemy2Id]=resolveEnemyPair();
    units.push(makeUnit(allyId,'player','ally','ai'));
    units.push(makeUnit(enemy1Id,'enemy','enemy1','ai',null,setup.aiDifficulty));
    units.push(makeUnit(enemy2Id,'enemy','enemy2','ai',null,setup.aiDifficulty));
  }else{
    const enemyId=setup.enemyId==='random'?randomOpponent(setup.championId):setup.enemyId;
    units.push(makeUnit(enemyId,'enemy','enemy1','ai',null,setup.aiDifficulty));
  }
  B={
    mode:setup.mode,round:1,turn:0,timer:30,selectedAction:null,selectedUnitId:'player',pendingImpulseTargetId:null,pendingPreview:null,pendingStage:null,pendingChoice:null,
    skillsOpen:false,logOpen:false,busy:false,pendingTimeout:false,notice:'',
    hudCollapsed:{player:true,enemy:true},hudBottomCollapsed:false,
    deployment:true,deployPos:null,camera:{x:0,y:0,rotation:0},pillars:[],traps:[],dollPhase:null,nextPillarId:1,nextObjectId:1,nextTrapId:1,nextQuakeId:1,fxSeq:0,noticeSeq:0,log:[],
    units,order:units.map(u=>u.id),ended:false,resultRecorded:false
  };
  renderDeployment();
}

function renderDeployment(){
  const p=humanUnit();
  let tiles='',pieces='';
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    const k=key(x,y),valid=PLAYER_DEPLOY.includes(k)&&!isFixedObstacle(x,y),chosen=B.deployPos===k;
    const cl=['tile'];
    if(isFixedObstacle(x,y))cl.push('obstacle');
    if(valid)cl.push('deploy');
    if(chosen)cl.push('deploy-chosen');
    tiles+=isoTileMarkup(x,y,cl);
    if(isFixedObstacle(x,y))pieces+=isoObstacleMarkup(x,y);
    if(chosen){
      const preview={...p,x,y};
      pieces+=isoEntityMarkup(preview,p,preview);
    }
  }
  app.innerHTML=`<section class="screen deployment-screen iso-deployment-screen">
    <div class="topbar"><b>Despliegue ${B.mode==='2v2'?'2v2':'1v1'}</b><span>Antes de la Ronda 1 · Arena isométrica</span></div>
    <div class="card"><b>Elegí la posición de ${p.name}</b><p class="small">${B.mode==='2v2'?'Tu aliado y los dos rivales se desplegarán automáticamente en casillas distintas.':'El rival elige su posición sin verla.'} Todas las posiciones se revelan al confirmar.</p><p class="small iso-help">Los rombos azules son las mismas casillas lógicas del tablero 12×12.</p></div>
    ${isoBoardMarkup(tiles,pieces)}
    <div class="deployment-actions"><button id="confirm" ${B.deployPos?'':'disabled'}>Confirmar posición</button><button class="secondary" id="cancel">Cancelar</button></div>
  </section>`;
  $('#grid').onclick=e=>{
    const t=e.target.closest('.tile');if(!t)return;
    const k=key(+t.dataset.x,+t.dataset.y);
    if(!PLAYER_DEPLOY.includes(k)||isFixedObstacle(+t.dataset.x,+t.dataset.y))return;
    B.deployPos=k;renderDeployment();
  };
  $('#confirm').onclick=confirmDeployment;
  $('#cancel').onclick=showChampionSelect;
}

function pickDeployTile(pool,occupied=[]){
  const blocked=new Set(occupied);
  const options=pool.filter(k=>{
    const [x,y]=k.split(',').map(Number);
    return !blocked.has(k)&&!isFixedObstacle(x,y)&&!entityAt(x,y);
  });
  return options[Math.floor(Math.random()*options.length)]||null;
}
function confirmDeployment(){
  const p=humanUnit();
  [p.x,p.y]=B.deployPos.split(',').map(Number);
  const occupied=[B.deployPos];
  const ally=B.units.find(u=>u.id==='ally');
  if(ally){
    const k=pickDeployTile(PLAYER_DEPLOY,occupied);if(k){[ally.x,ally.y]=k.split(',').map(Number);occupied.push(k)}
  }
  for(const e of B.units.filter(u=>u.side==='enemy')){
    const k=pickDeployTile(ENEMY_DEPLOY,occupied)||'10,5';[e.x,e.y]=k.split(',').map(Number);occupied.push(k);
  }
  if(B.mode==='2v2'){
    const orderTeam=side=>{
      const team=B.units.filter(u=>u.side===side);
      if(team.length===2&&team[0].ini===team[1].ini&&Math.random()<.5)team.reverse();
      else team.sort((a,b)=>b.ini-a.ini);
      return team;
    };
    const allies=orderTeam('player'),enemies=orderTeam('enemy');
    B.order=[allies[0]?.id,enemies[0]?.id,allies[1]?.id,enemies[1]?.id].filter(Boolean);
  }else{
    B.order=[...B.units].sort((a,b)=>b.ini-a.ini||a.id.localeCompare(b.id)).map(u=>u.id);
  }
  B.turn=0;B.deployment=false;B.deployPos=null;
  log(B.mode==='2v2'?`⚔️ Orden inicial 2v2: aliado → enemigo → aliado → enemigo.`:`⚔️ ${cur().name} comienza por Iniciativa.`);
  beginTurn();
}

function beginTurn(){
  if(!B||B.ended)return;
  clearInterval(timerId);
  let u=cur();
  if(!u?.alive){if(checkBattleEnd())return;return nextTurn()}
  const paPenalty=Math.max(0,u.status.paPenaltyNext||0);
  u.pa=Math.max(0,u.maxPa-paPenalty);
  u.status.paPenaltyNext=0;
  u.exitedMonolithThisTurn=false;
  u.monolithPillarGainUsed=false;
  u.stoneArmorTargetsUsed=[];
  u.skillUsesThisTurn={};
  u.symbiosisUsed=false;
  u.ownActions={pillarCreated:false,markUsed:false,markBlocked:false,germinated:0,witherUsed:false,disarmUsed:false,reabsorbUsed:false,rockRecycleUsed:false};
  u.arfeliChain=[];
  const pmPenalty=Math.max(0,u.status.pmPenaltyNext||0);
  u.status.pmPenaltyNext=0;
  if(u.monolith){u.monolithStoredPm=u.maxPm;u.pm=0}else u.pm=Math.max(0,u.maxPm-pmPenalty);
  B.timer=30;B.selectedAction=null;B.pendingPreview=null;B.pendingStage=null;B.pendingChoice=null;B.skillsOpen=false;B.selectedUnitId=u.id;B.notice='';B.noticeSeq++;
  if(paPenalty){log(`🔨 Interferencia: ${u.name} comienza el turno con -${paPenalty} PA.`);feedback(u,`-${paPenalty} PA`,'status');}
  if(pmPenalty){log(`🌿 Control: ${u.name} comienza el turno con -${pmPenalty} PM.`);feedback(u,`-${pmPenalty} PM`,'status');}
  if(u.status.burn>0){const n=u.status.burn;applyDamage(u,n,false);log(`🔥 Quemadura ${n}: ${u.name} recibe ${n} daño al inicio del turno.`);if(checkBattleEnd())return}
  renderBattle();
  timerId=setInterval(()=>{
    if(!B||B.ended)return clearInterval(timerId);
    B.timer--;
    const t=$('#timer');if(t){t.textContent=B.timer+'s';t.closest('.combat-timer')?.classList.toggle('danger-time',B.timer<=10)}
    if(B.timer<=0){
      clearInterval(timerId);
      if(B.busy)B.pendingTimeout=true;
      else nextTurn();
    }
  },1000);
  if(u.controller==='ai')setTimeout(aiTurn,550);
}

function endTurnEffects(u){
  if(u.status.burn>0){const n=u.status.burn;applyDamage(u,n,false);log(`🔥 Quemadura ${n}: ${u.name} recibe ${n} daño al final del turno.`)}
  const oldWound=u.status.wound||0,oldPoison=u.status.poison||0,oldBurn=u.status.burn||0;
  halveStatusEndTurn(u,'wound');halveStatusEndTurn(u,'poison');halveStatusEndTurn(u,'burn');
  if(oldWound!==u.status.wound)log(`🩸 ${u.name}: Herida baja a ${u.status.wound}.`);
  if(oldPoison!==u.status.poison)log(`☠️ ${u.name}: Veneno baja a ${u.status.poison}.`);
  if(oldBurn!==u.status.burn)log(`🔥 ${u.name}: Quemadura baja a ${u.status.burn}.`);
  ageShieldStacks(u);ownedPillars(u).forEach(ageShieldStacks);
  u.fixationTargetId=null;
  if(u.championId==='houngan'){
    const d=getEntity(u.painTransferDollId),l=getEntity(u.painTransferLinkId);
    if(!d?.alive||!l?.alive||u.linkedTargetId!==u.painTransferLinkId||d.linkedTargetId!==u.painTransferLinkId){
      u.painTransferDollId=null;u.painTransferLinkId=null;
    }
  }
}

function advanceTurn(){
  if(!B||B.ended)return;
  B.dollPhase=null;B.selectedAction=null;B.pendingImpulseTargetId=null;B.pendingPreview=null;B.pendingStage=null;B.pendingChoice=null;B.skillsOpen=false;B.busy=false;B.pendingTimeout=false;
  let safety=0;
  do{
    B.turn++;
    if(B.turn>=B.order.length){B.turn=0;B.round++}
    safety++;
  }while(safety<=B.order.length&&!cur()?.alive);
  beginTurn();
}
function startDollPhase(owner,doll){
  if(!B||B.ended||!owner?.alive||!doll?.alive)return advanceTurn();
  clearInterval(timerId);
  B.dollPhase={ownerId:owner.id,dollId:doll.id,pm:3,maxPm:3};
  B.selectedAction=null;B.pendingImpulseTargetId=null;B.pendingPreview=null;B.pendingStage=null;B.pendingChoice=null;B.skillsOpen=false;B.busy=false;B.pendingTimeout=false;B.selectedUnitId=doll.id;
  log(`🪆 ${doll.name} dispone de 3 PM después del turno de ${owner.name}.`);
  renderBattle();
  if(owner.controller==='ai')setTimeout(aiDollPhase,380);
}
function finishDollPhase(){
  if(!B?.dollPhase)return;
  const owner=getUnit(B.dollPhase.ownerId),doll=getEntity(B.dollPhase.dollId);
  if(doll?.alive)log(`🪆 ${doll.name} finaliza su movimiento.`);
  if(owner){owner.danceDollId=null;owner.danceLinkId=null}
  advanceTurn();
}
function nextTurn(){
  if(!B||B.ended)return;
  if(B.dollPhase)return finishDollPhase();
  clearInterval(timerId);
  const old=cur();
  if(old?.alive)endTurnEffects(old);
  if(checkBattleEnd())return;
  B.selectedAction=null;B.pendingImpulseTargetId=null;B.pendingPreview=null;B.pendingStage=null;B.pendingChoice=null;B.skillsOpen=false;B.busy=false;B.pendingTimeout=false;
  if(old?.alive&&old.championId==='houngan'){
    const doll=ownedDoll(old);
    if(doll?.alive)return startDollPhase(old,doll);
  }
  advanceTurn();
}

function movementMap(u,limit=u.pm){
  const seen=new Map([[key(u.x,u.y),0]]),q=[[u.x,u.y]];
  while(q.length){
    const [x,y]=q.shift(),d=seen.get(key(x,y));
    if(d>=limit)continue;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,ny=y+dy,k=key(nx,ny);
      if(!inside(nx,ny)||isFixedObstacle(nx,ny)||entityAt(nx,ny)||seen.has(k))continue;
      seen.set(k,d+1);q.push([nx,ny]);
    }
  }
  seen.delete(key(u.x,u.y));
  return seen;
}

function objectMovementMap(obj,limit){
  if(!obj?.alive)return new Map();
  const seen=new Map([[key(obj.x,obj.y),0]]),q=[[obj.x,obj.y]];
  while(q.length){
    const [x,y]=q.shift(),d=seen.get(key(x,y));
    if(d>=limit)continue;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,ny=y+dy,k=key(nx,ny);
      if(!inside(nx,ny)||isFixedObstacle(nx,ny)||entityAt(nx,ny)||seen.has(k))continue;
      seen.set(k,d+1);q.push([nx,ny]);
    }
  }
  seen.delete(key(obj.x,obj.y));
  return seen;
}
function objectGridPath(obj,goal){
  const q=[[obj.x,obj.y]],prev=new Map([[key(obj.x,obj.y),null]]);
  while(q.length){
    const [x,y]=q.shift();
    if(x===goal.x&&y===goal.y)break;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,ny=y+dy,k=key(nx,ny);
      if(!inside(nx,ny)||isFixedObstacle(nx,ny)||prev.has(k)||entityAt(nx,ny))continue;
      prev.set(k,[x,y]);q.push([nx,ny]);
    }
  }
  const end=key(goal.x,goal.y);if(!prev.has(end))return[];
  let p=[goal.x,goal.y],out=[];
  while(p){out.push(p);p=prev.get(key(p[0],p[1]))}
  return out.reverse();
}
async function danceCopyStep(owner,dx,dy){
  if(!owner?.danceDollId||!owner?.danceLinkId)return;
  const doll=getEntity(owner.danceDollId),linked=getEntity(owner.danceLinkId);
  if(!doll?.alive||!linked?.alive||owner.linkedTargetId!==linked.id||doll.linkedTargetId!==linked.id)return;
  const nx=linked.x+dx,ny=linked.y+dy;
  if(!inside(nx,ny)||isFixedObstacle(nx,ny)||entityAt(nx,ny)){log(`💃 Danza Vudú: ${linked.name} no puede copiar este paso.`);return}
  const old={x:linked.x,y:linked.y};linked.x=nx;linked.y=ny;faceStep(linked,old);applyWoundStep(linked);
  renderBattle();await sleep(90);if(linked.alive&&!checkBattleEnd())await triggerTrapAt(linked);
}
async function moveDoll(x,y){
  const phase=B?.dollPhase;if(!phase||B.busy)return false;
  const doll=getEntity(phase.dollId);if(!doll?.alive)return finishDollPhase();
  const reach=objectMovementMap(doll,phase.pm),cost=reach.get(key(x,y));
  if(cost==null)return false;
  const path=objectGridPath(doll,{x,y});if(path.length<2)return false;
  const owner=getUnit(phase.ownerId);
  B.busy=true;let steps=0;
  for(let i=1;i<path.length&&doll.alive;i++){
    const ox=doll.x,oy=doll.y;doll.x=path[i][0];doll.y=path[i][1];steps++;phase.pm=Math.max(0,phase.pm-1);
    renderBattle();await sleep(100);await danceCopyStep(owner,doll.x-ox,doll.y-oy);await triggerTrapAt(doll);
    if(checkBattleEnd()){B.busy=false;return true}
  }
  if(steps)log(`🪆 ${doll.name} se mueve ${steps} casilla${steps!==1?'s':''}.`);
  B.busy=false;renderBattle();
  if(!doll.alive||phase.pm<=0){await sleep(140);finishDollPhase()}
  return true;
}

function gridPath(u,goal){
  const q=[[u.x,u.y]],prev=new Map([[key(u.x,u.y),null]]);
  while(q.length){
    const [x,y]=q.shift();
    if(x===goal.x&&y===goal.y)break;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,ny=y+dy,k=key(nx,ny);
      if(!inside(nx,ny)||isFixedObstacle(nx,ny)||prev.has(k))continue;
      const z=entityAt(nx,ny);
      if(z&&!(nx===goal.x&&ny===goal.y))continue;
      if(z&&nx===goal.x&&ny===goal.y)continue;
      prev.set(k,[x,y]);q.push([nx,ny]);
    }
  }
  const end=key(goal.x,goal.y);if(!prev.has(end))return[];
  let p=[goal.x,goal.y],out=[];
  while(p){out.push(p);p=prev.get(key(p[0],p[1]))}
  return out.reverse();
}

function adjacentEnemies(u){
  return B.units.filter(z=>z.alive&&z.side!==u.side&&adjCardinal(u,z));
}

async function moveUnit(u,x,y){
  const reach=movementMap(u),cost=reach.get(key(x,y));
  if(cost==null||B.busy)return;
  const path=gridPath(u,{x,y});if(path.length<2)return;
  B.busy=true;
  if(u.championId==='coloso')u.ownActions.pillarCreated=true;
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
    applyWoundStep(u);renderBattle();await sleep(125);
    if(!u.alive||checkBattleEnd())break;
    await triggerTrapAt(u);
  }
  u.pm=Math.max(0,u.pm-steps);
  if(steps)log(`👣 ${u.name} se mueve ${steps} casilla${steps!==1?'s':''}.`);
  B.selectedAction=null;B.busy=false;renderBattle();
  if(B.pendingTimeout&&!B.ended)nextTurn();
}

function lineCells(a,b){
  const result=[];
  const x0=a.x+.5,y0=a.y+.5,x1=b.x+.5,y1=b.y+.5;
  const samples=Math.max(Math.abs(b.x-a.x),Math.abs(b.y-a.y))*16;
  let last='';
  for(let i=1;i<samples;i++){
    const t=i/samples;
    const x=Math.floor(x0+(x1-x0)*t),y=Math.floor(y0+(y1-y0)*t),k=key(x,y);
    if(k!==last&&!(x===a.x&&y===a.y)&&!(x===b.x&&y===b.y)){result.push([x,y]);last=k}
  }
  return result;
}
function clearLOS(a,b){
  return lineCells(a,b).every(([x,y])=>{const z=entityAt(x,y);return !isFixedObstacle(x,y)&&(!z||z.blocksLOS===false)});
}
function effectiveRange(u,a){return a.id==='rock'&&u.monolith?a.range+1:a.range}
function inRange(a,b,r){
  if(r===0)return a.x===b.x&&a.y===b.y;
  if(r===1)return adj8(a,b);
  const d=md(a,b);return d>0&&d<=r;
}
function requiresLOS(a){return (a.range||0)>1&&!a.noLOS}
function quakeOriginForTarget(u,target){
  if(!u||!target)return null;
  if(adj8(u,target))return u;
  if(u.championId==='coloso'&&u.monolith){
    return ownedPillars(u).filter(p=>adj8(p,target)).sort((a,b)=>(a.number||0)-(b.number||0))[0]||null;
  }
  return null;
}
function quakeCanReach(u,target){return !!quakeOriginForTarget(u,target)}
function getMarkedTarget(u){const z=getEntity(u?.markedTargetId);return z?.alive&&z.kind==='unit'?z:null}
function setMarkedTarget(u,target){
  const old=getMarkedTarget(u);if(old&&old.status.markedBy===u.id)old.status.markedBy=null;
  u.markedTargetId=target?.id||null;
  if(target?.kind==='unit')target.status.markedBy=u.id;
}
function clearMarkedTarget(u){setMarkedTarget(u,null)}
function getLinkedTarget(u){const z=getEntity(u?.linkedTargetId);return z?.alive&&z.kind==='unit'?z:null}
function setLinkedTarget(u,target){
  const old=getLinkedTarget(u);if(old&&old.status.linkedBy===u.id)old.status.linkedBy=null;
  u.linkedTargetId=target?.id||null;
  if(target?.kind==='unit')target.status.linkedBy=u.id;
}
function clearLinkedTarget(u){setLinkedTarget(u,null)}
function straightDashValidFrom(mover,x,y,max=2){
  const d=Math.abs(x-mover.x)+Math.abs(y-mover.y);
  if(d<1||d>max||!(x===mover.x||y===mover.y)||!free(x,y))return false;
  const dx=Math.sign(x-mover.x),dy=Math.sign(y-mover.y);let cx=mover.x,cy=mover.y;
  for(let i=0;i<d-1;i++){cx+=dx;cy+=dy;if(entityAt(cx,cy))return false}
  return true;
}
function straightDashValid(u,x,y,max=2){return straightDashValidFrom(u,x,y,max)}
function impulseDestinationValid(u,x,y){
  return !!(u?.championId==='piplus'&&straightDashValidFrom(u,x,y,2));
}
function tileInRangeLOS(u,pos,a,ignoreLos=false){
  return inRange(u,pos,effectiveRange(u,a))&&(ignoreLos||!requiresLOS(a)||clearLOS(u,pos));
}
function objectDescription(z){
  if(z.type==='pillar')return 'Pilar de Coloso. 15 PV reales. Bloquea movimiento y línea de visión.';
  if(z.type==='sprout')return 'Brote de Onod. 12 PV, ocupa casilla y no bloquea línea de visión.';
  if(z.type==='doll')return `Muñeco Vudú de ${z.maxHp} PV asociado a ${getEntity(z.linkedTargetId)?.name||'un vínculo anterior'}. Sólo activa efectos si coincide con el Vínculo actual.`;
  return 'Objeto de combate.';
}
function bestFreeTile(u,target,range=3,preferNear=true){
  let best=null,bestScore=1e9;
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    const p={x,y};if(!free(x,y)||!inRange(u,p,range)||!clearLOS(u,p))continue;
    const score=(preferNear?md(p,target):-md(p,target));if(score<bestScore){bestScore=score;best=p}
  }
  return best;
}
function symbiosisHealFromOnod(onod,target){
  if(onod?.championId!=='onod'||!target)return;
  const sprouts=ownedSprouts(onod).filter(s=>adjCardinal(s,target)&&s.hp<s.maxHp);
  for(const s of sprouts){const got=heal(s,4);if(got)log(`🌿 Simbiosis: ${s.name} recupera ${got} PV.`)}
}
function symbiosisFromPoisonDamage(target,actual){
  if(!target?.alive||actual<=0)return;
  for(const onod of B.units.filter(z=>z.alive&&z.championId==='onod'&&z.side!==target.side)){
    for(const s of ownedSprouts(onod).filter(s=>adjCardinal(s,target)&&s.hp<s.maxHp)){
      const got=heal(s,actual);if(got)log(`🌿 Simbiosis: ${s.name} recupera ${got} PV por daño real de Veneno.`);
    }
  }
}
function triggerSymbiosis(u,target){symbiosisHealFromOnod(u,target)}
function arfeliChainBonus(u,id){
  if(u?.championId!=='arfeli')return 0;
  u.arfeliChain=u.arfeliChain||[];
  if(u.arfeliChain.includes(id)){u.arfeliChain=[id];return 0}
  const bonus=u.arfeliChain.length;u.arfeliChain.push(id);return bonus;
}
function correspondingDoll(u){
  const d=ownedDoll(u),l=getLinkedTarget(u);
  return d?.alive&&l?.alive&&d.linkedTargetId===l.id?d:null;
}
function offensiveAgainstMarked(u,id,target){
  return ['precise','vector','rupture'].includes(id)&&u?.fixationTargetId&&target?.id===u.fixationTargetId;
}
function collapseCells(pillar,dx,dy){
  const perp={x:-dy,y:dx},out=[];
  for(const off of [-1,0,1])out.push({x:pillar.x+dx+perp.x*off,y:pillar.y+dy+perp.y*off,band:'near'});
  for(const off of [-1,1])out.push({x:pillar.x+dx*2+perp.x*off,y:pillar.y+dy*2+perp.y*off,band:'middle'});
  out.push({x:pillar.x+dx*3,y:pillar.y+dy*3,band:'far'});
  return out.filter(c=>inside(c.x,c.y));
}
function areaCellsForPreview(pre){
  if(!pre)return[];
  if(pre.id==='vines'||pre.id==='grenade')return [{x:pre.x,y:pre.y},{x:pre.x+1,y:pre.y},{x:pre.x-1,y:pre.y},{x:pre.x,y:pre.y+1},{x:pre.x,y:pre.y-1}].filter(c=>inside(c.x,c.y));
  if(pre.id==='spores'){
    const s=getEntity(pre.sourceId);if(!s)return[];
    const out=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy){const x=s.x+dx,y=s.y+dy;if(inside(x,y))out.push({x,y})}return out;
  }
  if(pre.id==='awakening'){
    const u=cur(),seen=new Map();
    for(const s of ownedSprouts(u))for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=s.x+dx,y=s.y+dy;if(inside(x,y))seen.set(key(x,y),{x,y})}
    return [...seen.values()];
  }
  if(pre.id==='collapse'){
    const p=getEntity(pre.pillarId);return p?collapseCells(p,pre.dx,pre.dy):[];
  }
  return [];
}
function previewContains(x,y){return areaCellsForPreview(B?.pendingPreview).some(c=>c.x===x&&c.y===y)}
function validCollapseDirection(p,x,y){
  return !!(p&&Math.abs(x-p.x)+Math.abs(y-p.y)===1);
}
function markActionUsed(u){
  if(u?.championId==='coloso')u.ownActions.pillarCreated=true;
}
function abilityRangeState(u,id,x,y){
  const a=ability(u.championId,id);if(!a)return null;
  const pos={x,y},target=entityAt(x,y);
  if(id==='shield')return x===u.x&&y===u.y?{inside:true,blocked:false}:null;
  if(id==='impulse'||id==='hunterstep')return straightDashValidFrom(u,x,y,2)?{inside:true,blocked:false}:null;
  if(id==='awakening'||id==='reabsorb'||id==='paintransfer'||id==='dance')return x===u.x&&y===u.y?{inside:true,blocked:false}:null;
  if(id==='spores')return target?.type==='sprout'&&target.ownerId===u.id?{inside:true,blocked:false}:null;
  if(id==='collapse'||id==='magnetism'){
    const limit=u.monolith?5:3;
    return target?.type==='pillar'&&target.ownerId===u.id&&inRange(u,target,limit)?{inside:true,blocked:false}:null;
  }
  if(id==='stonearmor'&&x===u.x&&y===u.y)return {inside:true,blocked:false};
  if(id==='quake'&&u.championId==='coloso'&&u.monolith){
    const insideQuake=adj8(u,pos)||ownedPillars(u).some(p=>adj8(p,pos));return insideQuake?{inside:true,blocked:false}:null;
  }
  const r=effectiveRange(u,a);if(!inRange(u,pos,r))return null;
  const ignore=offensiveAgainstMarked(u,id,target);
  const blocked=requiresLOS(a)&&!ignore&&!clearLOS(u,pos);return {inside:true,blocked};
}

function canUseAbility(u,id,x,y){
  const a=ability(u.championId,id);if(!a||!u.loadout.includes(id)||u.pa<a.cost||B.busy||!skillUseAllowed(u,id))return false;
  const target=entityAt(x,y),pos={x,y},r=effectiveRange(u,a);
  if(id==='shield')return x===u.x&&y===u.y;
  if(id==='impulse')return impulseDestinationValid(u,x,y);
  if(id==='hunterstep')return straightDashValid(u,x,y,2);
  if(id==='stonearmor'){
    if(!target||u.stoneArmorTargetsUsed.includes(target.id))return false;
    if(target.id===u.id)return true;
    if(target.kind==='unit'&&target.side===u.side)return tileInRangeLOS(u,target,a);
    return target.type==='pillar'&&target.ownerId===u.id&&tileInRangeLOS(u,target,a);
  }
  if(id==='absorb'){
    return !!(target?.type==='pillar'&&target.ownerId===u.id&&!(target.createdRound===B.round&&target.createdTurn===B.turn)&&tileInRangeLOS(u,target,a));
  }
  if(id==='collapse'||id==='magnetism'){
    const limit=u.monolith?5:3;
    return !!(target?.type==='pillar'&&target.ownerId===u.id&&inRange(u,target,limit));
  }
  if(['trap_spikes','trap_electric'].includes(id))return activeTraps(u).length<3&&free(x,y)&&tileInRangeLOS(u,pos,a);
  if(id==='sap')return !!(target?.kind==='unit'&&target.side===u.side&&(target.id===u.id||tileInRangeLOS(u,target,a)));
  if(id==='spores')return !!(target?.type==='sprout'&&target.ownerId===u.id);
  if(id==='awakening')return x===u.x&&y===u.y&&ownedSprouts(u).length>0;
  if(id==='reabsorb')return x===u.x&&y===u.y&&ownedSprouts(u).some(s=>!(s.createdRound===B.round&&s.createdTurn===B.turn));
  if(id==='interference'||id==='fixation'||id==='rupture'){
    const marked=getMarkedTarget(u);
    return !!(marked&&target?.id===marked.id&&inRange(u,marked,a.range)&&(!requiresLOS(a)||id==='fixation'||u.fixationTargetId===marked.id||clearLOS(u,marked)));
  }
  if(id==='needle'){
    return !!(target?.kind==='unit'&&target.alive&&inRange(u,target,a.range)&&clearLOS(u,target));
  }
  if(id==='transfer'){
    const d=correspondingDoll(u);return !!(d&&target?.id===d.id&&u.hp<u.maxHp&&tileInRangeLOS(u,d,a));
  }
  if(id==='ritual'){
    const linked=getLinkedTarget(u);return !!(linked&&linked.side!==u.side&&target?.id===linked.id&&tileInRangeLOS(u,linked,a));
  }
  if(id==='curse'){
    return !!(target?.kind==='unit'&&target.side!==u.side&&tileInRangeLOS(u,target,a));
  }
  if(id==='paintransfer'||id==='dance'){
    return x===u.x&&y===u.y&&!!correspondingDoll(u);
  }
  if(id==='vines'||id==='grenade'){
    return tileInRangeLOS(u,pos,a);
  }
  if(id==='shot'){
    return !!(damageableEnemy(u,target)&&(target.x===u.x||target.y===u.y)&&inRange(u,target,5)&&clearLOS(u,target));
  }
  if(id==='hook'){
    return !!(damageableEnemy(u,target)&&inRange(u,target,3)&&clearLOS(u,target));
  }
  const foe=target;if(!damageableEnemy(u,foe))return false;
  if(id==='hammer'){
    if(!inRange(u,foe,3))return false;
    return [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]].some(([dx,dy])=>free(foe.x+dx,foe.y+dy));
  }
  if(id==='quake'&&u.championId==='coloso'&&u.monolith)return quakeCanReach(u,foe);
  if(!inRange(u,foe,r))return false;
  if(requiresLOS(a)&&!offensiveAgainstMarked(u,id,foe)&&!clearLOS(u,foe))return false;
  return true;
}


function berserkerBonus(u){return 0}
function skillDamage(u,a){return (a.damage||0)}

function applyDamageCore(e,n,ignoreShield=false,opts={}){
  if(!e||!e.alive||n<=0)return 0;
  let remaining=n,absorbed=0;
  if(!ignoreShield){
    for(const s of e.shieldStacks||[]){if(remaining<=0)break;const take=Math.min(s.amount,remaining);s.amount-=take;remaining-=take;absorbed+=take}
    e.shieldStacks=(e.shieldStacks||[]).filter(s=>s.amount>0&&s.turns>0);
  }
  const before=e.hp,rawHp=Math.max(0,remaining),actualHp=Math.min(before,rawHp);
  if(rawHp>0)e.hp-=rawHp;
  if(absorbed&&actualHp)feedback(e,`🛡️-${absorbed}  ❤️-${actualHp}`,'damage');
  else if(absorbed)feedback(e,`🛡️-${absorbed}`,'shield-hit');
  else if(actualHp)feedback(e,`-${actualHp}`,'damage');
  if(e.hp<=0){e.hp=0;e.alive=false;if(isCombatObject(e))log(`${e.icon||'◼️'} ${e.name} fue destruido.`);else log(`📣 ${e.name} queda fuera de combate.`)}
  if(e.type==='doll'&&actualHp>0&&!opts.skipDollEffect){
    const owner=getUnit(e.ownerId),linked=getEntity(e.linkedTargetId);
    const active=owner?.alive&&linked?.alive&&owner.linkedTargetId===e.linkedTargetId;
    if(active){
      const effect=Math.ceil(actualHp/2);
      if(linked.side!==owner.side){applyDamage(linked,effect,false,{skipPainTransfer:false});log(`🪆 Muñeco: ${linked.name} recibe ${effect} daño indirecto.`)}
      else{const got=heal(linked,effect);if(got)log(`🪆 Muñeco: ${linked.name} recupera ${got} PV.`)}
    }
  }
  return actualHp;
}
function applyDamage(e,n,ignoreShield=false,opts={}){
  if(!e||!e.alive||n<=0)return 0;
  if(e.kind==='unit'&&e.championId==='houngan'&&!opts.skipPainTransfer){
    const d=getEntity(e.painTransferDollId);
    const valid=d?.alive&&d.type==='doll'&&e.painTransferLinkId&&e.linkedTargetId===e.painTransferLinkId&&d.id===e.painTransferDollId&&d.linkedTargetId===e.painTransferLinkId;
    if(valid){
      const houganPart=Math.ceil(n/2),dollPart=Math.floor(n/2);
      const realHougan=applyDamageCore(e,houganPart,ignoreShield,{...opts,skipPainTransfer:true});
      if(dollPart>0)applyDamageCore(d,dollPart,ignoreShield,{...opts,skipPainTransfer:true});
      log(`🩸 Transferencia de Dolor: ${houganPart} a Houngan / ${dollPart} al Muñeco.`);
      return realHougan;
    }
  }
  return applyDamageCore(e,n,ignoreShield,opts);
}
function heal(u,n){
  const before=u.hp;u.hp=Math.min(u.maxHp,u.hp+n);
  const gained=u.hp-before;if(gained>0)feedback(u,`+${gained} ❤️`,'heal');
  return gained;
}
function destroyPillar(p){
  if(!p)return;p.alive=false;p.hp=0;
}

function trapAt(x,y){return B?.traps.find(t=>t.active&&t.x===x&&t.y===y)||null}
async function triggerTrapAt(target){
  const trap=B?.traps.find(t=>t.active&&t.side!==target.side&&t.x===target.x&&t.y===target.y);if(!trap)return;
  trap.active=false;
  if(trap.trapType==='spikes'){applyDamage(target,10,false);if(target.kind==='unit'&&target.alive)addStatus(target,'wound',1);log(`🪤 Trampa de Pinchos: ${target.name} recibe 10 daño + Herida 1.`)}
  if(trap.trapType==='electric'){applyDamage(target,8,false);if(target.kind==='unit'&&target.alive)target.status.paPenaltyNext=Math.max(target.status.paPenaltyNext||0,1);log(`⚡ Mina Eléctrica: ${target.name} recibe 8 daño y -1 PA en su próximo turno.`)}
  renderBattle();await sleep(180);
}
async function dashUnit(u,x,y){
  const dx=Math.sign(x-u.x),dy=Math.sign(y-u.y),steps=md(u,{x,y});
  for(let i=0;i<steps&&u.alive;i++){const old={x:u.x,y:u.y};u.x+=dx;u.y+=dy;faceStep(u,old);applyWoundStep(u);renderBattle();await sleep(120);if(!u.alive||checkBattleEnd())break;await triggerTrapAt(u)}
}
function forcedDirection(source,target,away=true){
  const dx=target.x-source.x,dy=target.y-source.y;
  if(Math.abs(dx)>=Math.abs(dy)&&dx!==0)return [away?Math.sign(dx):-Math.sign(dx),0];
  if(dy!==0)return [0,away?Math.sign(dy):-Math.sign(dy)];
  return [0,0];
}
async function forcedMove(target,source,distance=1,away=true,label='Empuje'){
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
        log(`💥 ${blocker.type==='pillar'?blocker.name:blocker.name} recibe ${half} daño por la colisión.`);
      }
      renderBattle();await sleep(220);
      break;
    }
    const old={x:target.x,y:target.y};target.x=nx;target.y=ny;faceStep(target,old);
    applyWoundStep(target);renderBattle();await sleep(150);if(!target.alive||checkBattleEnd())break;await triggerTrapAt(target);
  }
}

function spendPAAfterAction(u){
  if(u.alive&&u.status.curseDamage>0){const n=u.status.curseDamage;u.status.curseDamage=0;applyDamage(u,n,false);log(`☠️ Maldición: ${u.name} recibe ${n} daño por gastar PA.`)}
}

async function executeAbility(u,id,x,y,fromAI=false,extra={}){
  if(!canUseAbility(u,id,x,y))return false;
  const a=ability(u.championId,id),target=entityAt(x,y);
  B.busy=true;B.noticeSeq++;B.notice=`${u.icon} ${u.name} — ${a.icon} ${a.name}`;markActionUsed(u);
  if(target)faceTarget(u,target);registerSkillUse(u,id);u.pa-=a.cost;triggerPoisonOnAbility(u);
  if(!u.alive){B.notice='';B.selectedAction=null;B.busy=false;renderBattle();checkBattleEnd();return true}
  const objectTarget=isCombatObject(target),arfeliBonus=u.championId==='arfeli'?arfeliChainBonus(u,id):0;
  renderBattle();await sleep(120);

  if(['sword','daggers','bow','spear'].includes(id)){
    const dmg=(a.damage||0)+arfeliBonus;applyDamage(target,dmg,false);log(`${a.icon} ${a.name}: ${dmg} daño a ${target.name}.`);
    if(id==='daggers'&&target.kind==='unit'&&target.alive){addStatus(target,'wound',2);log(`🩸 ${target.name} obtiene Herida ${target.status.wound}.`)}
    if(id==='spear'&&target.kind==='unit'&&target.alive)await forcedMove(target,u,1,false,'Atracción');
  }else if(id==='shield'){
    const amount=15+arfeliBonus;addShield(u,amount,'Portación de Escudo');log(`🛡️ ${u.name} obtiene ${amount} de Escudo.`);
  }else if(id==='hammer'){
    const spots=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]
      .map(([dx,dy])=>({x:target.x+dx,y:target.y+dy}))
      .filter(p=>free(p.x,p.y)).sort((p,q)=>md(u,p)-md(u,q));
    if(spots.length){u.x=spots[0].x;u.y=spots[0].y;faceTarget(u,target)}
    const dmg=13+arfeliBonus;applyDamage(target,dmg,false);log(`🔨 Golpe de Martillo: ${dmg} daño a ${target.name}.`);
    if(target.kind==='unit'&&target.alive){target.status.pmPenaltyNext=Math.max(target.status.pmPenaltyNext||0,1);log(`🔨 ${target.name} tendrá -1 PM en su próximo turno.`)}

  }else if(id==='rock'){
    applyDamage(target,8,false);log(`💥 Lanzar Roca: 8 daño a ${target.name}.`);
  }else if(id==='stonearmor'){
    u.stoneArmorTargetsUsed.push(target.id);addShield(target,10,'Armadura de Piedra');log(`🛡️ ${target.name} obtiene 10 de Escudo.`);
  }else if(id==='absorb'){
    const amount=Math.min(15,target.hp),name=target.name;destroyPillar(target);const got=heal(u,amount);log(`🧲 Absorción Rocosa: ${name} aporta ${amount} PV reales; ${u.name} recupera ${got}.`);
  }else if(id==='quake'){
    let origin=u,projected=false;
    if(u.monolith){origin=quakeOriginForTarget(u,target)||u;projected=origin.type==='pillar'}
    const dmg=projected?8:10;applyDamage(target,dmg,false);log(`🌋 Golpe Sísmico: ${dmg} daño a ${target.name}.`);
    if(target.alive){
      const qid=`quake-${B.nextQuakeId++}`;if(projected)origin.lastReplicaQuakeId=qid;
      await forcedMove(target,origin,1,true,'Empuje');
      if(u.monolith&&target.alive)await triggerReplicas(u,target,qid);
    }
  }else if(id==='collapse'){
    const p=getEntity(extra.pillarId),cells=collapseCells(p,extra.dx,extra.dy),hp=p?.hp||0;
    if(p){
      destroyPillar(p);
      for(const c of cells){
        const z=entityAt(c.x,c.y);if(!z?.alive||z.side===u.side)continue;
        const dmg=c.band==='near'?Math.max(3,hp-6):c.band==='middle'?Math.max(3,hp-3):Math.max(3,hp);
        applyDamage(z,dmg,false);log(`🪨 Derrumbe (${c.band}): ${z.name} recibe ${dmg} daño.`);
      }
    }
  }else if(id==='magnetism'){
    const p=getEntity(extra.pillarId),pullTarget=extra.forcedTarget||getEntity(extra.targetId);
    if(p&&pullTarget?.kind==='unit')await forcedMove(pullTarget,p,2,false,'Magnetismo');
  }else if(id==='precise'){
    const marked=getMarkedTarget(u)?.id===target.id,dmg=marked?10:8;applyDamage(target,dmg,false);log(`🏹 Disparo Preciso: ${dmg} daño a ${target.name}.`);
  }else if(id==='vector'){
    const marked=getMarkedTarget(u)?.id===target.id,dist=marked?2:1;applyDamage(target,6,false);log(`💥 Impacto Vectorial: 6 daño a ${target.name}.`);
    if(target.kind==='unit'&&target.alive)await forcedMove(target,u,dist,true,'Impacto Vectorial');
  }else if(id==='interference'){
    target.status.pmPenaltyNext=Math.max(target.status.pmPenaltyNext||0,1);log(`📡 ${target.name} tendrá -1 PM en su próximo turno.`);
  }else if(id==='rupture'){
    applyDamage(target,14,false);clearMarkedTarget(u);u.ownActions.markBlocked=true;u.fixationTargetId=null;log(`💥 Ruptura de Marca: 14 daño. La Marca se consume.`);
  }else if(id==='fixation'){
    u.fixationTargetId=target.id;log(`🎯 Fijación: la próxima habilidad ofensiva contra ${target.name} este turno ignora línea de visión.`);
  }else if(id==='hunterstep'){
    await dashUnit(u,x,y);log(`🏃 Paso del Cazador: ${u.name} se desplaza sin gastar PM.`);
  }else if(id==='thorn'){
    applyDamage(target,6,false);if(target.kind==='unit'&&target.alive)addStatus(target,'poison',1);log(`☠️ Espina Venenosa: 6 daño + Veneno 1 a ${target.name}.`);
  }else if(id==='vines'){
    const cells=[{x,y},{x:x+1,y},{x:x-1,y},{x,y:y+1},{x,y:y-1}];
    for(const c of cells){
      const z=entityAt(c.x,c.y);if(!z?.alive||z.side===u.side||z.kind!=='unit')continue;
      const dmg=(c.x===x&&c.y===y)?6:4;applyDamage(z,dmg,false);if(z.alive)z.status.pmPenaltyNext=Math.max(z.status.pmPenaltyNext||0,1);
      log(`🌿 Enredaderas: ${z.name} recibe ${dmg} daño y -1 PM próximo turno.`);
    }
  }else if(id==='sap'){
    const near=ownedSprouts(u).some(s=>adjCardinal(s,target)),amount=near?12:8,got=heal(target,amount);
    log(`💚 Savia Vital: ${target.name} recupera ${got} PV${near?' junto a Brote':''}.`);symbiosisHealFromOnod(u,target);
  }else if(id==='spores'){
    const s=target;
    for(const z of B.units.filter(z=>z.alive&&z.side!==u.side&&Math.max(Math.abs(z.x-s.x),Math.abs(z.y-s.y))===1)){
      applyDamage(z,8,false);if(z.alive)addStatus(z,'poison',1);log(`🌬️ Esporas Tóxicas: ${z.name} recibe 8 daño + Veneno 1.`);
    }
  }else if(id==='awakening'){
    const enemies=B.units.filter(z=>z.alive&&z.side!==u.side);
    for(const z of enemies){
      const hits=ownedSprouts(u).filter(s=>adjCardinal(s,z)).length;if(!hits)continue;
      const dmg=8*hits;applyDamage(z,dmg,false);log(`🌳 Despertar del Bosque: ${z.name} recibe ${dmg} daño (${hits} Brote${hits>1?'s':''}).`);
    }
  }else if(id==='reabsorb'){
    const old=ownedSprouts(u).filter(s=>!(s.createdRound===B.round&&s.createdTurn===B.turn)),count=old.length;
    old.forEach(destroyPillar);u.pa+=count;u.ownActions.reabsorbUsed=true;log(`♻️ Reabsorción: absorbe ${count} Brote${count!==1?'s':''} y recupera ${count} PA.`);
  }else if(['trap_spikes','trap_electric'].includes(id)){
    const trapType=id==='trap_spikes'?'spikes':'electric',icon=id==='trap_spikes'?'🪤':'⚡';
    B.traps.push({id:`trap${B.nextTrapId++}`,trapType,icon,x,y,ownerId:u.id,side:u.side,active:true});log(`🪤 ${u.name} preparó una trampa.`);
  }else if(id==='grenade'){
    const center={x,y},targets=[{x,y,center:true},{x:x+1,y},{x:x-1,y},{x,y:y+1},{x,y:y-1}];
    for(const c of targets){
      const z=entityAt(c.x,c.y);if(!z?.alive||z.side===u.side)continue;
      if(c.center){applyDamage(z,10,false);log(`💣 Granada: ${z.name} recibe 10 daño en el centro.`)}
      else{applyDamage(z,6,false);log(`💣 Granada: ${z.name} recibe 6 daño.`);if(z.kind==='unit'&&z.alive)await forcedMove(z,center,1,true,'Granada')}
    }
  }else if(id==='shot'){
    applyDamage(target,10,false);log(`🏹 Disparo de Caza: 10 daño a ${target.name}.`);
  }else if(id==='hook'){
    applyDamage(target,6,false);log(`🪝 Gancho: 6 daño a ${target.name}.`);
    if(target.kind==='unit'&&target.alive)await forcedMove(target,u,extra.pull||1,false,'Gancho');
  }else if(id==='needle'){
    if(target.side===u.side){const got=heal(target,6);setLinkedTarget(u,target);log(`🪡 Aguja Vudú: ${target.name} recupera ${got} PV y queda Vinculado.`)}
    else{applyDamage(target,6,false);if(target.alive)setLinkedTarget(u,target);log(`🪡 Aguja Vudú: 6 daño a ${target.name} + Vínculo.`)}
  }else if(id==='transfer'){
    const d=target,need=Math.min(8,u.maxHp-u.hp),got=heal(u,need);if(got>0)applyDamage(d,got,false);log(`🔄 Transferencia: ${u.name} recupera ${got} PV y el Muñeco pierde exactamente ${got} PV.`);
  }else if(id==='ritual'){
    const d=correspondingDoll(u),damage=d&&adjCardinal(d,target)?20:14;applyDamage(target,damage,false);log(`👁️ Ritual del Dolor: ${target.name} recibe ${damage} daño.`);clearLinkedTarget(u);u.painTransferDollId=null;u.painTransferLinkId=null;
  }else if(id==='curse'){
    applyDamage(target,8,false);if(target.alive)addStatus(target,'poison',1);log(`☠️ Maldición: ${target.name} recibe 8 daño + Veneno 1.`);
  }else if(id==='paintransfer'){
    const d=correspondingDoll(u),l=getLinkedTarget(u);u.painTransferDollId=d.id;u.painTransferLinkId=l.id;log(`🩸 Transferencia de Dolor queda activa mientras se mantengan ese Vínculo y ese Muñeco.`);
  }else if(id==='dance'){
    const d=correspondingDoll(u),l=getLinkedTarget(u);u.danceDollId=d.id;u.danceLinkId=l.id;log(`💃 Danza Vudú preparada: ${l.name} intentará copiar cada paso del Muñeco.`);
  }

  if(u.fixationTargetId&&target?.id===u.fixationTargetId&&['precise','vector','rupture'].includes(id)&&id!=='fixation')u.fixationTargetId=null;
  spendPAAfterAction(u);B.notice='';B.selectedAction=null;B.pendingPreview=null;B.pendingStage=null;B.pendingChoice=null;B.busy=false;renderBattle();
  if(checkBattleEnd())return true;if(B.pendingTimeout&&!B.ended){nextTurn();return true}return true;
}

async function triggerReplicas(u,target,quakeId){
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
}

function leaveMonolith(u,reason=''){
  if(!u||!u.monolith)return false;
  u.monolith=false;u.exitedMonolithThisTurn=true;u.pm=Math.max(0,u.monolithStoredPm??u.maxPm);
  log(`🗿 ${u.name} abandona Monolito.${reason?` ${reason}`:''}`);
  return true;
}
function exitMonolith(){
  const u=cur();if(!u||u.controller!=='human'||!u.monolith||B.busy)return;
  u.ownActions.pillarCreated=true;leaveMonolith(u);renderBattle();
}
function ownActionRange(u,action,x,y){
  const p={x,y},z=entityAt(x,y);
  if(action==='createPillar')return u.championId==='coloso'&&!u.ownActions.pillarCreated&&ownedPillars(u).length<(u.monolith?3:2)&&free(x,y)&&inRange(u,p,5)&&clearLOS(u,p);
  if(action==='fusionPillar')return u.championId==='coloso'&&!u.monolith&&u.pa>=3&&z?.type==='pillar'&&z.ownerId===u.id&&adjCardinal(u,z);
  if(action==='rockRecycle')return u.championId==='coloso'&&u.monolith&&!u.ownActions.rockRecycleUsed&&z?.type==='pillar'&&z.ownerId===u.id;
  if(action==='markTarget')return u.championId==='piplus'&&!u.ownActions.markUsed&&!u.ownActions.markBlocked&&z?.kind==='unit'&&z.side!==u.side&&inRange(u,z,4)&&clearLOS(u,z);
  if(action==='germinateOwn')return u.championId==='onod'&&!u.ownActions.reabsorbUsed&&u.pa>=1&&u.ownActions.germinated<2&&ownedSprouts(u).length<3&&free(x,y)&&inRange(u,p,3)&&clearLOS(u,p);
  if(action==='witherSprout')return u.championId==='onod'&&!u.ownActions.witherUsed&&z?.type==='sprout'&&z.ownerId===u.id;
  if(action==='disarmTrap')return u.championId==='korgan'&&!u.ownActions.disarmUsed&&B.traps.some(q=>q.active&&q.ownerId===u.id&&q.x===x&&q.y===y);
  if(action==='createDoll')return u.championId==='houngan'&&u.pa>=2&&!!getLinkedTarget(u)&&free(x,y)&&inRange(u,p,3)&&clearLOS(u,p);
  return false;
}
function selectOwnAction(action){
  const u=cur();if(!u||u.controller!=='human'||B.busy)return;
  B.selectedAction=B.selectedAction===action?null:action;B.pendingPreview=null;B.pendingStage=null;B.pendingChoice=null;B.skillsOpen=false;B.pendingImpulseTargetId=null;renderBattle();
}
function executeOwnAction(action,x,y){
  const u=cur();if(!ownActionRange(u,action,x,y))return false;
  const z=entityAt(x,y);
  if(action!=='createPillar'&&u.championId==='coloso')u.ownActions.pillarCreated=true;
  if(action==='createPillar'){
    const number=B.nextPillarId++;
    B.pillars.push({id:`pillar${number}`,number,type:'pillar',kind:'object',ownerId:u.id,side:u.side,name:`Pilar ${number}`,icon:'🗿',x,y,hp:15,maxHp:15,alive:true,shieldStacks:[],blocksLOS:true,lastReplicaQuakeId:null,createdRound:B.round,createdTurn:B.turn});
    u.ownActions.pillarCreated=true;log(`🗿 ${u.name} crea Pilar ${number} con 15 PV.`);
  }else if(action==='fusionPillar'){
    u.pa-=3;destroyPillar(z);u.monolithStoredPm=u.pm;u.monolith=true;u.pm=0;log(`🗿 ${u.name} consume ${z.name} y entra en Monolito.`);
  }else if(action==='rockRecycle'){
    const name=z.name;destroyPillar(z);u.ownActions.rockRecycleUsed=true;
    const damaged=ownedPillars(u).filter(p=>p.hp<p.maxHp).sort((a,b)=>a.hp-b.hp)[0];
    if(damaged){damaged.hp=15;log(`♻️ Reciclaje Rocoso: ${name} se sacrifica y ${damaged.name} vuelve a 15 PV.`)}
    else{addShield(u,6,'Reciclaje Rocoso');log(`♻️ Reciclaje Rocoso: ${name} se sacrifica y ${u.name} obtiene 6 de Escudo.`)}
  }else if(action==='markTarget'){
    setMarkedTarget(u,z);u.ownActions.markUsed=true;log(`🎯 ${u.name} marca a ${z.name}.`);
  }else if(action==='germinateOwn'){
    u.pa-=1;u.ownActions.germinated++;
    const n=B.nextObjectId++;
    B.pillars.push({id:`sprout${n}`,number:n,type:'sprout',kind:'object',ownerId:u.id,side:u.side,name:`Brote ${n}`,icon:'🌱',x,y,hp:12,maxHp:12,alive:true,shieldStacks:[],blocksLOS:false,createdRound:B.round,createdTurn:B.turn});
    log(`🌱 ${u.name} germina un Brote por 1 PA.`);
  }else if(action==='witherSprout'){
    const name=z.name;destroyPillar(z);u.ownActions.witherUsed=true;log(`🍂 ${u.name} marchita ${name} sin obtener beneficio.`);
  }else if(action==='disarmTrap'){
    const trap=B.traps.find(q=>q.active&&q.ownerId===u.id&&q.x===x&&q.y===y);trap.active=false;u.ownActions.disarmUsed=true;u.pa+=1;feedback(u,'+1 PA','pa');log(`🪤 ${u.name} desarma una trampa propia y recupera 1 PA.`);
  }else if(action==='createDoll'){
    u.pa-=2;const linked=getLinkedTarget(u),old=ownedDoll(u);if(old)destroyPillar(old);
    const enemy=linked.side!==u.side,hp=enemy?16:20,n=B.nextObjectId++;
    B.pillars.push({id:`doll${n}`,type:'doll',kind:'object',ownerId:u.id,side:u.side,name:'Muñeco Vudú',icon:'🪆',x,y,hp,maxHp:hp,alive:true,shieldStacks:[],blocksLOS:false,linkedTargetId:linked.id});
    log(`🪆 ${u.name} crea un Muñeco de ${hp} PV asociado a ${linked.name}.`);
  }
  B.selectedAction=null;renderBattle();return true;
}

function statusText(u){
  const a=[];if(u.status.wound)a.push(`🩸 Herida ${u.status.wound}`);if(u.status.poison)a.push(`☠️ Veneno ${u.status.poison}`);if(u.status.burn)a.push(`🔥 Quemadura ${u.status.burn}`);if(u.status.paPenaltyNext)a.push('🔨 PA -1 próximo turno');if(u.status.pmPenaltyNext)a.push(`🌿 PM -${u.status.pmPenaltyNext} próximo turno`);if(u.status.curseDamage)a.push('☠️ Maldición');if(u.status.markedBy)a.push('🎯 Marcado');if(u.status.linkedBy)a.push('🪡 Vinculado');if(u.monolith)a.push('🗿 Monolito');return a.length?a.join(' · '):'Sin estados';
}
function statusChips(u){
  const a=[];if(u.status.wound)a.push(`<span class="state-chip">🩸 Herida ${u.status.wound}</span>`);if(u.status.poison)a.push(`<span class="state-chip">☠️ Veneno ${u.status.poison}</span>`);if(u.status.burn)a.push(`<span class="state-chip">🔥 Quemadura ${u.status.burn}</span>`);if(u.status.paPenaltyNext)a.push('<span class="state-chip control">🔨 PA -1 próximo</span>');if(u.status.pmPenaltyNext)a.push(`<span class="state-chip control">🌿 PM -${u.status.pmPenaltyNext} próximo</span>`);if(u.status.curseDamage)a.push('<span class="state-chip control">☠️ Maldición</span>');if(u.status.markedBy)a.push('<span class="state-chip">🎯 Marcado</span>');if(u.status.linkedBy)a.push('<span class="state-chip">🪡 Vinculado</span>');if(u.monolith)a.push('<span class="state-chip monolith">🗿 Monolito</span>');return a.length?a.join(''):'<span class="state-empty">Sin estados</span>';
}
function statusIcons(u){
  const a=[];if(u.status.wound)a.push(`🩸${u.status.wound}`);if(u.status.poison)a.push(`☠️${u.status.poison}`);if(u.status.paPenaltyNext)a.push('🔨-1PA');if(u.status.pmPenaltyNext)a.push(`🌿-${u.status.pmPenaltyNext}PM`);if(u.status.curseDamage)a.push('☠️');if(u.status.markedBy)a.push('🎯');if(u.status.linkedBy)a.push('🪡');if(u.monolith)a.push('🗿');return a.join(' ');
}
function renderEntity(z,current,view){
  if(isCombatObject(z)){
    const label=z.type==='pillar'?`P${z.number||'?'}`:z.type==='sprout'?'🌱':z.type==='doll'?'🪆':'';
    return `<div class="unit-piece pillar-piece object-piece ${z.type}" style="z-index:${10+z.y}">${z.feedback?`<div class="damage-float ${z.feedback.type}">${z.feedback.text}</div>`:''}${label?`<div class="pillar-label">${label}</div>`:''}${shieldTotal(z)?`<div class="unit-shieldbar">🛡️${shieldTotal(z)}</div>`:''}<div class="unit-vitals">${z.hp}/${z.maxHp}</div><div class="unit-hp"><i style="width:${Math.max(0,z.hp/z.maxHp*100)}%"></i></div><span class="unit-icon">${z.icon}</span></div>`;
  }
  return `<div class="unit-piece ${z.side==='player'?'team-player':'team-enemy'} ${z.monolith?'monolith-piece':''}" style="z-index:${10+z.y}">${z.feedback?`<div class="damage-float ${z.feedback.type}">${z.feedback.text}</div>`:''}${statusIcons(z)?`<div class="unit-states">${statusIcons(z)}</div>`:''}${shieldTotal(z)?`<div class="unit-shieldbar">🛡️${shieldTotal(z)}</div>`:''}<div class="unit-vitals">${z.hp}/${z.maxHp}</div><div class="unit-hp"><i style="width:${Math.max(0,z.hp/z.maxHp*100)}%"></i></div><span class="unit-icon">${z.icon}</span></div>`;
}
function validTargetTile(x,y,action){
  const u=cur();if(!u||u.controller!=='human')return false;
  if(['createPillar','fusionPillar','rockRecycle','markTarget','germinateOwn','witherSprout','disarmTrap','createDoll'].includes(action))return ownActionRange(u,action,x,y);
  if(action==='impulse'&&B?.pendingImpulseTargetId)return impulseDestinationValid(u,x,y);
  return canUseAbility(u,action,x,y);
}
function invalidAbilityReason(u,id,x,y){
  const a=ability(u.championId,id),target=entityAt(x,y);if(!a)return 'Acción no disponible.';if(!skillUseAllowed(u,id))return `${a.name}: límite de usos por turno alcanzado.`;if(u.pa<a.cost)return 'PA insuficientes.';
  if(['trap_spikes','trap_electric'].includes(id)&&!free(x,y))return 'La casilla está ocupada.';
    if(['trap_spikes','trap_electric'].includes(id)&&activeTraps(u).length>=3)return 'Máximo de 3 trampas activas.';
      if(id==='ritual'&&!getLinkedTarget(u))return 'Necesitás un enemigo Vinculado.';
  if(id==='rupture'&&!getMarkedTarget(u))return 'Necesitás un enemigo Marcado.';
  if(id==='impulse')return 'Elegí una casilla final libre a 1 o 2 casillas en línea.';
  if(id==='hunterstep')return 'Elegí una casilla libre en línea a 1 o 2 casillas.';
  if(!target&&!['vines','grenade','awakening','reabsorb','paintransfer','dance','impulse','hunterstep','trap_spikes','trap_electric'].includes(id))return 'Elegí un objetivo.';
  if(target?.side===u.side&&!['sap','stonearmor','absorb','awakening','transfer','needle'].includes(id))return 'Objetivo aliado no válido.';
  if(id==='quake'&&u.monolith&&target&&!quakeCanReach(u,target))return 'Fuera del alcance de Coloso y de sus Pilares.';
  const rs=abilityRangeState(u,id,x,y);if(!rs?.inside)return 'Fuera de alcance.';if(rs.blocked)return 'Sin línea de visión.';return 'Objetivo no válido.';
}

function actionInfo(id){
  const u=cur();
  if(id==='move')return {name:'Mover',cost:'1 PM/casilla',text:'Movimiento ortogonal. Podés dividir el movimiento antes y después de usar habilidades.',target:'Casilla libre',range:'Hasta PM disponibles'};
  if(id==='createPillar')return {name:'Crear Pilar',cost:'0 PA',text:'Sólo como primera acción del turno. Crea un Pilar de 15 PV.',target:'Casilla libre',range:'5'};
  if(id==='fusionPillar')return {name:'Fusión de Pilar',cost:'3 PA',text:'Consume un Pilar ortogonalmente adyacente y entra en Monolito.',target:'Pilar propio',range:'1'};
  if(id==='rockRecycle')return {name:'Reciclaje Rocoso',cost:'0 PA',text:'Monolito, 1/turno. Sacrifica un Pilar: repara otro a 15 PV o da 6 Escudo.',target:'Pilar propio',range:'Cualquiera'};
  if(id==='markTarget')return {name:'Marcar Objetivo',cost:'0 PA',text:'Marca un enemigo. Máximo 1/turno.',target:'Enemigo',range:'4 + LOS'};
  if(id==='germinateOwn')return {name:'Germinar Brote',cost:'1 PA',text:'Crea Brote de 12 PV. Máximo 2/turno y 3 activos.',target:'Casilla libre',range:'3 + LOS'};
  if(id==='witherSprout')return {name:'Marchitar Brote',cost:'0 PA',text:'Retira voluntariamente un Brote propio. Máximo 1/turno.',target:'Brote propio',range:'Cualquiera'};
  if(id==='disarmTrap')return {name:'Desarmar Trampa',cost:'0 PA',text:'Retira una trampa propia y recupera 1 PA. Máximo 1/turno.',target:'Trampa propia',range:'Cualquiera'};
  if(id==='createDoll')return {name:'Muñeco Vudú',cost:'2 PA',text:'Requiere Vínculo. Reemplaza el Muñeco anterior y queda asociado a ese Vinculado.',target:'Casilla libre',range:'3 + LOS'};
  const a=ability(u.championId,id);if(!a)return null;
  const placement=['trap_spikes','trap_electric','hunterstep','vines','grenade'].includes(id);const support=['sap','stonearmor'].includes(id);return{name:a.name,cost:`${a.cost} PA`,text:a.text,target:id==='impulse'?(B?.pendingImpulseTargetId?'Destino del aliado':'Piplus o aliado'):placement?'Casilla/posición':support?'Aliado/propio':id==='absorb'||id==='awakening'||id==='transfer'||id==='spores'?'Invocación propia':'Enemigo/objeto enemigo',range:a.range===0?'Personal':`Alcance ${effectiveRange(u,a)}`};
}
function infoPanel(id){
  const z=actionInfo(id);if(!z)return'';
  return `<div class="action-info"><div><b>${z.name}</b><span>${z.cost}</span></div><p>${z.text}</p><div class="info-grid"><span>🎯 ${z.target}</span><span>📏 ${z.range}</span></div></div>`;
}

function renderBattle(){
  if(!B||B.ended)return;
  const u=cur(),phase=B.dollPhase,doll=phase?getEntity(phase.dollId):null,phaseHuman=!!(phase&&u?.controller==='human');
  const view=getEntity(B.selectedUnitId)||(phase&&doll)||u;
  const moves=phaseHuman&&doll?objectMovementMap(doll,phase.pm):(u.controller==='human'&&B.selectedAction==='move'?movementMap(u):new Map());
  let tiles='',pieces='';
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    const z=entityAt(x,y),trap=trapAt(x,y),cl=['tile'],k=key(x,y);
    if(isFixedObstacle(x,y))cl.push('obstacle');
    if(moves.has(k))cl.push('move');
    if(z?.id===(phase&&doll?doll.id:u.id))cl.push('turn-unit');
    if(z?.id===B.selectedUnitId)cl.push('inspected');
    if(!phase&&u.controller==='human'&&B.selectedAction&&!['move','createPillar','fusionPillar','rockRecycle','markTarget','germinateOwn','witherSprout','disarmTrap','createDoll'].includes(B.selectedAction)){
      const rs=abilityRangeState(u,B.selectedAction,x,y);
      if(rs?.inside)cl.push('skill-range');
      if(rs?.blocked)cl.push('range-blocked');
    }
    if(B.pendingPreview&&previewContains(x,y))cl.push('target');
    else if(!phase&&u.controller==='human'&&B.selectedAction&&B.selectedAction!=='move'&&!['vines','grenade','spores','awakening','collapse'].includes(B.selectedAction)&&validTargetTile(x,y,B.selectedAction))cl.push('target');
    tiles+=isoTileMarkup(x,y,cl);
    if(isFixedObstacle(x,y))pieces+=isoObstacleMarkup(x,y);
    if(trap&&trap.side==='player')pieces+=isoTrapMarkup(trap,x,y);
    if(z)pieces+=isoEntityMarkup(z,u,view);
  }
  const order=B.order.map((id,i)=>{const z=getUnit(id);return`<span class="turn-chip ${z.side==='player'?'blue-team':'red-team'} ${!z.alive?'ko':''} ${id===u.id?'current':''}" title="${i+1}. ${z.name}${!z.alive?' · KO':''}"><span class="turn-number">${i+1}</span><span class="turn-team-dot">${z.side==='player'?'🔵':'🔴'}</span><span class="turn-icon">${z.icon}</span><span class="turn-name">${z.name}</span></span>`}).join('');
  const playerHud=hudSetting('player'),enemyHud=hudSetting('enemy'),commandHud=hudSetting('command'),roundHud=hudSetting('round');
  const rosterItem=z=>{const pct=Math.max(0,Math.round((z.hp/z.maxHp)*100));return`<button class="battle-roster-item ${z.side==='player'?'blue-team':'red-team'} ${!z.alive?'ko':''} ${z.id===u.id?'current':''}" data-roster-unit="${z.id}" type="button"><span class="battle-roster-icon">${z.icon}</span><span class="roster-mini-hp"><i style="width:${pct}%"></i></span><div class="battle-roster-copy"><b>${z.name}</b><small>${!z.alive?'KO':`❤️ ${z.hp}/${z.maxHp} · PA ${z.pa} · PM ${z.pm}`}</small><i><span style="width:${pct}%"></span></i></div></button>`};
  const rosterBlue=B.order.map(getUnit).filter(z=>z?.side==='player').map(rosterItem).join('');
  const rosterRed=B.order.map(getUnit).filter(z=>z?.side==='enemy').map(rosterItem).join('');
  const fighter=isCombatObject(view)
    ?`<div class="fighter-panel"><div class="fighter-avatar">${view.icon}</div><div class="fighter-main"><div class="fighter-name"><b>${view.name} · ${getUnit(view.ownerId)?.name||'Invocador'}</b><small>Objeto de combate</small></div><div class="fighter-vitals"><span>❤️ <b>${view.hp}/${view.maxHp}</b></span><span>🛡️ <b>${shieldTotal(view)}</b></span>${view.type==='doll'&&phase?.dollId===view.id?`<span>PM <b>${phase.pm}/${phase.maxPm}</b></span>`:''}</div><div class="fighter-states">${objectDescription(view)}</div></div></div>`
    :`<div class="fighter-panel ${view.side==='player'?'fighter-player':'fighter-enemy'}"><div class="fighter-avatar">${view.icon}</div><div class="fighter-main"><div class="fighter-name"><b>${view.name}</b><small>${teamLabel(view)} · ${champ(view.championId).title}</small></div><div class="fighter-vitals"><span>❤️ <b>${view.hp}/${view.maxHp}</b></span><span>🛡️ <b>${shieldTotal(view)}</b></span><span>PA <b>${view.pa}/${view.maxPa}</b></span><span>PM <b>${view.pm}/${view.maxPm}</b></span></div><div class="fighter-states chips">${statusChips(view)}</div></div></div>`;
  let controls='';
  if(phase){
    controls=phaseHuman
      ?`<div class="doll-phase-card"><b>🪆 Movimiento del Muñeco</b><span>${phase.pm}/${phase.maxPm} PM</span><p>Tocá una casilla resaltada para moverlo. Podés dividir sus 3 PM.</p><button class="end-turn" id="finishDoll">Finalizar movimiento</button></div>`
      :`<div class="ai">🤖 ${u.side==='player'?'Tu aliado IA':'El rival IA'} está moviendo su Muñeco Vudú…</div>`;
  }else if(u.controller==='human'){
    const skillButtons=u.loadout.map(id=>{
      const a=ability(u.championId,id),used=skillUseCount(u,id),limited=!!a.maxUsesPerTurn,remaining=skillUsesRemaining(u,id);
      const useBadge=limited?`<span class="use-count">${used}/${a.maxUsesPerTurn}</span>`:'';
      return `<button data-skill="${id}" class="${B.selectedAction===id?'active-action':''}" ${u.pa<a.cost||remaining<=0?'disabled':''}><span class="pa-cost">${a.cost} PA</span>${useBadge}<span class="skill-icon">${a.icon}</span><b>${a.name}</b><small>${a.text}</small></button>`;
    }).join('');
    const specialParts=[];
    if(u.championId==='coloso'){
      if(!u.monolith)specialParts.push(`<button data-own-action="createPillar" ${u.ownActions.pillarCreated||ownedPillars(u).length>=2?'disabled':''}>Crear Pilar · 0 PA</button><button data-own-action="fusionPillar" ${u.pa<3||!ownedPillars(u).length?'disabled':''}>Fusión de Pilar · 3 PA</button>`);
      if(u.monolith)specialParts.push(`<button id="exitMonolith">Salir de Monolito · 0 PA</button><button data-own-action="createPillar" ${u.ownActions.pillarCreated||ownedPillars(u).length>=3?'disabled':''}>Crear Pilar · 0 PA</button><button data-own-action="rockRecycle" ${u.ownActions.rockRecycleUsed||!ownedPillars(u).length?'disabled':''}>Reciclaje Rocoso · 0 PA</button>`);
    }
    if(u.championId==='piplus')specialParts.push(`<button data-own-action="markTarget" ${u.ownActions.markUsed||u.ownActions.markBlocked?'disabled':''}>Marcar Objetivo · 0 PA</button>`);
    if(u.championId==='onod')specialParts.push(`<button data-own-action="germinateOwn" ${u.pa<1||u.ownActions.germinated>=2||u.ownActions.reabsorbUsed||ownedSprouts(u).length>=3?'disabled':''}>Germinar Brote · 1 PA</button><button data-own-action="witherSprout" ${u.ownActions.witherUsed||!ownedSprouts(u).length?'disabled':''}>Marchitar Brote · 0 PA</button>`);
    if(u.championId==='korgan')specialParts.push(`<button data-own-action="disarmTrap" ${u.ownActions.disarmUsed||!activeTraps(u).length?'disabled':''}>Desarmar Trampa · +1 PA</button>`);
    if(u.championId==='houngan')specialParts.push(`<button data-own-action="createDoll" ${u.pa<2||!getLinkedTarget(u)?'disabled':''}>Muñeco Vudú · 2 PA</button>`);
    const special=specialParts.length?`<div class="special-actions">${specialParts.join('')}</div>`:'';
    controls=`<div class="hud">
      <button id="move" class="${B.selectedAction==='move'?'active-action':''}">👣<b>Mover</b></button>
      <button id="skills" class="${B.skillsOpen?'active-action':''}">✨<b>Habilidades</b></button>
      <button class="end-turn" id="end">⏭️<b>Fin turno</b></button>
    </div>
    <div class="skill-drawer ${B.skillsOpen?'open':'closed'}">${skillButtons}</div>
    ${special}
    ${B.selectedAction?infoPanel(B.selectedAction):''}
    ${B.selectedAction&&!['move','createPillar','fusionPillar','rockRecycle','markTarget','germinateOwn','witherSprout','disarmTrap','createDoll'].includes(B.selectedAction)?`<div class="range-legend"><span><i class="swatch range"></i>Rango de selección</span><span><i class="swatch valid"></i>Área/objetivo</span><span><i class="swatch blocked"></i>LOS bloqueada</span></div>`:''}
    ${B.pendingPreview?`<div class="special-actions"><button id="confirmPreview">✅ Confirmar</button><button id="cancelPreview">✖ Cancelar</button></div>`:''}
    ${B.pendingChoice?.id==='hook'?`<div class="special-actions"><button data-hook-pull="1">Atraer 1</button><button data-hook-pull="2">Atraer 2</button><button id="cancelPreview">Cancelar</button></div>`:''}
    <p class="combat-help">${B.pendingPreview?'El área marcada es el efecto real. Confirmá o cancelá.':B.pendingStage?.id==='collapse'?'Elegí una dirección ortogonal desde el Pilar.':B.pendingStage?.id==='magnetism'?'Elegí un personaje a Manhattan 5 desde el Pilar.':B.selectedAction?'Tocá una casilla u objetivo resaltado.':'Tocá un combatiente o invocación para inspeccionarlo, o elegí una acción.'}</p>`;
  }else controls=`<div class="ai">🤖 ${u.side==='player'?'Tu aliado IA':'El rival IA'} está jugando…</div>`;
  const selectedAbility=!phase&&u.controller==='human'&&B.selectedAction&&!['move','createPillar','fusionPillar','rockRecycle','markTarget','germinateOwn','witherSprout','disarmTrap','createDoll'].includes(B.selectedAction)?ability(u.championId,B.selectedAction):null;
  const logText=B.log.slice(-8).join('<br>')||'Comienza el combate.';
  const headTitle=phase&&doll?`🪆 Muñeco · ${u.name}`:`Ronda ${B.round}`;
  const activeTurnLabel=phase&&doll?`${doll.icon} ${doll.name}`:`${u.side==='player'?'🔵':'🔴'} ${u.icon} ${u.name}`;
  app.innerHTML=`<section class="screen battle-screen">
    <div class="round-hud-panel hud-module ${hudClass('round')}">
      <div class="round-hud-tools">${hudControls('round')}</div>
      <div class="round-summary"><b>${headTitle}</b><span class="round-active">${activeTurnLabel}</span>${phase?`<span class="combat-timer">👣 <b>${phase.pm} PM</b></span>`:`<span class="combat-timer ${B.timer<=10?'danger-time':''}">⏱️ <b id="timer">${B.timer}s</b></span>`}<button class="reset-hud" id="resetHud" type="button" title="Restablecer HUD">↺</button></div>
      <div class="turn-order">${order}</div>
    </div>
    <div class="camera-hud-panel hud-module" aria-label="Controles de cámara">
      <button class="camera-hud-btn camera-drag hud-drag-handle" type="button" title="Mover controles de cámara" aria-label="Mover controles de cámara">⠿</button>
      <button class="camera-hud-btn" id="rotateCameraLeft" type="button" title="Girar vista 90° a la izquierda" aria-label="Girar vista 90 grados a la izquierda">↶</button>
      <button class="camera-hud-btn" id="rotateCameraRight" type="button" title="Girar vista 90° a la derecha" aria-label="Girar vista 90 grados a la derecha">↷</button>
    </div>
    ${B.notice?`<div class="enemy-action-banner">${B.notice}</div>`:''}
    ${selectedAbility?`<div class="selected-skill-banner">${selectedAbility.icon} <b>${selectedAbility.name}</b><span>${selectedAbility.cost} PA · ${selectedAbility.id==='quake'&&u.monolith?'Coloso + red de Pilares':`Alcance ${effectiveRange(u,selectedAbility)}`}</span></div>`:''}
    <div class="battle-layout">
      <div class="battle-board">${isoBoardMarkup(tiles,pieces)}</div>
      <div class="battle-sidebar">
        <div class="battle-roster">
          <div class="battle-roster-team roster-blue hud-module ${hudClass('player')}">
            <div class="roster-team-title hud-module-head"><span class="team-dot">🔵</span><span class="team-name">TU EQUIPO</span><span class="hud-module-tools">${hudControls('player',playerHud.collapsed?'▶':'◀')}</span></div>${rosterBlue}
          </div>
          <div class="battle-roster-team roster-red hud-module ${hudClass('enemy')}">
            <div class="roster-team-title hud-module-head"><span class="team-dot">🔴</span><span class="team-name">RIVALES</span><span class="hud-module-tools">${hudControls('enemy',enemyHud.collapsed?'◀':'▶')}</span></div>${rosterRed}
          </div>
        </div>
        <div class="battle-command-panel hud-module ${hudClass('command')}">
          <div class="command-hud-tools">${hudControls('command',commandHud.collapsed?'▲':'▼')}</div>
          ${fighter}${controls}
        </div>
        <div class="battle-log-panel">
          <button class="combat-log-toggle" id="toggleLog">📜 Registro ${B.logOpen?'▲':'▼'}</button>
          ${B.logOpen?`<div class="card combat-log">${logText}</div>`:''}
        </div>
      </div>
    </div>
  </section>`;
  const battleRoot=$('.battle-screen');
  bindDraggableHud($('.roster-blue'),'player',battleRoot);
  bindDraggableHud($('.roster-red'),'enemy',battleRoot);
  bindDraggableHud($('.battle-command-panel'),'command',battleRoot);
  bindDraggableHud($('.round-hud-panel'),'round',battleRoot);
  bindDraggableHud($('.camera-hud-panel'),'camera',battleRoot);
  $('#resetHud')?.addEventListener('click',()=>{resetHudPositions();renderBattle()});
  $('#rotateCameraLeft')?.addEventListener('click',e=>{e.stopPropagation();rotateBattleCamera(-1)});
  $('#rotateCameraRight')?.addEventListener('click',e=>{e.stopPropagation();rotateBattleCamera(1)});
  $$('[data-hud-collapse]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();toggleHudCollapsed(b.dataset.hudCollapse);renderBattle()}));
  $$('[data-hud-orient]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();toggleHudOrientation(b.dataset.hudOrient);renderBattle()}));
  $('#grid').onclick=battleTap;
  bindBattleCamera($('#grid'));
  $$('[data-roster-unit]').forEach(b=>b.addEventListener('click',()=>{
    B.selectedUnitId=b.dataset.rosterUnit;
    renderBattle();
  }));
  if(!phase){
    $('#move')?.addEventListener('click',()=>{if(B.busy)return;B.pendingImpulseTargetId=null;B.selectedAction=B.selectedAction==='move'?null:'move';B.skillsOpen=false;renderBattle()});
    $('#skills')?.addEventListener('click',()=>{if(B.busy)return;B.skillsOpen=!B.skillsOpen;if(B.skillsOpen&&B.selectedAction==='move')B.selectedAction=null;renderBattle()});
    $$('[data-skill]').forEach(b=>b.onclick=()=>{if(B.busy)return;const id=b.dataset.skill;if(B.selectedAction===id){B.selectedAction=null}else{B.selectedAction=id}B.pendingImpulseTargetId=null;B.pendingPreview=null;B.pendingStage=null;B.pendingChoice=null;B.skillsOpen=true;renderBattle()});
    $('#end')?.addEventListener('click',()=>{if(!B.busy)nextTurn()});
    $('#exitMonolith')?.addEventListener('click',exitMonolith);
    $$('[data-own-action]').forEach(b=>b.addEventListener('click',()=>selectOwnAction(b.dataset.ownAction)));
    $('#confirmPreview')?.addEventListener('click',()=>confirmPendingPreview());
    $('#cancelPreview')?.addEventListener('click',()=>{B.pendingPreview=null;B.pendingStage=null;B.pendingChoice=null;renderBattle()});
    $$('[data-hook-pull]').forEach(b=>b.addEventListener('click',()=>confirmHookPull(+b.dataset.hookPull)));
  }else $('#finishDoll')?.addEventListener('click',()=>{if(!B.busy)finishDollPhase()});
  $('#toggleLog')?.addEventListener('click',()=>{B.logOpen=!B.logOpen;renderBattle()});
}

async function executeImpulse(u,x,y){
  const a=ability(u.championId,'impulse');
  if(!a||u.pa<a.cost||!skillUseAllowed(u,'impulse')||!impulseDestinationValid(u,x,y))return false;
  const dx=Math.sign(x-u.x),dy=Math.sign(y-u.y),steps=md(u,{x,y});
  const adjacent=B.units.find(z=>z.alive&&z.side!==u.side&&adjCardinal(u,z)&&z.x===u.x-dx&&z.y===u.y-dy);
  B.busy=true;B.noticeSeq++;B.notice=`${u.icon} ${u.name} — ${a.icon} ${a.name}`;registerSkillUse(u,'impulse');u.pa-=a.cost;triggerPoisonOnAbility(u);
  if(!u.alive){B.notice='';B.selectedAction=null;B.busy=false;renderBattle();checkBattleEnd();return true}
  if(adjacent?.alive)await forcedMove(adjacent,u,1,true,'Impulso');
  for(let i=0;i<steps&&u.alive;i++){
    const old={x:u.x,y:u.y};u.x+=dx;u.y+=dy;faceStep(u,old);applyWoundStep(u);
    renderBattle();await sleep(120);if(!u.alive||checkBattleEnd())break;await triggerTrapAt(u);
  }
  log(`💨 Impulso: ${u.name} se desplaza ${steps} casilla${steps!==1?'s':''} sin gastar PM.`);
  spendPAAfterAction(u);B.notice='';B.selectedAction=null;B.busy=false;renderBattle();if(checkBattleEnd())return true;if(B.pendingTimeout&&!B.ended)nextTurn();return true;
}

async function confirmPendingPreview(){
  const pre=B?.pendingPreview,u=cur();if(!pre||!u||B.busy)return;
  const p={...pre};B.pendingPreview=null;
  if(p.id==='collapse'){
    const pillar=getEntity(p.pillarId);if(!pillar?.alive){B.pendingStage=null;renderBattle();return}
    await executeAbility(u,'collapse',pillar.x,pillar.y,false,{pillarId:p.pillarId,dx:p.dx,dy:p.dy});
  }else if(p.id==='spores'){
    const s=getEntity(p.sourceId);if(s?.alive)await executeAbility(u,'spores',s.x,s.y,false);
  }else if(p.id==='awakening'){
    await executeAbility(u,'awakening',u.x,u.y,false);
  }else{
    await executeAbility(u,p.id,p.x,p.y,false);
  }
}
async function confirmHookPull(distance){
  const ch=B?.pendingChoice,u=cur();if(!ch||ch.id!=='hook'||B.busy)return;
  const z=getEntity(ch.targetId);B.pendingChoice=null;
  if(z?.alive)await executeAbility(u,'hook',z.x,z.y,false,{pull:distance});
}
async function battleTap(e){
  if(!B||B.ended||B.busy||cur().controller!=='human')return;
  const tile=e.target.closest('.tile');if(!tile)return;
  const x=+tile.dataset.x,y=+tile.dataset.y,z=entityAt(x,y),u=cur();
  if(B.dollPhase){
    const doll=getEntity(B.dollPhase.dollId);
    if(z?.id===doll?.id){B.selectedUnitId=z.id;renderBattle();return}
    const ok=await moveDoll(x,y);if(!ok)showNotice('El Muñeco puede moverse sólo por casillas libres usando sus PM.');return;
  }
  if(B.pendingPreview||B.pendingChoice)return;
  if(B.pendingStage?.id==='collapse'){
    const p=getEntity(B.pendingStage.pillarId);
    if(!validCollapseDirection(p,x,y)){showNotice('Elegí una casilla ortogonal al Pilar para indicar la dirección.');return}
    B.pendingPreview={id:'collapse',pillarId:p.id,dx:x-p.x,dy:y-p.y};renderBattle();return;
  }
  if(B.pendingStage?.id==='magnetism'){
    const p=getEntity(B.pendingStage.pillarId);
    if(!p?.alive||!z?.alive||z.kind!=='unit'||md(p,z)>5){showNotice('Elegí un personaje a Manhattan 5 desde el Pilar.');return}
    B.pendingStage=null;await executeAbility(u,'magnetism',p.x,p.y,false,{pillarId:p.id,targetId:z.id,forcedTarget:z});return;
  }
  if(!B.selectedAction){if(z){B.selectedUnitId=z.id;renderBattle()}return}
  if(B.selectedAction==='move'){await moveUnit(u,x,y);if(!u.alive&&!B.ended)nextTurn();return}
  if(['createPillar','fusionPillar','rockRecycle','markTarget','germinateOwn','witherSprout','disarmTrap','createDoll'].includes(B.selectedAction)){
    if(!executeOwnAction(B.selectedAction,x,y))showNotice('Objetivo o casilla no válida para esta acción.');return;
  }
  if(B.selectedAction==='impulse'){
    if(!impulseDestinationValid(u,x,y)){showNotice('Destino inválido: 1 o 2 casillas en línea, final libre. Puede cruzar obstáculos fijos.');return}
    await executeImpulse(u,x,y);if(!u.alive&&!B.ended)nextTurn();return;
  }
  if(B.selectedAction==='collapse'){
    if(!canUseAbility(u,'collapse',x,y)){showNotice(invalidAbilityReason(u,'collapse',x,y));return}
    B.pendingStage={id:'collapse',pillarId:z.id};showNotice('🪨 Ahora elegí la dirección del Derrumbe.',1100);renderBattle();return;
  }
  if(B.selectedAction==='magnetism'){
    if(!canUseAbility(u,'magnetism',x,y)){showNotice(invalidAbilityReason(u,'magnetism',x,y));return}
    B.pendingStage={id:'magnetism',pillarId:z.id};showNotice('🧲 Elegí el personaje que será atraído hasta 2 casillas.',1100);renderBattle();return;
  }
  if(['vines','grenade'].includes(B.selectedAction)){
    if(!canUseAbility(u,B.selectedAction,x,y)){showNotice(invalidAbilityReason(u,B.selectedAction,x,y));return}
    B.pendingPreview={id:B.selectedAction,x,y};renderBattle();return;
  }
  if(B.selectedAction==='spores'){
    if(!canUseAbility(u,'spores',x,y)){showNotice('Elegí uno de tus Brotes activos.');return}
    B.pendingPreview={id:'spores',sourceId:z.id};renderBattle();return;
  }
  if(B.selectedAction==='awakening'){
    if(!canUseAbility(u,'awakening',u.x,u.y)){showNotice('Necesitás al menos un Brote activo.');return}
    B.pendingPreview={id:'awakening'};renderBattle();return;
  }
  if(B.selectedAction==='hook'){
    if(!canUseAbility(u,'hook',x,y)){showNotice(invalidAbilityReason(u,'hook',x,y));return}
    B.pendingChoice={id:'hook',targetId:z.id};renderBattle();return;
  }
  if(!canUseAbility(u,B.selectedAction,x,y)){showNotice(invalidAbilityReason(u,B.selectedAction,x,y));return}
  await executeAbility(u,B.selectedAction,x,y,false);if(!u.alive&&!B.ended)nextTurn();
}

function checkBattleEnd(){
  if(!B||B.ended)return true;
  const blueAlive=B.units.some(u=>u.side==='player'&&u.alive);
  const redAlive=B.units.some(u=>u.side==='enemy'&&u.alive);
  if(blueAlive&&redAlive)return false;
  clearInterval(timerId);B.ended=true;
  const win=blueAlive&&!redAlive;
  setTimeout(()=>showResult(win),250);
  return true;
}

function recordMatch(win){
  if(!B||B.resultRecorded)return;
  B.resultRecorded=true;
  profile.played++;
  if(win)profile.wins++;else profile.losses++;
  profile.favorite=setup.championId||profile.favorite;
  saveProfile(profile);
}

function showResult(win){
  if(!B)return;
  recordMatch(win);
  const blue=B.units.filter(u=>u.side==='player'),red=B.units.filter(u=>u.side==='enemy');
  const teamNames=arr=>arr.map(u=>`${u.icon} ${u.name}${u.alive?` ${u.hp}/${u.maxHp}`:' KO'}`).join(' · ');
  app.innerHTML=`<section class="screen result result-screen"><div class="home-card">
    <div style="font-size:48px">${win?'🏆':'🥈'}</div>
    <h2>${win?'VICTORIA':'DERROTA'}</h2>
    <p><b>🔵 Equipo azul</b><br>${teamNames(blue)}</p>
    <p><b>🔴 Equipo rojo</b><br>${teamNames(red)}</p>
    <div class="result-stats"><span>📺 KO deportivo</span><span>${B.mode==='2v2'?'2v2':'1v1'}</span><span>Ronda ${B.round}</span></div>
    <div class="actions result-actions"><button id="again">Revancha</button><button class="secondary" id="change">Cambiar equipo</button><button class="secondary" id="lobby">Volver al Lobby</button></div>
  </div></section>`;
  $('#again').onclick=startBattle;
  $('#change').onclick=showChampionSelect;
  $('#lobby').onclick=showLobby;
}

function offensiveIds(u){
  return u.loadout.filter(id=>[
    'sword','daggers','bow','spear','hammer',
    'rock','quake','collapse','magnetism',
    'precise','vector','rupture',
    'thorn','vines','spores','awakening',
    'grenade','shot','hook',
    'needle','ritual','curse'
  ].includes(id));
}
function validAbilityTargets(u,id){
  const out=[];
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)if(canUseAbility(u,id,x,y))out.push({x,y});
  return out;
}
function isExpertAI(u){return u?.aiDifficulty==='expert'}
function aiWait(u,normal=190,expert=120){return sleep(isExpertAI(u)?expert:normal)}
function clearLOSFrom(fake,b,ignoreId){
  return lineCells(fake,b).every(([x,y])=>{
    if(isFixedObstacle(x,y))return false;
    const z=entityAt(x,y);return !z||z.id===ignoreId||z.blocksLOS===false;
  });
}
function aiCanUseFrom(u,id,from,target){
  const a=ability(u.championId,id);if(!a||u.pa<a.cost||!target?.alive)return false;
  const r=effectiveRange(u,a);
  if(id==='shot'&&!(from.x===target.x||from.y===target.y))return false;
  if(!inRange(from,target,r))return false;
  if(requiresLOS(a)&&!clearLOSFrom(from,target,u.id))return false;
  return true;
}
function bestMoveForAI(u,target){
  const reach=movementMap(u),ids=offensiveIds(u).filter(id=>{
    const a=ability(u.championId,id);
    return a&&u.pa>=a.cost&&!['collapse','magnetism','awakening','spores'].includes(id);
  });
  let best=null,bestScore=1e9;
  for(const [k,cost] of reach){
    const [x,y]=k.split(',').map(Number),fake={...u,x,y};
    let score=md(fake,target)*10+cost*.6;
    for(const id of ids){
      const a=ability(u.championId,id);
      if(aiCanUseFrom(u,id,fake,target)){
        score-=55+(a.damage||0)*2;
        if(id==='daggers'&&target.status?.wound<3)score-=7;
        if(id==='thorn'&&target.status?.poison<3)score-=7;
        if(id==='shot')score-=5;
      }
    }
    if(isExpertAI(u)){
      const adjacentEnemies=enemyUnits(u,true).filter(z=>md(fake,z)===1).length;
      if(u.championId!=='arfeli'&&u.championId!=='coloso')score+=adjacentEnemies*4;
      if(u.championId==='arfeli'&&u.loadout.includes('daggers')&&md(fake,target)===1)score-=8;
    }
    if(score<bestScore){bestScore=score;best={x,y,cost}}
  }
  return best;
}
function bestFreeTileAI(u,target,range=3,preferNear=true){
  let best=null,bestScore=1e9;
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    const p={x,y};if(!free(x,y)||!inRange(u,p,range)||!clearLOS(u,p))continue;
    let score=(preferNear?md(p,target):-md(p,target))*6;
    score+=Math.abs(x-SIZE/2)*.08+Math.abs(y-SIZE/2)*.08;
    if(score<bestScore){bestScore=score;best=p}
  }
  return best;
}
function bestPillarTile(u,target){
  let best=null,bestScore=1e9;
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    const p={x,y};if(!ownActionRange(u,'createPillar',x,y))continue;
    let score=md(p,target)*5;
    if(adjCardinal(p,target))score-=18;
    if(md(p,target)<=2)score-=6;
    if(ownedPillars(u).some(q=>adjCardinal(q,p)))score+=2;
    if(score<bestScore){bestScore=score;best=p}
  }
  return best;
}
function bestSproutTile(u,target){
  let best=null,bestScore=1e9;
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    if(!ownActionRange(u,'germinateOwn',x,y))continue;
    const p={x,y};
    const nearEnemy=enemyUnits(u,true).filter(z=>adjCardinal(p,z)).length;
    const aroundEnemy=enemyUnits(u,true).filter(z=>Math.max(Math.abs(z.x-x),Math.abs(z.y-y))===1).length;
    let score=md(p,target)*4-nearEnemy*12-aroundEnemy*4;
    if(score<bestScore){bestScore=score;best=p}
  }
  return best;
}
function aiCanAttackNow(u,target){
  const direct=offensiveIds(u).some(id=>{
    if(['collapse','magnetism','spores','awakening'].includes(id))return false;
    const a=ability(u.championId,id);return a&&u.pa>=a.cost&&canUseAbility(u,id,target.x,target.y);
  });
  if(direct)return true;
  if(u.loadout.includes('spores')&&u.pa>=4){
    return ownedSprouts(u).some(s=>enemyUnits(u,true).some(z=>Math.max(Math.abs(z.x-s.x),Math.abs(z.y-s.y))===1));
  }
  return false;
}
function shouldAIExitMonolith(u,target){
  if(u.championId!=='coloso'||!u.monolith)return false;
  if(aiCanAttackNow(u,target))return false;
  if(!u.ownActions.rockRecycleUsed&&ownedPillars(u).length>=2)return false;
  if(!u.ownActions.pillarCreated&&ownedPillars(u).length<3&&bestPillarTile(u,target))return false;
  return md(u,target)>5;
}
function chooseEnemyTarget(u){
  const foes=enemyUnits(u,true);if(!foes.length)return null;
  return [...foes].sort((a,b)=>{
    const markedA=getMarkedTarget(u)?.id===a.id?-9:0,markedB=getMarkedTarget(u)?.id===b.id?-9:0;
    const linkedA=getLinkedTarget(u)?.id===a.id?-7:0,linkedB=getLinkedTarget(u)?.id===b.id?-7:0;
    const sa=md(u,a)*8+(a.hp/a.maxHp)*7+markedA+linkedA;
    const sb=md(u,b)*8+(b.hp/b.maxHp)*7+markedB+linkedB;
    return sa-sb;
  })[0];
}
function chooseHealTarget(u,id,threshold=.72){
  return teamUnits(u,true)
    .filter(z=>z.hp<z.maxHp&&z.hp/z.maxHp<threshold&&canUseAbility(u,id,z.x,z.y))
    .sort((a,b)=>(a.hp/a.maxHp)-(b.hp/b.maxHp))[0]||null;
}
function chooseStoneArmorTarget(u){
  const candidates=[...teamUnits(u,true),...ownedPillars(u)];
  return candidates
    .filter(z=>z.alive&&shieldTotal(z)<7&&canUseAbility(u,'stonearmor',z.x,z.y))
    .sort((a,b)=>{
      const av=a.maxHp? a.hp/a.maxHp:1,bv=b.maxHp?b.hp/b.maxHp:1;
      return av-bv;
    })[0]||null;
}
function aiAreaScore(u,id,x,y){
  const cells=id==='vines'||id==='grenade'
    ?[{x,y},{x:x+1,y},{x:x-1,y},{x,y:y+1},{x,y:y-1}]
    :[];
  let score=0;
  for(const c of cells){
    const z=entityAt(c.x,c.y);if(!z?.alive)continue;
    if(z.side!==u.side)score+=z.kind==='unit'?12:5;
    else score-=z.kind==='unit'?10:4;
  }
  return score;
}
function bestAreaPlay(u,id){
  const a=ability(u.championId,id);if(!a||u.pa<a.cost)return null;
  let best=null,bestScore=-1e9;
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    if(!canUseAbility(u,id,x,y))continue;
    const score=aiAreaScore(u,id,x,y);
    if(score>bestScore){bestScore=score;best={x,y,score}}
  }
  return bestScore>0?best:null;
}
function bestSporePlay(u){
  if(!u.loadout.includes('spores')||u.pa<4)return null;
  let best=null,bestScore=0;
  for(const s of ownedSprouts(u)){
    if(!canUseAbility(u,'spores',s.x,s.y))continue;
    let score=0;
    for(const z of B.units.filter(z=>z.alive&&Math.max(Math.abs(z.x-s.x),Math.abs(z.y-s.y))===1)){
      score+=z.side!==u.side?12:-10;
    }
    if(score>bestScore){bestScore=score;best={sprout:s,score}}
  }
  return best;
}
function bestAwakeningScore(u){
  if(!u.loadout.includes('awakening')||u.pa<4||!ownedSprouts(u).length)return 0;
  let score=0;
  for(const z of B.units.filter(z=>z.alive)){
    const hits=ownedSprouts(u).filter(s=>adjCardinal(s,z)).length;
    if(hits)score+=(z.side!==u.side?1:-1)*8*hits;
  }
  return score;
}
function bestCollapsePlay(u){
  if(!u.loadout.includes('collapse')||u.pa<3)return null;
  let best=null,bestScore=0;
  const limit=u.monolith?5:3;
  for(const p of ownedPillars(u)){
    if(!inRange(u,p,limit))continue;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const cells=collapseCells(p,dx,dy);let score=0;
      for(const c of cells){
        const z=entityAt(c.x,c.y);if(!z?.alive)continue;
        const dmg=c.band==='near'?Math.max(3,p.hp-6):c.band==='middle'?Math.max(3,p.hp-3):Math.max(3,p.hp);
        score+=(z.side!==u.side?1:-1)*dmg;
      }
      if(score>bestScore){bestScore=score;best={pillar:p,dx,dy,score}}
    }
  }
  return best;
}
function bestMagnetismPlay(u){
  if(!u.loadout.includes('magnetism')||u.pa<3)return null;
  const limit=u.monolith?5:3;let best=null,bestScore=-1e9;
  for(const p of ownedPillars(u)){
    if(!inRange(u,p,limit))continue;
    for(const z of B.units.filter(z=>z.alive&&md(p,z)<=5)){
      const dist=md(p,z),score=z.side!==u.side?(20-dist*2):(isExpertAI(u)?2-dist:-20);
      if(score>bestScore){bestScore=score;best={pillar:p,target:z,score}}
    }
  }
  return best?.target.side!==u.side?best:null;
}
function bestAttackPlay(u){
  let best=null,bestScore=-1e9;
  for(const target of enemyUnits(u,true)){
    for(const id of offensiveIds(u)){
      if(['collapse','magnetism','spores','awakening','vines','grenade','hook'].includes(id))continue;
      const a=ability(u.championId,id);if(!a||u.pa<a.cost||!canUseAbility(u,id,target.x,target.y))continue;
      let dmg=a.damage||0;
      if(id==='precise'&&getMarkedTarget(u)?.id===target.id)dmg=10;
      if(id==='ritual'){
        const d=correspondingDoll(u);dmg=d&&adjCardinal(d,target)?20:14;
      }
      if(id==='quake'&&u.monolith)dmg=8;
      let score=dmg*4+(1-target.hp/target.maxHp)*16-md(u,target);
      if(id==='daggers'&&target.status.wound<3)score+=8;
      if(id==='thorn'&&target.status.poison<3)score+=8;
      if(id==='rupture'&&target.hp<=14)score+=16;
      if(id==='needle'&&!getLinkedTarget(u))score+=10;
      if(score>bestScore){bestScore=score;best={id,target,score}}
    }
  }
  const vines= u.loadout.includes('vines') ? bestAreaPlay(u,'vines') : null;
  if(vines&&vines.score*4>bestScore)best={id:'vines',target:vines,score:vines.score*4};
  const grenade=u.loadout.includes('grenade') ? bestAreaPlay(u,'grenade') : null;
  if(grenade&&grenade.score*4>bestScore)best={id:'grenade',target:grenade,score:grenade.score*4};
  const spores=bestSporePlay(u);
  if(spores&&spores.score*4>bestScore)best={id:'spores',target:spores.sprout,score:spores.score*4};
  const awakenScore=bestAwakeningScore(u);
  if(awakenScore>0&&awakenScore*3>bestScore)best={id:'awakening',target:u,score:awakenScore*3};
  const collapse=bestCollapsePlay(u);
  if(collapse&&collapse.score*3>bestScore)best={id:'collapse',target:collapse.pillar,extra:{pillarId:collapse.pillar.id,dx:collapse.dx,dy:collapse.dy},score:collapse.score*3};
  const magnet=bestMagnetismPlay(u);
  if(magnet&&magnet.score>bestScore)best={id:'magnetism',target:magnet.pillar,extra:{pillarId:magnet.pillar.id,targetId:magnet.target.id,forcedTarget:magnet.target},score:magnet.score};
  if(u.loadout.includes('hook')&&u.pa>=3){
    for(const target of enemyUnits(u,true)){
      if(!canUseAbility(u,'hook',target.x,target.y))continue;
      const score=24+(1-target.hp/target.maxHp)*10;
      if(score>bestScore)best={id:'hook',target,extra:{pull:isExpertAI(u)?2:1},score};
    }
  }
  return best;
}
function bestDollMove(doll,owner){
  const phase=B?.dollPhase;if(!phase||!doll?.alive)return null;
  const target=getEntity(doll.linkedTargetId)||chooseEnemyTarget(owner);if(!target)return null;
  const reach=objectMovementMap(doll,phase.pm);let best=null,bestScore=1e9;
  for(const [k,cost] of reach){
    const [x,y]=k.split(',').map(Number);
    let score=md({x,y},target)+cost*.05;
    if(owner.danceDollId===doll.id&&owner.danceLinkId===target.id)score-=Math.max(0,md(doll,target)-md({x,y},target))*2;
    if(score<bestScore){bestScore=score;best={x,y,cost}}
  }
  return best;
}
async function aiDollPhase(){
  if(!B?.dollPhase||B.ended)return;
  const owner=getUnit(B.dollPhase.ownerId),doll=getEntity(B.dollPhase.dollId);
  if(!owner?.alive||!doll?.alive)return finishDollPhase();
  const move=bestDollMove(doll,owner);
  if(move)await moveDoll(move.x,move.y);
  if(B?.dollPhase&&!B.ended)setTimeout(finishDollPhase,isExpertAI(owner)?140:220);
}
async function aiOwnAction(u,action,x,y){
  if(!ownActionRange(u,action,x,y))return false;
  executeOwnAction(action,x,y);await aiWait(u,160,100);return true;
}
function farthestUselessTrap(u,target){
  return activeTraps(u).sort((a,b)=>md(b,target)-md(a,target))[0]||null;
}
function farthestUselessSprout(u,target){
  return ownedSprouts(u).sort((a,b)=>md(b,target)-md(a,target))[0]||null;
}
async function aiTryOwnActions(u,target){
  if(u.championId==='coloso'){
    if(u.monolith&&!u.ownActions.rockRecycleUsed&&ownedPillars(u).length){
      const damaged=ownedPillars(u).some(p=>p.hp<p.maxHp),needShield=shieldTotal(u)<4&&u.hp/u.maxHp<.7;
      if((damaged||needShield)&&await aiOwnAction(u,'rockRecycle',ownedPillars(u)[0].x,ownedPillars(u)[0].y))return true;
    }
    if(!u.ownActions.pillarCreated&&ownedPillars(u).length<(u.monolith?3:2)){
      const pt=bestPillarTile(u,target);if(pt&&await aiOwnAction(u,'createPillar',pt.x,pt.y))return true;
    }
    if(!u.monolith&&u.pa>=3){
      const p=ownedPillars(u).find(p=>adjCardinal(u,p));
      if(p&&md(u,target)>2&&isExpertAI(u)&&await aiOwnAction(u,'fusionPillar',p.x,p.y))return true;
    }
  }
  if(u.championId==='piplus'&&!getMarkedTarget(u)&&!u.ownActions.markUsed&&!u.ownActions.markBlocked){
    if(ownActionRange(u,'markTarget',target.x,target.y)&&await aiOwnAction(u,'markTarget',target.x,target.y))return true;
  }
  if(u.championId==='onod'){
    if(ownedSprouts(u).length>=3&&!u.ownActions.witherUsed&&ownedSprouts(u).every(s=>md(s,target)>4)){
      const s=farthestUselessSprout(u,target);if(s&&await aiOwnAction(u,'witherSprout',s.x,s.y))return true;
    }
    if(u.pa>=1&&!u.ownActions.reabsorbUsed&&u.ownActions.germinated<2&&ownedSprouts(u).length<3){
      const pt=bestSproutTile(u,target);if(pt&&await aiOwnAction(u,'germinateOwn',pt.x,pt.y))return true;
    }
  }
  if(u.championId==='korgan'&&activeTraps(u).length>=3&&!u.ownActions.disarmUsed&&u.pa<=2){
    const trap=farthestUselessTrap(u,target);
    if(trap&&md(trap,target)>4&&await aiOwnAction(u,'disarmTrap',trap.x,trap.y))return true;
  }
  if(u.championId==='houngan'&&getLinkedTarget(u)&&u.pa>=2){
    const d=correspondingDoll(u),existing=ownedDoll(u);
    if(!d){
      const linked=getLinkedTarget(u),pt=bestFreeTileAI(u,linked||target,3,false);
      if(pt&&await aiOwnAction(u,'createDoll',pt.x,pt.y))return true;
    }else if(existing&&isExpertAI(u)&&existing.hp<=4){
      const linked=getLinkedTarget(u),pt=bestFreeTileAI(u,linked||target,3,false);
      if(pt&&await aiOwnAction(u,'createDoll',pt.x,pt.y))return true;
    }
  }
  return false;
}
async function aiTrySupport(u,target){
  if(u.championId==='onod'&&u.loadout.includes('sap')&&u.pa>=3){
    const ally=chooseHealTarget(u,'sap',isExpertAI(u)?.82:.68);
    if(ally){await executeAbility(u,'sap',ally.x,ally.y,true);await aiWait(u);return true}
  }
  if(u.championId==='coloso'){
    if(u.loadout.includes('stonearmor')&&u.pa>=2){
      const ally=chooseStoneArmorTarget(u);
      if(ally&&((ally.hp/ally.maxHp)<(isExpertAI(u)?.85:.7)||shieldTotal(ally)===0)){
        await executeAbility(u,'stonearmor',ally.x,ally.y,true);await aiWait(u);return true;
      }
    }
    if(u.loadout.includes('absorb')&&u.pa>=2&&u.hp/u.maxHp<(isExpertAI(u)?.68:.5)){
      const p=ownedPillars(u).filter(p=>!(p.createdRound===B.round&&p.createdTurn===B.turn)&&canUseAbility(u,'absorb',p.x,p.y))
        .sort((a,b)=>b.hp-a.hp)[0];
      if(p){await executeAbility(u,'absorb',p.x,p.y,true);await aiWait(u);return true}
    }
  }
  if(u.championId==='arfeli'&&u.loadout.includes('shield')&&u.pa>=3&&shieldTotal(u)<6&&u.hp/u.maxHp<(isExpertAI(u)?.82:.68)&&canUseAbility(u,'shield',u.x,u.y)){
    await executeAbility(u,'shield',u.x,u.y,true);await aiWait(u);return true;
  }
  if(u.championId==='houngan'){
    const d=correspondingDoll(u);
    if(u.loadout.includes('transfer')&&u.pa>=2&&d&&u.hp<u.maxHp-3&&canUseAbility(u,'transfer',d.x,d.y)){
      await executeAbility(u,'transfer',d.x,d.y,true);await aiWait(u);return true;
    }
    if(u.loadout.includes('paintransfer')&&u.pa>=3&&d&&!u.painTransferDollId&&canUseAbility(u,'paintransfer',u.x,u.y)){
      await executeAbility(u,'paintransfer',u.x,u.y,true);await aiWait(u);return true;
    }
    if(u.loadout.includes('dance')&&u.pa>=3&&d&&canUseAbility(u,'dance',u.x,u.y)&&isExpertAI(u)){
      await executeAbility(u,'dance',u.x,u.y,true);await aiWait(u);return true;
    }
  }
  if(u.championId==='piplus'&&getMarkedTarget(u)){
    const marked=getMarkedTarget(u);
    if(u.loadout.includes('interference')&&u.pa>=2&&marked.status.pmPenaltyNext<1&&canUseAbility(u,'interference',marked.x,marked.y)&&isExpertAI(u)){
      await executeAbility(u,'interference',marked.x,marked.y,true);await aiWait(u);return true;
    }
    if(u.loadout.includes('fixation')&&u.pa>=2&&canUseAbility(u,'fixation',marked.x,marked.y)&&!clearLOS(u,marked)&&isExpertAI(u)){
      await executeAbility(u,'fixation',marked.x,marked.y,true);await aiWait(u);return true;
    }
  }
  if(u.championId==='onod'&&u.loadout.includes('reabsorb')&&u.pa<=1){
    const old=ownedSprouts(u).filter(s=>!(s.createdRound===B.round&&s.createdTurn===B.turn));
    if(old.length>=2&&canUseAbility(u,'reabsorb',u.x,u.y)){
      await executeAbility(u,'reabsorb',u.x,u.y,true);await aiWait(u);return true;
    }
  }
  return false;
}
async function aiTryTrap(u,target){
  if(u.championId!=='korgan'||activeTraps(u).length>=3)return false;
  const ids=['trap_spikes','trap_electric'].filter(id=>u.loadout.includes(id)&&u.pa>=ability(u.championId,id).cost&&skillUseAllowed(u,id));
  if(!ids.length)return false;
  const id=(isExpertAI(u)&&ids.includes('trap_electric')&&target.pa>=3)?'trap_electric':ids[0];
  const pt=bestFreeTileAI(u,target,3,true);
  if(pt&&canUseAbility(u,id,pt.x,pt.y)){
    await executeAbility(u,id,pt.x,pt.y,true);await aiWait(u);return true;
  }
  return false;
}
async function aiTryMobilityAbility(u,target){
  if(u.championId==='piplus'&&u.loadout.includes('impulse')&&u.pa>=2&&skillUseAllowed(u,'impulse')){
    let best=null,bestDist=md(u,target);
    for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
      if(!impulseDestinationValid(u,x,y))continue;
      const d=md({x,y},target);if(d<bestDist){bestDist=d;best={x,y}}
    }
    if(best){await executeImpulse(u,best.x,best.y);await aiWait(u);return true}
  }
  if(u.championId==='korgan'&&u.loadout.includes('hunterstep')&&u.pa>=1&&skillUseAllowed(u,'hunterstep')){
    let best=null,bestDist=md(u,target);
    for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
      if(!canUseAbility(u,'hunterstep',x,y))continue;
      const d=md({x,y},target);if(d<bestDist){bestDist=d;best={x,y}}
    }
    if(best){await executeAbility(u,'hunterstep',best.x,best.y,true);await aiWait(u);return true}
  }
  return false;
}
async function aiTurn(){
  if(!B||B.ended||cur().controller!=='ai'||B.busy)return;
  const u=cur();let target=chooseEnemyTarget(u);if(!target){checkBattleEnd();return}
  await aiWait(u,330,220);

  if(shouldAIExitMonolith(u,target)){
    leaveMonolith(u,'La IA necesita recuperar movilidad.');
    u.ownActions.pillarCreated=true;
    B.notice=`🤖 ${u.name} sale de Monolito para recuperar movilidad.`;renderBattle();await aiWait(u,250,150);B.notice='';
  }

  const maxCycles=isExpertAI(u)?12:9;
  for(let cycle=0;cycle<maxCycles&&u.alive&&!B.ended;cycle++){
    if(checkBattleEnd())return;
    target=chooseEnemyTarget(u);if(!target)break;

    if(await aiTryOwnActions(u,target))continue;
    if(await aiTrySupport(u,target))continue;
    if(await aiTryTrap(u,target))continue;

    const attack=bestAttackPlay(u);
    if(attack){
      await executeAbility(u,attack.id,attack.target.x,attack.target.y,true,attack.extra||{});
      await aiWait(u,210,130);if(checkBattleEnd())return;continue;
    }

    if(await aiTryMobilityAbility(u,target))continue;

    const hostile=B.pillars.filter(p=>p.alive&&p.side!==u.side).sort((a,b)=>a.hp-b.hp);
    let objectPlay=null;
    for(const p of hostile){
      const ids=offensiveIds(u).filter(id=>{
        const a=ability(u.championId,id);
        return a&&u.pa>=a.cost&&!['collapse','magnetism','vines','grenade','spores','awakening','hook'].includes(id)&&canUseAbility(u,id,p.x,p.y);
      }).sort((a,b)=>(ability(u.championId,b).damage||0)-(ability(u.championId,a).damage||0));
      if(ids.length){objectPlay={p,id:ids[0]};break}
    }
    if(objectPlay){
      await executeAbility(u,objectPlay.id,objectPlay.p.x,objectPlay.p.y,true);await aiWait(u);continue;
    }

    const mv=bestMoveForAI(u,target);
    if(mv&&mv.cost>0&&u.pm>0){
      await moveUnit(u,mv.x,mv.y);await aiWait(u);if(checkBattleEnd())return;continue;
    }
    break;
  }
  if(!B.ended)setTimeout(nextTurn,isExpertAI(u)?220:350);
}

showStart();
