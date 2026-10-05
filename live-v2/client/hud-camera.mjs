export const HUD_STORAGE_KEY='live-v2-hud-v045';
export const HUD_DEFAULTS=Object.freeze({
  player:{x:null,y:null,collapsed:false,orientation:'vertical'},
  enemy:{x:null,y:null,collapsed:false,orientation:'vertical'},
  command:{x:null,y:null,collapsed:false,orientation:'horizontal'},
  round:{x:null,y:null,collapsed:false,orientation:'horizontal'},
  camera:{x:null,y:null,collapsed:false,orientation:'horizontal'}
});
const LOCKED_HORIZONTAL=new Set(['round','command']);
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

export function normalizeHudSettings(raw={}){
  const out={};
  for(const key of Object.keys(HUD_DEFAULTS)){
    const saved=raw?.[key]&&typeof raw[key]==='object'?raw[key]:{};
    out[key]={...HUD_DEFAULTS[key],...saved};
    if(LOCKED_HORIZONTAL.has(key))out[key].orientation='horizontal';
    if(out[key].x!=null)out[key].x=clamp(Number(out[key].x)||0,0,1);
    if(out[key].y!=null)out[key].y=clamp(Number(out[key].y)||0,0,1);
    out[key].collapsed=Boolean(out[key].collapsed);
  }
  return out;
}
export function loadHudSettings(storage=globalThis.localStorage){
  try{return normalizeHudSettings(JSON.parse(storage?.getItem(HUD_STORAGE_KEY)||'{}')||{});}catch{return normalizeHudSettings({});}
}
export function saveHudSetting(storage,key,patch){
  const all=loadHudSettings(storage);
  if(!all[key])return all;
  all[key]={...all[key],...patch};
  const normalized=normalizeHudSettings(all);
  try{storage?.setItem(HUD_STORAGE_KEY,JSON.stringify(normalized));}catch{}
  return normalized;
}
export function resetHudSettings(storage=globalThis.localStorage){
  try{storage?.removeItem(HUD_STORAGE_KEY);}catch{}
  return normalizeHudSettings({});
}
export function hudClass(settings,key){
  const h=normalizeHudSettings(settings)[key]??HUD_DEFAULTS[key];
  return `${h.collapsed?'collapsed':''} hud-${h.orientation}`.trim();
}
export function hudControls(settings,key,{collapseLabel=''}={}){
  const h=normalizeHudSettings(settings)[key]??HUD_DEFAULTS[key],locked=LOCKED_HORIZONTAL.has(key);
  const orient=locked?'':`<button class="hud-tool" data-hud-orient="${key}" type="button" aria-label="Cambiar orientación" title="Horizontal / vertical">${h.orientation==='vertical'?'↔':'↕'}</button>`;
  return `<button class="hud-tool hud-drag-handle" type="button" aria-label="Mover panel" title="Mover">⠿</button>${orient}<button class="hud-tool" data-hud-collapse="${key}" type="button" aria-label="Plegar o desplegar" title="Plegar / desplegar">${collapseLabel||(h.collapsed?'＋':'−')}</button>`;
}
function viewportBox(){
  const vv=globalThis.visualViewport;
  return {
    left:Math.round(vv?.offsetLeft||0),
    top:Math.round(vv?.offsetTop||0),
    width:Math.max(1,Math.round(vv?.width||globalThis.innerWidth||globalThis.document?.documentElement?.clientWidth||1)),
    height:Math.max(1,Math.round(vv?.height||globalThis.innerHeight||globalThis.document?.documentElement?.clientHeight||1))
  };
}
function setHudCoords(panel,x,y){
  panel.style.setProperty('left',`${Math.round(x)}px`,'important');
  panel.style.setProperty('top',`${Math.round(y)}px`,'important');
  panel.style.setProperty('right','auto','important');
  panel.style.setProperty('bottom','auto','important');
  panel.style.setProperty('transform','none','important');
}
function hudIsFixed(panel){return globalThis.getComputedStyle?.(panel)?.position==='fixed';}
function hudBox(root,panel){return hudIsFixed(panel)?viewportBox():root.getBoundingClientRect();}
export function applyStoredHudPositions(root,settings){
  if(!root)return;
  const all=normalizeHudSettings(settings);
  for(const panel of root.querySelectorAll('[data-hud-panel]')){
    const key=panel.dataset.hudPanel,pos=all[key];
    if(!pos||pos.x==null||pos.y==null)continue;
    const fixed=hudIsFixed(panel),cr=hudBox(root,panel),pr=panel.getBoundingClientRect();
    const usableX=Math.max(1,cr.width-pr.width),usableY=Math.max(1,cr.height-pr.height);
    const relX=clamp(Math.round(clamp(pos.x,0,1)*usableX),2,Math.max(2,usableX-2));
    const relY=clamp(Math.round(clamp(pos.y,0,1)*usableY),2,Math.max(2,usableY-2));
    setHudCoords(panel,fixed?cr.left+relX:relX,fixed?cr.top+relY:relY);
  }
}
export function bindDraggableHud(root,{storage=globalThis.localStorage,onStored=()=>{}}={}){
  if(!root)return;
  let settings=loadHudSettings(storage);
  applyStoredHudPositions(root,settings);
  for(const panel of root.querySelectorAll('[data-hud-panel]')){
    const key=panel.dataset.hudPanel,handle=panel.querySelector('.hud-drag-handle');
    if(!key||!handle)continue;
    let pointer=null,startX=0,startY=0,left=0,top=0,moved=false,raf=0,nextX=0,nextY=0;
    const paint=()=>{raf=0;setHudCoords(panel,nextX,nextY);};
    handle.addEventListener('pointerdown',event=>{
      if(event.pointerType==='mouse'&&event.button!==0)return;
      event.preventDefault();event.stopPropagation();
      pointer=event.pointerId;moved=false;
      const pr=panel.getBoundingClientRect(),fixed=hudIsFixed(panel),cr=hudBox(root,panel);
      startX=event.clientX;startY=event.clientY;left=fixed?pr.left:(pr.left-cr.left);top=fixed?pr.top:(pr.top-cr.top);
      handle.setPointerCapture?.(pointer);panel.classList.add('dragging');
    });
    handle.addEventListener('pointermove',event=>{
      if(pointer!==event.pointerId)return;
      const dx=event.clientX-startX,dy=event.clientY-startY;
      if(!moved&&Math.hypot(dx,dy)<1.5)return;
      moved=true;event.preventDefault();
      const pr=panel.getBoundingClientRect(),fixed=hudIsFixed(panel),cr=hudBox(root,panel);
      const minX=fixed?cr.left:2,minY=fixed?cr.top:2,maxX=fixed?cr.left+cr.width-pr.width-2:cr.width-pr.width-2,maxY=fixed?cr.top+cr.height-pr.height-2:cr.height-pr.height-2;
      nextX=clamp(left+dx,minX,Math.max(minX,maxX));
      nextY=clamp(top+dy,minY,Math.max(minY,maxY));
      if(!raf)raf=requestAnimationFrame(paint);
    });
    const finish=event=>{
      if(pointer!==event.pointerId)return;
      if(raf){cancelAnimationFrame(raf);raf=0;paint();}
      if(moved){
        const pr=panel.getBoundingClientRect(),cr=hudBox(root,panel);
        const usableX=Math.max(1,cr.width-pr.width),usableY=Math.max(1,cr.height-pr.height);
        settings=saveHudSetting(storage,key,{
          x:clamp((pr.left-cr.left)/usableX,0,1),
          y:clamp((pr.top-cr.top)/usableY,0,1)
        });
        onStored(settings);
      }
      panel.classList.remove('dragging');
      try{handle.releasePointerCapture?.(pointer);}catch{}
      pointer=null;
    };
    handle.addEventListener('pointerup',finish);
    handle.addEventListener('pointercancel',finish);
    handle.addEventListener('lostpointercapture',event=>{if(pointer===event.pointerId)finish(event);});
  }
}

export function normalizeRotation(rotation){return ((Number(rotation)||0)%4+4)%4;}
export function rotateCell(x,y,rotation=0,size=12){
  const r=normalizeRotation(rotation);
  if(r===1)return {x:size-1-y,y:x};
  if(r===2)return {x:size-1-x,y:size-1-y};
  if(r===3)return {x:y,y:size-1-x};
  return {x,y};
}
const FACING_VECTOR={
  'down-right':[1,0],
  'down-left':[0,1],
  'up-left':[-1,0],
  'up-right':[0,-1]
};
const VECTOR_FACING={'1,0':'down-right','0,1':'down-left','-1,0':'up-left','0,-1':'up-right'};
export function rotateFacing(facing,rotation=0){
  let [dx,dy]=FACING_VECTOR[facing]??FACING_VECTOR['down-right'];
  for(let i=0;i<normalizeRotation(rotation);i++)[dx,dy]=[-dy,dx];
  return VECTOR_FACING[`${dx},${dy}`]??'down-right';
}
export function clampCamera(camera,width=1,height=1){
  const limitX=Math.max(90,Math.max(1,width)*.46),limitY=Math.max(70,Math.max(1,height)*.46);
  return {x:clamp(Number(camera?.x)||0,-limitX,limitX),y:clamp(Number(camera?.y)||0,-limitY,limitY),rotation:normalizeRotation(camera?.rotation)};
}
export function cameraParallax(camera){
  return {
    x:clamp((Number(camera?.x)||0)*.22,-56,56),
    y:clamp((Number(camera?.y)||0)*.14,-20,20)
  };
}
export function applyCameraDom(root,camera){
  if(!root)return camera;
  const stage=root.querySelector('.arena-stage'),scene=root.querySelector('.arena-scene');
  const next=clampCamera(camera,stage?.offsetWidth||1,stage?.offsetHeight||1),bg=cameraParallax(next);
  if(scene)scene.style.transform=`translate(${next.x}px,${next.y}px)`;
  root.style.setProperty('--arena-bg-parallax-x',`${bg.x.toFixed(2)}px`);
  root.style.setProperty('--arena-bg-parallax-y',`${bg.y.toFixed(2)}px`);
  root.dataset.arenaRotation=String(next.rotation);
  return next;
}
export function bindBattleCamera(root,camera,{onChange=()=>{}}={}){
  const stage=root?.querySelector('.arena-stage');if(!stage)return ()=>{};
  Object.assign(camera,applyCameraDom(root,camera));
  let pointer=null,startX=0,startY=0,baseX=0,baseY=0,moved=false,raf=0,next=null,suppressClick=false;
  const paint=()=>{raf=0;if(!next)return;Object.assign(camera,next);Object.assign(camera,applyCameraDom(root,camera));onChange(camera);};
  const down=event=>{
    if(event.pointerType==='mouse'&&event.button!==0)return;
    pointer=event.pointerId;startX=event.clientX;startY=event.clientY;baseX=camera.x;baseY=camera.y;moved=false;next=null;
    try{stage.setPointerCapture(pointer);}catch{}
  };
  const move=event=>{
    if(pointer!==event.pointerId)return;
    const dx=event.clientX-startX,dy=event.clientY-startY;
    if(!moved&&Math.hypot(dx,dy)<7)return;
    moved=true;event.preventDefault();
    next=clampCamera({x:baseX+dx,y:baseY+dy,rotation:camera.rotation},stage.offsetWidth,stage.offsetHeight);
    if(!raf)raf=requestAnimationFrame(paint);
  };
  const finish=event=>{
    if(pointer!==event.pointerId)return;
    if(raf){cancelAnimationFrame(raf);raf=0;paint();}
    if(moved){suppressClick=true;event.preventDefault();setTimeout(()=>{suppressClick=false;},350);}
    try{stage.releasePointerCapture(pointer);}catch{}
    pointer=null;
  };
  const click=event=>{if(!suppressClick)return;suppressClick=false;event.preventDefault();event.stopImmediatePropagation();};
  stage.addEventListener('pointerdown',down);
  stage.addEventListener('pointermove',move);
  stage.addEventListener('pointerup',finish);
  stage.addEventListener('pointercancel',finish);
  stage.addEventListener('click',click,true);
  return ()=>{stage.removeEventListener('pointerdown',down);stage.removeEventListener('pointermove',move);stage.removeEventListener('pointerup',finish);stage.removeEventListener('pointercancel',finish);stage.removeEventListener('click',click,true);};
}
export function centerCameraOn(root,camera,entityId){
  if(!root||!entityId)return camera;
  const stage=root.querySelector('.arena-stage');
  const entity=[...root.querySelectorAll('.arena-scene [data-inspect-id]')].find(node=>node.dataset.inspectId===entityId);
  if(!stage||!entity)return camera;
  const rr=root.getBoundingClientRect(),er=entity.getBoundingClientRect();
  const targetX=rr.left+rr.width/2,targetY=rr.top+rr.height*.52;
  const centered=clampCamera({x:camera.x+(targetX-(er.left+er.width/2)),y:camera.y+(targetY-(er.top+er.height/2)),rotation:camera.rotation},stage.offsetWidth,stage.offsetHeight);
  Object.assign(camera,centered);applyCameraDom(root,camera);return camera;
}
