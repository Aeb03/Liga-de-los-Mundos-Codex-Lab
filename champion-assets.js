(()=>{
'use strict';

const CHAMPION_ART={
  arfeli:{name:'Arfeli',avatar:'./assets/champions/arfeli/arfeli-avatar.png',select:'./assets/champions/arfeli/arfeli-select.png'},
  coloso:{name:'Coloso',avatar:'./assets/champions/coloso/coloso-avatar.png',select:'./assets/champions/coloso/coloso-select.png'},
  piplus:{name:'Piplus',avatar:'./assets/champions/piplus/piplus-avatar.png',select:'./assets/champions/piplus/piplus-select.png'},
  onod:{name:'Onod',avatar:'./assets/champions/onod/onod-avatar.png',select:'./assets/champions/onod/onod-select.png'},
  korgan:{name:'Korgan',avatar:'./assets/champions/korgan/korgan-avatar.png',select:'./assets/champions/korgan/korgan-select.png'},
  houngan:{name:'Hougan',avatar:'./assets/champions/houngan/houngan-avatar.png',select:'./assets/champions/houngan/houngan-select.png'}
};

const CHAMPION_COMBAT_VIEWS={
  arfeli:{
    'down-right':'./assets/champions/arfeli/arfeli-combat-down-left.png?v=0538',
    'down-left':'./assets/champions/arfeli/arfeli-combat-down-right.png?v=0538',
    'up-right':'./assets/champions/arfeli/arfeli-combat-up-left.png?v=0538',
    'up-left':'./assets/champions/arfeli/arfeli-combat-up-right.png?v=0538'
  },
  coloso:{
    'down-right':'./assets/champions/coloso/coloso-combat-down-left.png?v=0538',
    'down-left':'./assets/champions/coloso/coloso-combat-down-right.png?v=0538',
    'up-right':'./assets/champions/coloso/coloso-combat-up-right.png?v=0538',
    'up-left':'./assets/champions/coloso/coloso-combat-up-left.png?v=0538'
  },
  piplus:{
    'down-right':'./assets/champions/piplus/piplus-combat-down-left.png?v=0538',
    'down-left':'./assets/champions/piplus/piplus-combat-down-right.png?v=0538',
    'up-right':'./assets/champions/piplus/piplus-combat-up-right.png?v=0538',
    'up-left':'./assets/champions/piplus/piplus-combat-up-left.png?v=0538'
  },
  onod:{
    'down-right':'./assets/champions/onod/onod-combat-down-left.png?v=0538',
    'down-left':'./assets/champions/onod/onod-combat-down-right.png?v=0538',
    'up-right':'./assets/champions/onod/onod-combat-up-right.png?v=0538',
    'up-left':'./assets/champions/onod/onod-combat-up-left.png?v=0538'
  },
  korgan:{
    'down-right':'./assets/champions/korgan/korgan-combat-down-left.png?v=0538',
    'down-left':'./assets/champions/korgan/korgan-combat-down-right.png?v=0538',
    'up-right':'./assets/champions/korgan/korgan-combat-up-left.png?v=0538',
    'up-left':'./assets/champions/korgan/korgan-combat-up-right.png?v=0538'
  },
  houngan:{
    'down-right':'./assets/champions/houngan/houngan-combat-down-left.png?v=0538',
    'down-left':'./assets/champions/houngan/houngan-combat-down-right.png?v=0538',
    'up-right':'./assets/champions/houngan/houngan-combat-up-left.png?v=0538',
    'up-left':'./assets/champions/houngan/houngan-combat-up-right.png?v=0538'
  }
};

for(const art of Object.values(CHAMPION_ART)){
  for(const src of [art.avatar,art.select]){
    const img=new Image();img.src=src;if(img.decode)img.decode().catch(()=>{});
  }
}
for(const views of Object.values(CHAMPION_COMBAT_VIEWS))for(const src of Object.values(views)){
  const img=new Image();img.src=src;if(img.decode)img.decode().catch(()=>{});
}

function setImage(host,src,cls,alt='',hostClass='champion-image-host'){
  if(!host)return;
  const current=host.querySelector(`img.${cls}`);
  if(current){if(current.src!==new URL(src,location.href).href)current.src=src;return}
  host.textContent='';
  host.classList.add(hostClass);
  const img=document.createElement('img');
  img.src=src;img.alt=alt;img.className=cls;img.draggable=false;
  host.appendChild(img);
}
function championByText(text=''){
  return Object.entries(CHAMPION_ART).find(([,a])=>new RegExp(`^${a.name}(?:\\s|$|·)`,'i').test(text.trim()))?.[0]||null;
}

function decorateChampionScreens(){
  for(const [id,art] of Object.entries(CHAMPION_ART)){
    document.querySelectorAll(`[data-champ="${id}"] .champ-icon`)
      .forEach(x=>setImage(x,art.select,'champion-select-img',art.name,'champion-select-host'));
    document.querySelectorAll(`[data-collection-champ="${id}"] .champ-icon`)
      .forEach(x=>setImage(x,art.select,'champion-select-img',art.name,'champion-collection-select-host'));
  }
  document.querySelectorAll('.champion-detail').forEach(card=>{
    const name=card.querySelector('.champion-detail-head h3')?.textContent?.trim();
    const found=Object.entries(CHAMPION_ART).find(([,a])=>a.name===name);
    if(found)setImage(card.querySelector('.detail-icon'),found[1].avatar,'champion-avatar-img',found[1].name);
  });
  document.querySelectorAll('.profile-card').forEach(card=>{
    const text=card.textContent||'';
    const found=Object.entries(CHAMPION_ART).find(([,a])=>new RegExp(`Campeón destacado:\\s*${a.name}`,'i').test(text));
    if(found)setImage(card.querySelector('.profile-avatar'),found[1].avatar,'champion-avatar-img',found[1].name);
  });
}

function decorateHud(){
  document.querySelectorAll('.battle-roster-item').forEach(row=>{
    const name=row.querySelector('.battle-roster-copy b')?.textContent?.trim();
    const found=Object.entries(CHAMPION_ART).find(([,a])=>a.name===name);
    if(found)setImage(row.querySelector('.battle-roster-icon'),found[1].avatar,'champion-avatar-img',found[1].name);
  });
  document.querySelectorAll('.fighter-panel').forEach(panel=>{
    const id=championByText(panel.querySelector('.fighter-name b')?.textContent||'');
    if(id)setImage(panel.querySelector('.fighter-avatar'),CHAMPION_ART[id].avatar,'champion-avatar-img',CHAMPION_ART[id].name);
  });
  document.querySelectorAll('.turn-chip').forEach(chip=>{
    const name=chip.querySelector('.turn-name')?.textContent?.trim();
    const found=Object.entries(CHAMPION_ART).find(([,a])=>a.name===name);
    if(found)setImage(chip.querySelector('.turn-icon'),found[1].avatar,'champion-avatar-img',found[1].name);
  });
  const active=document.querySelector('.round-active');
  if(active&&!active.querySelector('.champion-round-avatar')){
    const text=active.textContent||'';
    const found=Object.entries(CHAMPION_ART).find(([,a])=>new RegExp(a.name,'i').test(text));
    if(found){
      const team=text.includes('🔴')?'🔴':'🔵';
      active.innerHTML=`<span class="champion-round-team">${team}</span><img class="champion-round-avatar" src="${found[1].avatar}" alt=""><span>${found[1].name}</span>`;
    }
  }
}

function combatVisualDirection(facing,rotation=0){
  const vectors={derecha:[1,0],izquierda:[-1,0],abajo:[0,1],arriba:[0,-1]};
  let [dx,dy]=vectors[facing]||vectors.derecha;
  const r=((rotation%4)+4)%4;
  for(let i=0;i<r;i++) [dx,dy]=[-dy,dx];
  if(dx>0)return 'down-right';
  if(dx<0)return 'up-left';
  if(dy>0)return 'down-left';
  return 'up-right';
}

function championCombatImages(id,active){
  return Object.entries(CHAMPION_COMBAT_VIEWS[id]).map(([dir,src])=>
    `<img class="champion-combat-img ${id}-combat-${dir}${dir===active?' is-active':''}" src="${src}" alt="" aria-hidden="true" draggable="false">`
  ).join('');
}

function installChampionBattleHook(){
  if(typeof renderEntity!=='function'||renderEntity.__championFourViews)return;
  const original=renderEntity;
  const hooked=function(z,current,view){
    let html=original(z,current,view);
    const id=z?.championId;
    if(!z||z.kind!=='unit'||!CHAMPION_COMBAT_VIEWS[id])return html;

    const rotation=(typeof B!=='undefined'&&B?.camera?.rotation)||0;
    const dir=combatVisualDirection(z.facing,rotation);

    html=html.replace('<div class="unit-piece ','<div class="unit-piece champion-'+id+' ');
    const oldIcon=`<span class="unit-icon">${z.icon}</span>`;
    const newIcon=`<span class="unit-icon champion-combat-host" data-combat-direction="${dir}">${championCombatImages(id,dir)}</span>`;
    return html.replace(oldIcon,newIcon);
  };
  hooked.__championFourViews=true;
  renderEntity=hooked;
}

installChampionBattleHook();

function decorate(){decorateChampionScreens();decorateHud()}
let queued=false;
function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;decorate()})}
new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',decorate,{once:true});else decorate();
})();
