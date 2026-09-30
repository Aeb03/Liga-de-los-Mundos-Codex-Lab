const app=document.querySelector('#app');
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const SIZE=12, VERSION='0.6.38h5-v02';



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
  arfeli:{
    id:'arfeli',name:'Arfeli',title:'Guerrera versátil',role:'Agresión / versatilidad',icon:'⚔️',
    hp:100,pa:6,pm:4,ini:5,
    passive:{name:'Berserker',text:'Por debajo del 50% de Vida, sus ataques causan +2 daño.'},
    abilities:[
      {id:'sword',icon:'⚔️',name:'Corte con Espada',cost:2,range:1,damage:12,maxUsesPerTurn:2,text:'12 de daño a un objetivo adyacente. Máximo 2 usos por turno.'},
      {id:'daggers',icon:'🩸',name:'Dagas Danzantes',cost:3,range:1,damage:10,text:'10 de daño y aplica Herida 1.'},
      {id:'bow',icon:'🏹',name:'Disparo con Arco',cost:3,range:4,damage:11,text:'11 de daño. Alcance 4 y requiere línea de visión.'},
      {id:'shield',icon:'🛡️',name:'Portación de Escudo',cost:2,range:0,shield:15,maxUsesPerTurn:1,text:'Obtiene 15 de Escudo. Máximo 1 uso por turno.'},
      {id:'spear',icon:'🔱',name:'Arte de la Lanza',cost:3,range:2,damage:10,text:'10 de daño y atrae al objetivo 1 casilla.'},
      {id:'hammer',icon:'🔨',name:'Golpe de Martillo',cost:4,range:1,damage:16,text:'16 de daño. El objetivo pierde 1 PA en su próximo turno.'}
    ]
  },
  coloso:{
    id:'coloso',name:'Coloso',title:'Guardián rocoso',role:'Territorio / resistencia',icon:'🪨',
    hp:115,pa:6,pm:3,ini:3,
    passive:{name:'Conexión Rocosa',text:'Controla Pilares de 20 PV que bloquean movimiento y línea de visión.'},
    abilities:[
      {id:'pillar',icon:'🗿',name:'Creación de Pilar',cost:2,range:3,text:'Crea un Pilar de 20 PV en una casilla libre. Máximo 2; en Monolito, 3.'},
      {id:'rock',icon:'💥',name:'Lanzar Roca',cost:3,range:4,damage:10,text:'10 de daño. En Monolito obtiene +1 alcance.'},
      {id:'stonearmor',icon:'🛡️',name:'Armadura de Piedra',cost:2,range:3,shield:15,text:'Otorga 15 de Escudo a Coloso, un aliado o un Pilar propio. Máximo 1 vez por turno por objetivo.'},
      {id:'absorb',icon:'🧲',name:'Absorción Rocosa',cost:3,range:3,text:'Consume un Pilar propio y recupera 20 PV.'},
      {id:'fusion',icon:'🗿',name:'Fusión de Pilar',cost:4,range:1,text:'Consume un Pilar propio adyacente y entra en Monolito.'},
      {id:'quake',icon:'🌋',name:'Golpe Sísmico',cost:3,range:1,damage:12,text:'12 de daño + empuje 1. En Monolito puede proyectarse desde un Pilar: 8 de daño + empuje 1; otros Pilares pueden activar Réplica.'}
    ]
  },
  piplus:{
    id:'piplus',name:'Piplus',title:'Tirador de apoyo',role:'Rango / apoyo / control',icon:'🎯',
    hp:90,pa:6,pm:3,ini:6,
    passive:{name:'Objetivo Marcado',text:'Puede mantener un enemigo Marcado. Varias habilidades mejoran contra ese objetivo.'},
    abilities:[
      {id:'marker',icon:'🎯',name:'Disparo Marcador',cost:2,range:4,damage:8,text:'8 de daño y Marca al combatiente alcanzado.'},
      {id:'precise',icon:'🏹',name:'Disparo Preciso',cost:3,range:4,damage:12,text:'12 de daño; 14 si el objetivo está Marcado.'},
      {id:'vector',icon:'🧲',name:'Tirón Vectorial',cost:3,range:4,damage:8,text:'8 de daño y atrae 1. Si está Marcado, atrae 2.'},
      {id:'impulse',icon:'💨',name:'Impulso',cost:2,range:3,text:'Piplus o un aliado a alcance 3 se desplaza hasta 2 casillas en línea sin gastar PM ni activar Herida u oportunidad.'},
      {id:'pulse',icon:'💚',name:'Pulso Reparador',cost:3,range:3,maxUsesPerTurn:1,text:'Cura 12 PV a Piplus o a un aliado. Máximo 1 uso por turno.'},
      {id:'rupture',icon:'💥',name:'Ruptura de Marca',cost:4,range:4,damage:14,text:'Sólo contra el Marcado: 14 de daño, empuja 1 y consume la Marca.'}
    ]
  },
  onod:{
    id:'onod',name:'Onod',title:'Guardián del bosque',role:'Desgaste / control natural',icon:'🌿',
    hp:95,pa:6,pm:3,ini:4,
    passive:{name:'Simbiosis',text:'Una vez por turno, al aplicar Veneno o curar, un Brote propio cercano al objetivo recupera 3 PV.'},
    abilities:[
      {id:'germinate',icon:'🌱',name:'Germinar',cost:2,range:3,text:'Crea un Brote de 12 PV. Máximo 2. Ocupa casilla pero no bloquea línea de visión.'},
      {id:'thorn',icon:'☠️',name:'Espina Venenosa',cost:2,range:4,damage:7,text:'7 de daño y aplica Veneno 1.'},
      {id:'vines',icon:'🌿',name:'Enredaderas',cost:3,range:3,damage:6,text:'6 de daño y el objetivo pierde 2 PM en su próximo turno.'},
      {id:'sap',icon:'💚',name:'Savia Vital',cost:3,range:3,maxUsesPerTurn:1,text:'Cura 10 PV; cura 14 si el objetivo está junto a un Brote propio.'},
      {id:'spores',icon:'🌬️',name:'Esporas Tóxicas',cost:4,range:3,damage:6,aoePreview:{pattern:'cross1'},text:'Área: casilla objetivo y sus 4 cardinales. Enemigos reciben 6 de daño + Veneno 1.'},
      {id:'awakening',icon:'🌳',name:'Despertar del Bosque',cost:4,range:3,text:'Consume un Brote. Enemigos adyacentes reciben 10 de daño y son empujados 1.'}
    ]
  },
  korgan:{
    id:'korgan',name:'Korgan',title:'Cazador de Arena',role:'Trampas / control del terreno',icon:'🪤',
    hp:100,pa:6,pm:4,ini:4,
    passive:{name:'Preparación',text:'Puede mantener hasta 3 trampas visibles activas en la Arena.'},
    abilities:[
      {id:'trap_spikes',icon:'🪤',name:'Trampa de Pinchos',cost:2,range:3,text:'Coloca una trampa. El primer enemigo que entra recibe 10 de daño.'},
      {id:'trap_snare',icon:'🧷',name:'Cepo',cost:3,range:3,text:'Al activarse: 6 de daño y -2 PM en el próximo turno.'},
      {id:'trap_bomb',icon:'💣',name:'Carga Explosiva',cost:3,range:3,text:'Al activarse: 8 de daño al objetivo y 4 a las 4 casillas cardinales adyacentes.'},
      {id:'shot',icon:'🏹',name:'Disparo de Caza',cost:3,range:4,damage:10,text:'10 de daño a distancia. Requiere línea de visión.'},
      {id:'hook',icon:'🪝',name:'Gancho',cost:3,range:3,damage:7,text:'7 de daño y atrae 1 casilla.'},
      {id:'hunterstep',icon:'🏃',name:'Paso del Cazador',cost:2,range:2,maxUsesPerTurn:1,text:'Se desplaza hasta 2 casillas en línea sin gastar PM. Máximo 1 uso por turno.'}
    ]
  },
  houngan:{
    id:'houngan',name:'Houngan',title:'Maestro Vudú',role:'Vínculos / maldiciones',icon:'🪆',
    hp:90,pa:6,pm:3,ini:5,
    passive:{name:'Vínculo Maldito',text:'Puede mantener un enemigo Vinculado. Sus rituales usan ese vínculo incluso a distancia.'},
    abilities:[
      {id:'needle',icon:'🪡',name:'Aguja Vudú',cost:2,range:4,damage:7,text:'7 de daño y Vincula al combatiente alcanzado.'},
      {id:'reflected',icon:'🩸',name:'Dolor Reflejado',cost:3,range:4,damage:10,text:'10 de daño al enemigo Vinculado dentro del alcance.'},
      {id:'doll',icon:'🪆',name:'Muñeco Vudú',cost:3,range:3,text:'Invoca 1 Muñeco de 16 PV. Si hay un Vinculado, queda ligado a él y refleja la mitad del daño recibido como daño normal. Tras el turno de Houngan puede moverse hasta 3 casillas.'},
      {id:'curse',icon:'☠️',name:'Maldición',cost:3,range:99,noLOS:true,maxUsesPerTurn:1,text:'Sin alcance: sólo sobre el Vinculado. Su próxima acción que gaste PA le causa 6 de daño normal.'},
      {id:'transfer',icon:'🔄',name:'Transferencia',cost:3,range:3,text:'Si hay Muñeco a alcance, Houngan recupera hasta 8 PV y transfiere esa cantidad de daño al Muñeco.'},
      {id:'ritual',icon:'👁️',name:'Ritual del Dolor',cost:4,range:4,damage:14,text:'14 de daño al Vinculado y consume el Vínculo. +4 si un Muñeco propio está cerca del objetivo.'}
    ]
  }
};

const BOT_LOADOUTS={
  arfeli:['sword','daggers','bow','shield'],
  coloso:['pillar','rock','fusion','quake'],
  piplus:['marker','precise','vector','pulse'],
  onod:['germinate','thorn','vines','spores'],
  korgan:['trap_spikes','trap_snare','shot','hook'],
  houngan:['needle','doll','curse','ritual']
};

const FIXED_OBS=new Set(['5,4','6,4','5,7','6,7']);
const PLAYER_DEPLOY=['0,3','1,3','0,4','2,5','1,6','2,6'];
const ENEMY_DEPLOY=['11,3','10,3','11,4','9,5','10,6','9,6'];

let setup={
  mode:'1v1',championId:'arfeli',allyId:'coloso',enemyId:'random',enemy2Id:'random',
  loadout:['sword','daggers','bow','shield']
};
let B=null,timerId=null;

const PROFILE_KEY='arena-tactica-profile-v030';
function loadProfile(){
  const base={name:'Competidor',played:0,wins:0,losses:0,favorite:'arfeli'};
  try{
    const raw=localStorage.getItem(PROFILE_KEY);
    const saved=raw?JSON.parse(raw):{};
    return {...base,...saved};
  }catch(e){return base}
}
function saveProfile(profile){
  try{localStorage.setItem(PROFILE_KEY,JSON.stringify(profile))}catch(e){}
}
let profile=loadProfile();

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const key=(x,y)=>`${x},${y}`;
const ISO_TILE_W=80, ISO_TILE_H=40;
const ISO_WORLD_W=SIZE*ISO_TILE_W, ISO_WORLD_H=SIZE*ISO_TILE_H;
function isoViewCoords(x,y){
  const r=((B?.camera?.rotation||0)%4+4)%4;
  if(r===1)return {x:SIZE-1-y,y:x};
  if(r===2)return {x:SIZE-1-x,y:SIZE-1-y};
  if(r===3)return {x:y,y:SIZE-1-x};
  return {x,y};
}
function isoCenter(x,y){
  const v=isoViewCoords(x,y);
  return {
    x:(v.x-v.y+SIZE)*(ISO_TILE_W/2),
    y:(v.x+v.y+1)*(ISO_TILE_H/2)
  };
}
function isoTilePoints(x,y){
  const c=isoCenter(x,y),hw=ISO_TILE_W/2,hh=ISO_TILE_H/2;
  return `${c.x},${c.y-hh} ${c.x+hw},${c.y} ${c.x},${c.y+hh} ${c.x-hw},${c.y}`;
}
function isoTileMarkup(x,y,classes=[]){
  const tone=(x+y)%2?'iso-tone-b':'iso-tone-a';
  return `<polygon class="${[...classes,tone,'iso-tile'].join(' ')}" data-x="${x}" data-y="${y}" points="${isoTilePoints(x,y)}"></polygon>`;
}
function isoEntityStyle(x,y,boost=0){
  const c=isoCenter(x,y),v=isoViewCoords(x,y),left=c.x/ISO_WORLD_W*100,top=c.y/ISO_WORLD_H*100;
  const depth=100+(v.x+v.y)*20+v.x+boost;
  return `left:${left.toFixed(4)}%;top:${top.toFixed(4)}%;z-index:${depth}`;
}
function isoEntityMarkup(z,current,view){
  return `<div class="iso-entity iso-combat-entity" style="${isoEntityStyle(z.x,z.y,8)}">${renderEntity(z,current,view)}</div>`;
}
function isoObstacleMarkup(x,y){
  return `<div class="iso-entity iso-fixed-obstacle" style="${isoEntityStyle(x,y,2)}" aria-hidden="true"><span>🪨</span></div>`;
}
function isoTrapMarkup(trap,x,y){
  return `<div class="iso-entity iso-trap" style="${isoEntityStyle(x,y,4)}" aria-hidden="true"><span>${trap.icon}</span></div>`;
}
function isoBoardMarkup(tiles,pieces){
  return `<div class="battle-grid iso-grid" id="grid"><svg class="iso-floor" viewBox="0 0 ${ISO_WORLD_W} ${ISO_WORLD_H}" preserveAspectRatio="xMidYMid meet" aria-label="Arena táctica isométrica">${tiles}</svg><div class="iso-entities">${pieces}</div></div>`;
}
function battleCameraState(){
  if(!B)return {x:0,y:0,rotation:0};
  if(!B.camera)B.camera={x:0,y:0,rotation:0};
  if(!Number.isInteger(B.camera.rotation))B.camera.rotation=0;
  B.camera.rotation=((B.camera.rotation%4)+4)%4;
  return B.camera;
}
function clampBattleCamera(grid,x,y){
  const w=Math.max(1,grid?.offsetWidth||1),h=Math.max(1,grid?.offsetHeight||1);
  const limitX=Math.max(90,w*.46),limitY=Math.max(70,h*.46);
  return {x:Math.max(-limitX,Math.min(limitX,x)),y:Math.max(-limitY,Math.min(limitY,y))};
}
function applyBattleCamera(grid=$('#grid')){
  if(!grid||!B)return;
  const c=battleCameraState(),next=clampBattleCamera(grid,c.x||0,c.y||0);
  B.camera={...c,...next};
  grid.style.setProperty('--camera-x',`${next.x}px`);
  grid.style.setProperty('--camera-y',`${next.y}px`);
}
function centerBattleCameraOn(entity){
  const grid=$('#grid');if(!grid||!B||!entity)return;
  const current=battleCameraState(),rect=grid.getBoundingClientRect();
  const baseLeft=rect.left-current.x,baseTop=rect.top-current.y;
  const c=isoCenter(entity.x,entity.y);
  const localX=(c.x/ISO_WORLD_W)*grid.offsetWidth,localY=(c.y/ISO_WORLD_H)*grid.offsetHeight;
  const vv=window.visualViewport;
  const targetX=(vv?.offsetLeft||0)+(vv?.width||window.innerWidth)/2;
  const targetY=(vv?.offsetTop||0)+(vv?.height||window.innerHeight)*.52;
  B.camera={...current,...clampBattleCamera(grid,targetX-(baseLeft+localX),targetY-(baseTop+localY))};
  applyBattleCamera(grid);
}
function bindBattleCamera(grid=$('#grid')){
  if(!grid||!B)return;
  applyBattleCamera(grid);
  let pointer=null,startX=0,startY=0,baseX=0,baseY=0,moved=false,suppressClick=false,raf=0,next=null,startTile=null;
  const paint=()=>{raf=0;if(!next)return;B.camera={...battleCameraState(),...next};applyBattleCamera(grid)};
  grid.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'&&e.button!==0)return;
    pointer=e.pointerId;startX=e.clientX;startY=e.clientY;
    startTile=e.target.closest?.('.tile')||null;
    const c=battleCameraState();baseX=c.x;baseY=c.y;moved=false;next=null;
    try{grid.setPointerCapture(pointer)}catch{}
  });
  grid.addEventListener('pointermove',e=>{
    if(pointer!==e.pointerId)return;
    const dx=e.clientX-startX,dy=e.clientY-startY;
    if(!moved&&Math.hypot(dx,dy)<7)return;
    moved=true;e.preventDefault();
    next=clampBattleCamera(grid,baseX+dx,baseY+dy);
    if(!raf)raf=requestAnimationFrame(paint);
  });
  const finish=e=>{
    if(pointer!==e.pointerId)return;
    if(raf){cancelAnimationFrame(raf);raf=0;if(next){B.camera={...battleCameraState(),...next};applyBattleCamera(grid)}}
    if(moved){suppressClick=true;e.preventDefault()}
    else if(B?.onlineMode&&B.selectedAction==='move'&&B.onlineLocalHasAuthority&&!B.onlineActionPending&&!B.onlineDesync&&startTile?.classList?.contains('move')){
      const x=Number(startTile.dataset.x),y=Number(startTile.dataset.y),u=cur();
      if(Number.isInteger(x)&&Number.isInteger(y)&&u){
        suppressClick=true;e.preventDefault();
        Promise.resolve(requestOnlineMove(u,x,y)).catch(err=>console.error('Online move tap',err));
      }
    }
    try{grid.releasePointerCapture(pointer)}catch{}
    pointer=null;startTile=null;
  };
  grid.addEventListener('pointerup',finish);
  grid.addEventListener('pointercancel',finish);
  grid.addEventListener('click',e=>{
    if(!suppressClick)return;
    suppressClick=false;e.preventDefault();e.stopImmediatePropagation();
  },true);
}
function rotateBattleCamera(step){
  if(!B||B.ended)return;
  const focus=getEntity(B.selectedUnitId)||cur();
  const c=battleCameraState();
  B.camera={x:0,y:0,rotation:((c.rotation||0)+step+4)%4};
  renderBattle();
  requestAnimationFrame(()=>{
    const target=focus?.alive===false?(cur()||focus):focus;
    if(target)centerBattleCameraOn(target);
  });
}
const inside=(x,y)=>x>=0&&y>=0&&x<SIZE&&y<SIZE;
const md=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const adj8=(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y))===1;
const adjCardinal=(a,b)=>md(a,b)===1;
const champ=id=>CHAMPIONS[id];
const ability=(champId,id)=>champ(champId).abilities.find(a=>a.id===id);
const randomChampionExcluding=(excluded=[])=>{
  const blocked=new Set(excluded.filter(Boolean));
  const ids=Object.keys(CHAMPIONS).filter(x=>!blocked.has(x));
  return ids[Math.floor(Math.random()*ids.length)]||Object.keys(CHAMPIONS)[0];
};
const randomOpponent=id=>randomChampionExcluding([id]);

function makeUnit(championId,side,id,controller='ai',customLoadout=null){
  const c=champ(championId);
  return{
    id,kind:'unit',type:'unit',championId,side,controller,name:c.name,icon:c.icon,
    x:-1,y:-1,hp:c.hp,maxHp:c.hp,pa:c.pa,maxPa:c.pa,pm:c.pm,maxPm:c.pm,ini:c.ini,
    alive:true,facing:side==='player'?'derecha':'izquierda',
    status:{wound:0,poison:0,burn:0,paPenaltyNext:0,pmPenaltyNext:0,curseDamage:0,markedBy:null,linkedBy:null},shieldStacks:[],
    monolith:false,monolithStoredPm:0,exitedMonolithThisTurn:false,monolithPillarGainUsed:false,
    stoneArmorTargetsUsed:[],skillUsesThisTurn:{},symbiosisUsed:false,markedTargetId:null,linkedTargetId:null,
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
  const n=u.status.poison;applyDamage(u,n,false);log(`☠️ Veneno ${n}: ${u.name} recibe ${n} daño por utilizar una habilidad.`);return n;
}
function shieldTotal(e){return (e?.shieldStacks||[]).reduce((n,s)=>n+(s?.amount||0),0)}
function shieldSourceId(target){
  const active=cur();
  return active?.id||target?.ownerId||target?.id||null;
}
function addShield(e,amount,label='Escudo',sourceOwnerId=null){
  if(!e||!e.alive)return;
  e.shieldStacks=e.shieldStacks||[];
  e.shieldStacks.push({
    amount:Math.max(0,Number(amount)||0),
    turns:1,
    label,
    sourceOwnerId:sourceOwnerId||shieldSourceId(e)
  });
  feedback(e,`+${amount} 🛡️`,'shield');
}
function ageShieldStacks(e){
  if(!e?.shieldStacks)return;
  // La duración ya NO se descuenta al final del turno.
  // El Escudo expira al inicio del próximo turno de quien lo generó.
  e.shieldStacks=e.shieldStacks.filter(s=>(s?.amount||0)>0);
}
function expireShieldsFromSource(sourceOwnerId){
  if(!B||!sourceOwnerId)return 0;
  let expired=0;
  const entities=[...(B.units||[]),...(B.pillars||[])];
  for(const entity of entities){
    if(!Array.isArray(entity?.shieldStacks)||!entity.shieldStacks.length)continue;
    const keep=[];
    for(const stack of entity.shieldStacks){
      if(stack?.sourceOwnerId===sourceOwnerId){
        expired+=Math.max(0,stack.amount||0);
      }else if((stack?.amount||0)>0){
        keep.push(stack);
      }
    }
    entity.shieldStacks=keep;
  }
  return expired;
}
function expireOrphanedShields(){
  if(!B?.units)return 0;
  const aliveIds=new Set(B.units.filter(u=>u?.alive).map(u=>u.id));
  let expired=0;
  const entities=[...(B.units||[]),...(B.pillars||[])];
  for(const entity of entities){
    if(!Array.isArray(entity?.shieldStacks)||!entity.shieldStacks.length)continue;
    const keep=[];
    for(const stack of entity.shieldStacks){
      if(stack?.sourceOwnerId&&!aliveIds.has(stack.sourceOwnerId)){
        expired+=Math.max(0,stack.amount||0);
      }else if((stack?.amount||0)>0){
        keep.push(stack);
      }
    }
    entity.shieldStacks=keep;
  }
  return expired;
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
function teamLabel(u){
  if(u.controller==='human')return 'Tu campeón';
  if(u.controller==='remote')return 'Rival online';
  return u.side==='player'?'Aliado IA':'Rival IA';
}

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
        <span class="mode-icon">🌐</span><b>1v1 ONLINE</b><small>Conectá dos dispositivos mediante código de sala.</small><em>PRUEBA · SALA + PREPARACIÓN</em>
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
  const difficultyPicker=`<div class="rival-picker ai-difficulty-picker"><span>🧠 IA de combate</span><b>EXPERTA</b></div>`;
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
    units.push(makeUnit(enemy1Id,'enemy','enemy1','ai'));
    units.push(makeUnit(enemy2Id,'enemy','enemy2','ai'));
  }else{
    const enemyId=setup.enemyId==='random'?randomOpponent(setup.championId):setup.enemyId;
    units.push(makeUnit(enemyId,'enemy','enemy1','ai'));
  }
  B={
    mode:setup.mode,round:1,turn:0,timer:30,selectedAction:null,selectedUnitId:'player',pendingImpulseTargetId:null,
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

  // Regla global de Escudo:
  // todo Escudo generado por este campeón expira al COMENZAR su próximo turno.
  const expiredShield=expireShieldsFromSource(u.id);
  const orphanedShield=expireOrphanedShields();
  if(expiredShield>0)log(`🛡️ Expiran ${expiredShield} puntos de Escudo generados por ${u.name}.`);
  if(orphanedShield>0)log(`🛡️ Expiran ${orphanedShield} puntos de Escudo cuyo generador ya no está en combate.`);

  const paPenalty=Math.max(0,u.status.paPenaltyNext||0);
  u.pa=Math.max(0,u.maxPa-paPenalty);
  u.status.paPenaltyNext=0;
  u.exitedMonolithThisTurn=false;
  u.monolithPillarGainUsed=false;
  u.stoneArmorTargetsUsed=[];
  u.skillUsesThisTurn={};
  u.symbiosisUsed=false;
  const pmPenalty=Math.max(0,u.status.pmPenaltyNext||0);
  u.status.pmPenaltyNext=0;
  if(u.monolith){u.monolithStoredPm=u.maxPm;u.pm=0}else u.pm=Math.max(0,u.maxPm-pmPenalty);
  B.timer=30;B.selectedAction=null;B.skillsOpen=false;B.selectedUnitId=u.id;B.notice='';B.noticeSeq++;
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
}

function advanceTurn(){
  if(!B||B.ended)return;
  B.dollPhase=null;B.selectedAction=null;B.pendingImpulseTargetId=null;B.skillsOpen=false;B.busy=false;B.pendingTimeout=false;
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
  B.selectedAction=null;B.pendingImpulseTargetId=null;B.skillsOpen=false;B.busy=false;B.pendingTimeout=false;B.selectedUnitId=doll.id;
  log(`🪆 ${doll.name} dispone de 3 PM después del turno de ${owner.name}.`);
  renderBattle();
  if(owner.controller==='ai')setTimeout(aiDollPhase,380);
}
function finishDollPhase(){
  if(!B?.dollPhase)return;
  const doll=getEntity(B.dollPhase.dollId);
  if(doll?.alive)log(`🪆 ${doll.name} finaliza su movimiento.`);
  advanceTurn();
}
function nextTurn(){
  if(!B||B.ended)return;
  if(B.dollPhase)return finishDollPhase();
  clearInterval(timerId);
  const old=cur();
  if(old?.alive)endTurnEffects(old);
  if(checkBattleEnd())return;
  B.selectedAction=null;B.pendingImpulseTargetId=null;B.skillsOpen=false;B.busy=false;B.pendingTimeout=false;
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
async function moveDoll(x,y){
  const phase=B?.dollPhase;if(!phase||B.busy)return false;
  const doll=getEntity(phase.dollId);if(!doll?.alive)return finishDollPhase();
  const reach=objectMovementMap(doll,phase.pm),cost=reach.get(key(x,y));
  if(cost==null)return false;
  const path=objectGridPath(doll,{x,y});if(path.length<2)return false;
  B.busy=true;
  let steps=0;
  for(let i=1;i<path.length&&doll.alive;i++){
    doll.x=path[i][0];doll.y=path[i][1];steps++;phase.pm=Math.max(0,phase.pm-1);
    renderBattle();await sleep(120);await triggerTrapAt(doll);
    if(checkBattleEnd()){B.busy=false;return true}
  }
  if(steps)log(`🪆 ${doll.name} se mueve ${steps} casilla${steps!==1?'s':''}.`);
  B.busy=false;renderBattle();
  if(!doll.alive||phase.pm<=0){await sleep(160);finishDollPhase()}
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
  const d=Math.abs(x-mover.x)+Math.abs(y-mover.y);if(d<1||d>max||!(x===mover.x||y===mover.y)||!free(x,y))return false;
  const dx=Math.sign(x-mover.x),dy=Math.sign(y-mover.y);let cx=mover.x,cy=mover.y;
  for(let i=0;i<d;i++){cx+=dx;cy+=dy;if(isFixedObstacle(cx,cy)||entityAt(cx,cy))return false}
  return true;
}
function straightDashValid(u,x,y,max=2){return straightDashValidFrom(u,x,y,max)}
function impulseTargetValid(u,target){
  if(!u||!target||target.kind!=='unit'||target.side!==u.side||!target.alive)return false;
  if(target.id===u.id)return true;
  const a=ability(u.championId,'impulse');return !!(a&&inRange(u,target,a.range)&&(!requiresLOS(a)||clearLOS(u,target)));
}
function impulseDestinationValid(u,x,y){
  const target=getUnit(B?.pendingImpulseTargetId);return !!(impulseTargetValid(u,target)&&straightDashValidFrom(target,x,y,2));
}
function tileInRangeLOS(u,pos,a){return inRange(u,pos,effectiveRange(u,a))&&(!requiresLOS(a)||clearLOS(u,pos))}
function objectDescription(z){
  if(z.type==='pillar')return 'Bloquea movimiento y línea de visión.';
  if(z.type==='sprout')return 'Brote de Onod. 12 PV, puede recibir daño, ocupa casilla y no bloquea línea de visión.';
  if(z.type==='doll')return z.linkedTargetId?'Muñeco Vudú de 16 PV vinculado. Refleja la mitad del daño recibido y puede moverse 3 PM tras Houngan.':'Muñeco Vudú de 16 PV sin vínculo. Puede moverse 3 PM tras Houngan.';
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
function triggerSymbiosis(u,target){
  if(u.championId!=='onod'||u.symbiosisUsed||!target)return;
  const s=ownedSprouts(u).find(s=>md(s,target)<=2&&s.hp<s.maxHp);
  if(!s)return;
  const got=heal(s,3);if(got){u.symbiosisUsed=true;log(`🌿 Simbiosis: ${s.name} recupera ${got} PV.`)}
}
function abilityRangeState(u,id,x,y){
  const a=ability(u.championId,id);if(!a)return null;
  const pos={x,y};
  if(id==='shield')return x===u.x&&y===u.y?{inside:true,blocked:false}:null;
  if(id==='stonearmor'&&x===u.x&&y===u.y)return {inside:true,blocked:false};
  if(id==='curse')return getLinkedTarget(u)?.x===x&&getLinkedTarget(u)?.y===y?{inside:true,blocked:false}:null;
  if(id==='impulse'){
    if(B?.pendingImpulseTargetId)return impulseDestinationValid(u,x,y)?{inside:true,blocked:false}:null;
    const target=entityAt(x,y);return impulseTargetValid(u,target)?{inside:true,blocked:false}:null;
  }
  if(id==='hunterstep')return straightDashValid(u,x,y,2)?{inside:true,blocked:false}:null;
  if(id==='quake'&&u.championId==='coloso'&&u.monolith){
    const insideQuake=adj8(u,pos)||ownedPillars(u).some(p=>adj8(p,pos));return insideQuake?{inside:true,blocked:false}:null;
  }
  const r=effectiveRange(u,a);if(!inRange(u,pos,r))return null;
  const blocked=requiresLOS(a)&&!clearLOS(u,pos);return {inside:true,blocked};
}

function canUseAbility(u,id,x,y){
  const a=ability(u.championId,id);if(!a||!u.loadout.includes(id)||u.pa<a.cost||B.busy||!skillUseAllowed(u,id))return false;
  const target=entityAt(x,y),pos={x,y},r=effectiveRange(u,a);
  if(id==='shield')return x===u.x&&y===u.y;
  if(id==='impulse')return !B?.pendingImpulseTargetId&&impulseTargetValid(u,target);
  if(id==='hunterstep')return straightDashValid(u,x,y,2);
  if(id==='pillar')return ownedPillars(u).length<(u.monolith?3:2)&&free(x,y)&&tileInRangeLOS(u,pos,a);
  if(id==='stonearmor'){
    if(!target||u.stoneArmorTargetsUsed.includes(target.id))return false;
    if(target.id===u.id)return true;
    if(target.kind==='unit'&&target.side===u.side)return tileInRangeLOS(u,target,a);
    return target.type==='pillar'&&target.ownerId===u.id&&tileInRangeLOS(u,target,a);
  }
  if(id==='absorb')return !!(target?.type==='pillar'&&target.ownerId===u.id&&tileInRangeLOS(u,target,a));
  if(id==='fusion')return !!(!u.monolith&&!u.exitedMonolithThisTurn&&target?.type==='pillar'&&target.ownerId===u.id&&adj8(u,target));
  if(id==='germinate')return ownedSprouts(u).length<2&&free(x,y)&&tileInRangeLOS(u,pos,a);
  if(['trap_spikes','trap_snare','trap_bomb'].includes(id))return activeTraps(u).length<3&&free(x,y)&&tileInRangeLOS(u,pos,a);
  if(id==='doll')return !ownedDoll(u)&&free(x,y)&&tileInRangeLOS(u,pos,a);
  if(id==='pulse'||id==='sap')return !!(target?.kind==='unit'&&target.side===u.side&&(target.id===u.id||tileInRangeLOS(u,target,a)));
  if(id==='awakening')return !!(target?.type==='sprout'&&target.ownerId===u.id&&tileInRangeLOS(u,target,a));
  if(id==='transfer')return !!(target?.type==='doll'&&target.ownerId===u.id&&u.hp<u.maxHp&&tileInRangeLOS(u,target,a));
  if(id==='curse'){const linked=getLinkedTarget(u);return !!(linked&&target?.id===linked.id)}
  if(id==='reflected'||id==='ritual'){const linked=getLinkedTarget(u);return !!(linked&&target?.id===linked.id&&tileInRangeLOS(u,linked,a))}
  if(id==='rupture'){const marked=getMarkedTarget(u);return !!(marked&&target?.id===marked.id&&tileInRangeLOS(u,marked,a))}
  if(id==='spores')return tileInRangeLOS(u,pos,a);
  const foe=target;if(!damageableEnemy(u,foe))return false;
  if(id==='quake'&&u.championId==='coloso'&&u.monolith)return quakeCanReach(u,foe);
  if(!inRange(u,foe,r))return false;
  if(requiresLOS(a)&&!clearLOS(u,foe))return false;
  return true;
}

function berserkerBonus(u){
  return u.championId==='arfeli'&&u.hp<u.maxHp*.5?2:0;
}
function skillDamage(u,a){return (a.damage||0)+berserkerBonus(u)}

function applyDamage(e,n,ignoreShield=false){
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
  if(e.type==='doll'&&actualHp>0&&e.linkedTargetId){
    const linked=getEntity(e.linkedTargetId),echo=Math.floor(actualHp/2);
    if(linked?.alive&&linked.kind==='unit'&&echo>0){applyDamage(linked,echo,false);log(`🪆 Vínculo del Muñeco: ${linked.name} recibe ${echo} daño normal.`)}
  }
  return absorbed;
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
  if(trap.trapType==='spikes'){applyDamage(target,10,false);log(`🪤 Trampa de Pinchos: ${target.name} recibe 10 daño.`)}
  if(trap.trapType==='snare'){applyDamage(target,6,false);if(target.kind==='unit')target.status.pmPenaltyNext=Math.max(target.status.pmPenaltyNext||0,2);log(`🧷 Cepo: ${target.name} recibe 6 daño y -2 PM en su próximo turno.`)}
  if(trap.trapType==='bomb'){
    applyDamage(target,8,false);log(`💣 Carga Explosiva: ${target.name} recibe 8 daño.`);
    for(const z of allEntities().filter(z=>z.alive&&z.id!==target.id&&adjCardinal(z,trap))){applyDamage(z,4,false);log(`💥 Explosión: ${z.name} recibe 4 daño.`)}
  }
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

async function executeAbility(u,id,x,y,fromAI=false){
  if(!canUseAbility(u,id,x,y))return false;
  const a=ability(u.championId,id),target=entityAt(x,y);
  B.busy=true;B.noticeSeq++;B.notice=`${u.icon} ${u.name} — ${a.icon} ${a.name}`;
  if(target)faceTarget(u,target);registerSkillUse(u,id);u.pa-=a.cost;triggerPoisonOnAbility(u);renderBattle();await sleep(150);
  if(!u.alive){B.notice='';B.selectedAction=null;B.busy=false;renderBattle();checkBattleEnd();return true}
  const objectTarget=isCombatObject(target);

  if(['sword','daggers','bow','spear','hammer','rock','quake'].includes(id)){
    let origin=u,projected=false;if(id==='quake'&&u.championId==='coloso'&&u.monolith){origin=quakeOriginForTarget(u,target)||u;projected=origin.type==='pillar'}
    const dmg=projected?8:skillDamage(u,a);applyDamage(target,dmg,false);
    log(projected?`🌋 ${origin.name} proyecta Golpe Sísmico: ${dmg} daño a ${target.name}.`:`${a.icon} ${a.name}: ${dmg} daño a ${target.name}.`);
    if(!objectTarget&&id==='daggers'&&target.alive){addStatus(target,'wound',1);log(`🩸 ${target.name} obtiene Herida ${target.status.wound}.`)}
    if(!objectTarget&&id==='hammer'&&target.alive){target.status.paPenaltyNext=Math.max(target.status.paPenaltyNext||0,1);feedback(target,'PA -1 próximo','status');log(`🔨 ${target.name} sufrirá -1 PA al comenzar su próximo turno.`)}
    renderBattle();await sleep(180);
    if(!objectTarget&&target.alive&&id==='spear')await forcedMove(target,u,1,false,'Atracción');
    if(!objectTarget&&target.alive&&id==='quake'){
      const qid=`quake-${B.nextQuakeId++}`;if(projected)origin.lastReplicaQuakeId=qid;await forcedMove(target,origin,1,true,projected?'Resonancia':'Empuje');if(u.monolith&&target.alive)await triggerReplicas(u,target,qid)
    }
  }else if(id==='shield'){
    addShield(u,15,'Portación de Escudo');log(`🛡️ ${u.name} obtiene 15 de Escudo.`);
  }else if(id==='pillar'){
    const number=B.nextPillarId++;const p={id:`pillar${number}`,number,type:'pillar',kind:'object',ownerId:u.id,side:u.side,name:`Pilar ${number}`,icon:'🗿',x,y,hp:20,maxHp:20,alive:true,shieldStacks:[],blocksLOS:true,lastReplicaQuakeId:null};B.pillars.push(p);log(`🗿 ${u.name} crea ${p.name}.`);
  }else if(id==='stonearmor'){
    u.stoneArmorTargetsUsed.push(target.id);addShield(target,15,'Armadura de Piedra');log(`🛡️ ${target.name} obtiene 15 de Escudo con Armadura de Piedra.`);
  }else if(id==='absorb'){
    const name=target.name;destroyPillar(target);const got=heal(u,20);log(`🧲 ${u.name} absorbe ${name} y recupera ${got} PV.`);
  }else if(id==='fusion'){
    destroyPillar(target);u.monolithStoredPm=u.pm;u.monolith=true;u.pm=0;addShield(u,20,'Monolito');log(`🗿 ${u.name} entra en Monolito y obtiene 20 de Escudo.`);

  }else if(id==='marker'){
    applyDamage(target,8,false);log(`🎯 Disparo Marcador: 8 daño a ${target.name}.`);if(!objectTarget&&target.alive){setMarkedTarget(u,target);log(`🎯 ${target.name} queda Marcado.`)}
  }else if(id==='precise'){
    const bonus=!objectTarget&&getMarkedTarget(u)?.id===target.id?2:0;applyDamage(target,12+bonus,false);log(`🏹 Disparo Preciso: ${12+bonus} daño a ${target.name}${bonus?' por Marca':''}.`);
  }else if(id==='vector'){
    const marked=!objectTarget&&getMarkedTarget(u)?.id===target.id,dist=marked?2:1;applyDamage(target,8,false);log(`🧲 Tirón Vectorial: 8 daño a ${target.name}.`);if(!objectTarget&&target.alive)await forcedMove(target,u,dist,false,'Atracción');
  }else if(id==='hunterstep'){
    await dashUnit(u,x,y);log(`${a.icon} ${u.name} se desplaza sin gastar PM.`);
  }else if(id==='pulse'){
    const got=heal(target,12);log(`💚 Pulso Reparador: ${target.name} recupera ${got} PV.`);
  }else if(id==='rupture'){
    applyDamage(target,14,false);log(`💥 Ruptura de Marca: 14 daño a ${target.name}.`);if(!objectTarget&&target.alive)await forcedMove(target,u,1,true,'Empuje');clearMarkedTarget(u);

  }else if(id==='germinate'){
    const n=B.nextObjectId++;const s={id:`sprout${n}`,number:n,type:'sprout',kind:'object',ownerId:u.id,side:u.side,name:`Brote ${ownedSprouts(u).length+1}`,icon:'🌱',x,y,hp:12,maxHp:12,alive:true,shieldStacks:[],blocksLOS:false};B.pillars.push(s);log(`🌱 ${u.name} hace germinar ${s.name}.`);
  }else if(id==='thorn'){
    applyDamage(target,7,false);log(`☠️ Espina Venenosa: 7 daño a ${target.name}.`);if(!objectTarget&&target.alive){addStatus(target,'poison',1);log(`☠️ ${target.name} obtiene Veneno ${target.status.poison}.`);triggerSymbiosis(u,target)}
  }else if(id==='vines'){
    applyDamage(target,6,false);log(`🌿 Enredaderas: 6 daño a ${target.name}.`);if(!objectTarget&&target.alive){target.status.pmPenaltyNext=Math.max(target.status.pmPenaltyNext||0,2);log(`🌿 ${target.name} tendrá -2 PM en su próximo turno.`)}
  }else if(id==='sap'){
    const near=ownedSprouts(u).some(s=>adj8(s,target)),got=heal(target,near?14:10);log(`💚 Savia Vital: ${target.name} recupera ${got} PV${near?' junto a un Brote':''}.`);triggerSymbiosis(u,target);
  }else if(id==='spores'){
    const center={x,y},cells=[center,{x:x+1,y},{x:x-1,y},{x,y:y+1},{x,y:y-1}];let poisonedTarget=null;
    for(const z of allEntities().filter(z=>z.alive&&z.side!==u.side&&cells.some(c=>c.x===z.x&&c.y===z.y))){applyDamage(z,6,false);if(z.kind==='unit'&&z.alive){addStatus(z,'poison',1);poisonedTarget=poisonedTarget||z;log(`🌬️ Esporas: ${z.name} recibe 6 daño y Veneno ${z.status.poison}.`)}else log(`🌬️ Esporas: ${z.name} recibe 6 daño.`)}
    if(poisonedTarget)triggerSymbiosis(u,poisonedTarget);
  }else if(id==='awakening'){
    const source={x:target.x,y:target.y,name:target.name};destroyPillar(target);log(`🌳 ${u.name} consume ${source.name} y despierta el bosque.`);
    for(const z of B.units.filter(z=>z.alive&&z.side!==u.side&&adj8(z,source))){applyDamage(z,10,false);log(`🌳 ${z.name} recibe 10 daño.`);if(z.alive)await forcedMove(z,source,1,true,'Raíces')}

  }else if(['trap_spikes','trap_snare','trap_bomb'].includes(id)){
    const trapType=id==='trap_spikes'?'spikes':id==='trap_snare'?'snare':'bomb',icon=id==='trap_spikes'?'🪤':id==='trap_snare'?'🧷':'💣';
    B.traps.push({id:`trap${B.nextTrapId++}`,trapType,icon,x,y,ownerId:u.id,side:u.side,active:true});log(`${icon} ${u.name} coloca ${a.name}.`);
  }else if(id==='shot'){
    applyDamage(target,10,false);log(`🏹 Disparo de Caza: 10 daño a ${target.name}.`);
  }else if(id==='hook'){
    applyDamage(target,7,false);log(`🪝 Gancho: 7 daño a ${target.name}.`);if(!objectTarget&&target.alive)await forcedMove(target,u,1,false,'Gancho');

  }else if(id==='needle'){
    applyDamage(target,7,false);log(`🪡 Aguja Vudú: 7 daño a ${target.name}.`);if(!objectTarget&&target.alive){setLinkedTarget(u,target);log(`🪡 ${target.name} queda Vinculado a ${u.name}.`)}
  }else if(id==='reflected'){
    applyDamage(target,10,false);log(`🩸 Dolor Reflejado: ${target.name} recibe 10 daño.`);
    const extra=B.units.find(z=>z.alive&&z.side===target.side&&z.id!==target.id&&adj8(z,target));if(extra){applyDamage(extra,4,false);log(`🩸 ${extra.name} recibe 4 daño reflejado.`)}
  }else if(id==='doll'){
    const n=B.nextObjectId++,linked=getLinkedTarget(u);const d={id:`doll${n}`,type:'doll',kind:'object',ownerId:u.id,side:u.side,name:'Muñeco Vudú',icon:'🪆',x,y,hp:16,maxHp:16,alive:true,shieldStacks:[],blocksLOS:false,linkedTargetId:linked?.id||null};B.pillars.push(d);log(`🪆 ${u.name} invoca un Muñeco Vudú${linked?` vinculado a ${linked.name}`:''}.`);
  }else if(id==='curse'){
    target.status.curseDamage=6;log(`☠️ ${target.name} queda Maldito: su próxima acción con PA le causará 6 daño.`);
  }else if(id==='transfer'){
    const amount=Math.min(8,u.maxHp-u.hp),got=heal(u,amount);applyDamage(target,got,false);log(`🔄 Transferencia: ${u.name} recupera ${got} PV y el Muñeco recibe ${got} daño.`);
  }else if(id==='ritual'){
    const near=ownedDoll(u)&&md(ownedDoll(u),target)<=2,damage=14+(near?4:0);applyDamage(target,damage,false);log(`👁️ Ritual del Dolor: ${target.name} recibe ${damage} daño${near?' con resonancia del Muñeco':''}.`);clearLinkedTarget(u);
  }

  spendPAAfterAction(u);B.notice='';B.selectedAction=null;B.busy=false;renderBattle();if(checkBattleEnd())return true;if(B.pendingTimeout&&!B.ended){nextTurn();return true}return true;
}

async function triggerReplicas(u,target,quakeId){
  const used=new Set();
  while(target.alive){
    const p=ownedPillars(u).find(p=>!used.has(p.id)&&p.lastReplicaQuakeId!==quakeId&&adj8(p,target));
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
  leaveMonolith(u);renderBattle();
}
function selectConsumePillar(){
  const u=cur();if(!u||!u.monolith||u.monolithPillarGainUsed||!ownedPillars(u).length)return;
  B.selectedAction=B.selectedAction==='consumePillar'?null:'consumePillar';B.skillsOpen=false;renderBattle();
}
function validConsumePillar(x,y){
  const u=cur(),p=pillarAt(x,y);return !!(u?.monolith&&!u.monolithPillarGainUsed&&p?.ownerId===u.id);
}
function consumePillarForPA(x,y){
  if(!validConsumePillar(x,y))return;
  const u=cur(),p=pillarAt(x,y),pillarName=p.name;destroyPillar(p);u.pa+=1;u.monolithPillarGainUsed=true;B.selectedAction=null;
  feedback(u,'+1 PA','pa');log(`⚡ ${u.name} consume ${pillarName} y obtiene +1 PA.`);renderBattle();
}
function selectRemoveSprout(){
  const u=cur();if(!u||u.controller!=='human'||u.championId!=='onod'||!ownedSprouts(u).length||B.busy)return;
  B.selectedAction=B.selectedAction==='removeSprout'?null:'removeSprout';B.skillsOpen=false;renderBattle();
}
function validRemoveSprout(x,y){
  const u=cur(),s=entityAt(x,y);return !!(u?.championId==='onod'&&s?.type==='sprout'&&s.ownerId===u.id&&s.alive);
}
function removeSproutFree(x,y){
  if(!validRemoveSprout(x,y))return;
  const s=entityAt(x,y),name=s.name;destroyPillar(s);B.selectedAction=null;
  log(`🌱 ${cur().name} retira ${name} sin gastar PA.`);renderBattle();
}

function statusText(u){
  const a=[];if(u.status.wound)a.push(`🩸 Herida ${u.status.wound}`);if(u.status.poison)a.push(`☠️ Veneno ${u.status.poison}`);if(u.status.burn)a.push(`🔥 Quemadura ${u.status.burn}`);if(u.status.paPenaltyNext)a.push('🔨 PA -1 próximo turno');if(u.status.pmPenaltyNext)a.push(`🌿 PM -${u.status.pmPenaltyNext} próximo turno`);if(u.status.curseDamage)a.push('☠️ Maldición');if(u.status.markedBy)a.push('🎯 Marcado');if(u.status.linkedBy)a.push('🪡 Vinculado');if(u.monolith)a.push('🗿 Monolito');if(berserkerBonus(u))a.push('🔥 Berserker +2');return a.length?a.join(' · '):'Sin estados';
}
function statusChips(u){
  const a=[];if(u.status.wound)a.push(`<span class="state-chip">🩸 Herida ${u.status.wound}</span>`);if(u.status.poison)a.push(`<span class="state-chip">☠️ Veneno ${u.status.poison}</span>`);if(u.status.burn)a.push(`<span class="state-chip">🔥 Quemadura ${u.status.burn}</span>`);if(u.status.paPenaltyNext)a.push('<span class="state-chip control">🔨 PA -1 próximo</span>');if(u.status.pmPenaltyNext)a.push(`<span class="state-chip control">🌿 PM -${u.status.pmPenaltyNext} próximo</span>`);if(u.status.curseDamage)a.push('<span class="state-chip control">☠️ Maldición</span>');if(u.status.markedBy)a.push('<span class="state-chip">🎯 Marcado</span>');if(u.status.linkedBy)a.push('<span class="state-chip">🪡 Vinculado</span>');if(u.monolith)a.push('<span class="state-chip monolith">🗿 Monolito</span>');if(berserkerBonus(u))a.push('<span class="state-chip berserker">🔥 Berserker +2</span>');return a.length?a.join(''):'<span class="state-empty">Sin estados</span>';
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
  if(action==='consumePillar')return validConsumePillar(x,y);
  if(action==='removeSprout')return validRemoveSprout(x,y);
  if(action==='impulse'&&B?.pendingImpulseTargetId)return impulseDestinationValid(u,x,y);
  return canUseAbility(u,action,x,y);
}
function invalidAbilityReason(u,id,x,y){
  const a=ability(u.championId,id),target=entityAt(x,y);if(!a)return 'Acción no disponible.';if(!skillUseAllowed(u,id))return `${a.name}: límite de usos por turno alcanzado.`;if(u.pa<a.cost)return 'PA insuficientes.';
  if(['pillar','germinate','doll','trap_spikes','trap_snare','trap_bomb'].includes(id)&&!free(x,y))return 'La casilla está ocupada.';
  if(['pillar'].includes(id)&&ownedPillars(u).length>=(u.monolith?3:2))return 'Máximo de Pilares alcanzado.';
  if(id==='germinate'&&ownedSprouts(u).length>=2)return 'Máximo de 2 Brotes activos.';
  if(['trap_spikes','trap_snare','trap_bomb'].includes(id)&&activeTraps(u).length>=3)return 'Máximo de 3 trampas activas.';
  if(id==='doll'&&ownedDoll(u))return 'Ya hay un Muñeco Vudú activo.';
  if(id==='curse'&&!getLinkedTarget(u))return 'Necesitás un enemigo Vinculado.';
  if(['reflected','ritual'].includes(id)&&!getLinkedTarget(u))return 'Necesitás un enemigo Vinculado.';
  if(id==='rupture'&&!getMarkedTarget(u))return 'Necesitás un enemigo Marcado.';
  if(id==='impulse')return B?.pendingImpulseTargetId?'Elegí una casilla libre en línea a 1 o 2 casillas del aliado.':'Elegí a Piplus o a un aliado dentro de alcance 3.';
  if(id==='hunterstep')return 'Elegí una casilla libre en línea a 1 o 2 casillas.';
  if(!target&&!['spores','pillar','germinate','doll','trap_spikes','trap_snare','trap_bomb'].includes(id))return 'Elegí un objetivo.';
  if(target?.side===u.side&&!['pulse','sap','stonearmor','absorb','fusion','awakening','transfer'].includes(id))return 'Objetivo aliado no válido.';
  if(id==='quake'&&u.monolith&&target&&!quakeCanReach(u,target))return 'Fuera del alcance de Coloso y de sus Pilares.';
  const rs=abilityRangeState(u,id,x,y);if(!rs?.inside)return 'Fuera de alcance.';if(rs.blocked)return 'Sin línea de visión.';return 'Objetivo no válido.';
}

function actionInfo(id){
  const u=cur();
  if(id==='move')return {name:'Mover',cost:'1 PM/casilla',text:'Movimiento ortogonal. Podés dividir el movimiento antes y después de usar habilidades.',target:'Casilla libre',range:'Hasta PM disponibles'};
  if(id==='consumePillar')return {name:'Consumir Pilar',cost:'0 PA',text:'Una vez por turno en Monolito, consume un Pilar propio y obtiene +1 PA.',target:'Pilar propio',range:'Cualquier Pilar propio'};
  if(id==='removeSprout')return {name:'Retirar Brote',cost:'0 PA',text:'Retira voluntariamente un Brote propio. Para volver a colocarlo deberá usar Germinar y pagar su coste normal.',target:'Brote propio',range:'Sin alcance'};
  const a=ability(u.championId,id);if(!a)return null;
  const placement=['pillar','germinate','doll','trap_spikes','trap_snare','trap_bomb','hunterstep','spores'].includes(id);const support=['pulse','sap','stonearmor'].includes(id);return{name:a.name,cost:`${a.cost} PA`,text:a.text,target:id==='impulse'?(B?.pendingImpulseTargetId?'Destino del aliado':'Piplus o aliado'):placement?'Casilla/posición':support?'Aliado/propio':id==='absorb'||id==='fusion'||id==='awakening'||id==='transfer'?'Invocación propia':'Enemigo/objeto enemigo',range:id==='curse'?'Global por Vínculo':a.range===0?'Personal':`Alcance ${effectiveRange(u,a)}`};
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
    if(!phase&&u.controller==='human'&&B.selectedAction&&!['move','consumePillar','removeSprout'].includes(B.selectedAction)){
      const rs=abilityRangeState(u,B.selectedAction,x,y);
      if(rs?.inside)cl.push('skill-range');
      if(rs?.blocked)cl.push('range-blocked');
    }
    if(!phase&&u.controller==='human'&&B.selectedAction&&B.selectedAction!=='move'&&validTargetTile(x,y,B.selectedAction))cl.push('target');
    tiles+=isoTileMarkup(x,y,cl);
    if(isFixedObstacle(x,y))pieces+=isoObstacleMarkup(x,y);
    if(trap)pieces+=isoTrapMarkup(trap,x,y);
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
  if(B.onlinePreview){
    const onlineUnits=B.units.filter(z=>z?.onlineTeam);
    const skillNames=z=>(z?.loadout||[]).map(id=>ability(z.championId,id)?.name||id).join(' · ');
    const rows=onlineUnits.map(z=>`<small><strong>${z.side==='player'?'TU EQUIPO':'RIVAL'} · ${z.name}:</strong> ${skillNames(z)}</small>`).join('');
    if(B.onlinePhase==='turn-authority'){
      const active=cur(),mine=!!B.onlineLocalHasAuthority,pending=!!B.onlineActionPending;
      if(B.onlineDesync){
        controls=`<div class="online-turn-status online-turn-error"><b>⚠️ DESINCRONIZACIÓN</b><span>Sala ${B.onlineRoomCode||'—'} · Sec. ${B.onlineTurnSeq||1}</span><small>Acciones bloqueadas para evitar separar los estados.</small><button class="secondary online-leave-compact" id="onlineLeaveBattle" type="button">Abandonar</button></div><div class="hud online-turn-hud"><button disabled>👣<b>Mover</b></button><button class="end-turn" disabled>⏭️<b>Fin turno</b></button></div>`;
      }else if(mine){
        controls=`<div class="online-turn-status online-turn-mine"><b>🟢 TU TURNO</b><span>${active?.icon||''} ${active?.name||'—'} · Ronda ${B.round}</span><small>${pending?'Sincronizando acción…':'Movimiento habilitado · Habilidades todavía bloqueadas'}</small><button class="secondary online-leave-compact" id="onlineLeaveBattle" type="button">Abandonar</button></div><div class="hud online-turn-hud"><button id="onlineMove" class="${B.selectedAction==='move'?'active-action':''}" ${pending||active?.pm<=0?'disabled':''}>👣<b>Mover</b></button><button class="end-turn" id="onlineEnd" ${pending?'disabled':''}>⏭️<b>Fin turno</b></button></div>`;
      }else{
        controls=`<div class="online-turn-status online-turn-rival"><b>👁️ TURNO RIVAL</b><span>${active?.icon||''} ${active?.name||'—'} · Ronda ${B.round}</span><small>Modo observador · esperando Movimiento o Fin de turno.</small><button class="secondary online-leave-compact" id="onlineLeaveBattle" type="button">Abandonar</button></div><div class="hud online-turn-hud"><button disabled>👣<b>Mover</b></button><button class="end-turn" disabled>⏭️<b>Fin turno</b></button></div>`;
      }
    }else{
      controls=`<div class="online-preview-lock"><b>🌐 DESPLIEGUE SINCRONIZADO</b><span>Sala ${B.onlineRoomCode||'—'} · Equipo ${B.onlineLocalTeam||'—'}</span>${rows}<p>Ronda 1 preparada. Esperando la autoridad de turno compartida.</p><button class="secondary" id="onlineLeaveBattle" type="button">Abandonar partida</button></div>`;
    }
  }else if(phase){
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
    if(u.championId==='coloso'&&u.monolith)specialParts.push(`<button id="exitMonolith">Salir de Monolito · 0 PA</button><button id="consumePillar" ${u.monolithPillarGainUsed||!ownedPillars(u).length?'disabled':''}>Consumir Pilar · +1 PA</button>`);
    if(u.championId==='onod'&&ownedSprouts(u).length)specialParts.push(`<button id="removeSprout" class="${B.selectedAction==='removeSprout'?'active-action':''}">Retirar Brote · 0 PA</button>`);
    const special=specialParts.length?`<div class="special-actions">${specialParts.join('')}</div>`:'';
    controls=`<div class="hud">
      <button id="move" class="${B.selectedAction==='move'?'active-action':''}">👣<b>Mover</b></button>
      <button id="skills" class="${B.skillsOpen?'active-action':''}">✨<b>Habilidades</b></button>
      <button class="end-turn" id="end">⏭️<b>Fin turno</b></button>
    </div>
    <div class="skill-drawer ${B.skillsOpen?'open':'closed'}">${skillButtons}</div>
    ${special}
    ${B.selectedAction&&!['move','consumePillar','removeSprout'].includes(B.selectedAction)?`<div class="range-legend"><span><i class="swatch range"></i>Rango</span><span><i class="swatch valid"></i>Objetivo válido</span><span><i class="swatch blocked"></i>LOS bloqueada</span></div>`:''}
    <p class="combat-help">${B.selectedAction?'Tocá una casilla u objetivo resaltado.':'Tocá un combatiente o invocación para inspeccionarlo, o elegí una acción.'}</p>`;
  }else controls=`<div class="ai">🤖 ${u.side==='player'?'Tu aliado IA':'El rival IA'} está jugando…</div>`;
  const selectedAbility=!phase&&u.controller==='human'&&B.selectedAction&&!['move','consumePillar','removeSprout'].includes(B.selectedAction)?ability(u.championId,B.selectedAction):null;
  const logText=B.log.slice(-8).join('<br>')||'Comienza el combate.';
  const headTitle=B.onlinePreview?`ONLINE · RONDA ${B.round}`:(phase&&doll?`🪆 Muñeco · ${u.name}`:`Ronda ${B.round}`);
  const activeTurnLabel=phase&&doll?`${doll.icon} ${doll.name}`:`${u.side==='player'?'🔵':'🔴'} ${u.icon} ${u.name}`;
  app.innerHTML=`<section class="screen battle-screen">
    <div class="round-hud-panel hud-module ${hudClass('round')}">
      <div class="round-hud-tools">${hudControls('round')}</div>
      <div class="round-summary"><b>${headTitle}</b><span class="round-active">${activeTurnLabel}</span>${B.onlinePreview?(B.onlinePhase==='turn-authority'?`<span class="combat-timer ${B.timer<=10?'danger-time':''}">🔗 ⏱️ <b id="timer">${B.timer}s</b></span>`:`<span class="combat-timer">🔗 <b>SINCRONIZANDO</b></span>`):(phase?`<span class="combat-timer">👣 <b>${phase.pm} PM</b></span>`:`<span class="combat-timer ${B.timer<=10?'danger-time':''}">⏱️ <b id="timer">${B.timer}s</b></span>`)}<button class="reset-hud" id="resetHud" type="button" title="Restablecer HUD">↺</button></div>
      <div class="turn-order">${order}</div>
    </div>
    <div class="camera-hud-panel hud-module" aria-label="Controles de cámara">
      <button class="camera-hud-btn camera-drag hud-drag-handle" type="button" title="Mover controles de cámara" aria-label="Mover controles de cámara">⠿</button>
      <button class="camera-hud-btn" id="rotateCameraLeft" type="button" title="Girar vista 90° a la izquierda" aria-label="Girar vista 90 grados a la izquierda">↶</button>
      <button class="camera-hud-btn" id="rotateCameraRight" type="button" title="Girar vista 90° a la derecha" aria-label="Girar vista 90 grados a la derecha">↷</button>
    </div>
    ${B.notice?`<div class="enemy-action-banner">${B.notice}</div>`:''}
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
    $$('[data-skill]').forEach(b=>b.onclick=()=>{if(B.busy)return;const id=b.dataset.skill;if(B.selectedAction===id){B.selectedAction=null;B.pendingImpulseTargetId=null}else{B.selectedAction=id;B.pendingImpulseTargetId=null}B.skillsOpen=true;renderBattle()});
    $('#end')?.addEventListener('click',()=>{if(!B.busy)nextTurn()});
    $('#exitMonolith')?.addEventListener('click',exitMonolith);
    $('#consumePillar')?.addEventListener('click',selectConsumePillar);
    $('#removeSprout')?.addEventListener('click',selectRemoveSprout);
  }else $('#finishDoll')?.addEventListener('click',()=>{if(!B.busy)finishDollPhase()});
  $('#toggleLog')?.addEventListener('click',()=>{B.logOpen=!B.logOpen;renderBattle()});
  $('#onlineMove')?.addEventListener('click',()=>{
    if(!B?.onlineMode||!B.onlineLocalHasAuthority||B.onlineActionPending||B.onlineDesync)return;
    B.selectedAction=B.selectedAction==='move'?null:'move';B.skillsOpen=false;renderBattle();
  });
  $('#onlineEnd')?.addEventListener('click',()=>{if(B?.onlineMode&&!B.onlineActionPending)requestOnlineEndTurn()});
  $('#onlineLeaveBattle')?.addEventListener('click',()=>window.LigaOnline?.leave?.());
}

async function executeImpulse(u,target,x,y){
  const a=ability(u.championId,'impulse');
  if(!a||u.pa<a.cost||!skillUseAllowed(u,'impulse')||!impulseTargetValid(u,target)||!straightDashValidFrom(target,x,y,2))return false;
  B.busy=true;B.noticeSeq++;B.notice=`${u.icon} ${u.name} — ${a.icon} ${a.name}`;registerSkillUse(u,'impulse');u.pa-=a.cost;triggerPoisonOnAbility(u);renderBattle();await sleep(140);
  if(!u.alive){B.notice='';B.selectedAction=null;B.pendingImpulseTargetId=null;B.busy=false;renderBattle();checkBattleEnd();return true}
  await dashUnit(target,x,y);log(`💨 Impulso: ${target.name} se desplaza sin gastar PM.`);
  spendPAAfterAction(u);B.notice='';B.selectedAction=null;B.pendingImpulseTargetId=null;B.busy=false;renderBattle();if(checkBattleEnd())return true;if(B.pendingTimeout&&!B.ended){nextTurn();return true}return true;
}

async function battleTap(e){
  if(!B||B.ended||B.busy||cur().controller!=='human')return;if(B.onlineMode&&(!B.onlineLocalHasAuthority||B.onlineActionPending||B.onlineDesync))return;
  const t=e.target.closest('.tile');if(!t)return;
  const x=+t.dataset.x,y=+t.dataset.y,z=entityAt(x,y),u=cur();
  if(B.dollPhase){
    const doll=getEntity(B.dollPhase.dollId);
    if(z?.id===doll?.id){B.selectedUnitId=z.id;renderBattle();return}
    const ok=await moveDoll(x,y);if(!ok)showNotice('El Muñeco puede moverse sólo por casillas libres usando sus PM.');return;
  }
  if(!B.selectedAction){
    if(z){B.selectedUnitId=z.id;renderBattle()}return;
  }
  if(B.selectedAction==='move'){if(B.onlineMode){await requestOnlineMove(u,x,y);return}await moveUnit(u,x,y);if(!u.alive&&!B.ended)nextTurn();return}
  if(B.selectedAction==='consumePillar'){consumePillarForPA(x,y);return}
  if(B.selectedAction==='removeSprout'){removeSproutFree(x,y);return}
  if(B.selectedAction==='impulse'){
    if(!B.pendingImpulseTargetId){
      if(!impulseTargetValid(u,z)){showNotice('Elegí a Piplus o a un aliado dentro de alcance 3.');return}
      B.pendingImpulseTargetId=z.id;B.selectedUnitId=z.id;showNotice(`💨 Elegí el destino de ${z.name}: hasta 2 casillas en línea.`,1200);renderBattle();return;
    }
    const target=getUnit(B.pendingImpulseTargetId);
    if(!impulseDestinationValid(u,x,y)){showNotice('Destino inválido: hasta 2 casillas en línea y sin obstáculos.');return}
    await executeImpulse(u,target,x,y);if(!u.alive&&!B.ended)nextTurn();return;
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

function offensiveIds(u){return u.loadout.filter(id=>['sword','daggers','bow','spear','hammer','rock','quake','marker','precise','vector','rupture','thorn','vines','spores','shot','hook','needle','reflected','ritual'].includes(id))}
function validAbilityTargets(u,id){
  const out=[];
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)if(canUseAbility(u,id,x,y))out.push({x,y});
  return out;
}
function bestMoveForAI(u,target){
  const reach=movementMap(u),ids=offensiveIds(u).filter(id=>u.pa>=ability(u.championId,id).cost);
  let best=null,bestScore=1e9;
  for(const [k,cost] of reach){
    const [x,y]=k.split(',').map(Number),fake={...u,x,y};
    let score=md(fake,target)*10+cost;
    for(const id of ids){
      const a=ability(u.championId,id),r=effectiveRange(u,a);
      if(inRange(fake,target,r)&&(!requiresLOS(a)||clearLOSFrom(fake,target,u.id))){
        score-=50+(a.damage||0);
        if(u.championId==='arfeli'&&id==='bow'){
          score-=28;
          if(md(fake,target)>=3)score-=12;
        }
      }
    }
    if(score<bestScore){bestScore=score;best={x,y,cost}}
  }
  return best;
}
function clearLOSFrom(fake,b,ignoreId){
  return lineCells(fake,b).every(([x,y])=>{
    if(isFixedObstacle(x,y))return false;
    const z=entityAt(x,y);return !z||z.id===ignoreId||z.blocksLOS===false;
  });
}
function bestPillarTile(u,target){
  let best=null,score=1e9;
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    const pos={x,y};
    if(!free(x,y)||!inRange(u,pos,3)||!clearLOS(u,pos))continue;
    let s=md(pos,target)*5;
    if(adj8(pos,target))s-=22;
    if(ownedPillars(u).some(p=>adj8(p,pos)))s-=2;
    if(s<score){score=s;best={x,y}}
  }
  return best;
}
function aiCanAttackNow(u,target){
  return offensiveIds(u).some(id=>u.pa>=ability(u.championId,id).cost&&canUseAbility(u,id,target.x,target.y));
}
function aiHasUsefulPillarPlacement(u,target){
  if(!u.loadout.includes('pillar')||u.pa<2||ownedPillars(u).length>=(u.monolith?3:2))return false;
  const pt=bestPillarTile(u,target);
  return !!(pt&&adj8(pt,target));
}
function shouldAIExitMonolith(u,target){
  if(u.championId!=='coloso'||!u.monolith)return false;
  if(aiCanAttackNow(u,target))return false;
  if(aiHasUsefulPillarPlacement(u,target))return false;
  return true;
}
function chooseEnemyTarget(u){
  const foes=enemyUnits(u,true);
  if(!foes.length)return null;
  return [...foes].sort((a,b)=>{
    const sa=md(u,a)*8+(a.hp/a.maxHp)*5;
    const sb=md(u,b)*8+(b.hp/b.maxHp)*5;
    return sa-sb;
  })[0];
}
function chooseHealTarget(u,id,threshold=.72){
  return teamUnits(u,true)
    .filter(z=>z.hp<z.maxHp&&z.hp/z.maxHp<threshold&&canUseAbility(u,id,z.x,z.y))
    .sort((a,b)=>(a.hp/a.maxHp)-(b.hp/b.maxHp))[0]||null;
}
function chooseStoneArmorTarget(u){
  return teamUnits(u,true)
    .filter(z=>shieldTotal(z)<8&&canUseAbility(u,'stonearmor',z.x,z.y))
    .sort((a,b)=>(a.hp/a.maxHp)-(b.hp/b.maxHp))[0]||null;
}
function bestAttackPlay(u){
  let best=null,bestScore=-1e9;
  for(const target of enemyUnits(u,true)){
    for(const id of offensiveIds(u)){
      const a=ability(u.championId,id);if(!a||u.pa<a.cost||!canUseAbility(u,id,target.x,target.y))continue;
      let dmg=a.damage||0;
      if(id==='precise'&&getMarkedTarget(u)?.id===target.id)dmg=14;
      if(id==='ritual'&&ownedDoll(u)&&md(ownedDoll(u),target)<=2)dmg=18;
      const score=dmg*4+(1-target.hp/target.maxHp)*15-md(u,target);
      if(score>bestScore){bestScore=score;best={id,target}}
    }
  }
  return best;
}
function bestDollMove(doll,owner){
  const phase=B?.dollPhase;if(!phase||!doll?.alive)return null;
  const target=getEntity(doll.linkedTargetId)||chooseEnemyTarget(owner);
  if(!target)return null;
  const reach=objectMovementMap(doll,phase.pm);let best=null,bestScore=md(doll,target);
  for(const [k,cost] of reach){
    const [x,y]=k.split(',').map(Number),score=md({x,y},target)+cost*.05;
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
  if(B?.dollPhase&&!B.ended)setTimeout(finishDollPhase,220);
}

async function aiTurn(){
  if(!B||B.ended||cur().controller!=='ai'||B.busy)return;
  const u=cur();let t=chooseEnemyTarget(u);if(!t){checkBattleEnd();return}await sleep(350);
  if(shouldAIExitMonolith(u,t)){leaveMonolith(u,'La IA necesita recuperar movilidad.');B.notice=`🤖 ${u.name} sale de Monolito para volver a presionar.`;renderBattle();await sleep(280);B.notice=''}
  for(let cycle=0;cycle<8&&u.alive;cycle++){
    if(checkBattleEnd())return;
    t=chooseEnemyTarget(u);if(!t)break;

    if(u.championId==='piplus'&&u.loadout.includes('pulse')&&u.pa>=3){const ally=chooseHealTarget(u,'pulse');if(ally){await executeAbility(u,'pulse',ally.x,ally.y,true);await sleep(180);continue}}
    if(u.championId==='onod'&&u.loadout.includes('sap')&&u.pa>=3){const ally=chooseHealTarget(u,'sap');if(ally){await executeAbility(u,'sap',ally.x,ally.y,true);await sleep(180);continue}}
    if(u.championId==='coloso'&&u.loadout.includes('stonearmor')&&u.pa>=2){const ally=chooseStoneArmorTarget(u);if(ally&&ally.hp/ally.maxHp<.75){await executeAbility(u,'stonearmor',ally.x,ally.y,true);await sleep(180);continue}}

    if(u.championId==='piplus'&&!getMarkedTarget(u)&&u.loadout.includes('marker')&&canUseAbility(u,'marker',t.x,t.y)){await executeAbility(u,'marker',t.x,t.y,true);await sleep(180);continue}
    if(u.championId==='onod'&&u.loadout.includes('germinate')&&ownedSprouts(u).length>=2&&ownedSprouts(u).every(s=>md(s,t)>4)){const s=[...ownedSprouts(u)].sort((a,b)=>md(b,t)-md(a,t))[0];destroyPillar(s);log(`🌱 IA: ${u.name} retira ${s.name} para reubicarlo.`);renderBattle();await sleep(140);continue}
    if(u.championId==='onod'&&u.loadout.includes('germinate')&&ownedSprouts(u).length<2&&u.pa>=2){const pt=bestFreeTile(u,t,3,true);if(pt&&canUseAbility(u,'germinate',pt.x,pt.y)){await executeAbility(u,'germinate',pt.x,pt.y,true);await sleep(180);continue}}
    if(u.championId==='korgan'&&activeTraps(u).length<2&&u.pa>=2){const trapId=u.loadout.includes('trap_spikes')?'trap_spikes':u.loadout.includes('trap_snare')?'trap_snare':u.loadout.includes('trap_bomb')?'trap_bomb':null;const pt=trapId?bestFreeTile(u,t,3,true):null;if(pt&&canUseAbility(u,trapId,pt.x,pt.y)){await executeAbility(u,trapId,pt.x,pt.y,true);await sleep(180);continue}}
    if(u.championId==='houngan'&&!getLinkedTarget(u)&&u.loadout.includes('needle')&&canUseAbility(u,'needle',t.x,t.y)){await executeAbility(u,'needle',t.x,t.y,true);await sleep(180);continue}
    if(u.championId==='houngan'&&getLinkedTarget(u)&&u.loadout.includes('curse')){const linked=getLinkedTarget(u);if(linked&&linked.status.curseDamage===0&&canUseAbility(u,'curse',linked.x,linked.y)){await executeAbility(u,'curse',linked.x,linked.y,true);await sleep(180);continue}}
    if(u.championId==='houngan'&&getLinkedTarget(u)&&u.loadout.includes('doll')&&!ownedDoll(u)&&u.pa>=3){const linked=getLinkedTarget(u),pt=bestFreeTile(u,linked||t,3,false);if(pt&&canUseAbility(u,'doll',pt.x,pt.y)){await executeAbility(u,'doll',pt.x,pt.y,true);await sleep(180);continue}}

    if(u.championId==='coloso'&&u.monolith&&!u.monolithPillarGainUsed&&ownedPillars(u).length&&u.pa<3&&u.loadout.includes('rock')){const p=ownedPillars(u)[0],name=p.name;destroyPillar(p);u.pa+=1;u.monolithPillarGainUsed=true;feedback(u,'+1 PA','pa');log(`⚡ ${u.name} consume ${name} y obtiene +1 PA.`);renderBattle();await sleep(180);continue}
    if(u.championId==='coloso'&&u.loadout.includes('absorb')&&u.hp/u.maxHp<.55&&u.pa>=3){const p=ownedPillars(u).find(p=>inRange(u,p,3)&&clearLOS(u,p));if(p){await executeAbility(u,'absorb',p.x,p.y,true);await sleep(180);continue}}

    const attack=bestAttackPlay(u);
    if(attack){await executeAbility(u,attack.id,attack.target.x,attack.target.y,true);await sleep(220);if(checkBattleEnd())return;continue}

    const hostile=B.pillars.filter(p=>p.alive&&p.side!==u.side).sort((a,b)=>a.hp-b.hp);let objectPlay=null;
    for(const p of hostile){const ids=offensiveIds(u).filter(id=>u.pa>=ability(u.championId,id).cost&&canUseAbility(u,id,p.x,p.y)).sort((a,b)=>(ability(u.championId,b).damage||0)-(ability(u.championId,a).damage||0));if(ids.length){objectPlay={p,id:ids[0]};break}}
    if(objectPlay){await executeAbility(u,objectPlay.id,objectPlay.p.x,objectPlay.p.y,true);await sleep(200);continue}

    if(u.championId==='coloso'&&u.loadout.includes('fusion')&&!u.monolith&&!u.exitedMonolithThisTurn&&u.pa>=4){const p=ownedPillars(u).find(p=>adj8(u,p));if(p){await executeAbility(u,'fusion',p.x,p.y,true);await sleep(200);continue}}
    if(u.championId==='coloso'&&u.loadout.includes('pillar')&&u.pa>=2&&ownedPillars(u).length<(u.monolith?3:2)){const pt=bestPillarTile(u,t);if(pt&&md(u,t)>1){await executeAbility(u,'pillar',pt.x,pt.y,true);await sleep(180);continue}}
    if(u.championId==='arfeli'&&u.loadout.includes('shield')&&u.pa>=2&&shieldTotal(u)<8&&u.hp/u.maxHp<.8&&canUseAbility(u,'shield',u.x,u.y)){await executeAbility(u,'shield',u.x,u.y,true);await sleep(180);continue}

    const mv=bestMoveForAI(u,t);if(mv&&mv.cost>0&&u.pm>0){await moveUnit(u,mv.x,mv.y);await sleep(190);if(checkBattleEnd())return;continue}break;
  }
  if(!B.ended)setTimeout(nextTurn,350);
}


// ONLINE v0.6.38 — despliegue + autoridad validados; Movimiento normal y Fin de turno por comandos.
// Estructura preparada para separar equipo / controlador / unidad. El MVP sigue siendo 1v1.
function onlineRosterSnapshot(){
  return Object.values(CHAMPIONS).map(c=>({
    id:c.id,name:c.name,title:c.title,role:c.role,icon:c.icon,
    hp:c.hp,pa:c.pa,pm:c.pm,ini:c.ini,
    passive:{name:c.passive?.name||'',text:c.passive?.text||''},
    abilities:(c.abilities||[]).map(a=>({id:a.id,name:a.name,icon:a.icon,cost:a.cost,text:a.text||''}))
  }));
}
function cleanOnlineLoadout(championId,list){
  const valid=new Set((CHAMPIONS[championId]?.abilities||[]).map(a=>a.id));
  return Array.isArray(list)?list.filter(id=>valid.has(id)).slice(0,4):[];
}
function normalizeOnlineParticipants(cfg={}){
  return (Array.isArray(cfg.participants)?cfg.participants:[]).map((p,i)=>({
    team:String(p?.team||''),slotNumber:Number(p?.slotNumber)||i+1,controller:String(p?.controller||'PLAYER'),
    playerId:p?.playerId||null,championId:p?.championId,loadout:cleanOnlineLoadout(p?.championId,p?.loadout),
    deploymentReady:!!p?.deploymentReady,x:Number.isInteger(p?.x)?p.x:null,y:Number.isInteger(p?.y)?p.y:null
  })).filter(p=>p.team&&CHAMPIONS[p.championId]&&p.loadout.length===4);
}
function onlineUnitId(p){return `online-${p.team}-${p.slotNumber}`}
function onlineDeploymentPool(team){return team==='B'?ENEMY_DEPLOY:PLAYER_DEPLOY}
function onlineLocalUnit(){
  if(!B?.onlineMode)return null;
  return B.units.find(u=>u.onlineControllerId&&u.onlineControllerId===B.onlineLocalPlayerId)
    ||B.units.find(u=>u.onlineTeam===B.onlineLocalTeam&&u.controller==='human')
    ||B.units.find(u=>u.onlineTeam===B.onlineLocalTeam)
    ||null;
}
function buildOnlineUnits(cfg={}){
  const localTeam=cfg.localTeam==='B'?'B':'A',localPlayerId=cfg.localPlayerId||null;
  return normalizeOnlineParticipants(cfg).map(p=>{
    const sameTeam=p.team===localTeam,isLocal=p.playerId&&p.playerId===localPlayerId;
    const controller=p.controller==='AI'?'ai':(isLocal?'human':'remote');
    const u=makeUnit(p.championId,sameTeam?'player':'enemy',onlineUnitId(p),controller,p.loadout);
    u.onlineTeam=p.team;u.onlineSlotNumber=p.slotNumber;u.onlineControllerType=p.controller;u.onlineControllerId=p.playerId;
    // Facing canónico: A mira hacia B y B hacia A. La cámara transforma sólo la vista.
    u.facing=p.team==='B'?'izquierda':'derecha';
    if(p.deploymentReady&&Number.isInteger(p.x)&&Number.isInteger(p.y)){u.x=p.x;u.y=p.y}
    return u;
  });
}
function startOnlineDeployment(cfg={}){
  clearInterval(timerId);
  const participants=normalizeOnlineParticipants(cfg);
  if(participants.length<2)return false;
  const localTeam=cfg.localTeam==='B'?'B':'A';
  const units=buildOnlineUnits({...cfg,participants});
  if(!units.length)return false;
  B={
    mode:'online1v1',onlineMode:true,onlinePhase:'deployment',onlinePreview:false,
    onlineRoomCode:String(cfg.roomCode||''),onlineLocalTeam:localTeam,onlineLocalPlayerId:cfg.localPlayerId||null,
    onlineDeploymentConfirmed:false,onlineOpponentDeploymentReady:false,onlineDeploySending:false,onlineDeploySyncSig:'',
    onlineActionPending:false,onlineDesync:false,onlineTurnSeq:0,onlineTurnSyncSig:'',
    round:1,turn:0,timer:30,selectedAction:null,selectedUnitId:null,pendingImpulseTargetId:null,
    skillsOpen:false,logOpen:false,busy:false,pendingTimeout:false,notice:'',
    hudCollapsed:{player:true,enemy:true},hudBottomCollapsed:false,
    deployment:true,deployPos:null,camera:{x:0,y:0,rotation:localTeam==='B'?2:0},pillars:[],traps:[],dollPhase:null,
    nextPillarId:1,nextObjectId:1,nextTrapId:1,nextQuakeId:1,fxSeq:0,noticeSeq:0,
    log:[`🌐 Sala ${String(cfg.roomCode||'—')} · despliegue online iniciado.`],
    units,order:units.map(u=>u.id),ended:false,resultRecorded:false
  };
  const local=onlineLocalUnit();if(!local)return false;
  B.selectedUnitId=local.id;
  syncOnlineDeployment({...cfg,participants});
  return true;
}
function renderOnlineDeployment(){
  if(!B?.onlineMode||B.onlinePhase!=='deployment')return;
  const p=onlineLocalUnit();if(!p)return;
  const pool=onlineDeploymentPool(p.onlineTeam),confirmed=!!B.onlineDeploymentConfirmed;
  let tiles='',pieces='';
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    const k=key(x,y),valid=pool.includes(k)&&!isFixedObstacle(x,y),chosen=B.deployPos===k;
    const cl=['tile'];
    if(isFixedObstacle(x,y))cl.push('obstacle');
    if(valid&&!confirmed)cl.push('deploy');
    if(chosen)cl.push('deploy-chosen');
    tiles+=isoTileMarkup(x,y,cl);
    if(isFixedObstacle(x,y))pieces+=isoObstacleMarkup(x,y);
    // Durante el despliegue sólo se revela la miniatura propia. La rival aparece cuando ambos confirman.
    if(chosen){const preview={...p,x,y};pieces+=isoEntityMarkup(preview,p,preview)}
  }
  const ownState=confirmed?'✅ POSICIÓN CONFIRMADA':(B.deployPos?'Posición elegida · falta confirmar':'Elegí una casilla azul');
  const rivalState=B.onlineOpponentDeploymentReady?'✅ Rival confirmado':'⏳ Rival desplegando';
  app.innerHTML=`<section class="screen deployment-screen iso-deployment-screen online-deployment-screen">
    <div class="topbar"><b>🌐 Despliegue online · Sala ${B.onlineRoomCode||'—'}</b><span>Tu equipo ${B.onlineLocalTeam} · tu lado siempre abajo</span></div>
    <div class="card"><b>Elegí la posición de ${p.name}</b><p class="small">Sólo podés colocar tu propia miniatura. La posición rival permanece oculta hasta que ambos confirmen.</p><p class="small iso-help">${ownState}<br>${rivalState}</p></div>
    ${isoBoardMarkup(tiles,pieces)}
    <div class="deployment-actions"><button id="confirmOnlineDeploy" ${!B.deployPos||confirmed||B.onlineDeploySending?'disabled':''}>${confirmed?'CONFIRMADO':(B.onlineDeploySending?'ENVIANDO…':'CONFIRMAR POSICIÓN')}</button><button class="secondary" id="leaveOnlineDeploy">Abandonar partida</button></div>
  </section>`;
  $('#grid').onclick=e=>{
    if(confirmed||B.onlineDeploySending)return;
    const t=e.target.closest('.tile');if(!t)return;
    const k=key(+t.dataset.x,+t.dataset.y);
    if(!pool.includes(k)||isFixedObstacle(+t.dataset.x,+t.dataset.y))return;
    B.deployPos=k;renderOnlineDeployment();
  };
  $('#confirmOnlineDeploy')?.addEventListener('click',async()=>{
    if(!B.deployPos||B.onlineDeploymentConfirmed||B.onlineDeploySending)return;
    const [x,y]=B.deployPos.split(',').map(Number);
    B.onlineDeploySending=true;renderOnlineDeployment();
    const ok=await window.LigaOnline?.confirmDeployment?.({x,y});
    if(!ok&&B?.onlinePhase==='deployment'){B.onlineDeploySending=false;renderOnlineDeployment()}
  });
  $('#leaveOnlineDeploy')?.addEventListener('click',()=>window.LigaOnline?.leave?.());
}
function syncOnlineDeployment(cfg={}){
  if(!B?.onlineMode||B.onlinePhase!=='deployment')return false;
  const participants=normalizeOnlineParticipants(cfg);
  if(!participants.length)return false;
  const sig=participants.map(p=>`${p.team}:${p.slotNumber}:${p.deploymentReady?1:0}:${p.x??'-'}:${p.y??'-'}`).sort().join('|');
  const local=participants.find(p=>p.playerId&&p.playerId===B.onlineLocalPlayerId)||participants.find(p=>p.team===B.onlineLocalTeam);
  const rivals=participants.filter(p=>p.team!==B.onlineLocalTeam);
  for(const p of participants){
    const u=getUnit(onlineUnitId(p));if(!u)continue;
    if(p.deploymentReady&&Number.isInteger(p.x)&&Number.isInteger(p.y)){u.x=p.x;u.y=p.y}
  }
  B.onlineDeploymentConfirmed=!!local?.deploymentReady;
  B.onlineOpponentDeploymentReady=rivals.length>0&&rivals.every(p=>p.deploymentReady);
  B.onlineDeploySending=false;
  if(local?.deploymentReady&&Number.isInteger(local.x)&&Number.isInteger(local.y))B.deployPos=key(local.x,local.y);
  if(sig!==B.onlineDeploySyncSig){B.onlineDeploySyncSig=sig;renderOnlineDeployment()}
  return true;
}
function startOnlineRoundReady(cfg={}){
  const participants=normalizeOnlineParticipants(cfg);
  if(participants.length<2||participants.some(p=>!p.deploymentReady||!Number.isInteger(p.x)||!Number.isInteger(p.y)))return false;
  if(!B?.onlineMode||B.onlineRoomCode!==String(cfg.roomCode||'')){
    if(!startOnlineDeployment(cfg))return false;
  }
  for(const p of participants){const u=getUnit(onlineUnitId(p));if(u){u.x=p.x;u.y=p.y}}
  B.onlinePhase='round-ready';B.onlinePreview=true;B.deployment=false;B.deployPos=null;B.onlineDeploymentConfirmed=true;B.onlineOpponentDeploymentReady=true;
  B.round=1;B.timer=30;B.selectedAction=null;
  B.order=[...B.units].sort((a,b)=>b.ini-a.ini||String(a.onlineTeam).localeCompare(String(b.onlineTeam))||a.onlineSlotNumber-b.onlineSlotNumber).map(u=>u.id);
  B.turn=0;
  const local=onlineLocalUnit();if(local)B.selectedUnitId=local.id;
  B.log.push(`✅ Despliegue sincronizado. Ronda 1 preparada. ${cur()?.name||'—'} tiene la iniciativa.`);
  renderBattle();
  return true;
}
function onlineDeploymentError(message='Error al sincronizar el despliegue.'){
  if(!B?.onlineMode||B.onlinePhase!=='deployment')return;
  B.onlineDeploySending=false;B.notice=String(message||'Error al sincronizar el despliegue.');
  renderOnlineDeployment();
}

function onlineTurnReset(u){
  if(!u?.alive)return;
  u.pa=u.maxPa;
  u.pm=u.monolith?0:u.maxPm;
  u.exitedMonolithThisTurn=false;
  u.monolithPillarGainUsed=false;
  u.stoneArmorTargetsUsed=[];
  u.skillUsesThisTurn={};
  u.symbiosisUsed=false;
}
async function requestOnlineMove(u,x,y){
  if(!B?.onlineMode||B.onlinePhase!=='turn-authority'||!B.onlineLocalHasAuthority||B.onlineActionPending||B.onlineDesync)return false;
  const reach=movementMap(u),cost=reach.get(key(x,y));
  if(cost==null)return false;
  const path=gridPath(u,{x,y});if(path.length<2)return false;
  const command={
    from:{x:u.x,y:u.y},to:{x,y},
    path:path.map(([px,py])=>({x:px,y:py})),
    cost,pmBefore:u.pm,pmAfter:Math.max(0,u.pm-cost)
  };
  B.onlineActionPending=true;B.notice='🔗 Enviando movimiento…';renderBattle();
  const ok=await window.LigaOnline?.requestMove?.(command);
  if(!ok&&B?.onlineMode){
    B.onlineActionPending=false;B.notice='No se pudo sincronizar el movimiento.';B.selectedAction='move';renderBattle();
  }
  return !!ok;
}
async function requestOnlineEndTurn(){
  if(!B?.onlineMode||B.onlinePhase!=='turn-authority'||!B.onlineLocalHasAuthority||B.onlineActionPending||B.onlineDesync)return false;
  B.onlineActionPending=true;B.selectedAction=null;B.notice='🔗 Cerrando turno…';renderBattle();
  const ok=await window.LigaOnline?.requestEndTurn?.();
  if(!ok&&B?.onlineMode){B.onlineActionPending=false;B.notice='No se pudo sincronizar el Fin de turno.';renderBattle()}
  return !!ok;
}
function onlineAppliedActionSet(){
  if(!B.onlineAppliedActionSeqs)B.onlineAppliedActionSeqs=new Set();
  return B.onlineAppliedActionSeqs;
}
async function applyOnlineMoveAction(a){
  const seq=Number(a?.seq)||0,applied=onlineAppliedActionSet();
  if(seq&&applied.has(seq))return true;
  const actor=getUnit(onlineUnitId({team:String(a.actor_team||''),slotNumber:Number(a.actor_slot)||1}));
  const payload=a?.payload||{},result=a?.result||{},from=payload.from||{},to=payload.to||{};
  if(!actor?.alive||!Number.isInteger(from.x)||!Number.isInteger(from.y)||!Number.isInteger(to.x)||!Number.isInteger(to.y))return false;
  // Realtime + polling pueden entregar el mismo comando más de una vez. Si la unidad ya
  // está exactamente en el resultado esperado de ESA acción, se considera ya aplicada.
  const expectedPmAfter=Number(result.pmAfter);
  if(actor.x===to.x&&actor.y===to.y&&Number.isFinite(expectedPmAfter)&&actor.pm===expectedPmAfter){
    if(seq)applied.add(seq);B.onlineActionPending=false;B.notice='';renderBattle();return true;
  }
  if(actor.x!==from.x||actor.y!==from.y)return false;
  const reach=movementMap(actor),cost=reach.get(key(to.x,to.y));
  if(cost==null||cost!==Number(payload.cost))return false;
  await moveUnit(actor,to.x,to.y);
  if(actor.x!==to.x||actor.y!==to.y)return false;
  if(seq)applied.add(seq);
  B.onlineActionPending=false;B.notice='';renderBattle();
  return true;
}
async function syncOnlineActions(cfg={}){
  if(!B?.onlineMode)return false;
  const actions=Array.isArray(cfg.actions)?cfg.actions:[];
  const applied=onlineAppliedActionSet();
  for(const a of actions){
    const seq=Number(a?.seq)||0;
    if(seq&&applied.has(seq))continue;
    const type=String(a?.action_type||'');
    if(type==='move'){
      const ok=await applyOnlineMoveAction(a);
      if(!ok){
        B.onlineDesync=true;B.onlineActionPending=false;B.selectedAction=null;
        B.notice=`⚠️ Desincronización detectada en movimiento #${seq||'?'}.`;
        B.log.push(B.notice);renderBattle();
        return false;
      }
    }else if(type==='end_turn'){
      if(seq)applied.add(seq);
      B.log.push(`⏭️ Equipo ${String(a.actor_team||'—')} finaliza su turno.`);
    }
  }
  return true;
}
function onlineActionError(message='Error al sincronizar la acción.'){
  if(!B?.onlineMode)return;
  B.onlineActionPending=false;B.notice=String(message||'Error al sincronizar la acción.');renderBattle();
}
function updateOnlineAuthorityClock(){
  if(!B?.onlineMode||B.onlinePhase!=='turn-authority')return;
  const started=Date.parse(B.onlineTurnStartedAt||'');
  if(!Number.isFinite(started)){B.timer=30;return}
  const now=Date.now()+(Number(B.onlineClockOffsetMs)||0);
  const elapsed=Math.max(0,Math.floor((now-started)/1000));
  B.timer=Math.max(0,30-elapsed);
  const t=$('#timer');if(t){t.textContent=B.timer+'s';t.closest('.combat-timer')?.classList.toggle('danger-time',B.timer<=10)}
  const seq=Number(B.onlineTurnSeq)||0;
  if(B.timer<=0&&B.onlineLocalHasAuthority&&!B.onlineActionPending&&!B.onlineDesync&&Number(B.onlineTimeoutRequestedSeq)!==seq){
    B.onlineTimeoutRequestedSeq=seq;
    requestOnlineEndTurn().then(ok=>{
      if(!ok&&B?.onlineMode&&Number(B.onlineTurnSeq)===seq)B.onlineTimeoutRequestedSeq=0;
    });
  }
}
function startOnlineAuthorityClock(){
  clearInterval(timerId);updateOnlineAuthorityClock();
  timerId=setInterval(()=>{if(!B?.onlineMode||B.onlinePhase!=='turn-authority')return clearInterval(timerId);updateOnlineAuthorityClock()},250);
}
function stopOnlineSession(){
  if(!B?.onlineMode)return;
  clearInterval(timerId);timerId=null;B=null;
}
function syncOnlineTurnAuthority(cfg={}){
  if(!B?.onlineMode)return false;
  const participants=normalizeOnlineParticipants(cfg);
  if(participants.length<2)return false;
  const activeTeam=String(cfg.activeTeam||''),activeSlot=Number(cfg.activeSlot);
  const activeId=onlineUnitId({team:activeTeam,slotNumber:activeSlot});
  const idx=B.order.indexOf(activeId);if(idx<0)return false;
  const round=Math.max(1,Number(cfg.roundNumber)||1),seq=Math.max(1,Number(cfg.turnSeq)||1);
  const started=String(cfg.turnStartedAt||'');
  const sig=`${round}:${seq}:${activeTeam}:${activeSlot}:${started}`;
  const changed=sig!==B.onlineTurnSyncSig,turnChanged=seq!==Number(B.onlineTurnSeq||0);
  B.onlinePhase='turn-authority';B.onlinePreview=true;B.deployment=false;
  B.round=round;B.turn=idx;B.onlineTurnSeq=seq;B.onlineTurnStartedAt=started;B.onlineClockOffsetMs=Number(cfg.clockOffsetMs)||0;
  const active=cur();
  if(turnChanged&&active)onlineTurnReset(active);
  const hadLocalAuthority=!!B.onlineLocalHasAuthority;
  B.onlineLocalHasAuthority=!!(active&&active.onlineControllerType!=='AI'&&active.onlineControllerId&&active.onlineControllerId===B.onlineLocalPlayerId);
  // No borrar la acción seleccionada en cada polling: si seguimos en el mismo turno y
  // conservamos autoridad, Mover debe permanecer activo hasta ejecutar/cancelar.
  // Limpiar sólo cuando cambia realmente el turno o perdemos/ganamos autoridad.
  if(turnChanged||hadLocalAuthority!==B.onlineLocalHasAuthority||!B.onlineLocalHasAuthority){B.selectedAction=null;B.skillsOpen=false;}
  B.busy=false;B.selectedUnitId=active?.id||B.selectedUnitId;
  if(turnChanged){B.onlineActionPending=false;B.onlineTimeoutRequestedSeq=0;}
  updateOnlineAuthorityClock();
  if(changed){
    B.onlineTurnSyncSig=sig;
    B.notice='';
    B.log.push(`🔗 Autoridad sincronizada: ${active?.name||'—'} · Equipo ${active?.onlineTeam||'—'} · Ronda ${B.round}.`);
    renderBattle();startOnlineAuthorityClock();
  }
  return true;
}
window.LigaOnlineGame={
  roster:onlineRosterSnapshot,
  defaultSelection:()=>({championId:setup.championId,loadout:[...setup.loadout]}),
  startDeployment:startOnlineDeployment,
  syncDeployment:syncOnlineDeployment,
  startRoundReady:startOnlineRoundReady,
  deploymentError:onlineDeploymentError,
  syncTurnAuthority:syncOnlineTurnAuthority,
  syncActions:syncOnlineActions,
  actionError:onlineActionError,
  stopOnline:stopOnlineSession,
  version:()=>VERSION
};

showStart();
