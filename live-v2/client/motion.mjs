import { rotateFacing, rotateCell } from './hud-camera.mjs?v=20261005-parityv22';
// Presentation only. Every animated cell comes from an accepted server event.
export const stepDirection=(a,b)=>b.x>a.x?'down-right':b.x<a.x?'up-left':b.y>a.y?'down-left':'up-right';
export function projectedOffset(sample,final,rotation=0){const a=rotateCell(sample.x,sample.y,rotation),b=rotateCell(final.x,final.y,rotation),dx=a.x-b.x,dy=a.y-b.y;return {x:(dx-dy)*20,y:(dx+dy)*10};}
export function spriteSource(championId,direction='down-right',monolith=false) {
  if(championId==='coloso'&&monolith)return `../assets/tactical/objects/monolito-coloso/${direction}.png`;
  // Effective offline mapping in champion-assets.js, including Coloso's upper views.
  const files={'down-right':'down-left','down-left':'down-right','up-right':'up-left','up-left':'up-right'};
  const view=championId==='coloso'&&direction.startsWith('up-')?direction:files[direction];
  return `../assets/champions/${championId}/${championId}-combat-${view??'down-left'}.png`;
}
// Peana footprint anchors measured from the lower opaque band of each PNG.
const championAnchors={"arfeli":{"down-right":[0.43945,0.92083],"down-left":[0.54102,0.92083],"up-right":[0.44531,0.92083],"up-left":[0.51107,0.92083]},"piplus":{"down-left":[0.5,0.92091],"down-right":[0.5,0.92091],"up-right":[0.48047,0.92083],"up-left":[0.54102,0.92083]},"houngan":{"up-right":[0.49219,0.92083],"down-left":[0.51302,0.92083],"down-right":[0.48047,0.92083],"up-left":[0.5026,0.92083]},"onod":{"up-right":[0.50651,0.92083],"down-right":[0.48047,0.92083],"up-left":[0.48958,0.92083],"down-left":[0.51562,0.92083]},"korgan":{"up-right":[0.46224,0.92083],"down-left":[0.50977,0.92083],"up-left":[0.54427,0.92083],"down-right":[0.47852,0.92083]},"coloso":{"down-right":[0.47917,0.92083],"down-left":[0.52018,0.92083],"up-right":[0.47852,0.92083],"up-left":[0.52148,0.92083]}};
export function championSpriteBox(championId,direction,monolith,point){
  if(championId==='coloso'&&monolith)return {x:point.x-22,y:point.y-53,width:44,height:58};
  const source=spriteSource(championId,direction),view=source.split('-combat-')[1]?.replace('.png','');
  const [ax,ay]=championAnchors[championId]?.[view]??[.5,.92];
  return {x:point.x-44*ax,y:point.y-44*ay,width:44,height:44};
}
function paintChampionImage(group,image,direction){
  const champion=group.dataset.champion,monolith=group.dataset.monolith==='true';
  const cell=rotateCell(Number(group.dataset.x),Number(group.dataset.y),Number(group.dataset.cameraRotation)||0);
  const box=championSpriteBox(champion,direction,monolith,{x:260+(cell.x-cell.y)*20,y:30+(cell.x+cell.y)*10});
  image.setAttribute('href',spriteSource(champion,direction,monolith));
  for(const [key,value] of Object.entries(box))image.setAttribute(key,String(value));
}
const same=(a,b)=>a?.x===b?.x&&a?.y===b?.y;
export function confirmedRoutes(previous,next) {
  if(!previous?.combat||!next?.combat||previous.id!==next.id||next.version<=previous.version||previous.version<(next.presentation?.fromVersion??0))return [];
  const batches=(next.presentation?.moves??[]).filter(b=>b.version>previous.version&&b.version<=next.version).sort((a,b)=>a.version-b.version);
  const routes=[],entities=[
    ...previous.combat.units.map(entity=>({entity,kind:'unit'})),
    ...(previous.combat.objects??[]).filter(entity=>entity.type==='doll').map(entity=>({entity,kind:'object'}))
  ];
  for(const {entity:before,kind} of entities){
    const after=(kind==='unit'?next.combat.units:(next.combat.objects??[])).find(u=>u.id===before.id);
    if(!before.alive||!after?.alive)continue;
    let path=[{x:before.x,y:before.y}],valid=true,jump=false,dash=false;
    for(const batch of batches.filter(b=>(kind==='unit'?b.unitId:b.objectId)===before.id)){
      if(!Array.isArray(batch.path)||batch.path.length<2||!same(path.at(-1),batch.path[0])){valid=false;break;}
      if(batch.kind==='jump')jump=true;if(batch.kind==='dash')dash=true;
      for(let i=1;i<batch.path.length;i++){
        const p=batch.path[i],last=path.at(-1);
        if(!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.y<0||p.x>11||p.y>11||(batch.kind==='dash'?batch.path.length!==2||Math.abs(last.x-p.x)+Math.abs(last.y-p.y)<1||Math.abs(last.x-p.x)+Math.abs(last.y-p.y)>2||(last.x!==p.x&&last.y!==p.y):batch.kind==='jump'?batch.path.length!==2||Math.abs(last.x-p.x)+Math.abs(last.y-p.y)>4:Math.abs(last.x-p.x)+Math.abs(last.y-p.y)!==1)){valid=false;break;}
        path.push({...p});
      }
    }
    if(valid&&path.length>1&&same(path.at(-1),after))routes.push({...(kind==='unit'?{unitId:before.id}:{objectId:before.id}),path,...(jump?{jump:true}:dash?{dash:true}:{})});
  }
  return routes;
}
export class MotionTimeline {
  constructor(){this.state=null;this.tracks=new Map();this.offline=false;}
  receive(state,now,{connected=true,reducedMotion=false}={}){
    if(state?.id===this.state?.id&&state?.version<this.state?.version)return;
    if(!connected){this.tracks.clear();this.offline=true;this.state=state;return;}
    if(state?.version===this.state?.version&&!this.offline)return;
    const routes=!this.offline&&!reducedMotion?confirmedRoutes(this.state,state):[];
    this.tracks.clear();this.offline=false;this.state=state;
    // Snapshot gaps may span several moves. Cap visual duration, not server time.
    for(const route of routes)this.tracks.set(route.unitId??route.objectId,{...route,start:now,stepMs:route.jump?320:route.dash?240:Math.min(160,900/(route.path.length-1))});
  }
  sample(id,now){
    const t=this.tracks.get(id);if(!t)return null;
    const elapsed=Math.max(0,now-t.start),step=Math.floor(elapsed/t.stepMs);
    if(step>=t.path.length-1){this.tracks.delete(id);return null;}
    const a=t.path[step],b=t.path[step+1],fraction=(elapsed%t.stepMs)/t.stepMs;
    return {x:a.x+(b.x-a.x)*fraction,y:a.y+(b.y-a.y)*fraction,direction:stepDirection(a,b),...(t.jump?{lift:Math.sin(fraction*Math.PI)*18}:{})};
  }
}
export class MotionPresenter {
  constructor({clock=()=>performance.now(),frame=fn=>requestAnimationFrame(fn),cancel=id=>cancelAnimationFrame(id)}={}){
    this.clock=clock;this.frame=frame;this.cancel=cancel;this.timeline=new MotionTimeline();this.frameId=null;
  }
  receive(state,options){this.timeline.receive(state,this.clock(),options);}
  paint(root){
    if(this.frameId!=null)this.cancel(this.frameId);
    const tick=()=>{
      this.frameId=null;
      for(const group of root.querySelectorAll('[data-motion-unit]')){
        const id=group.dataset.motionUnit,sample=this.timeline.sample(id,this.clock());
        if(!sample){group.removeAttribute('transform');paintChampionImage(group,group.querySelector('image'),group.dataset.facing);continue;}
        // Isometric offset from the authoritative final position; no state mutation.
        const offset=projectedOffset(sample,{x:Number(group.dataset.x),y:Number(group.dataset.y)},Number(group.dataset.cameraRotation)||0);
        group.setAttribute('transform',`translate(${offset.x} ${offset.y-(sample.lift??0)})`);
        const image=group.querySelector('image'),direction=rotateFacing(sample.direction,Number(group.dataset.cameraRotation)||0);paintChampionImage(group,image,direction);
      }
      for(const group of root.querySelectorAll('[data-motion-object]')){
        const id=group.dataset.motionObject,sample=this.timeline.sample(id,this.clock()),image=group.querySelector('image'),variant=group.dataset.dollVariant??'muneco-houngan-01';
        if(!sample){group.removeAttribute('transform');image.setAttribute('href',`../assets/tactical/objects/${variant}/${group.dataset.facing??'down-right'}.png`);continue;}
        const offset=projectedOffset(sample,{x:Number(group.dataset.x),y:Number(group.dataset.y)},Number(group.dataset.cameraRotation)||0);
        group.setAttribute('transform',`translate(${offset.x} ${offset.y})`);
        image.setAttribute('href',`../assets/tactical/objects/${variant}/${rotateFacing(sample.direction,Number(group.dataset.cameraRotation)||0)}.png`);
      }
      if(this.timeline.tracks.size)this.frameId=this.frame(tick);
    };
    tick();
  }
}
