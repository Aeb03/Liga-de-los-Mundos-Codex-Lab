import { rotateCell } from './hud-camera.mjs?v=20261005-skills2';
export function createVfxPlayer(){

/*
  Liga de los Mundos v0.5.34
  Sistema general reutilizable de VFX — 🟡 EN PRUEBA

  PRINCIPIO:
  1) el motor resuelve la mecánica;
  2) esta capa observa el resultado;
  3) recién entonces reproduce feedback visual.

  Nunca decide daño, curación, escudo, estados, desplazamientos, PA, PM,
  alcance, IA ni condiciones de activación.
  No existe ni se implementa VFX de MISS/FALLO.
*/

const VFX_ROOT_ID='combat-vfx-root';
const VFX_MAX_NODES=72;
let epoch=0;const timers=new Set();
function later(fn,ms){const generation=epoch;const timer=setTimeout(()=>{timers.delete(timer);if(generation===epoch&&!document.hidden)fn();},ms);timers.add(timer);return timer;}

function vfxRoot(){
  let root=document.getElementById(VFX_ROOT_ID);
  if(root)return root;
  root=document.createElement('div');
  root.id=VFX_ROOT_ID;
  root.setAttribute('aria-hidden','true');
  document.body.appendChild(root);
  return root;
}
function vfxTrim(root){
  while(root.children.length>=VFX_MAX_NODES)root.firstElementChild?.remove();
}
function vfxNode(className,html='',duration=700){
  const root=vfxRoot();
  vfxTrim(root);
  const el=document.createElement('div');
  el.className=`combat-vfx ${className}`;
  if(html)el.innerHTML=html;
  root.appendChild(el);
  later(()=>el.remove(),Math.max(160,duration+180));
  return el;
}
function vfxGhost(subject){
  if(!subject||!Number.isFinite(subject.x)||!Number.isFinite(subject.y))return null;
  return {x:subject.x,y:subject.y,id:subject.id||null,type:subject.type||subject.kind||'generic',name:subject.name||''};
}
function vfxPoint(subject){
  if(!subject||!Number.isFinite(subject.x)||!Number.isFinite(subject.y))return null;
  const board=document.querySelector('.live-board');if(!board)return null;
  const rotation=Number(board.closest('.live-battle')?.dataset.arenaRotation)||0;
  const cell=rotateCell(subject.x,subject.y,rotation),matrix=board.getScreenCTM();if(!matrix)return null;
  const point=new DOMPoint(260+(cell.x-cell.y)*20,30+(cell.x+cell.y)*10).matrixTransform(matrix);
  return {x:point.x,y:point.y};
}
function inside(x,y){return x>=0&&y>=0&&x<12&&y<12;}

function vfxPlace(el,p,ox=0,oy=0){
  if(!el||!p)return el;
  el.style.left=`${Math.round(p.x+ox)}px`;
  el.style.top=`${Math.round(p.y+oy)}px`;
  return el;
}
function vfxSafeAnimate(el,keyframes,options){
  if(!el)return null;
  try{
    const a=el.animate(keyframes,options);
    a.finished.catch(()=>{}).finally(()=>el.remove());
    return a;
  }catch(_){
    return null;
  }
}

/* ────────────────────────────────────────────
   PRIMITIVAS VISUALES
   ──────────────────────────────────────────── */

function vfxFloating(subject,text,type='damage'){
  const p=vfxPoint(subject);if(!p)return;
  const el=vfxPlace(vfxNode(`vfx-float vfx-${type}`,String(text),760),p,0,-28);
  vfxSafeAnimate(el,[
    {transform:'translate(-50%,0) scale(.78)',opacity:0},
    {transform:'translate(-50%,-7px) scale(1.08)',opacity:1,offset:.18},
    {transform:'translate(-50%,-27px) scale(1)',opacity:1,offset:.67},
    {transform:'translate(-50%,-44px) scale(.94)',opacity:0}
  ],{duration:700,easing:'cubic-bezier(.2,.8,.2,1)',fill:'forwards'});
}
function vfxImpact(subject,variant='generic'){
  const p=vfxPoint(subject);if(!p)return;
  const el=vfxPlace(vfxNode(`vfx-impact vfx-${variant}`,'<i></i><i></i><i></i>',440),p,0,-8);
  vfxSafeAnimate(el,[
    {transform:'translate(-50%,-50%) scale(.22)',opacity:0},
    {transform:'translate(-50%,-50%) scale(1.02)',opacity:1,offset:.30},
    {transform:'translate(-50%,-50%) scale(1.5)',opacity:0}
  ],{duration:400,easing:'ease-out',fill:'forwards'});
}
function vfxProjectile(from,to,variant='generic'){
  const a=vfxPoint(from),b=vfxPoint(to);if(!a||!b)return;
  const dx=b.x-a.x,dy=b.y-a.y;
  const el=vfxPlace(vfxNode(`vfx-projectile vfx-${variant}`,'',520),a,0,-10);
  vfxSafeAnimate(el,[
    {transform:'translate(-50%,-50%) scale(.7)',opacity:0},
    {transform:'translate(-50%,-50%) scale(1)',opacity:1,offset:.12},
    {transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(1)`,opacity:1,offset:.82},
    {transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.45)`,opacity:0}
  ],{duration:300,easing:'cubic-bezier(.25,.75,.2,1)',fill:'forwards'});
}
function vfxShield(subject){
  const p=vfxPoint(subject);if(!p)return;
  const el=vfxPlace(vfxNode('vfx-shield','<span></span>',650),p,0,-8);
  vfxSafeAnimate(el,[
    {transform:'translate(-50%,-50%) scale(.52)',opacity:0},
    {transform:'translate(-50%,-50%) scale(1)',opacity:1,offset:.3},
    {transform:'translate(-50%,-50%) scale(1.12)',opacity:.7,offset:.7},
    {transform:'translate(-50%,-50%) scale(1.24)',opacity:0}
  ],{duration:600,easing:'ease-out',fill:'forwards'});
}
function vfxShieldBreak(subject){
  const p=vfxPoint(subject);if(!p)return;
  const el=vfxPlace(vfxNode('vfx-shield-break','<i></i><i></i><i></i><i></i><i></i>',620),p,0,-8);
  vfxSafeAnimate(el,[
    {transform:'translate(-50%,-50%) scale(.7)',opacity:0},
    {transform:'translate(-50%,-50%) scale(1)',opacity:1,offset:.22},
    {transform:'translate(-50%,-50%) scale(1.42)',opacity:0}
  ],{duration:540,easing:'ease-out',fill:'forwards'});
}
function vfxArea(cells,variant='generic'){
  if(!Array.isArray(cells))return;
  const unique=new Map();
  for(const c of cells){
    if(!c||!Number.isFinite(c.x)||!Number.isFinite(c.y)||!inside(c.x,c.y))continue;
    unique.set(`${c.x},${c.y}`,c);
  }
  let delay=0;
  for(const c of unique.values()){
    const p=vfxPoint(c);if(!p)continue;
    const el=vfxPlace(vfxNode(`vfx-area vfx-${variant}`,'',650),p);
    vfxSafeAnimate(el,[
      {transform:'translate(-50%,-50%) scale(.35)',opacity:0},
      {transform:'translate(-50%,-50%) scale(1)',opacity:.78,offset:.28},
      {transform:'translate(-50%,-50%) scale(1.38)',opacity:0}
    ],{duration:520,delay,easing:'ease-out',fill:'forwards'});
    delay=Math.min(72,delay+14);
  }
}
function vfxStatusApplied(subject,icon,label=''){
  const p=vfxPoint(subject);if(!p)return;
  const el=vfxPlace(vfxNode('vfx-status-applied',`<b>${icon||'✦'}</b>${label?`<small>${label}</small>`:''}`,760),p,18,-35);
  vfxSafeAnimate(el,[
    {transform:'translate(-50%,0) scale(.4)',opacity:0},
    {transform:'translate(-50%,-5px) scale(1.08)',opacity:1,offset:.25},
    {transform:'translate(-50%,-18px) scale(1)',opacity:1,offset:.68},
    {transform:'translate(-50%,-31px) scale(.9)',opacity:0}
  ],{duration:700,easing:'ease-out',fill:'forwards'});
}
function vfxStatusActivation(subject,icon,label=''){
  const p=vfxPoint(subject);if(!p)return;
  const el=vfxPlace(vfxNode('vfx-status-activation',`<b>${icon||'✦'}</b>${label?`<small>${label}</small>`:''}`,620),p,-18,-20);
  vfxSafeAnimate(el,[
    {transform:'translate(-50%,-50%) scale(.55)',opacity:0},
    {transform:'translate(-50%,-50%) scale(1.15)',opacity:1,offset:.25},
    {transform:'translate(-50%,-50%) scale(.95)',opacity:.9,offset:.62},
    {transform:'translate(-50%,-50%) scale(1.35)',opacity:0}
  ],{duration:540,easing:'ease-out',fill:'forwards'});
}
function vfxForced(subject,source,away=true){
  const p=vfxPoint(subject),s=vfxPoint(source);if(!p||!s)return;
  let dx=p.x-s.x,dy=p.y-s.y;
  if(!away){dx=-dx;dy=-dy}
  const len=Math.hypot(dx,dy)||1;
  dx/=len;dy/=len;
  const angle=Math.atan2(dy,dx)*180/Math.PI;
  const el=vfxPlace(vfxNode('vfx-forced','<b>➜</b>',520),p,-dx*8,-dy*8);
  vfxSafeAnimate(el,[
    {transform:`translate(-50%,-50%) rotate(${angle}deg) translateX(-10px) scale(.7)`,opacity:0},
    {transform:`translate(-50%,-50%) rotate(${angle}deg) translateX(0) scale(1)`,opacity:1,offset:.30},
    {transform:`translate(-50%,-50%) rotate(${angle}deg) translateX(18px) scale(.9)`,opacity:0}
  ],{duration:440,easing:'ease-out',fill:'forwards'});
}
function vfxSpawn(subject,variant='generic'){
  const p=vfxPoint(subject);if(!p)return;
  const el=vfxPlace(vfxNode(`vfx-spawn vfx-${variant}`,'<i></i>',700),p);
  vfxSafeAnimate(el,[
    {transform:'translate(-50%,-50%) scale(.2)',opacity:0},
    {transform:'translate(-50%,-50%) scale(.9)',opacity:1,offset:.28},
    {transform:'translate(-50%,-50%) scale(1.35)',opacity:.7,offset:.62},
    {transform:'translate(-50%,-50%) scale(1.7)',opacity:0}
  ],{duration:620,easing:'ease-out',fill:'forwards'});
}
function vfxVanish(subject,variant='generic'){
  const p=vfxPoint(subject);if(!p)return;
  const el=vfxPlace(vfxNode(`vfx-vanish vfx-${variant}`,'<i></i><i></i><i></i><i></i>',720),p,0,-4);
  vfxSafeAnimate(el,[
    {transform:'translate(-50%,-50%) scale(.72)',opacity:0},
    {transform:'translate(-50%,-50%) scale(1)',opacity:1,offset:.2},
    {transform:'translate(-50%,-50%) scale(1.58)',opacity:0}
  ],{duration:600,easing:'ease-out',fill:'forwards'});
}
function vfxTransfer(from,to,variant='generic'){
  const a=vfxPoint(from),b=vfxPoint(to);if(!a||!b)return;
  const dx=b.x-a.x,dy=b.y-a.y;
  const el=vfxPlace(vfxNode(`vfx-transfer vfx-${variant}`,'<i></i><i></i><i></i>',700),a);
  vfxSafeAnimate(el,[
    {transform:'translate(-50%,-50%) scale(.6)',opacity:0},
    {transform:'translate(-50%,-50%) scale(1)',opacity:1,offset:.15},
    {transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.9)`,opacity:1,offset:.78},
    {transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.35)`,opacity:0}
  ],{duration:520,easing:'cubic-bezier(.25,.75,.2,1)',fill:'forwards'});
}
function vfxTrapActivation(subject,trapType='generic'){
  const p=vfxPoint(subject);if(!p)return;
  const icon=trapType==='mine'?'⚡':trapType==='spikes'?'✦':'◆';
  const el=vfxPlace(vfxNode(`vfx-trap-activation vfx-${trapType}`,`<b>${icon}</b><i></i>`,650),p,0,-2);
  vfxSafeAnimate(el,[
    {transform:'translate(-50%,-50%) scale(.3)',opacity:0},
    {transform:'translate(-50%,-50%) scale(1.12)',opacity:1,offset:.24},
    {transform:'translate(-50%,-50%) scale(1.55)',opacity:0}
  ],{duration:560,easing:'ease-out',fill:'forwards'});
}
function vfxRelation(from,to,kind='mark',mode='apply'){
  const a=vfxPoint(from),b=vfxPoint(to);if(!a||!b)return;
  const dx=b.x-a.x,dy=b.y-a.y;
  const len=Math.hypot(dx,dy);
  const angle=Math.atan2(dy,dx)*180/Math.PI;
  const icon=kind==='link'?'🪡':'🎯';
  const el=vfxPlace(vfxNode(`vfx-relation vfx-${kind} vfx-${mode}`,`<span></span><b>${icon}</b>`,760),a);
  el.style.width=`${Math.max(18,len)}px`;
  el.style.transformOrigin='0 50%';
  el.style.setProperty('--vfx-relation-angle',`${angle}deg`);
  const badge=el.querySelector('b');
  if(badge){
    badge.style.left=`${Math.max(18,len)}px`;
  }
  vfxSafeAnimate(el,[
    {transform:`rotate(${angle}deg) scaleX(.15)`,opacity:0},
    {transform:`rotate(${angle}deg) scaleX(1)`,opacity:.95,offset:.3},
    {transform:`rotate(${angle}deg) scaleX(1)`,opacity:.75,offset:.62},
    {transform:`rotate(${angle}deg) scaleX(.85)`,opacity:0}
  ],{duration:650,easing:'ease-out',fill:'forwards'});
}
function vfxTransform(subject,variant='generic'){
  const p=vfxPoint(subject);if(!p)return;
  const el=vfxPlace(vfxNode(`vfx-transform vfx-${variant}`,'<i></i><span></span>',820),p,0,-6);
  vfxSafeAnimate(el,[
    {transform:'translate(-50%,-50%) scale(.45) rotate(0deg)',opacity:0},
    {transform:'translate(-50%,-50%) scale(1) rotate(80deg)',opacity:1,offset:.34},
    {transform:'translate(-50%,-50%) scale(1.18) rotate(155deg)',opacity:.82,offset:.68},
    {transform:'translate(-50%,-50%) scale(1.42) rotate(220deg)',opacity:0}
  ],{duration:720,easing:'ease-out',fill:'forwards'});
}
function vfxActivationPulse(subject,variant='generic'){
  const p=vfxPoint(subject);if(!p)return;
  const el=vfxPlace(vfxNode(`vfx-activation-pulse vfx-${variant}`,'<i></i>',520),p,0,-7);
  vfxSafeAnimate(el,[
    {transform:'translate(-50%,-50%) scale(.55)',opacity:0},
    {transform:'translate(-50%,-50%) scale(.92)',opacity:.9,offset:.3},
    {transform:'translate(-50%,-50%) scale(1.28)',opacity:0}
  ],{duration:430,easing:'ease-out',fill:'forwards'});
}
function vfxKO(subject){
  const p=vfxPoint(subject);if(!p)return;
  const el=vfxPlace(vfxNode('vfx-ko','<b>KO</b><span>FUERA</span>',1020),p,0,-18);
  vfxSafeAnimate(el,[
    {transform:'translate(-50%,-50%) scale(.45)',opacity:0},
    {transform:'translate(-50%,-50%) scale(1.12)',opacity:1,offset:.22},
    {transform:'translate(-50%,-50%) scale(1)',opacity:1,offset:.72},
    {transform:'translate(-50%,-62%) scale(.9)',opacity:0}
  ],{duration:920,easing:'cubic-bezier(.2,.8,.2,1)',fill:'forwards'});
}


const delays={activation:0,relation:45,transfer:55,projectile:60,area:60,trapActivation:55,transform:80,spawn:95,forced:85,impact:115,shieldBreak:125,float:145,statusActivation:80,statusApplied:165,vanish:150,ko:190};
function play(e){switch(e.type){
case 'activation':vfxActivationPulse(e.subject,e.variant);break;
case 'projectile':vfxProjectile(e.from,e.to,e.variant);break;
case 'impact':vfxImpact(e.subject,e.variant);break;
case 'float':vfxFloating(e.subject,e.text,e.variant);break;
case 'shield':vfxShield(e.subject);break;
case 'shieldBreak':vfxShieldBreak(e.subject);break;
case 'area':vfxArea(e.cells,e.variant);break;
case 'statusApplied':vfxStatusApplied(e.subject,e.icon,e.label);break;
case 'statusActivation':vfxStatusActivation(e.subject,e.icon,e.label);break;
case 'forced':vfxForced(e.subject,e.source,e.away);break;
case 'spawn':vfxSpawn(e.subject,e.variant);break;
case 'vanish':vfxVanish(e.subject,e.variant);break;
case 'transfer':vfxTransfer(e.from,e.to,e.variant);break;
case 'trapActivation':vfxTrapActivation(e.subject,e.trapType);break;
case 'relation':vfxRelation(e.from,e.to,e.kind,e.mode);break;
case 'transform':vfxTransform(e.subject,e.variant);break;
case 'ko':vfxKO(e.subject);break;
}}
return {
 playBatch(events,{reducedMotion=false}={}){for(const e of events??[]){if(reducedMotion&&!['float','statusApplied','ko'].includes(e.type))continue;later(()=>{try{play(e);}catch{}},delays[e.type]??100);}},
 clear(){epoch++;for(const timer of timers)clearTimeout(timer);timers.clear();document.getElementById(VFX_ROOT_ID)?.replaceChildren();}
};
}
