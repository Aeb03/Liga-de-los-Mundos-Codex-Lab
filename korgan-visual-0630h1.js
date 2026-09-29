(()=>{'use strict';

/*
  Liga de los Mundos — v0.6.30h1
  Korgan — render tardío de trampas

  Se carga DESPUÉS de tactical-assets para que ninguna capa posterior vuelva
  a ocultar o reemplace mal el arte de las trampas.
*/

const ROOT='./assets/tactical/objects/';
const ART={
  spikes:ROOT+'trampa-korgan.png?v=0630h1',
  mine:ROOT+'dispositivo-electrico.png?v=0630h1'
};

function viewerSide(){
  try{return humanUnit?.()?.side||null}catch(_){return null}
}

function directFriendlyTrapMarkup(trap,x,y){
  const mine=trap?.trapType==='mine';
  const src=mine?ART.mine:ART.spikes;
  const cls=mine?'device-art':'trap-art';

  return `<div class="iso-entity iso-trap tactical-trap korgan-friendly-trap"
    style="${isoEntityStyle(x,y,4)}"
    data-korgan-friendly-trap="1"
    aria-hidden="true">
      <span class="tactical-trap-host">
        <img class="tactical-single-art ${cls}"
          src="${src}" alt="" aria-hidden="true" draggable="false">
      </span>
    </div>`;
}

if(typeof isoTrapMarkup==='function'){
  const previous=isoTrapMarkup;

  isoTrapMarkup=function(trap,x,y){
    const side=viewerSide();

    if(trap?.hidden&&side){
      // Rival: cero pista visual.
      if(trap.side!==side)return '';

      // Propio equipo: siempre visible y semitransparente.
      return directFriendlyTrapMarkup(trap,x,y);
    }

    return previous(trap,x,y);
  };

  isoTrapMarkup.__korganVisual0630h1=true;
}

globalThis.LDMKorganVisual0630h1={ART,directFriendlyTrapMarkup};

})();