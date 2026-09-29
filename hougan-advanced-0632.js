(()=>{'use strict';

/*
  Liga de los Mundos — v0.6.32-v02
  HOUGAN — BLOQUE 2

  Agrega:
  - Transferencia de Dolor.
  - Danza Vudú.
  - Copia paso a paso del movimiento del Muñeco.
  - Ciclo de vida de ambos estados.
  - Definición final de 6 habilidades.

  El reparto de daño de Transferencia de Dolor se instala en
  hougan-damage-0632.js DESPUÉS de combat-core para trabajar sobre
  la cadena final de daño/escudos.
*/

const HOUGAN_ID='houngan';
const ADVANCED_SKILLS=new Set(['paintransfer','dance']);

function isHougan(u){return !!u&&u.championId===HOUGAN_ID}
function baseApi(){return globalThis.LDMHougan0631}
function currentLinked(u){return getLinkedTarget(u)}
function currentDoll(u){return ownedDoll(u)}

function matchingDoll(u){
  const d=currentDoll(u),target=currentLinked(u);
  if(!d?.alive||!target?.alive)return null;
  if(d.linkedTargetId!==target.id)return null;
  if(!baseApi()?.dollAssociationActive?.(d))return null;
  return d;
}

function painTransferStateValid(u){
  const s=u?.houganPainTransfer;
  if(!isHougan(u)||!s)return false;
  const d=getEntity(s.dollId),target=getEntity(s.targetId);
  return !!(
    u.alive&&d?.alive&&target?.alive&&
    currentLinked(u)?.id===s.targetId&&
    d.id===currentDoll(u)?.id&&
    d.linkedTargetId===s.targetId&&
    baseApi()?.dollAssociationActive?.(d)
  );
}

function clearPainTransfer(u,reason=''){
  if(!u?.houganPainTransfer)return false;
  u.houganPainTransfer=null;
  if(reason)log(`🩸 Transferencia de Dolor termina: ${reason}.`);
  return true;
}

function danceStateValid(u){
  const s=u?.houganDance;
  if(!isHougan(u)||!s)return false;
  const d=getEntity(s.dollId),target=getEntity(s.targetId);
  return !!(
    u.alive&&d?.alive&&target?.alive&&
    currentLinked(u)?.id===s.targetId&&
    currentDoll(u)?.id===s.dollId&&
    d.linkedTargetId===s.targetId&&
    baseApi()?.dollAssociationActive?.(d)
  );
}

function clearDance(u,reason=''){
  if(!u?.houganDance)return false;
  u.houganDance=null;
  if(reason)log(`🪆 Danza Vudú termina: ${reason}.`);
  return true;
}

function pruneHouganStates(u,reason=''){
  if(!isHougan(u))return;
  if(u.houganPainTransfer&&!painTransferStateValid(u)){
    clearPainTransfer(u,reason||'el Vínculo o el Muñeco ya no coinciden');
  }
  if(u.houganDance&&!danceStateValid(u)){
    clearDance(u,reason||'el Vínculo o el Muñeco ya no coinciden');
  }
}

// ------------------------------------------------------------
// Definición final — 6 habilidades
// ------------------------------------------------------------

function installAdvancedAbilities(){
  const c=CHAMPIONS?.[HOUGAN_ID];
  if(!c)return false;

  const existing=(c.abilities||[]).filter(a=>!ADVANCED_SKILLS.has(a.id));
  existing.push(
    {
      id:'paintransfer',icon:'🩸',name:'Transferencia de Dolor',
      cost:3,range:0,noLOS:true,
      text:'Requiere Vínculo actual y el Muñeco correspondiente activo. Mientras ambos sigan coincidiendo, todo daño que reciba Hougan se divide 50/50 entre Hougan y el Muñeco; si el daño es impar, Hougan recibe la parte mayor. La parte enviada al Muñeco activa normalmente su efecto según los PV reales que pierda. Si el Muñeco no soporta toda su parte, el excedente no vuelve a Hougan. El efecto termina si cambia el Vínculo o el Muñeco deja de corresponder o es destruido.'
    },
    {
      id:'dance',icon:'🪆',name:'Danza Vudú',
      cost:3,range:0,noLOS:true,
      text:'Requiere Vínculo actual y el Muñeco correspondiente activo. En la fase de movimiento del Muñeco posterior a este turno, cada casilla que recorra hace que el Vinculado intente moverse 1 casilla en la misma dirección, sin gastar PM. Copia cada cambio de dirección. Ese movimiento activa Herida y trampas. Si un paso del Vinculado está bloqueado, ese paso simplemente falla: no hay daño de colisión y la Danza continúa.'
    }
  );

  c.abilities=existing;
  BOT_LOADOUTS.houngan=['needle','transfer','paintransfer','dance'];
  return true;
}
installAdvancedAbilities();

// ------------------------------------------------------------
// Estado inicial
// ------------------------------------------------------------

const _advBaseMakeUnit=makeUnit;
makeUnit=function(...args){
  const u=_advBaseMakeUnit(...args);
  if(isHougan(u)){
    u.houganPainTransfer=null;
    u.houganDance=null;
  }
  return u;
};

// ------------------------------------------------------------
// Si cambia el Vínculo, cortar estados persistentes que ya no coinciden.
// ------------------------------------------------------------

const _advBaseSetLinkedTarget=setLinkedTarget;
setLinkedTarget=function(u,target){
  const before=u?.linkedTargetId||null;
  const out=_advBaseSetLinkedTarget(u,target);
  if(isHougan(u)&&before!==(u.linkedTargetId||null)){
    pruneHouganStates(u,'cambió el Vínculo');
  }
  return out;
};
clearLinkedTarget=function(u){return setLinkedTarget(u,null)};

// ------------------------------------------------------------
// Validación de habilidades
// ------------------------------------------------------------

function painTransferAvailable(u){
  return !!(
    isHougan(u)&&u.alive&&u.pa>=3&&
    matchingDoll(u)&&
    !painTransferStateValid(u)
  );
}

function danceAvailable(u){
  return !!(
    isHougan(u)&&u.alive&&u.pa>=3&&
    matchingDoll(u)&&
    !danceStateValid(u)
  );
}

const _advBaseAbilityRangeState=abilityRangeState;
abilityRangeState=function(u,id,x,y){
  if(isHougan(u)&&ADVANCED_SKILLS.has(id)){
    return x===u.x&&y===u.y?{inside:true,blocked:false}:null;
  }
  return _advBaseAbilityRangeState(u,id,x,y);
};

const _advBaseCanUseAbility=canUseAbility;
canUseAbility=function(u,id,x,y){
  if(!isHougan(u)||!ADVANCED_SKILLS.has(id)){
    return _advBaseCanUseAbility(u,id,x,y);
  }

  const a=ability(HOUGAN_ID,id);
  if(!a||!u.loadout.includes(id)||u.pa<a.cost||B.busy||!skillUseAllowed(u,id))return false;
  if(x!==u.x||y!==u.y)return false;

  if(id==='paintransfer')return painTransferAvailable(u);
  if(id==='dance')return danceAvailable(u);
  return false;
};

const _advBaseInvalidReason=invalidAbilityReason;
invalidAbilityReason=function(u,id,x,y){
  if(!isHougan(u)||!ADVANCED_SKILLS.has(id)){
    return _advBaseInvalidReason(u,id,x,y);
  }

  const a=ability(HOUGAN_ID,id);
  if(!a)return 'Habilidad no disponible.';
  if(u.pa<a.cost)return 'PA insuficientes.';
  if(!skillUseAllowed(u,id))return `${a.name}: límite de usos por turno alcanzado.`;
  if(x!==u.x||y!==u.y)return `Tocá a Hougan para usar ${a.name}.`;

  const target=currentLinked(u);
  if(!target)return 'Necesitás un personaje Vinculado.';
  const d=currentDoll(u);
  if(!d?.alive)return 'Necesitás un Muñeco Vudú activo.';
  if(d.linkedTargetId!==target.id||!baseApi()?.dollAssociationActive?.(d)){
    return 'El Muñeco actual no corresponde al Vínculo actual.';
  }

  if(id==='paintransfer'&&painTransferStateValid(u)){
    return 'Transferencia de Dolor ya está activa.';
  }
  if(id==='dance'&&danceStateValid(u)){
    return 'Danza Vudú ya está preparada para este movimiento del Muñeco.';
  }

  return 'Acción no válida.';
};

const _advBaseActionInfo=actionInfo;
actionInfo=function(id){
  const u=cur();
  if(isHougan(u)&&id==='paintransfer'){
    return {
      name:'Transferencia de Dolor',cost:'3 PA',
      text:ability(HOUGAN_ID,'paintransfer')?.text||'',
      target:'Hougan',range:'Personal · requiere Vínculo + Muñeco correspondiente'
    };
  }
  if(isHougan(u)&&id==='dance'){
    return {
      name:'Danza Vudú',cost:'3 PA',
      text:ability(HOUGAN_ID,'dance')?.text||'',
      target:'Hougan',range:'Personal · afecta la próxima fase del Muñeco'
    };
  }
  return _advBaseActionInfo(id);
};

// ------------------------------------------------------------
// Ejecución avanzada
// ------------------------------------------------------------

async function beginAdvancedSkill(u,id){
  if(!canUseAbility(u,id,u.x,u.y))return null;
  const a=ability(HOUGAN_ID,id);

  B.busy=true;
  B.noticeSeq++;
  B.notice=`${u.icon} ${u.name} — ${a.icon} ${a.name}`;
  registerSkillUse(u,id);
  u.pa-=a.cost;
  triggerPoisonOnAbility(u);
  renderBattle();
  await sleep(130);

  if(!u.alive){
    B.notice='';B.selectedAction=null;B.busy=false;
    renderBattle();checkBattleEnd();
    return {aborted:true};
  }
  return {a};
}

async function finishAdvancedSkill(u){
  spendPAAfterAction(u);
  B.notice='';
  B.selectedAction=null;
  B.busy=false;
  renderBattle();

  if(checkBattleEnd())return true;
  if(B.pendingTimeout&&!B.ended)nextTurn();
  return true;
}

const _advBaseExecuteAbility=executeAbility;
executeAbility=async function(u,id,x,y,fromAI=false){
  if(!isHougan(u)||!ADVANCED_SKILLS.has(id)){
    return _advBaseExecuteAbility(u,id,x,y,fromAI);
  }

  const ctx=await beginAdvancedSkill(u,id);
  if(!ctx)return false;
  if(ctx.aborted)return true;

  const d=matchingDoll(u);
  const target=currentLinked(u);

  if(id==='paintransfer'){
    u.houganPainTransfer={dollId:d.id,targetId:target.id};
    log(`🩸 Transferencia de Dolor: el daño dirigido a ${u.name} se dividirá con ${d.name} mientras el Vínculo y el Muñeco sigan coincidiendo.`);
    feedback(u,'🩸 DOLOR 50/50','status');
  }

  if(id==='dance'){
    u.houganDance={dollId:d.id,targetId:target.id};
    log(`🪆 Danza Vudú preparada: durante el próximo movimiento de ${d.name}, ${target.name} intentará copiar cada paso.`);
    feedback(u,'🪆 DANZA','status');
  }

  await sleep(120);
  return finishAdvancedSkill(u);
};

// ------------------------------------------------------------
// Danza: movimiento copiado paso a paso
// ------------------------------------------------------------

function occupiedForDance(x,y,linked,doll){
  return allEntities().some(z=>
    z.alive&&z.id!==linked.id&&z.id!==doll.id&&z.x===x&&z.y===y
  );
}

function danceStepDestinationValid(linked,doll,nx,ny){
  return !!(
    inside(nx,ny)&&
    !isFixedObstacle(nx,ny)&&
    !occupiedForDance(nx,ny,linked,doll)
  );
}

async function copyDanceStep(owner,doll,dx,dy){
  if(!danceStateValid(owner))return false;

  const state=owner.houganDance;
  const linked=getEntity(state.targetId);
  if(!linked?.alive){
    clearDance(owner,'el Vinculado quedó fuera de combate');
    return false;
  }

  const nx=linked.x+dx,ny=linked.y+dy;

  if(!danceStepDestinationValid(linked,doll,nx,ny)){
    log(`🪆 Danza Vudú: ${linked.name} no puede copiar ese paso; la Danza continúa.`);
    return false;
  }

  const old={x:linked.x,y:linked.y};
  linked.x=nx;linked.y=ny;
  faceStep(linked,old);

  // Movimiento forzado sin PM: Herida y trampas sí se activan.
  applyWoundStep(linked);
  log(`🪆 Danza Vudú: ${linked.name} copia el paso del Muñeco.`);

  renderBattle();
  await sleep(110);

  if(!linked.alive||checkBattleEnd()){
    clearDance(owner,'el Vinculado quedó fuera de combate');
    return true;
  }

  await triggerTrapAt(linked);

  if(!linked.alive){
    clearDance(owner,'el Vinculado quedó fuera de combate');
  }
  return true;
}

const _advBaseMoveDoll=moveDoll;
moveDoll=async function(x,y){
  const phase=B?.dollPhase;
  if(!phase||B.busy)return false;

  const doll=getEntity(phase.dollId);
  if(!doll?.alive)return finishDollPhase();

  const owner=getUnit(phase.ownerId);
  if(!isHougan(owner)){
    return _advBaseMoveDoll(x,y);
  }

  const reach=objectMovementMap(doll,phase.pm),cost=reach.get(key(x,y));
  if(cost==null)return false;
  const path=objectGridPath(doll,{x,y});
  if(path.length<2)return false;

  B.busy=true;
  let steps=0;

  for(let i=1;i<path.length&&doll.alive;i++){
    const old={x:doll.x,y:doll.y};
    const nx=path[i][0],ny=path[i][1];
    const dx=nx-old.x,dy=ny-old.y;

    doll.x=nx;doll.y=ny;
    faceStep(doll,old);
    steps++;
    phase.pm=Math.max(0,phase.pm-1);

    renderBattle();
    await sleep(100);

    // Cada paso del Muñeco dispara el intento de copia antes de continuar.
    if(danceStateValid(owner)){
      await copyDanceStep(owner,doll,dx,dy);
      if(B.ended){B.busy=false;return true}
    }

    // El Muñeco también entra normalmente en la casilla y activa trampas.
    await triggerTrapAt(doll);
    if(checkBattleEnd()){B.busy=false;return true}

    pruneHouganStates(owner);
  }

  if(steps)log(`🪆 ${doll.name} se mueve ${steps} casilla${steps!==1?'s':''}.`);
  B.busy=false;
  renderBattle();

  if(!doll.alive||phase.pm<=0){
    await sleep(150);
    finishDollPhase();
  }
  return true;
};

// Danza dura exactamente hasta finalizar esa fase de movimiento.
const _advBaseFinishDollPhase=finishDollPhase;
finishDollPhase=function(){
  const phase=B?.dollPhase;
  const owner=phase?getUnit(phase.ownerId):null;
  if(isHougan(owner)&&owner.houganDance){
    clearDance(owner,'finalizó el movimiento del Muñeco');
  }
  return _advBaseFinishDollPhase();
};

// ------------------------------------------------------------
// Indicadores visibles
// ------------------------------------------------------------

const _advBaseStatusChips=statusChips;
statusChips=function(u){
  let html=_advBaseStatusChips(u);
  if(!isHougan(u))return html;

  pruneHouganStates(u);

  const extra=[];
  if(painTransferStateValid(u))extra.push('<span class="state-chip control">🩸 Dolor 50/50</span>');
  if(danceStateValid(u))extra.push('<span class="state-chip control">🪆 Danza preparada</span>');
  if(!extra.length)return html;

  if(html.includes('state-empty'))return extra.join('');
  return html+extra.join('');
};

const _advBaseStatusText=statusText;
statusText=function(u){
  const base=_advBaseStatusText(u);
  if(!isHougan(u))return base;

  const extra=[];
  if(painTransferStateValid(u))extra.push('🩸 Transferencia de Dolor');
  if(danceStateValid(u))extra.push('🪆 Danza preparada');
  if(!extra.length)return base;

  return base==='Sin estados'?extra.join(' · '):`${base} · ${extra.join(' · ')}`;
};

const _advBaseRenderBattle=renderBattle;
renderBattle=function(...args){
  const out=_advBaseRenderBattle(...args);
  if(!B||B.ended)return out;

  const phase=B.dollPhase;
  if(phase){
    const owner=getUnit(phase.ownerId);
    if(isHougan(owner)&&danceStateValid(owner)){
      const linked=getEntity(owner.houganDance.targetId);
      const p=document.querySelector('.doll-phase-card p');
      if(p&&linked?.alive){
        p.textContent=`Danza Vudú activa: cada paso del Muñeco hará que ${linked.name} intente copiar la misma dirección. Tiene ${phase.pm}/${phase.maxPm} PM.`;
      }
    }
  }
  return out;
};

// ------------------------------------------------------------
// Helpers IA
// ------------------------------------------------------------

function dancePotential(u){
  const d=matchingDoll(u),target=currentLinked(u);
  if(!d||!target)return -99;

  let best=-6;
  const dirs=[[1,0],[-1,0],[0,1],[0,-1]];

  for(const [dx,dy] of dirs){
    const dxD=d.x+dx,dyD=d.y+dy;
    if(!inside(dxD,dyD)||isFixedObstacle(dxD,dyD)||entityAt(dxD,dyD))continue;

    const tx=target.x+dx,ty=target.y+dy;
    let score=1;

    if(danceStepDestinationValid(target,d,tx,ty)){
      score+=4;

      if(target.side!==u.side){
        // Sólo se consulta la red propia de trampas: nunca información oculta rival.
        if((B?.traps||[]).some(t=>t.active&&t.side===u.side&&t.x===tx&&t.y===ty))score+=12;
        score+=(target.status?.wound||0)*1.5;
        score+=Math.max(0,md(target,u)-md({x:tx,y:ty},u))*1.2;
      }else{
        const foes=enemyUnits(u,true);
        if(foes.length){
          const before=Math.min(...foes.map(e=>md(target,e)));
          const after=Math.min(...foes.map(e=>md({x:tx,y:ty},e)));
          if(target.hp/target.maxHp<.55)score+=(after-before)*2.5;
          else score+=(before-after)*1.1;
        }
      }
    }else{
      score-=2;
    }

    best=Math.max(best,score);
  }
  return best;
}

function bestDollPlacementTiles(u,focus=null){
  if(!baseApi()?.dollActionAvailable?.(u))return [];

  const linkedTarget=currentLinked(u);
  if(!linkedTarget)return [];

  const current=currentDoll(u);
  if(current?.alive&&baseApi()?.dollAssociationActive?.(current))return [];

  const out=[];
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    if(!baseApi()?.dollPlacementValid?.(u,x,y))continue;

    const p={x,y};
    let score=10;
    const dLink=md(p,linkedTarget);

    if(linkedTarget.side!==u.side){
      if(dLink===1)score+=u.loadout.includes('ritual')?11:6;
      else if(dLink===2)score+=4;
      score+=Math.max(0,5-dLink);
    }else{
      if(dLink===1)score+=5;
      score+=Math.max(0,(1-linkedTarget.hp/linkedTarget.maxHp)*7);
    }

    if(focus&&linkedTarget.side!==u.side&&focus.id===linkedTarget.id)score+=3;
    out.push({x,y,score});
  }
  return out.sort((a,b)=>b.score-a.score);
}

globalThis.LDMHougan0632={
  matchingDoll,
  painTransferStateValid,
  clearPainTransfer,
  danceStateValid,
  clearDance,
  pruneHouganStates,
  painTransferAvailable,
  danceAvailable,
  dancePotential,
  bestDollPlacementTiles,
  copyDanceStep,
  danceStepDestinationValid
};

})();