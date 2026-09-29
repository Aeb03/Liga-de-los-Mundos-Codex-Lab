(()=>{'use strict';

/*
  Liga de los Mundos — v0.6.32
  Transferencia de Dolor — capa final de daño.

  Se carga DESPUÉS de combat-core:
  cada mitad pasa por la cadena final de Escudo + daño real.
*/

const _painBaseApplyDamage=applyDamage;

applyDamage=function(target,amount,ignoreShield=false,...rest){
  if(
    !target?.alive||
    target.championId!=='houngan'||
    !globalThis.LDMHougan0632?.painTransferStateValid?.(target)||
    !(Number(amount)>0)
  ){
    const out=_painBaseApplyDamage(target,amount,ignoreShield,...rest);
    if(target?.championId==='houngan'){
      globalThis.LDMHougan0632?.pruneHouganStates?.(target);
    }
    return out;
  }

  const state=target.houganPainTransfer;
  const doll=getEntity(state.dollId);

  if(!doll?.alive){
    globalThis.LDMHougan0632?.clearPainTransfer?.(target,'el Muñeco fue destruido');
    return _painBaseApplyDamage(target,amount,ignoreShield,...rest);
  }

  const requested=Math.max(0,Number(amount)||0);
  const houganShare=Math.ceil(requested/2);
  const dollShare=Math.floor(requested/2);

  log(`🩸 Transferencia de Dolor: ${requested} daño se divide ${houganShare} para ${target.name} y ${dollShare} para ${doll.name}.`);

  // Si el número es impar, Hougan recibe la parte mayor.
  const houganReturn=_painBaseApplyDamage(target,houganShare,ignoreShield,...rest);

  // La parte del Muñeco pasa por su Escudo y luego por su efecto de PV real.
  // Si el Muñeco no aguanta toda su mitad, el exceso NO vuelve a Hougan.
  if(dollShare>0&&doll.alive){
    _painBaseApplyDamage(doll,dollShare,ignoreShield,...rest);
  }

  if(!doll.alive){
    globalThis.LDMHougan0632?.clearPainTransfer?.(target,'el Muñeco fue destruido');
  }else{
    globalThis.LDMHougan0632?.pruneHouganStates?.(target);
  }

  return houganReturn;
};

globalThis.LDMHouganDamage0632={installed:true};

})();