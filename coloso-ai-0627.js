(()=>{'use strict';

/*
  Liga de los Mundos — v0.6.27-v02
  IA de Coloso adaptada al rework.
  Se ejecuta después de ai-approach.
*/

const _coloso0627BaseAiTurn=aiTurn;

aiTurn=async function(){
  if(!B||B.ended||cur()?.controller!=='ai'||B.busy)return;
  const u=cur();

  if(u?.championId!=='coloso'){
    return await _coloso0627BaseAiTurn();
  }

  await globalThis.LDMColoso0627?.aiPrepareTurn?.(u);

  if(B?.ended||!u.alive||cur()?.id!==u.id)return;
  return await _coloso0627BaseAiTurn();
};

})();