import { abilityTargets, useAbility, movementAvailable, calculatePath, resolvePath, endTurn, endHouganDollPhase, executeCommand, pillarAvailable, colosoActionTargets, piplusMarkTargets, germinateDestinations, onodActionTargets, houganDollDestinations, korganDisarmTargets, korganTrapDestinations, hunterStepDestinations, houganDollMovementAvailable, calculateHouganDollPath } from '../combat-core.mjs';
const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
function score(before,after,team){
  let total=0;
  for(const unit of before.units){const next=after.units.find(u=>u.id===unit.id);
    total+=(unit.team===team?-1.3:1)*(unit.hp-next.hp);
    if(unit.team!==team&&!next.alive&&unit.alive)total+=50;
    if(unit.team===team&&!next.alive&&unit.alive)total-=150;
    if(unit.team===team)total+=0.12*(next.shield.reduce((n,s)=>n+s.amount,0)-unit.shield.reduce((n,s)=>n+s.amount,0));
    if(unit.team!==team)total+=2*(next.status.wound-unit.status.wound)+2*(next.status.poison-unit.status.poison);
  }return total;
}
const dirs=[{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
const key=p=>`${p.x},${p.y}`;
function candidates(state,slot){
 const u=state.units.find(u=>u.id===slot.id),commands=[];
 const add=(type,args)=>commands.push({type,unitId:u.id,...args});
 for(const abilityId of slot.skills){
  if((u.skillUsesThisTurn[abilityId]??0)>0&&['shield','stonearmor','interference','fixation','paintransfer','dance'].includes(abilityId))continue;
  for(const targetId of abilityTargets(state,u.id,abilityId)){
   if(abilityId==='hook')for(const distance of [1,2])add('ability',{abilityId,targetId,distance});
   else if(abilityId==='collapse')for(const direction of dirs)add('ability',{abilityId,targetId,direction});
   else if(abilityId==='magnetism')for(const target of state.units)add('ability',{abilityId,targetId,secondaryTargetId:target.id});
   else add('ability',{abilityId,targetId});
  }
  const cells=['trap_spikes','trap_mine'].includes(abilityId)?korganTrapDestinations(state,u.id,abilityId):abilityId==='hunterstep'?hunterStepDestinations(state,u.id):['vines','grenade','vector'].includes(abilityId)?Array.from({length:144},(_,i)=>({x:i%12,y:Math.floor(i/12)})):[];
  for(const position of cells)add('ability',{abilityId,position});
 }
 if(u.championId==='coloso'){
  for(const position of pillarAvailable(state,u.id))add('createPillar',{position});
  for(const action of ['fusion','exit','recycle'])for(const targetId of colosoActionTargets(state,u.id,action))add('colosoAction',{action,targetId});
 }
 if(u.championId==='piplus')for(const targetId of piplusMarkTargets(state,u.id))if(targetId!==u.markedTargetId)add('piplusMark',{targetId});
 if(u.championId==='onod'){
  for(const position of germinateDestinations(state,u.id))add('onodAction',{action:'germinate',position});
  for(const targetId of onodActionTargets(state,u.id,'wither'))add('onodAction',{action:'wither',targetId});
 }
 if(u.championId==='houngan'&&!state.objects.some(o=>o.alive&&o.type==='doll'&&o.ownerId===u.id&&o.linkedTargetId===u.linkedTargetId))for(const position of houganDollDestinations(state,u.id))add('houganAction',{action:'doll',position});
 if(u.championId==='korgan')for(const targetId of korganDisarmTargets(state,u.id))add('korganAction',{action:'disarm',targetId});
 return commands;
}
// Value preparation only when its placement has a concrete tactical purpose.
function potential(state,u){
 const enemies=state.units.filter(e=>e.alive&&e.team!==u.team);let value=0;
 const near=p=>Math.min(...enemies.map(e=>distance(p,e)));
 if(u.markedTargetId)value+=5;
 if(u.linkedTargetId)value+=5;
 for(const o of state.objects.filter(o=>o.alive&&o.ownerId===u.id)){
  if(o.type==='pillar')value+=Math.max(0,4-near(o))*.9;
  if(o.type==='sprout')value+=enemies.filter(e=>distance(e,o)===1).length*3+state.units.filter(e=>e.alive&&e.team===u.team&&distance(e,o)===1&&e.hp<e.maxHp).length*2;
  if(o.type==='doll'){const t=state.units.find(e=>e.id===o.linkedTargetId&&e.alive);if(t)value+=4+Math.max(0,5-distance(o,t))*2;}
 }
 for(const t of state.traps.filter(t=>t.active&&t.ownerId===u.id))value+=Math.max(0,4-near(t))*1.5;
 return value;
}
function routeDistances(state,u){
 const blocked=new Set([...state.board.obstacles,...state.objects.filter(o=>o.alive).map(key),...state.units.filter(e=>e.alive&&e.id!==u.id).map(key)]),costs=new Map(),queue=[];
 for(const e of state.units.filter(e=>e.alive&&e.team!==u.team))for(const d of dirs){const p={x:e.x+d.x,y:e.y+d.y},k=key(p);if(p.x>=0&&p.x<12&&p.y>=0&&p.y<12&&!blocked.has(k)&&!costs.has(k)){costs.set(k,0);queue.push(p);}}
 for(let i=0;i<queue.length;i++)for(const d of dirs){const p={x:queue[i].x+d.x,y:queue[i].y+d.y},k=key(p);if(p.x<0||p.x>=12||p.y<0||p.y>=12||blocked.has(k)||costs.has(k))continue;costs.set(k,costs.get(key(queue[i]))+1);queue.push(p);}
 return costs;
}
// Hidden enemy traps are excluded from planning, but still resolve on execution.
export function planAI(combat,slot){
 const state=structuredClone(combat);state.traps=state.traps.filter(t=>t.team===slot.team);
 const u=state.units.find(u=>u.id===slot.id);
 const run=command=>({out:executeCommand(combat,command),action:command});
 if(!u.alive)return run({type:'endTurn',unitId:u.id});
 if(state.dollPhase){
  const doll=state.objects.find(o=>o.id===state.dollPhase.dollId),target=state.units.find(e=>e.id===doll?.linkedTargetId&&e.alive);let best=null;
  if(target)for(const cell of houganDollMovementAvailable(state,u.id)){
   const path=calculateHouganDollPath(state,u.id,cell),command={type:'houganDollMove',unitId:u.id,path};
   try{const out=executeCommand(state,command),next=out.state.objects.find(o=>o.id===doll.id),value=score(state,out.state,u.team)+(distance(doll,target)-distance(next,target))*.5;
    if(value>.05&&(!best||value>best.value))best={value,command};
   }catch(e){if(!e.code)throw e;}
  }
  return run(best?.command??{type:'houganDollEnd',unitId:u.id});
 }
 const routes=routeDistances(state,u),route=p=>routes.get(key(p))??100;
 const evaluate=(out,command)=>{
  const next=out.state.units.find(e=>e.id===u.id);
  let value=score(state,out.state,u.team)+potential(out.state,next)-potential(state,u);
  if(command.abilityId==='hunterstep')value+=(route(u)-route(next))*2;
  if(command.action==='fusion'&&route(u)>1)value-=6;
  if(command.action==='exit'&&route(u)>1)value+=3;
  if(command.type==='korganAction'&&route(state.traps.find(t=>t.id===command.targetId))>4)value+=.5;
  return value;
 };
 let best=null;
 for(const command of candidates(state,slot))try{
  const out=executeCommand(state,command);let value=evaluate(out,command);
  // One additional action reveals mark/attack, sprout/area and doll/ritual combinations.
  if(['piplusMark','createPillar','onodAction','houganAction'].includes(command.type)&&out.state.phase==='active'){
   let follow=0;for(const nextCommand of candidates(out.state,slot).filter(c=>c.type==='ability'))try{const result=executeCommand(out.state,nextCommand);follow=Math.max(follow,score(out.state,result.state,u.team));}catch(e){if(!e.code)throw e;}
   value+=follow*.7;
   if(potential(out.state,out.state.units.find(e=>e.id===u.id))>potential(state,u))value+=2;
  }
  if(value>.05&&(!best||value>best.value))best={value,command};
 }catch(e){if(!e.code)throw e;}
 if(best)return run(best.command);
 let move=null;
 for(const cell of movementAvailable(state,u.id)){
  const gain=route(u)-route(cell);if(gain<=0)continue;
  try{const path=calculatePath(state,u.id,cell),out=resolvePath(state,u.id,path),actor=out.state.units.find(e=>e.id===u.id);if(!actor.alive)continue;
   const value=gain*2-(u.hp-actor.hp)*1.5-cell.cost*.05;
   if(!move||value>move.value)move={value,command:{type:'move',unitId:u.id,path}};
  }catch(e){if(!e.code)throw e;}
 }
 // Even a necessary detour is movement toward the opponent, rather than waiting.
 if(move)return run(move.command);
 return run({type:'endTurn',unitId:u.id});
}
