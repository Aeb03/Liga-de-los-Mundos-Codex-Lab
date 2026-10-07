import { abilityTargets, useAbility, movementAvailable, calculatePath, resolvePath, endTurn, endHouganDollPhase } from '../combat-core.mjs';
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
// Only public tactical knowledge participates in planning. Hidden enemy traps remain authoritative on execution.
export function planAI(combat,slot){
  const state=structuredClone(combat);state.traps=state.traps.filter(t=>t.team===slot.team);
  const unit=state.units.find(u=>u.id===slot.id);
  if(state.dollPhase)return {out:endHouganDollPhase(combat,{unitId:slot.id}),action:{type:'houganDollEnd'}};
  if(!unit.alive)return {out:endTurn(combat,{unitId:slot.id}),action:{type:'endTurn'}};
  let best=null;
  const consider=(args)=>{try{
    if((unit.skillUsesThisTurn[args.abilityId]??0)>0&&['shield','stonearmor','interference'].includes(args.abilityId))return;
    const out=useAbility(state,{unitId:unit.id,...args}),value=score(state,out.state,unit.team);
    if(value>0.05&&(!best||value>best.value))best={value,args};
  }catch(error){if(!error.code)throw error;}};
  for(const abilityId of slot.skills){
    let targets=[];try{targets=abilityTargets(state,unit.id,abilityId);}catch(error){if(!error.code)throw error;}
    for(const targetId of targets){
      if(abilityId==='hook'){for(const d of [1,2])consider({abilityId,targetId,distance:d});}
      else if(abilityId==='collapse'){for(const direction of [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}])consider({abilityId,targetId,direction});}
      else if(abilityId==='magnetism'){for(const target of state.units)consider({abilityId,targetId,secondaryTargetId:target.id});}
      else consider({abilityId,targetId});
    }
    if(['vines','grenade','vector'].includes(abilityId))for(let x=0;x<12;x++)for(let y=0;y<12;y++)consider({abilityId,position:{x,y}});
  }
  if(best)return {out:useAbility(combat,{unitId:unit.id,...best.args}),action:{type:'ability',...best.args}};
  const enemies=state.units.filter(u=>u.alive&&u.team!==unit.team);
  const nearest=p=>Math.min(...enemies.map(enemy=>distance(p,enemy)));
  let destination=null;
  if(enemies.length)for(const cell of movementAvailable(state,unit.id)){
    const gain=nearest(unit)-nearest(cell);if(gain<=0)continue;
    try{const path=calculatePath(state,unit.id,cell),out=resolvePath(state,unit.id,path),actor=out.state.units.find(u=>u.id===unit.id);
      if(!actor.alive)continue;
      const value=gain*2-(unit.hp-actor.hp)*1.5-cell.cost*0.05;
      if(value>0&&(!destination||value>destination.value))destination={value,path};
    }catch(error){if(!error.code)throw error;}
  }
  if(destination)return {out:resolvePath(combat,unit.id,destination.path),action:{type:'move',path:destination.path}};
  return {out:endTurn(combat,{unitId:unit.id}),action:{type:'endTurn'}};
}
