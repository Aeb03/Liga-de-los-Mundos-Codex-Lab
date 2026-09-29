(()=>{'use strict';

/* Liga de los Mundos v0.6.33
   Recupera SFX YA EXISTENTES cuando una mecánica conservada pasó a ser
   una acción propia y dejó de atravesar executeAbility().
   No inventa sonidos para habilidades nuevas. */

function cue(key,tag){
  try{window.LigaAudio?.play?.(key,{dedupe:tag||key,dedupeMs:140});}catch(_){}
}

function wrapGlobal(name,marker,after){
  const fn=globalThis[name];
  if(typeof fn!=='function'||fn[marker])return false;
  const wrapped=function(...args){
    const result=fn.apply(this,args);
    try{after(result,args)}catch(_){}
    return result;
  };
  wrapped[marker]=true;
  globalThis[name]=wrapped;
  return true;
}

function install(){
  /* Coloso — Crear Pilar conserva el SFX histórico de creación de pilar. */
  wrapGlobal('executeColosoOwnAction','__ligaAudioCompat0633', (ok,args)=>{
    if(ok&&args[0]==='colosoCreatePillar')cue('coloso.creacion_pilar','own:coloso:pillar');
  });

  /* Piplus — Marcar Objetivo conserva el SFX histórico de Marca. */
  wrapGlobal('executeMarkTarget','__ligaAudioCompat0633', (ok,args)=>{
    const u=args[0];
    if(ok)cue('piplus.marca',`own:piplus:mark:${u?.id||''}`);
  });

  /* Onod — Germinar conserva su SFX. */
  wrapGlobal('executeOnodOwnAction','__ligaAudioCompat0633', (ok,args)=>{
    if(ok&&args[0]==='onodGerminate')cue('onod.germinar','own:onod:germinate');
  });

  /* Hougan — Muñeco Vudú conserva el SFX de la antigua Efigie. */
  wrapGlobal('executeDollAction','__ligaAudioCompat0633', (ok,args)=>{
    const u=args[0];
    if(ok)cue('houngan.efigie',`own:hougan:doll:${u?.id||''}`);
  });
}

install();
window.addEventListener('load',install,{once:true});
window.LigaAudioCompat0633={install};

})();
