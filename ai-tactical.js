(()=>{'use strict';

/*
  Liga de los Mundos v0.6.27
  IA táctica única EXPERTA — 🟡 EN PRUEBA

  Principios:
  - misma IA para aliado y rival;
  - decisiones centradas en el turno actual;
  - planes simples (mover→habilidad, habilidad→habilidad, habilidad→mover);
  - reevaluación después de cada acción;
  - sin consulta de trampas enemigas ocultas;
  - sin counter-pick de loadout;
  - imperfección controlada entre planes de valor parecido.
*/

// ─────────────────────────────────────────────
// LOADOUTS IA — ALEATORIEDAD PONDERADA
// Se eligen usando ÚNICAMENTE championId.
// Nunca se consulta rival, equipo rival ni loadout humano.
// ─────────────────────────────────────────────

const AI_LOADOUT_POOLS={
  arfeli:[
    {w:4,set:['sword','daggers','bow','shield']},
    {w:3,set:['sword','daggers','hammer','shield']},
    {w:3,set:['sword','bow','spear','shield']},
    {w:2,set:['daggers','spear','hammer','shield']},
    {w:2,set:['sword','daggers','spear','hammer']}
  ],
  coloso:[
    {w:4,set:['rock','stonearmor','quake','collapse']},
    {w:4,set:['rock','absorb','quake','magnetism']},
    {w:3,set:['stonearmor','absorb','quake','collapse']},
    {w:3,set:['rock','stonearmor','collapse','magnetism']},
    {w:2,set:['rock','absorb','collapse','magnetism']}
  ],
  piplus:[
    {w:4,set:['marker','precise','vector','pulse']},
    {w:3,set:['marker','precise','rupture','pulse']},
    {w:3,set:['marker','vector','rupture','impulse']},
    {w:2,set:['precise','vector','impulse','pulse']},
    {w:2,set:['marker','precise','impulse','rupture']}
  ],
  onod:[
    {w:4,set:['germinate','thorn','sap','awakening']},
    {w:3,set:['germinate','thorn','vines','spores']},
    {w:3,set:['germinate','sap','spores','awakening']},
    {w:2,set:['germinate','vines','sap','awakening']},
    {w:2,set:['germinate','thorn','spores','awakening']}
  ],
  korgan:[
    {w:4,set:['trap_spikes','trap_snare','hook','shot']},
    {w:3,set:['trap_spikes','trap_bomb','hook','shot']},
    {w:3,set:['trap_snare','trap_bomb','hunterstep','shot']},
    {w:2,set:['trap_spikes','hook','hunterstep','trap_bomb']},
    {w:2,set:['trap_snare','hook','shot','hunterstep']}
  ],
  houngan:[
    {w:4,set:['needle','doll','curse','ritual']},
    {w:3,set:['needle','doll','transfer','ritual']},
    {w:3,set:['needle','doll','reflected','curse']},
    {w:2,set:['needle','doll','transfer','reflected']},
    {w:2,set:['needle','curse','transfer','ritual']}
  ]
};

function weightedChoice(items){
  const total=items.reduce((n,x)=>n+x.w,0);
  let r=Math.random()*total;
  for(const x of items){
    r-=x.w;
    if(r<=0)return x;
  }
  return items[items.length-1];
}
function chooseAILoadout(championId){
  const pool=AI_LOADOUT_POOLS[championId];
  if(!pool?.length)return [...(BOT_LOADOUTS[championId]||[])];
  // Único perfil IA: EXPERTA. Prioriza loadouts de mayor coherencia interna
  // sin consultar rival, equipo rival ni información oculta de combate.
  const ranked=[...pool].sort((a,b)=>b.w-a.w);
  const best=ranked[0].w;
  const coherent=ranked.filter(x=>x.w>=best-1).map(x=>({...x,w:x.w*x.w}));
  return [...weightedChoice(coherent).set];
}

const _aiBaseMakeUnit=makeUnit;
makeUnit=function(championId,side,id,controller='ai',customLoadout=null){
  const lockedLoadout=(controller==='ai'&&!customLoadout)?chooseAILoadout(championId):customLoadout;
  const u=_aiBaseMakeUnit(championId,side,id,controller,lockedLoadout);
  u.aiFocusTargetId=null;
  u.aiMode='offense';
  u.aiRevealedAbilities=[];
  u.aiLastPlanLabel='';
  u.aiDifficulty='expert';
  return u;
};

// Registrar habilidades sólo DESPUÉS de que realmente se usaron.
// La IA no consulta loadouts enemigos.
const _aiBaseExecuteAbility=executeAbility;
executeAbility=async function(u,id,x,y,fromAI=false){
  const ok=await _aiBaseExecuteAbility(u,id,x,y,fromAI);
  if(ok&&u?.kind==='unit'&&!u.aiRevealedAbilities.includes(id)){
    u.aiRevealedAbilities.push(id);
  }
  return ok;
};

// ─────────────────────────────────────────────
// INFORMACIÓN VISIBLE / OBJETIVOS
// ─────────────────────────────────────────────

function aiVisibleHostileObjects(u){
  return (B?.pillars||[]).filter(z=>z.alive&&z.side!==u.side);
}
function aiKnownFriendlyTraps(u){
  // Regla crítica: jamás devolver trampas enemigas.
  return (B?.traps||[]).filter(t=>t.active&&t.side===u.side);
}
function aiKnownTrapAt(u,x,y){
  return aiKnownFriendlyTraps(u).find(t=>t.x===x&&t.y===y)||null;
}
function aiMissingHp(z){return Math.max(0,(z.maxHp||0)-(z.hp||0))}
function aiEffectiveDamage(z,n){return Math.max(0,Math.min(z.hp||0,n||0))}
function aiKillBonus(z,n){return (z?.alive&&(n||0)>=(z.hp||Infinity))?28:0}
function aiNearestEnemyDistance(u,pos=u){
  const foes=enemyUnits(u,true);
  if(!foes.length)return 99;
  return Math.min(...foes.map(z=>md(pos,z)));
}
function aiVisibleThreat(u,z){
  if(!z?.alive)return 0;
  let score=8;
  score+=(z.pa||0)*.7;
  score+=(z.pm||0)*.4;
  if(md(u,z)<=1)score+=8;
  else if(md(u,z)<=3)score+=4;
  if(z.status?.markedBy)score+=2;
  if(z.status?.poison)score-=Math.min(3,z.status.poison);
  if(z.status?.wound)score-=Math.min(2,z.status.wound);
  // Sólo habilidades ya reveladas.
  for(const id of z.aiRevealedAbilities||[]){
    const a=ability(z.championId,id);
    score+=Math.min(4,(a?.damage||0)/5);
  }
  return score;
}
function aiObjectThreatValue(z){
  if(!z?.alive)return 0;
  if(z.type==='doll')return 12+(z.linkedTargetId?6:0);
  if(z.type==='sprout')return 9;
  if(z.type==='pillar')return 7+(shieldTotal(z)>0?2:0);
  return 4;
}

function aiSelectFocus(u){
  const foes=enemyUnits(u,true);
  if(!foes.length){u.aiFocusTargetId=null;return null}

  const previous=getUnit(u.aiFocusTargetId);
  let best=null,bestScore=-1e9;

  for(const z of foes){
    const killPressure=(1-z.hp/z.maxHp)*12;
    const accessibility=Math.max(0,8-md(u,z));
    const threat=aiVisibleThreat(u,z);
    const persistence=previous?.id===z.id?4:0;
    const score=killPressure+accessibility+threat+persistence;
    if(score>bestScore){bestScore=score;best=z}
  }

  // Persistencia: no cambiar por una diferencia mínima.
  if(previous?.alive){
    const prevScore=(1-previous.hp/previous.maxHp)*12+Math.max(0,8-md(u,previous))+aiVisibleThreat(u,previous)+4;
    if(prevScore>=bestScore-5)best=previous;
  }

  u.aiFocusTargetId=best?.id||null;
  return best;
}

// ─────────────────────────────────────────────
// POSICIONAMIENTO
// ─────────────────────────────────────────────

function aiRangeIdentity(u){
  if(u.championId==='arfeli'||u.championId==='coloso')return 'close';
  return 'ranged';
}
function aiPreferredBand(u){
  // Preferencia blanda: nunca obliga una casilla concreta.
  const bands={arfeli:[1,2],coloso:[1,3],piplus:[3,4],onod:[3,4],korgan:[3,4],houngan:[3,4]};
  return bands[u.championId]||[2,4];
}
function aiKnownEnemyReach(foe){
  let r=1;
  for(const id of foe.aiRevealedAbilities||[]){
    const a=ability(foe.championId,id);if(a)r=Math.max(r,effectiveRange?effectiveRange(foe,a):(a.range||1));
  }
  return r;
}
function aiCanThreatenFrom(u,pos,foe){
  return aiWithTemporaryPosition(u,pos,()=>u.loadout.some(id=>{
    const a=ability(u.championId,id);if(!a||u.pa<a.cost)return false;
    if(['shield','stonearmor','pulse','sap','pillar','germinate','doll','transfer','impulse','hunterstep'].includes(id))return false;
    try{return canUseAbility(u,id,foe.x,foe.y)}catch(_){return false}
  }));
}
function aiPositionScore(u,pos,focus){
  if(!focus)return 0;
  const d=md(pos,focus),band=aiPreferredBand(u);
  let s=0;
  if(d>=band[0]&&d<=band[1])s+=8;
  else s-=Math.min(8,Math.min(Math.abs(d-band[0]),Math.abs(d-band[1]))*2);

  const foes=enemyUnits(u,true);
  const adjacent=foes.filter(z=>md(pos,z)===1).length;
  if(aiRangeIdentity(u)==='ranged')s-=adjacent*8;
  else s-=Math.max(0,adjacent-1)*2;

  // Ventaja de alcance: amenazar sin regalar respuesta inmediata.
  for(const foe of foes){
    const fd=md(pos,foe),theirReach=aiKnownEnemyReach(foe);
    const weThreaten=aiCanThreatenFrom(u,pos,foe);
    if(weThreaten)s+=3;
    if(weThreaten&&fd>theirReach)s+=6;
    if(fd<=theirReach)s-=3;
    if(fd<=Math.max(1,theirReach-(foe.pm||0)))s-=2;
  }

  // Objetos propios: cercanía útil, sin amontonarse.
  for(const o of (B?.pillars||[]).filter(z=>z.alive&&z.side===u.side)){
    const od=md(pos,o);
    if((u.championId==='onod'&&o.type==='sprout')||(u.championId==='coloso'&&o.type==='pillar')||(u.championId==='houngan'&&o.type==='doll')){
      if(od>=1&&od<=3)s+=2;
    }
  }
  // Trampas conocidas enemigas nunca se consultan; las propias sirven para construir rutas de control.
  if(u.championId==='korgan'&&aiKnownFriendlyTraps(u).some(t=>md(pos,t)<=3))s+=2;
  return s;
}
function aiWoundTravelCost(u,steps){
  return Math.min(3,u.status?.wound||0)*Math.max(0,steps);
}
function aiWithTemporaryPosition(u,pos,fn){
  const ox=u.x,oy=u.y;
  u.x=pos.x;u.y=pos.y;
  try{return fn()}finally{u.x=ox;u.y=oy}
}

// ─────────────────────────────────────────────
// DESPLAZAMIENTO / TRAMPAS CONOCIDAS
// ─────────────────────────────────────────────

function aiForcedPath(source,target,distance,away=true){
  const [dx,dy]=forcedDirection(source,target,away);
  const out=[];
  let x=target.x,y=target.y;
  for(let i=0;i<distance;i++){
    const nx=x+dx,ny=y+dy;
    if(!inside(nx,ny)||isFixedObstacle(nx,ny)||entityAt(nx,ny))break;
    x=nx;y=ny;out.push({x,y});
  }
  return out;
}
function aiKnownTrapPathBonus(u,path){
  for(const p of path){
    if(aiKnownTrapAt(u,p.x,p.y))return 15;
  }
  return 0;
}
function aiForcedPositionValue(u,target,end){
  if(!target||!end)return 0;
  const before=md(u,target),after=md(u,end),band=aiPreferredBand(u);
  let v=0;
  // Para rango, crear separación sin perder participación es valioso; para melee, acercar puede serlo.
  if(aiRangeIdentity(u)==='ranged'){
    if(after>=band[0]&&after<=band[1])v+=5;
    if(before<=2&&after>before)v+=4;
    if(after>band[1]+2)v-=4;
  }else if(after<before)v+=2;
  // No regalar al rival su propia distancia ideal.
  const eb=aiPreferredBand(target);
  const wasIdeal=before>=eb[0]&&before<=eb[1],nowIdeal=after>=eb[0]&&after<=eb[1];
  if(!wasIdeal&&nowIdeal)v-=4;
  if(wasIdeal&&!nowIdeal)v+=3;
  return v;
}

// ─────────────────────────────────────────────
// SCORING DE HABILIDADES
// ─────────────────────────────────────────────

function aiDamageScore(target,damage){
  if(!target?.alive)return -99;
  return aiEffectiveDamage(target,damage)*1.55+aiKillBonus(target,damage);
}
function aiHealScore(target,amount){
  const effective=Math.min(aiMissingHp(target),amount);
  if(effective<=0)return -30;
  let s=effective*1.35;
  if(effective<4)s-=7;
  if(target.hp/target.maxHp<.35)s+=6;
  return s;
}
function aiShieldScore(u,target,amount){
  const exposed=enemyUnits(u,true).reduce((n,e)=>n+(md(e,target)<=3?1:0),0);
  if(exposed===0)return -10;
  const existing=shieldTotal(target);
  const useful=Math.max(0,amount-Math.min(existing,amount));
  return useful*.65+exposed*3+(target.hp/target.maxHp<.5?4:0);
}
function aiStatusValue(target,type){
  if(!target?.alive)return 0;
  if(type==='wound'){
    const likelyTravel=Math.max(0,target.pm||0);
    const meleeNeed=aiRangeIdentity(target)==='close'?3:1;
    return 2+Math.min(9,likelyTravel*1.25+meleeNeed);
  }
  if(type==='poison'){
    const likelyActions=Math.max(1,Math.min(3,Math.floor((target.pa||0)/2)));
    return 2+likelyActions*2.2;
  }
  if(type==='pa'){
    const pa=target.pa||0;
    const knownCosts=(target.aiRevealedAbilities||[]).map(id=>ability(target.championId,id)?.cost||0);
    const breaksKnownCombo=knownCosts.some(c=>c>0&&pa>=c&&pa-1<c);
    return 4+(pa>=4?3:1)+(breaksKnownCombo?4:0);
  }
  if(type==='pm'){
    const needsMove=aiRangeIdentity(target)==='close'||aiNearestEnemyDistance(target,target)>aiPreferredBand(target)[1];
    return 3+Math.min(5,target.pm||0)+(needsMove?3:0);
  }
  return 0;
}
function aiFollowUpBonus(u,id,target){
  const left=u.pa-ability(u.championId,id).cost;
  if(left<=0)return 0;

  if(u.championId==='piplus'&&id==='marker'&&u.loadout.includes('precise')&&left>=3)return 8;
  if(u.championId==='piplus'&&id==='marker'&&u.loadout.includes('vector')&&left>=3)return 5;
  if(u.championId==='houngan'&&id==='needle'&&u.loadout.includes('doll')&&!ownedDoll(u)&&left>=3)return 10;
  if(u.championId==='onod'&&id==='germinate'&&u.loadout.includes('awakening')&&left>=4)return 5;
  if(u.championId==='arfeli'){
    const bonus=globalThis.LDMArfeli0626?.previewBonus?.(u,id)||0;
    const repeated=Array.isArray(u.arfeliMasteryChain)&&u.arfeliMasteryChain.includes(id);
    if(repeated&&u.arfeliMasteryChain.length>0)return -3;
    if(bonus>0)return Math.min(10,bonus*3);
  }
  return 0;
}

function aiScoreAreaDamage(u,id,x,y){
  const a=ability(u.championId,id);
  if(id==='spores'){
    const cells=[{x,y},{x:x+1,y},{x:x-1,y},{x,y:y+1},{x,y:y-1}];
    let s=0,hits=0;
    for(const z of enemyUnits(u,true)){
      if(cells.some(c=>c.x===z.x&&c.y===z.y)){
        hits++;
        s+=aiDamageScore(z,8)+aiStatusValue(z,'poison');
      }
    }
    return hits?s+(hits-1)*5:-20;
  }

  if(id==='trap_bomb'){
    let s=0,hits=0;
    const center=entityAt(x,y);
    if(center?.alive&&center.side!==u.side){
      hits++;s+=aiDamageScore(center,12);
    }
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const z=entityAt(x+dx,y+dy);
      if(z?.alive&&z.side!==u.side){
        hits++;
        s+=aiDamageScore(z,8);
        if(z.kind==='unit'){
          const path=aiForcedPath({x,y},z,1,true);
          s+=aiKnownTrapPathBonus(u,path);
        }
      }
      if(z?.alive&&z.side===u.side)s-=10;
    }
    return hits?s+(hits-1)*4:-22;
  }

  if(id==='awakening'){
    const sprouts=ownedSprouts(u);
    let s=0,totalHits=0;
    for(const z of enemyUnits(u,true)){
      const hits=sprouts.filter(sp=>adjCardinal(sp,z)).length;
      if(hits){
        totalHits+=hits;
        const dmg=8*hits;
        s+=aiDamageScore(z,dmg);
      }
    }
    return totalHits?s+(totalHits-1)*3:-24;
  }

  return a?.damage?0:-20;
}

function aiScoreSetup(u,id,x,y,focus){
  const pos={x,y};
  if(id==='pillar'){
    let s=5;
    if(focus){
      const d=md(pos,focus);
      if(d===1)s+=7;
      else if(d===2)s+=4;
      // Pilar entre Coloso y objetivo / cerca del combate.
      if(md(u,focus)>=3&&d<=2)s+=3;
    }
    return s;
  }

  if(id==='germinate'){
    let s=5;
    if(focus){
      const d=md(pos,focus);
      if(d===1)s+=8;
      else if(d<=3)s+=3;
    }
    if(u.loadout.includes('awakening'))s+=3;
    if(teamUnits(u,true).some(a=>aiMissingHp(a)>=8&&adjCardinal(a,pos)))s+=3;
    return s;
  }

  if(id==='trap_spikes'||id==='trap_snare'){
    if(!focus)return -8;
    const d=md(pos,focus);
    let s=3;
    if(d===1)s+=10;
    else if(d===2)s+=7;
    else if(d===3)s+=3;
    if(id==='trap_spikes')s+=Math.min(5,(focus.pm||0));
    if(id==='trap_snare')s+=(focus.pa||0)>=4?4:1;
    if(u.loadout.includes('hook'))s+=3;
    if(u.loadout.includes('trap_bomb'))s+=2;
    return s;
  }

  if(id==='doll'){
    const linked=getLinkedTarget(u);
    if(!linked)return 2;
    if(linked.side===u.side){
      return 12+aiMissingHp(linked)*.25+(linked.hp/linked.maxHp<.5?5:0);
    }
    return 13+(linked.hp/linked.maxHp<.55?4:0);
  }

  return 0;
}

function aiScoreAbilityCandidate(u,id,x,y,focus){
  const a=ability(u.championId,id);
  if(!a||!canUseAbility(u,id,x,y))return -1e9;
  const target=entityAt(x,y);
  let score=0;

  if(id==='spores'||id==='trap_bomb'||id==='awakening'){
    score=aiScoreAreaDamage(u,id,x,y);
  }

  else if(id==='shield'){
    const mastery=globalThis.LDMArfeli0626?.previewBonus?.(u,id)||0;
    score=aiShieldScore(u,u,(a.shield||15)+mastery);
  }

  else if(id==='stonearmor'){
    score=aiShieldScore(u,target,10);
    if(target?.type==='pillar'&&target.ownerId===u.id)score+=3;
  }

  else if(id==='pulse'){
    score=aiHealScore(target,12);
  }

  else if(id==='sap'){
    const amount=ownedSprouts(u).some(sp=>adjCardinal(sp,target))?14:10;
    score=aiHealScore(target,amount);
    if(amount===14)score+=2;
  }

  else if(id==='absorb'){
    const available=15;
    const effective=Math.min(aiMissingHp(u),available);
    score=aiHealScore(u,available)-6; // costo táctico de consumir Pilar
    if(effective<6)score-=10;
  }

  else if(id==='fusion'){
    score=5;
    if(enemyUnits(u,true).some(e=>md(u,e)<=2))score+=7;
    if(u.hp/u.maxHp<.6)score+=4;
    if(u.pm===0)score-=2;
  }

  else if(id==='pillar'||id==='germinate'||id==='trap_spikes'||id==='trap_snare'||id==='doll'){
    score=aiScoreSetup(u,id,x,y,focus);
  }

  else if(id==='transfer'){
    const healValue=aiHealScore(u,8);
    const doll=target;
    let extra=0;
    const linked=getEntity(doll?.linkedTargetId);
    if(doll?.linkMode==='enemy'&&linked?.alive)extra=aiDamageScore(linked,4)*.55;
    if(doll?.linkMode==='ally'&&linked?.alive)extra=aiHealScore(linked,4)*.55;
    score=healValue+extra;
  }

  else if(id==='reflected'){
    const doll=ownedDoll(u),linked=getLinkedTarget(u);
    if(!doll?.alive||!linked||linked.side!==u.side)return -1e9;
    const exposure=enemyUnits(u,true).filter(e=>md(e,u)<=3).length;
    score=exposure*5+(u.hp/u.maxHp<.6?6:0);
    if(exposure===0)score-=10;
  }

  else if(id==='needle'){
    if(target.side===u.side){
      score=aiHealScore(target,7);
      const current=getLinkedTarget(u);
      if(current?.alive&&current.id!==target.id)score-=8; // no romper estructura por poco
      if(u.aiMode==='support')score+=6;
    }else{
      score=aiDamageScore(target,7)+5;
      const current=getLinkedTarget(u);
      if(current?.alive&&current.id!==target.id)score-=7;
      if(u.aiMode==='offense')score+=5;
    }
  }

  else if(id==='curse'){
    score=aiDamageScore(target,9)+aiStatusValue(target,'poison');
  }

  else if(id==='ritual'){
    const doll=ownedDoll(u);
    const damage=doll?.alive&&doll.linkedTargetId===target.id&&adjCardinal(doll,target)?20:14;
    score=aiDamageScore(target,damage);
    // Consume Vínculo: penalizar si la estructura ofensiva sigue siendo rentable.
    if(target.hp>damage&&doll?.alive&&doll.linkMode==='enemy')score-=6;
    if(target.hp<=damage)score+=8;
  }

  else if(id==='marker'){
    score=aiDamageScore(target,8)+6;
    if(getMarkedTarget(u)?.id===target.id)score-=8;
    if(target.hp<=8)score-=4;
  }

  else if(id==='precise'){
    const dmg=getMarkedTarget(u)?.id===target.id?14:12;
    score=aiDamageScore(target,dmg)+(dmg===14?4:0);
  }

  else if(id==='vector'){
    const marked=getMarkedTarget(u)?.id===target.id;
    const dist=marked?2:1;
    score=aiDamageScore(target,8);
    const path=aiForcedPath(u,target,dist,false);
    score+=aiKnownTrapPathBonus(u,path);
    score+=aiForcedPositionValue(u,target,path[path.length-1]||target);
    // Piplus no quiere atraer gratis una amenaza encima.
    const end=path[path.length-1]||target;
    if(md(end,u)===1&&!aiKnownTrapPathBonus(u,path))score-=7;
  }

  else if(id==='rupture'){
    score=aiDamageScore(target,16);
    const path=aiForcedPath(u,target,2,true);
    score+=aiKnownTrapPathBonus(u,path);
    score+=aiForcedPositionValue(u,target,path[path.length-1]||target);
    if(target.hp>16&&u.loadout.includes('precise'))score-=5; // conservar Marca puede valer más
    if(target.hp<=16)score+=7;
  }

  else if(id==='daggers'){
    const mastery=globalThis.LDMArfeli0626?.previewBonus?.(u,id)||0;
    const dmg=(a.damage||10)+mastery;
    score=aiDamageScore(target,dmg)+aiStatusValue(target,'wound')+2;
  }

  else if(id==='hammer'){
    const mastery=globalThis.LDMArfeli0626?.previewBonus?.(u,id)||0;
    const dmg=(a.damage||13)+mastery;
    score=aiDamageScore(target,dmg)+(target?.kind==='unit'?aiStatusValue(target,'pm'):0);
    const landing=globalThis.LDMArfeli0626?.landing?.(u,target);
    if(landing&&focus){
      score+=(aiPositionScore(u,landing,focus)-aiPositionScore(u,u,focus))*.7;
    }
  }

  else if(id==='quake'){
    const origin=globalThis.LDMColoso0627?.quakeOrigin?.(u,target)||u;
    const projected=origin?.type==='pillar';
    const dmg=projected?8:10;
    score=aiDamageScore(target,dmg);
    const pushPath=aiForcedPath(origin,target,1,true);
    const finalPos=pushPath[pushPath.length-1]||target;
    const replicaCount=ownedPillars(u).filter(p=>p.id!==origin?.id&&adjCardinal(p,finalPos)).length;
    score+=replicaCount*6;
  }

  else if(id==='collapse'){
    const plan=globalThis.LDMColoso0627?.bestCollapsePlan?.(u,target);
    score=plan?plan.value:-30;
  }

  else if(id==='magnetism'){
    const plan=globalThis.LDMColoso0627?.bestMagnetismTarget?.(u,target);
    score=plan?plan.value:-30;
  }

  else if(id==='hook'){
    score=aiDamageScore(target,6);
    const path=aiForcedPath(u,target,2,false);
    score+=aiKnownTrapPathBonus(u,path);
    score+=aiForcedPositionValue(u,target,path[path.length-1]||target);
    const end=path[path.length-1]||target;
    if(md(end,u)===1&&aiRangeIdentity(u)==='ranged'&&!aiKnownTrapPathBonus(u,path))score-=5;
  }

  else if(id==='shot'){
    score=aiDamageScore(target,12)+3;
  }

  else if(id==='vines'){
    score=aiDamageScore(target,6)+aiStatusValue(target,'pm');
  }

  else if(id==='thorn'){
    score=aiDamageScore(target,7)+aiStatusValue(target,'poison');
  }

  else if(id==='hunterstep'){
    // Reposición por habilidad: sólo vale si mejora realmente el plan.
    const pos={x,y};
    const now=aiPositionScore(u,u,focus);
    const after=aiPositionScore(u,pos,focus);
    score=(after-now)*2-aiWoundTravelCost(u,md(u,pos))*1.5;
    if(score<4)score-=8;
  }

  else if(target&&target.side!==u.side){
    const mastery=u.championId==='arfeli'
      ?(globalThis.LDMArfeli0626?.previewBonus?.(u,id)||0)
      :0;
    const dmg=u.championId==='arfeli'
      ?(a.damage||0)+mastery
      :skillDamage(u,a);
    score=aiDamageScore(target,dmg);
  }

  score+=aiFollowUpBonus(u,id,target);

  if(target?.id&&target.id===u.aiFocusTargetId)score+=3;

  // Veneno propio: cada habilidad tiene un coste real.
  score-=Math.min(6,u.status?.poison||0)*1.15;

  // Eficiencia PA: no premiar gastar por gastar.
  score-=a.cost*.25;

  return score;
}

function aiCollectAbilityCandidates(u,focus,limit=null){
  if(limit==null)limit=30;
  const out=[];
  for(const id of u.loadout){
    const a=ability(u.championId,id);
    if(!a||u.pa<a.cost||!skillUseAllowed(u,id))continue;

    // Impulso se trata aparte porque requiere objetivo + destino.
    if(id==='impulse')continue;

    for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
      if(!canUseAbility(u,id,x,y))continue;
      const score=aiScoreAbilityCandidate(u,id,x,y,focus);
      if(score>-12)out.push({kind:'ability',id,x,y,score,label:`${a.name}`});
    }
  }
  out.sort((a,b)=>b.score-a.score);
  return out.slice(0,limit);
}

// ─────────────────────────────────────────────
// IMPULSO PIPLUS
// ─────────────────────────────────────────────

function aiCollectImpulseCandidates(u,focus){
  const a=ability(u.championId,'impulse');
  if(!a||!u.loadout.includes('impulse')||u.pa<a.cost||!skillUseAllowed(u,'impulse'))return [];

  const out=[];
  for(const ally of teamUnits(u,true)){
    if(!impulseTargetValid(u,ally))continue;

    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      for(const dist of [1,2]){
        const x=ally.x+dx*dist,y=ally.y+dy*dist;
        if(!straightDashValidFrom(ally,x,y,2))continue;

        const pos={x,y};
        const beforeDist=aiNearestEnemyDistance(ally,ally);
        const afterDist=Math.min(...enemyUnits(u,true).map(e=>md(pos,e)));
        let score=0;

        if(ally.id===u.id){
          const before=aiWithTemporaryPosition(u,{x:u.x,y:u.y},()=>aiCollectAbilityCandidates(u,focus,1)[0]?.score||0);
          const after=aiWithTemporaryPosition(u,pos,()=>aiCollectAbilityCandidates(u,focus,1)[0]?.score||0);
          score+=(after-before);
          score+=aiPositionScore(u,pos,focus)-aiPositionScore(u,u,focus);
        }else{
          const wounded=ally.hp/ally.maxHp<.45;
          if(wounded&&afterDist>beforeDist)score+=(afterDist-beforeDist)*5;
          if(aiRangeIdentity(ally)==='close'&&focus&&md(pos,focus)<md(ally,focus))score+=4;
        }

        score-=aiWoundTravelCost(ally,dist)*1.4;
        score-=a.cost*.25;

        if(score>=5)out.push({kind:'impulse',targetId:ally.id,x,y,score,label:`Impulso → ${ally.name}`});
      }
    }
  }
  return out;
}

// ─────────────────────────────────────────────
// PLANES DE MOVIMIENTO
// ─────────────────────────────────────────────

function aiBestCurrentActionScore(u,focus){
  const a=aiCollectAbilityCandidates(u,focus,1)[0]?.score??-20;
  const i=aiCollectImpulseCandidates(u,focus)[0]?.score??-20;
  return Math.max(a,i);
}

function aiCollectMovePlans(u,focus){
  if(u.pm<=0)return [];
  const reach=movementMap(u);
  const currentAction=aiBestCurrentActionScore(u,focus);
  const currentPosScore=aiPositionScore(u,u,focus);
  const plans=[];

  for(const [k,cost] of reach){
    const [x,y]=k.split(',').map(Number);
    const pos={x,y};

    const afterAction=aiWithTemporaryPosition(u,pos,()=>aiBestCurrentActionScore(u,focus));
    const positionGain=aiPositionScore(u,pos,focus)-currentPosScore;
    const woundCost=aiWoundTravelCost(u,cost);

    let score=afterAction+positionGain*2.15-cost*.45-woundCost*1.45;

    // IA EXPERTA: puede reposicionarse incluso si ya puede atacar cuando la casilla final
    // mejora de forma concreta el plan del turno.
    if(currentAction>=2&&afterAction>=currentAction-4&&positionGain>1)score+=4+positionGain*.8;

    // Si actualmente no hay ninguna acción útil, acercarse puede ser un objetivo concreto.
    if(currentAction<2&&focus){
      const gain=md(u,focus)-md(pos,focus);
      if(gain>0)score+=gain*2.2;
    }

    if(score>=3)plans.push({kind:'move',x,y,cost,score,label:`Mover ${cost}`});
  }

  plans.sort((a,b)=>b.score-a.score);
  return plans.slice(0,18);
}

// ─────────────────────────────────────────────
// HOUGAN — MODO OFENSIVO/APOYO CON HISTÉRESIS
// ─────────────────────────────────────────────

function aiUpdateHouganMode(u){
  if(u.championId!=='houngan')return;
  const allies=teamUnits(u,true).filter(z=>z.id!==u.id);
  if(!allies.length){u.aiMode='offense';return}

  let supportNeed=0;
  for(const a of allies){
    supportNeed+=aiMissingHp(a)*.08;
    if(a.hp/a.maxHp<.4)supportNeed+=6;
    if(enemyUnits(u,true).some(e=>md(e,a)<=2))supportNeed+=3;
  }

  const offenseOpportunity=enemyUnits(u,true).reduce((m,e)=>Math.max(m,(1-e.hp/e.maxHp)*8+Math.max(0,5-md(u,e))),0);
  const current=getLinkedTarget(u);
  if(current?.alive){
    if(current.side===u.side)supportNeed+=4;
    else supportNeed-=3;
  }

  if(u.aiMode==='support'){
    if(offenseOpportunity>supportNeed+7)u.aiMode='offense';
  }else{
    if(supportNeed>offenseOpportunity+5)u.aiMode='support';
  }
}

// ─────────────────────────────────────────────
// DESTRUIR ENTIDADES TÁCTICAS
// ─────────────────────────────────────────────

function aiCollectObjectAttackCandidates(u,focus){
  const out=[];
  for(const obj of aiVisibleHostileObjects(u)){
    const threat=aiObjectThreatValue(obj);
    for(const id of u.loadout){
      const a=ability(u.championId,id);
      if(!a||u.pa<a.cost||!skillUseAllowed(u,id))continue;
      if(['pulse','sap','shield','stonearmor','pillar','germinate','doll','transfer','reflected','awakening','trap_spikes','trap_snare','trap_bomb','impulse','hunterstep'].includes(id))continue;
      if(!canUseAbility(u,id,obj.x,obj.y))continue;
      const mastery=u.championId==='arfeli'
        ?(globalThis.LDMArfeli0626?.previewBonus?.(u,id)||0)
        :0;
      const dmg=u.championId==='arfeli'
        ?(a.damage||0)+mastery
        :id==='shot'?12:id==='hook'?6:id==='curse'?9:(a.damage||0);
      const score=aiDamageScore(obj,dmg)+threat-(focus?3:0);
      if(score>8)out.push({kind:'ability',id,x:obj.x,y:obj.y,score,label:`${a.name} → ${obj.name}`});
    }
  }
  return out;
}

// ─────────────────────────────────────────────
// IMPERFECCIÓN CONTROLADA
// ─────────────────────────────────────────────

function aiExpertKnownResponseRisk(u,pos){
  let risk=0;
  for(const foe of enemyUnits(u,true)){
    const d=md(pos,foe);
    // Sólo capacidades observables: posición, PA/PM y habilidades ya reveladas.
    let reach=Math.max(1,foe.pm||0);
    let knownDamage=0;
    for(const id of foe.aiRevealedAbilities||[]){
      const a=ability(foe.championId,id);
      if(!a)continue;
      reach=Math.max(reach,(a.range||1)+(foe.pm||0));
      knownDamage=Math.max(knownDamage,a.damage||0);
    }
    if(d<=reach)risk+=5+knownDamage*.32+Math.max(0,reach-d)*.7;
  }
  return risk;
}
function aiExpertFutureValue(u,plan,focus){
  const pos=plan.kind==='move'?{x:plan.x,y:plan.y}:{x:u.x,y:u.y};
  let value=aiPositionScore(u,pos,focus)*.8-aiExpertKnownResponseRisk(u,pos)*.72;
  // PM restantes tienen valor cuando existe una retirada/reposición que mantiene presión.
  if(plan.kind==='ability'&&u.pm>0&&focus){
    const base=aiPositionScore(u,u,focus);
    let best=base;
    for(const [k] of movementMap(u)){
      const [x,y]=k.split(',').map(Number),p={x,y};
      const keepsPressure=aiCanThreatenFrom(u,p,focus);
      const ps=aiPositionScore(u,p,focus)+(keepsPressure?3:-2);
      if(ps>best)best=ps;
    }
    value+=Math.max(0,best-base)*.9;
  }
  // Preparación y negación: premiar planes que sostienen la identidad táctica.
  if(plan.kind==='ability'){
    if(['pillar','germinate','trap_spikes','trap_snare','trap_bomb','doll','marker','needle'].includes(plan.id))value+=5;
    if(['fusion','awakening','rupture','ritual','hook','quake'].includes(plan.id))value+=2.5;
  }
  // Conservar recursos cuando la acción no genera una ventaja clara.
  const a=plan.id?ability(u.championId,plan.id):null;
  if(a&&plan.score<8)value-=a.cost*.35;
  return value;
}
function aiExpertRankPlans(u,candidates){
  const focus=aiSelectFocus(u);
  return candidates.map(p=>({...p,score:p.score+aiExpertFutureValue(u,p,focus)}));
}

function aiPickNearBest(candidates,u=null){
  if(!candidates.length)return null;
  candidates=aiExpertRankPlans(u,candidates);
  candidates.sort((a,b)=>b.score-a.score);
  const best=candidates[0].score;

  // Único perfil EXPERTO: banda estrecha y elección entre las 3 mejores opciones cercanas.
  const band=Math.max(2,Math.abs(best)*.035);
  const near=candidates.filter(c=>c.score>=best-band).slice(0,3);
  if(near.length===1)return near[0];

  // Ponderar fuertemente hacia las mejores sin volver determinista el resultado.
  const weights=near.map(c=>Math.max(.2,1-(best-c.score)/(band+1)));
  const total=weights.reduce((a,b)=>a+b,0);
  let r=Math.random()*total;
  for(let i=0;i<near.length;i++){
    r-=weights[i];
    if(r<=0)return near[i];
  }
  return near[0];
}

// ─────────────────────────────────────────────
// GENERADOR DE PLAN DEL TURNO
// ─────────────────────────────────────────────

function aiGeneratePlans(u){
  aiUpdateHouganMode(u);
  const focus=aiSelectFocus(u);

  const direct=aiCollectAbilityCandidates(u,focus);
  const impulse=aiCollectImpulseCandidates(u,focus);
  const objects=aiCollectObjectAttackCandidates(u,focus);
  const moves=aiCollectMovePlans(u,focus);

  const all=[...direct,...impulse,...objects,...moves];

  // No ejecutar acciones de valor nulo sólo por gastar PA/PM.
  return all.filter(p=>p.score>=2).sort((a,b)=>b.score-a.score);
}

async function aiExecutePlanStep(u,plan){
  if(!plan||!u?.alive)return false;
  u.aiLastPlanLabel=plan.label||plan.kind;

  if(plan.kind==='ability'){
    return await executeAbility(u,plan.id,plan.x,plan.y,true);
  }

  if(plan.kind==='impulse'){
    const target=getUnit(plan.targetId);
    if(!target?.alive)return false;
    return await executeImpulse(u,target,plan.x,plan.y);
  }

  if(plan.kind==='move'){
    const before={x:u.x,y:u.y};
    await moveUnit(u,plan.x,plan.y);
    return u.alive&&(u.x!==before.x||u.y!==before.y);
  }

  return false;
}

// ─────────────────────────────────────────────
// IA TÁCTICA ÚNICA — ALIADOS Y ENEMIGOS
// ─────────────────────────────────────────────

aiTurn=async function(){
  if(!B||B.ended||cur().controller!=='ai'||B.busy)return;
  const u=cur();

  await sleep(260);

  // Reevaluar después de cada acción; máximo acotado para evitar bucles.
  for(let step=0;step<9&&u.alive&&!B.ended;step++){
    if(checkBattleEnd())return;

    const plans=aiGeneratePlans(u);
    const plan=aiPickNearBest(plans,u);

    if(!plan)break;

    const before={
      x:u.x,y:u.y,pa:u.pa,pm:u.pm,
      objects:(B.pillars||[]).filter(z=>z.alive).length,
      enemies:enemyUnits(u,true).length
    };

    const acted=await aiExecutePlanStep(u,plan);
    await sleep(170);

    if(B.ended||!u.alive)return;

    const changed=
      acted||
      u.x!==before.x||u.y!==before.y||
      u.pa!==before.pa||u.pm!==before.pm||
      (B.pillars||[]).filter(z=>z.alive).length!==before.objects||
      enemyUnits(u,true).length!==before.enemies;

    if(!changed)break;

    // Si ya no quedan recursos útiles, finalizar.
    if(u.pa<=0&&u.pm<=0)break;
  }

  if(!B.ended)setTimeout(nextTurn,300);
};

})();