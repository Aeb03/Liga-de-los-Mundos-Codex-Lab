(()=>{'use strict';

/*
  v0.6.27h1 — seguridad visual de Monolito
  Se carga DESPUÉS de champion-assets y tactical-assets.
  Si el hook táctico histórico no reemplazó la miniatura de Coloso al entrar
  en Monolito, esta capa fuerza el set correcto de 4 vistas.
*/

const ROOT='./assets/tactical/objects/monolito-coloso/';
const MONOLITH={
  'down-right':ROOT+'down-right.png?v=0627h1',
  'down-left':ROOT+'down-left.png?v=0627h1',
  'up-left':ROOT+'up-left.png?v=0627h1',
  'up-right':ROOT+'up-right.png?v=0627h1'
};

function viewDirection(facing='derecha',rotation=0){
  const vectors={derecha:[1,0],izquierda:[-1,0],abajo:[0,1],arriba:[0,-1]};
  let [dx,dy]=vectors[facing]||vectors.derecha;
  const r=((rotation%4)+4)%4;
  for(let i=0;i<r;i++) [dx,dy]=[-dy,dx];
  if(dx>0)return 'down-right';
  if(dx<0)return 'up-left';
  if(dy>0)return 'down-left';
  return 'up-right';
}
function markup(dir){
  return Object.entries(MONOLITH).map(([key,src])=>
    `<img class="tactical-four-view monolith-view tactical-${key}${key===dir?' is-active':''}" src="${src}" alt="" aria-hidden="true" draggable="false">`
  ).join('');
}
function forceMonolithArt(html,z){
  if(!z||z.kind!=='unit'||z.championId!=='coloso'||!z.monolith)return html;

  // Si el hook táctico anterior ya lo resolvió, no duplicar.
  if(/monolith-view/.test(html))return html;

  const rotation=(typeof B!=='undefined'&&B?.camera?.rotation)||0;
  const dir=viewDirection(z.facing,rotation);
  const host=`<span class="unit-icon tactical-art-host monolith-art-host" data-combat-direction="${dir}">${markup(dir)}</span>`;

  if(/<span class="unit-icon champion-combat-host"[^>]*>[\s\S]*?<\/span>/.test(html)){
    html=html.replace(/<span class="unit-icon champion-combat-host"[^>]*>[\s\S]*?<\/span>/,host);
  }else if(/<span class="unit-icon tactical-art-host[^"]*"[^>]*>[\s\S]*?<\/span>/.test(html)){
    html=html.replace(/<span class="unit-icon tactical-art-host[^"]*"[^>]*>[\s\S]*?<\/span>/,host);
  }else{
    html=html.replace(/<span class="unit-icon">[\s\S]*?<\/span>/,host);
  }

  if(!/tactical-monolith-piece/.test(html)){
    html=html.replace('monolith-piece','monolith-piece tactical-monolith-piece');
  }
  return html;
}

if(typeof renderEntity==='function'){
  const base=renderEntity;
  renderEntity=function(z,current,view){
    return forceMonolithArt(base(z,current,view),z);
  };
}

globalThis.LDMColosoVisual0627h1={forceMonolithArt,viewDirection,MONOLITH};

})();