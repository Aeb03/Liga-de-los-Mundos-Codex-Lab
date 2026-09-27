(()=>{'use strict';
const V='0.6.13';
function rep(){
  const w=document.createTreeWalker(document,NodeFilter.SHOW_TEXT),a=[];
  while(w.nextNode())a.push(w.currentNode);
  for(const n of a){
    let t=n.nodeValue;
    t=t.replaceAll('ARENA TÁCTICA','LIGA DE LOS MUNDOS')
       .replaceAll('Arena Táctica','Liga de los Mundos')
       .replaceAll('CIRCUITO GALÁCTICO','LIGA DE LOS MUNDOS')
       .replaceAll('Circuito Galáctico','Liga de los Mundos')
       .replaceAll('TRANSMISIÓN DEL CIRCUITO','TRANSMISIÓN DE LA LIGA')
       .replaceAll('El circuito abre sus puertas','La Liga abre sus puertas')
       .replaceAll('Competidor del circuito','Competidor de la Liga.')
       .replaceAll('Distintos mundos. Una sola Arena.','Distintos mundos. Una sola Liga.')
       .replace(/v\d+\.\d+\.\d+/g,'v'+V);
    if(t!==n.nodeValue)n.nodeValue=t;
  }
}
function deco(){
  document.title='Liga de los Mundos v'+V;
  rep();
  const version=document.querySelector('.start-version');
  if(version)version.textContent='v'+V;
  const s=document.querySelector('.start-card');
  if(s&&!s.querySelector('.league-main-logo')){
    const a=s.querySelector('.start-stars'),b=s.querySelector('.start-brand'),l=document.createElement('div');
    l.className='league-main-logo';
    l.innerHTML='<img src="./icon-512.png" alt="Liga de los Mundos">';
    a?a.replaceWith(l):s.prepend(l);
    b?.remove();
  }
  const br=document.querySelector('.brand-block');
  if(br&&!br.querySelector('.league-brand-logo')){
    const m=br.querySelector('.brand-mark');
    if(m){
      const i=document.createElement('img');
      i.className='league-brand-logo';
      i.src='./icon-192.png';
      i.alt='';
      m.replaceWith(i);
    }
  }
}
let q=false;
new MutationObserver(()=>{
  if(q)return;
  q=true;
  requestAnimationFrame(()=>{q=false;deco()});
}).observe(document.documentElement,{subtree:true,childList:true});
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',deco,{once:true}):deco();
})();