// Approved hand-drawn layouts. Counterparts are rotations, never mirror copies.
const key=([x,y])=>`${x},${y}`;
const rotate=([x,y])=>[11-x,11-y];
const counterpart=piece=>({...piece,cells:piece.cells.map(rotate)});
const build=(id,name,starts,pieces)=>({id,name,revision:1,deployment:{A:starts.map(key),B:starts.map(rotate).map(key)},pieces:[...pieces,...pieces.map(counterpart)].map((p,i)=>({id:`${id}-${i}`,type:p.type,cells:p.cells.map(([x,y])=>({x,y}))}))});
const pillar=(x,y)=>({type:'pillar',cells:[[x,y]]});
const cube=(x,y)=>({type:'cube',cells:[[x,y]]});
const barrier=(x,y,dx,dy)=>({type:'barrier',cells:[[x,y],[x+dx,y+dy]]});
export const ARENA_MAPS=[
 build('central-01','Arena Central · 1',Array.from({length:12},(_,y)=>[y%2===0?1:0,y]),[
  barrier(3,1,0,1),barrier(3,5,0,1),barrier(3,9,0,1),pillar(6,3),cube(5,5)
 ]),
 build('central-02','Arena Central · 2',[[1,0],[1,1],[2,1],[1,3],[2,3],[1,4],[2,6],[1,7],[2,7],[1,9],[1,10],[2,10]],[
  pillar(4,0),cube(3,4),pillar(8,4),barrier(5,1,0,1),barrier(5,4,1,0)
 ]),
 build('central-03','Arena Central · 3',[[1,0],[1,1],[3,2],[3,3],[1,5],[2,5],[1,6],[2,6],[3,8],[3,9],[1,10],[1,11]],[
  cube(2,1),pillar(5,1),cube(9,1),pillar(1,4),pillar(10,4),barrier(5,3,1,0),barrier(3,5,0,1)
 ])
];
export const LEGACY_ARENA={id:'central-classic',name:'Arena Central',revision:0,deployment:{A:['0,3','1,3','0,4','2,5','1,6','2,6'],B:['11,3','10,3','11,4','9,5','10,6','9,6']},pieces:[[5,4],[6,4],[5,7],[6,7]].map(([x,y],i)=>({id:`classic-${i}`,type:'cube',cells:[{x,y}]}))};
export const arenaFor=state=>state?.arena??LEGACY_ARENA;
export const arenaObstacleCells=arena=>arena.pieces.flatMap(p=>p.cells.map(c=>({...c})));
export function drawArena(random=Math.random){
 const value=typeof random==='function'?random():random;
 if(!Number.isFinite(value)||value<0||value>=1)throw new RangeError('Arena draw must be in [0,1)');
 return structuredClone(ARENA_MAPS[Math.floor(value*ARENA_MAPS.length)]);
}
export function arenaById(id){const arena=[...ARENA_MAPS,LEGACY_ARENA].find(m=>m.id===id);if(!arena)throw new RangeError('Unknown arena');return structuredClone(arena);}
