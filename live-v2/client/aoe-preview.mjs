// Offline AoE interaction parity.
// Source of behavior: combat-core-0625.js @ frozen offline 0b498395.
// Range palette intentionally remains LIVE v2's approved palette.

export const AOE_ABILITIES=new Set(['vines','grenade','collapse','spores','awakening']);

export function createAoEState(abilityId,{target=null,locked=false,mode='drag'}={}){
  if(!AOE_ABILITIES.has(abilityId))return null;
  return {
    active:true,abilityId,mode,target:target?{...target}:null,
    locked:Boolean(locked),dragging:false,downTarget:null,
    suppressClickUntil:0
  };
}
export function sameCell(a,b){return !!(a&&b&&a.x===b.x&&a.y===b.y);}
export function aoePointerDown(state,cell,valid=true){
  if(!state?.active||!cell)return {state,handled:false,secondTap:false};
  const next={...state,downTarget:{...cell}};
  if(!valid){next.dragging=false;return {state:next,handled:true,secondTap:false};}
  if(next.locked&&sameCell(next.target,cell)){
    next.dragging=false;
    return {state:next,handled:true,secondTap:true};
  }
  next.locked=false;next.dragging=true;next.target={...cell};
  return {state:next,handled:true,secondTap:false};
}
export function aoePointerMove(state,cell,valid=true){
  if(!state?.active||!state.dragging||!cell||!valid)return {state,handled:Boolean(state?.active&&state.dragging)};
  return {state:{...state,target:{...cell}},handled:true};
}
export function aoePointerUp(state,cell,valid=true,now=Date.now()){
  if(!state?.active||!cell)return {state,handled:false,commit:false};
  const secondTap=state.locked&&sameCell(state.target,cell)&&sameCell(state.downTarget,cell);
  const next={...state,suppressClickUntil:now+450};
  if(secondTap){
    next.dragging=false;
    return {state:next,handled:true,commit:true};
  }
  if(state.dragging&&valid){
    next.target={...cell};next.locked=true;
  }
  next.dragging=false;
  return {state:next,handled:true,commit:false};
}
export function aoeCancelDrag(state){return state?.active?{...state,dragging:false}:state;}

export function tileFromPoint(doc,event,board){
  if(!doc||!event||!board)return null;
  const list=typeof doc.elementsFromPoint==='function'
    ?doc.elementsFromPoint(event.clientX,event.clientY)
    :[doc.elementFromPoint?.(event.clientX,event.clientY)].filter(Boolean);
  const tile=list.map(node=>node?.closest?.('.tile[data-x][data-y]')).find(node=>node&&board.contains(node));
  if(!tile)return null;
  const x=Number(tile.dataset.x),y=Number(tile.dataset.y);
  return Number.isInteger(x)&&Number.isInteger(y)?{x,y,tile}:null;
}

export function paintAoECells(board,{effect=[],anchor=null,locked=false}={}){
  if(!board)return;
  board.classList.toggle('aoe-preview-active',Boolean(anchor||effect.length));
  board.classList.toggle('aoe-preview-locked-state',Boolean(locked));
  board.querySelectorAll('.aoe-preview,.aoe-preview-center,.aoe-preview-anchor,.aoe-preview-locked').forEach(node=>{
    node.classList.remove('aoe-preview','aoe-preview-center','aoe-preview-anchor','aoe-preview-locked');
  });
  if(anchor){
    board.querySelector(`.tile[data-x="${anchor.x}"][data-y="${anchor.y}"]`)?.classList.add('aoe-preview-anchor');
  }
  for(const cell of effect){
    const tile=board.querySelector(`.tile[data-x="${cell.x}"][data-y="${cell.y}"]`);
    if(!tile)continue;
    tile.classList.add('aoe-preview');
    if(cell.zone==='center'||sameCell(cell,anchor))tile.classList.add('aoe-preview-center');
    if(locked)tile.classList.add('aoe-preview-locked');
  }
}

export function bindAoEGesture(board,{
  getState,setState,isValid,effectFor,onCommit,onChange=()=>{}
}={}){
  if(!board)return ()=>{};
  const doc=board.ownerDocument;
  let pointerId=null;
  const paint=state=>paintAoECells(board,{effect:state?.target?effectFor?.(state)??[]:[],anchor:state?.target??null,locked:state?.locked});
  const down=event=>{
    const state=getState?.();if(!state?.active||event.isPrimary===false)return;
    const hit=tileFromPoint(doc,event,board);if(!hit)return;
    event.preventDefault();event.stopPropagation();
    pointerId=event.pointerId;
    const result=aoePointerDown(state,hit,Boolean(isValid?.(hit,state)));
    setState?.(result.state);paint(result.state);onChange(result.state,{phase:'down'});
    try{board.setPointerCapture?.(pointerId);}catch{}
  };
  const move=event=>{
    if(pointerId!==event.pointerId)return;
    const state=getState?.();if(!state?.active||!state.dragging)return;
    const hit=tileFromPoint(doc,event,board);if(!hit)return;
    event.preventDefault();event.stopPropagation();
    const result=aoePointerMove(state,hit,Boolean(isValid?.(hit,state)));
    setState?.(result.state);paint(result.state);onChange(result.state,{phase:'move'});
  };
  const finish=event=>{
    if(pointerId!==event.pointerId)return;
    const state=getState?.();if(!state?.active){pointerId=null;return;}
    const hit=tileFromPoint(doc,event,board);
    if(hit){
      event.preventDefault();event.stopPropagation();
      const result=aoePointerUp(state,hit,Boolean(isValid?.(hit,state)));
      setState?.(result.state);paint(result.state);onChange(result.state,{phase:'up',commit:result.commit});
      if(result.commit)void onCommit?.(result.state);
    }else{
      const next=aoeCancelDrag(state);setState?.(next);onChange(next,{phase:'cancel'});
    }
    try{board.releasePointerCapture?.(pointerId);}catch{}
    pointerId=null;
  };
  const cancel=event=>{
    if(pointerId!==event.pointerId)return;
    const next=aoeCancelDrag(getState?.());setState?.(next);onChange(next,{phase:'cancel'});
    try{board.releasePointerCapture?.(pointerId);}catch{}pointerId=null;
  };
  const click=event=>{
    const state=getState?.();
    if(!state?.active||Date.now()>(state.suppressClickUntil||0))return;
    if(tileFromPoint(doc,event,board)){event.preventDefault();event.stopImmediatePropagation();}
  };
  board.addEventListener('pointerdown',down,true);
  board.addEventListener('pointermove',move,true);
  board.addEventListener('pointerup',finish,true);
  board.addEventListener('pointercancel',cancel,true);
  board.addEventListener('click',click,true);
  paint(getState?.());
  return ()=>{
    board.removeEventListener('pointerdown',down,true);board.removeEventListener('pointermove',move,true);
    board.removeEventListener('pointerup',finish,true);board.removeEventListener('pointercancel',cancel,true);board.removeEventListener('click',click,true);
  };
}
