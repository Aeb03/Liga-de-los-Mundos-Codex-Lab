import test from 'node:test';import assert from 'node:assert/strict';
import {confirmedRoutes,MotionTimeline,spriteSource,stepDirection,projectedOffset} from './motion.mjs';
const state=(version,x,y,moves=[])=>({id:'m',version,combat:{units:[{id:'A1',alive:true,x,y}]},presentation:{moves}});
const path=[{x:1,y:1},{x:1,y:2},{x:2,y:2}];
const batch={version:2,unitId:'A1',path};
test('both viewers animate accepted exact bends, never a newly calculated shortest path',()=>{
 const previous=state(1,1,1),next=state(2,2,2,[batch]);const before=structuredClone(next);
 assert.deepEqual(confirmedRoutes(previous,next),[{unitId:'A1',path}]);assert.deepEqual(next,before);
 assert.deepEqual(confirmedRoutes(previous,state(2,2,2)),[]);
 assert.deepEqual(confirmedRoutes(previous,state(2,2,2,[{...batch,path:[{x:1,y:1},{x:2,y:2}]}])),[]);
});
test('timeline follows cells, survives equal snapshots and finishes without changing confirmed state',()=>{
 const t=new MotionTimeline();t.receive(state(1,1,1),0);assert.equal(t.sample('A1',0),null);
 t.receive(state(2,2,2,[batch]),100);assert.deepEqual(t.sample('A1',180),{x:1,y:1.5,direction:'down-left'});
 t.receive(state(2,2,2,[batch]),200);assert.deepEqual(t.sample('A1',340),{x:1.5,y:2,direction:'down-right'});
 assert.equal(t.sample('A1',420),null);
});
test('refresh, reconnect, reduced motion, old snapshots and truncated history do not replay',()=>{
 const t=new MotionTimeline();t.receive(state(2,2,2,[batch]),0);assert.equal(t.tracks.size,0);
 t.receive(state(1,1,1),1);assert.equal(t.tracks.size,0);
 t.receive(state(1,1,1),2,{connected:false});t.receive(state(2,2,2,[batch]),3);assert.equal(t.tracks.size,0);
 const next=state(2,2,2,[batch]);next.presentation.fromVersion=2;assert.deepEqual(confirmedRoutes(state(1,1,1),next),[]);
 const reduced=new MotionTimeline();reduced.receive(state(1,1,1),0);reduced.receive(state(2,2,2,[batch]),1,{reducedMotion:true});assert.equal(reduced.tracks.size,0);
});
test('consecutive accepted moves and closed loops preserve exact steps',()=>{
 const second={version:3,unitId:'A1',path:[{x:2,y:2},{x:2,y:1},{x:1,y:1}]};
 assert.deepEqual(confirmedRoutes(state(1,1,1),state(3,1,1,[batch,second]))[0].path,[...path,...second.path.slice(1)]);
});
test('Muñeco Vudú anima el recorrido confirmado del servidor y no teletransporta',()=>{
 const previous={id:'m',version:10,combat:{units:[],objects:[{id:'doll1',type:'doll',alive:true,x:3,y:3}]},presentation:{moves:[]}};
 const dollPath=[{x:3,y:3},{x:4,y:3},{x:4,y:4}];
 const next={id:'m',version:11,combat:{units:[],objects:[{id:'doll1',type:'doll',alive:true,x:4,y:4}]},presentation:{moves:[{version:11,objectId:'doll1',path:dollPath}]}};
 assert.deepEqual(confirmedRoutes(previous,next),[{objectId:'doll1',path:dollPath}]);
 const timeline=new MotionTimeline();timeline.receive(previous,0);timeline.receive(next,100);
 assert.deepEqual(timeline.sample('doll1',180),{x:3.5,y:3,direction:'down-right'});
 assert.deepEqual(timeline.sample('doll1',260),{x:4,y:3,direction:'down-left'});
});
test('four views use effective offline asset mapping including Coloso upper-view exception',()=>{
 assert.equal(stepDirection({x:0,y:0},{x:1,y:0}),'down-right');assert.equal(stepDirection({x:1,y:0},{x:0,y:0}),'up-left');
 assert.equal(stepDirection({x:0,y:0},{x:0,y:1}),'down-left');assert.equal(stepDirection({x:0,y:1},{x:0,y:0}),'up-right');
 assert.match(spriteSource('arfeli','down-right'),/combat-down-left.png$/);assert.match(spriteSource('coloso','up-right'),/combat-up-right.png$/);
});

test('animación proyecta cada paso según la rotación de cámara',()=>{
 assert.deepEqual(projectedOffset({x:3.5,y:3},{x:4,y:3},0),{x:-10,y:-5});
 assert.deepEqual(projectedOffset({x:3.5,y:3},{x:4,y:3},1),{x:10,y:-5});
 assert.deepEqual(projectedOffset({x:3.5,y:3},{x:4,y:3},2),{x:10,y:5});
 assert.deepEqual(projectedOffset({x:3.5,y:3},{x:4,y:3},3),{x:-10,y:5});
});

test('moving entities cross static obstacles at their displayed depth',async()=>{
 const {sortDepthLayer}=await import('./motion.mjs');
 const obstacle={dataset:{depthX:'260',depthY:'100'}},unit={dataset:{depthX:'260',depthY:'120',depthOffsetY:'-40'}};
 const layer={children:[obstacle,unit],appendChild(node){this.children=this.children.filter(n=>n!==node);this.children.push(node);}};
 const root={querySelectorAll:()=>[layer]};sortDepthLayer(root);assert.deepEqual(layer.children,[unit,obstacle]);
 unit.dataset.depthOffsetY='0';sortDepthLayer(root);assert.deepEqual(layer.children,[obstacle,unit]);
});


test('doll views preserve native proportions and a stable footprint height',async()=>{
 const {dollSpriteBox,championSpriteBox}=await import('./motion.mjs');
 for(const variant of ['muneco-houngan-01','muneco-houngan-02'])for(const direction of ['down-right','down-left','up-right','up-left']){
  const box=dollSpriteBox(variant,direction,{x:100,y:100});
  assert.equal(box.x+box.width/2,100);assert.equal(box.y+box.height*.94,100);
  assert(box.height<=32);assert(box.width<=34);
 }
 assert.equal(championSpriteBox('coloso','down-right',true,{x:100,y:100}).height,45);
});
