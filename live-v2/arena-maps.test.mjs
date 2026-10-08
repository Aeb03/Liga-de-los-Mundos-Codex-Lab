import test from 'node:test';
import assert from 'node:assert/strict';
import {ARENA_MAPS,LEGACY_ARENA,arenaFor,arenaObstacleCells,drawArena} from './arena-maps.mjs';
const key=p=>`${p.x},${p.y}`,rotate=k=>k.split(',').map(n=>11-Number(n)).join(',');
test('all approved maps have 12 free deployment cells per side and exact rotational counterparts',()=>{
 for(const map of ARENA_MAPS){
  const cells=arenaObstacleCells(map),blocked=new Set(cells.map(key));assert.equal(blocked.size,cells.length);
  for(const team of ['A','B']){assert.equal(map.deployment[team].length,12);assert.equal(new Set(map.deployment[team]).size,12);for(const k of map.deployment[team])assert(!blocked.has(k));}
  assert.deepEqual(map.deployment.A.map(rotate).sort(),[...map.deployment.B].sort());
  for(const piece of map.pieces){assert.equal(piece.cells.length,piece.type==='barrier'?2:1);for(const p of piece.cells)assert(p.x>=0&&p.y>=0&&p.x<12&&p.y<12);
   if(piece.type==='barrier')assert.equal(Math.abs(piece.cells[0].x-piece.cells[1].x)+Math.abs(piece.cells[0].y-piece.cells[1].y),1);
   assert(map.pieces.some(other=>other.type===piece.type&&JSON.stringify(other.cells.map(key).sort())===JSON.stringify(piece.cells.map(key).map(rotate).sort())));
  }
  const seen=new Set([map.deployment.A[0]]),queue=[map.deployment.A[0]];
  while(queue.length){const [x,y]=queue.shift().split(',').map(Number);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const p={x:x+dx,y:y+dy},k=key(p);if(p.x>=0&&p.y>=0&&p.x<12&&p.y<12&&!blocked.has(k)&&!seen.has(k)){seen.add(k);queue.push(k);}}}
  assert.equal(seen.size,144-blocked.size,'every free tile must be connected');for(const k of [...map.deployment.A,...map.deployment.B])assert(seen.has(k));
 }
});
test('draw covers all three maps, returns independent data and legacy rooms never reroll',()=>{
 assert.deepEqual([0,.34,.99].map(v=>drawArena(v).id),ARENA_MAPS.map(m=>m.id));assert.throws(()=>drawArena(1));
 const m=drawArena(0);m.deployment.A.pop();assert.equal(ARENA_MAPS[0].deployment.A.length,12);
 assert.equal(arenaFor({}).id,LEGACY_ARENA.id);assert.equal(arenaObstacleCells(arenaFor({})).length,4);
});
