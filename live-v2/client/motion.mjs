// Presentation only. Every animated cell comes from an accepted server event.
export const stepDirection=(a,b)=>b.x>a.x?'down-right':b.x<a.x?'up-left':b.y>a.y?'down-left':'up-right';
export function spriteSource(championId,direction='down-right') {
  // Effective offline mapping in champion-assets.js, including Coloso's upper views.
  const files={'down-right':'down-left','down-left':'down-right','up-right':'up-left','up-left':'up-right'};
  const view=championId==='coloso'&&direction.startsWith('up-')?direction:files[direction];
  return `../assets/champions/${championId}/${championId}-combat-${view??'down-left'}.png`;
}
const same=(a,b)=>a?.x===b?.x&&a?.y===b?.y;
export function confirmedRoutes(previous,next) {
  if(!previous?.combat||!next?.combat||previous.id!==next.id||next.version<=previous.version||previous.version<(next.presentation?.fromVersion??0))return [];
  const batches=(next.presentation?.moves??[]).filter(b=>b.version>previous.version&&b.version<=next.version).sort((a,b)=>a.version-b.version);
  const routes=[];
  for(const before of previous.combat.units){
    const after=next.combat.units.find(u=>u.id===before.id);
    if(!before.alive||!after?.alive)continue;
    let path=[{x:before.x,y:before.y}],valid=true;
    for(const batch of batches.filter(b=>b.unitId===before.id)){
      if(!Array.isArray(batch.path)||batch.path.length<2||!same(path.at(-1),batch.path[0])){valid=false;break;}
      for(let i=1;i<batch.path.length;i++){
        const p=batch.path[i],last=path.at(-1);
        if(!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.y<0||p.x>11||p.y>11||Math.abs(last.x-p.x)+Math.abs(last.y-p.y)!==1){valid=false;break;}
        path.push({...p});
      }
    }
    if(valid&&path.length>1&&same(path.at(-1),after))routes.push({unitId:before.id,path});
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
    for(const route of routes)this.tracks.set(route.unitId,{...route,start:now,stepMs:Math.min(160,900/(route.path.length-1))});
  }
  sample(id,now){
    const t=this.tracks.get(id);if(!t)return null;
    const elapsed=Math.max(0,now-t.start),step=Math.floor(elapsed/t.stepMs);
    if(step>=t.path.length-1){this.tracks.delete(id);return null;}
    const a=t.path[step],b=t.path[step+1],fraction=(elapsed%t.stepMs)/t.stepMs;
    return {x:a.x+(b.x-a.x)*fraction,y:a.y+(b.y-a.y)*fraction,direction:stepDirection(a,b)};
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
        if(!sample){group.removeAttribute('transform');group.querySelector('image').setAttribute('href',spriteSource(group.dataset.champion,group.dataset.facing));continue;}
        // Isometric offset from the authoritative final position; no state mutation.
        const dx=sample.x-Number(group.dataset.x),dy=sample.y-Number(group.dataset.y);
        group.setAttribute('transform',`translate(${(dx-dy)*20} ${(dx+dy)*10})`);
        const image=group.querySelector('image');image.setAttribute('href',spriteSource(group.dataset.champion,sample.direction));
      }
      if(this.timeline.tracks.size)this.frameId=this.frame(tick);
    };
    tick();
  }
}
