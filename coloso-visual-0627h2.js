(()=>{'use strict';

/*
  Liga de los Mundos v0.6.27h2-v02
  Monolito — render visual robusto

  En vez de depender de cuatro <img> superpuestos + clases de visibilidad,
  se renderiza UNA imagen activa por vez, tomada del set oficial de 4 vistas.
  La vista se recalcula en cada render según facing + rotación de cámara.
*/

const ROOT='./assets/tactical/objects/monolito-coloso/';
const VIEWS={
  'down-right':ROOT+'down-right.png?v=0627h2',
  'down-left':ROOT+'down-left.png?v=0627h2',
  'up-left':ROOT+'up-left.png?v=0627h2',
  'up-right':ROOT+'up-right.png?v=0627h2'
};

function monolithDirection(facing='derecha',rotation=0){
  const vectors={derecha:[1,0],izquierda:[-1,0],abajo:[0,1],arriba:[0,-1]};
  let [dx,dy]=vectors[facing]||vectors.derecha;
  const r=((Number(rotation)||0)%4+4)%4;
  for(let i=0;i<r;i++) [dx,dy]=[-dy,dx];

  if(dx>0)return 'down-right';
  if(dx<0)return 'up-left';
  if(dy>0)return 'down-left';
  return 'up-right';
}

function monolithHost(z){
  const rotation=(typeof B!=='undefined'&&B?.camera?.rotation)||0;
  const dir=monolithDirection(z?.facing,rotation);
  const src=VIEWS[dir]||VIEWS['down-right'];

  return `<span class="unit-icon monolith-direct-host monolith-art-host"
    data-combat-direction="${dir}" data-monolith-view="${dir}">
    <img class="monolith-active-view" src="${src}" alt="" aria-hidden="true" draggable="false">
  </span>`;
}

function forceMonolith(html,z){
  if(!z||z.kind!=='unit'||z.championId!=='coloso'||!z.monolith)return html;

  const host=monolithHost(z);

  // Reemplaza cualquier variante previa del contenedor visual:
  // emoji base, campeón de 4 vistas o hook táctico antiguo.
  const iconRx=/<span class="unit-icon[^"]*"[^>]*>[\s\S]*?<\/span>/;
  if(iconRx.test(html)) html=html.replace(iconRx,host);

  if(!/\btactical-monolith-piece\b/.test(html)){
    html=html.replace('monolith-piece','monolith-piece tactical-monolith-piece');
  }

  return html;
}

if(typeof renderEntity==='function'){
  const previous=renderEntity;
  const hooked=function(z,current,view){
    return forceMonolith(previous(z,current,view),z);
  };
  hooked.__colosoVisual0627h2=true;
  renderEntity=hooked;
}

globalThis.LDMColosoVisual0627h2={
  VIEWS,
  direction:monolithDirection,
  force:forceMonolith
};

})();