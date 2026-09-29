(()=>{'use strict';

/*
  Liga de los Mundos — v0.6.31
  Muñecos Vudú — capa visual tardía y robusta.

  IMPORTANTE:
  - aliado -> muneco-houngan-01
  - enemigo -> muneco-houngan-02
  La elección se hace por linkMode, NUNCA por PV.
  Se muestra UNA sola imagen activa según facing + rotación de cámara.
*/

const ROOT='./assets/tactical/objects/';
const SETS={
  ally:{
    'down-right':ROOT+'muneco-houngan-01/down-right.png?v=0631',
    'down-left':ROOT+'muneco-houngan-01/down-left.png?v=0631',
    'up-left':ROOT+'muneco-houngan-01/up-left.png?v=0631',
    'up-right':ROOT+'muneco-houngan-01/up-right.png?v=0631'
  },
  enemy:{
    'down-right':ROOT+'muneco-houngan-02/down-right.png?v=0631',
    'down-left':ROOT+'muneco-houngan-02/down-left.png?v=0631',
    'up-left':ROOT+'muneco-houngan-02/up-left.png?v=0631',
    'up-right':ROOT+'muneco-houngan-02/up-right.png?v=0631'
  }
};

function visualDirection(facing='derecha',rotation=0){
  const vectors={derecha:[1,0],izquierda:[-1,0],abajo:[0,1],arriba:[0,-1]};
  let [dx,dy]=vectors[facing]||vectors.derecha;
  const r=((rotation%4)+4)%4;
  for(let i=0;i<r;i++) [dx,dy]=[-dy,dx];

  if(dx>0)return 'down-right';
  if(dx<0)return 'up-left';
  if(dy>0)return 'down-left';
  return 'up-right';
}

function activeDollMarkup(z){
  const mode=z?.linkMode==='ally'?'ally':'enemy';
  const set=SETS[mode];
  const rotation=(typeof B!=='undefined'&&B?.camera?.rotation)||0;
  const facing=z?.facing||(z?.side==='enemy'?'izquierda':'derecha');
  const dir=visualDirection(facing,rotation);
  const src=set[dir];

  return `<span class="unit-icon tactical-art-host doll-art-host hougan-doll-host hougan-doll-${mode}"
      data-combat-direction="${dir}">
      <img class="tactical-single-art doll-view hougan-doll-active-view"
        src="${src}" alt="" aria-hidden="true" draggable="false">
    </span>`;
}

if(typeof renderEntity==='function'&&!renderEntity.__houganVisual0631){
  const previous=renderEntity;

  const hooked=function(z,current,view){
    let html=previous(z,current,view);
    if(!z||z.kind!=='object'||z.type!=='doll')return html;
    if(typeof B!=='undefined'&&B?.deployment)return html;

    try{
      const host=activeDollMarkup(z);

      if(/<span class="unit-icon tactical-art-host doll-art-host[\s\S]*?<\/span>/.test(html)){
        html=html.replace(
          /<span class="unit-icon tactical-art-host doll-art-host[\s\S]*?<\/span>/,
          host
        );
      }else{
        html=html.replace(/<span class="unit-icon">[\s\S]*?<\/span>/,host);
      }

      html=html.replace(/\bdoll-hp-(?:16|30)\b/g,'');
      html=html.replace('tactical-doll-piece',`tactical-doll-piece hougan-doll-piece hougan-doll-${z.linkMode==='ally'?'ally':'enemy'}`);
      return html;
    }catch(_){
      return html;
    }
  };

  hooked.__houganVisual0631=true;
  renderEntity=hooked;
}

globalThis.LDMHouganVisual0631={SETS,visualDirection,activeDollMarkup};

})();