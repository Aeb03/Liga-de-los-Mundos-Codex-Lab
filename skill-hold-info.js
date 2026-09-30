(()=>{'use strict';

const HOLD_MS=1500;
const MOVE_TOLERANCE=14;

let timer=0;
let pointerId=null;
let startX=0;
let startY=0;
let activeButton=null;
let tooltip=null;
let shown=false;

function ensureTooltip(){
  if(tooltip?.isConnected)return tooltip;
  tooltip=document.createElement('div');
  tooltip.className='skill-hold-tooltip';
  tooltip.setAttribute('role','tooltip');
  tooltip.setAttribute('aria-hidden','true');
  document.body.appendChild(tooltip);
  return tooltip;
}

function safeActionInfo(id,button){
  let info=null;
  try{
    if(typeof actionInfo==='function')info=actionInfo(id);
  }catch(_){}
  return {
    icon:button?.querySelector('.skill-icon')?.textContent?.trim()||'✨',
    name:info?.name||button?.querySelector('b')?.textContent?.trim()||'Habilidad',
    cost:info?.cost||button?.querySelector('.pa-cost')?.textContent?.trim()||'',
    text:info?.text||button?.querySelector('small')?.textContent?.trim()||'',
    target:info?.target||'',
    range:info?.range||''
  };
}

function line(className,text){
  const node=document.createElement('span');
  node.className=className;
  node.textContent=text;
  return node;
}

function showTooltip(button){
  if(!button?.isConnected)return;
  const data=safeActionInfo(button.dataset.skill||button.dataset.onlineAbility,button);
  const box=ensureTooltip();
  box.replaceChildren();

  const head=document.createElement('div');
  head.className='skill-hold-tooltip-head';
  head.append(
    line('skill-hold-tooltip-icon',data.icon),
    line('skill-hold-tooltip-name',data.name),
    line('skill-hold-tooltip-cost',data.cost)
  );
  box.appendChild(head);

  if(data.text){
    const p=document.createElement('p');
    p.className='skill-hold-tooltip-text';
    p.textContent=data.text;
    box.appendChild(p);
  }

  if(data.target||data.range){
    const meta=document.createElement('div');
    meta.className='skill-hold-tooltip-meta';
    if(data.target)meta.appendChild(line('',`🎯 ${data.target}`));
    if(data.range)meta.appendChild(line('',`📏 ${data.range}`));
    box.appendChild(meta);
  }

  shown=true;
  document.documentElement.classList.add('skill-hold-open');
  box.classList.add('is-visible');
  box.setAttribute('aria-hidden','false');
}

function hideTooltip(){
  if(timer){clearTimeout(timer);timer=0}
  if(tooltip){
    tooltip.classList.remove('is-visible');
    tooltip.setAttribute('aria-hidden','true');
  }
  document.documentElement.classList.remove('skill-hold-open');
  activeButton?.classList.remove('skill-hold-arming');
  shown=false;
}

function resetHold(){
  hideTooltip();
  pointerId=null;
  activeButton=null;
}

document.addEventListener('pointerdown',e=>{
  const button=e.target.closest?.('[data-skill],[data-online-ability]');
  if(!button||!button.closest('.battle-command-panel'))return;
  if(e.isPrimary===false)return;

  resetHold();
  pointerId=e.pointerId;
  activeButton=button;
  startX=e.clientX;
  startY=e.clientY;
  button.classList.add('skill-hold-arming');

  timer=setTimeout(()=>{
    timer=0;
    if(pointerId===e.pointerId&&activeButton===button)showTooltip(button);
  },HOLD_MS);
},true);

document.addEventListener('pointermove',e=>{
  if(pointerId!==e.pointerId||!activeButton)return;
  if(shown)return;
  if(Math.hypot(e.clientX-startX,e.clientY-startY)>MOVE_TOLERANCE)resetHold();
},true);

document.addEventListener('pointerup',e=>{
  if(pointerId!==e.pointerId)return;
  resetHold();
},true);

document.addEventListener('pointercancel',e=>{
  if(pointerId!==e.pointerId)return;
  resetHold();
},true);

document.addEventListener('contextmenu',e=>{
  if(e.target.closest?.('[data-skill],[data-online-ability]'))e.preventDefault();
},true);

window.addEventListener('blur',resetHold);
document.addEventListener('visibilitychange',()=>{if(document.hidden)resetHold()});

})();