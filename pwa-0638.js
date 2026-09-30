(()=>{'use strict';
let p=null,r=null,u=false;
const st=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const atSafeStart=()=>!!document.querySelector('.start-screen')&&!document.querySelector('.battle-screen');

const isLocalDev=()=>{
  const h=location.hostname;
  return h==='localhost'||h==='127.0.0.1'||/^192\.168\./.test(h)||/^10\./.test(h)||/^172\.(1[6-9]|2\d|3[01])\./.test(h);
};
async function disableDevCache(){
  if(!isLocalDev()||!('serviceWorker' in navigator))return false;
  try{
    const regs=await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(x=>x.unregister()));
    if('caches' in window){const ks=await caches.keys();await Promise.all(ks.map(k=>caches.delete(k)))}
    if(navigator.serviceWorker.controller&&sessionStorage.getItem('liga-dev-cache-reset')!=='1'){
      sessionStorage.setItem('liga-dev-cache-reset','1');
      location.replace('./index.html?v=0638h5');
      return true;
    }
    sessionStorage.removeItem('liga-dev-cache-reset');
  }catch(e){console.warn('DEV cache reset:',e)}
  return true;
}

function b(){
  let x=document.getElementById('pwaInstallButton');
  if(!x){
    x=document.createElement('button');
    x.id='pwaInstallButton';
    x.className='pwa-install-button';
    x.type='button';
    x.textContent='⬇ Instalar app';
    x.hidden=true;
    x.onclick=async()=>{
      if(!p)return;
      const q=p;p=null;x.hidden=true;
      try{await q.prompt();await q.userChoice}catch(e){}
    };
    document.body.appendChild(x);
  }
  return x;
}
function rb(){b().hidden=!(p&&!st())}

function activateWaitingIfSafe(){
  if(!r?.waiting||!st()||!atSafeStart())return false;
  if(sessionStorage.getItem('liga-pwa-updating')==='1')return false;
  sessionStorage.setItem('liga-pwa-updating','1');
  u=true;
  r.waiting.postMessage({type:'SKIP_WAITING'});
  return true;
}

function ub(){
  if(activateWaitingIfSafe())return;
  if(document.querySelector('.pwa-update-banner'))return;
  const x=document.createElement('div');
  x.className='pwa-update-banner';
  x.innerHTML='<span><b>Nueva versión disponible</b><small>Actualizá cuando termines la partida.</small></span><button class="pwa-update-now">Actualizar</button><button class="pwa-update-close">×</button>';
  x.querySelector('.pwa-update-now').onclick=()=>{
    if(!r?.waiting)return;
    u=true;
    sessionStorage.setItem('liga-pwa-updating','1');
    r.waiting.postMessage({type:'SKIP_WAITING'});
  };
  x.querySelector('.pwa-update-close').onclick=()=>x.remove();
  document.body.appendChild(x);
}

addEventListener('beforeinstallprompt',e=>{e.preventDefault();p=e;rb()});
addEventListener('appinstalled',()=>{p=null;rb()});

async function s(){
  rb();
  if(await disableDevCache())return;
  if(!('serviceWorker'in navigator))return;
  try{
    r=await navigator.serviceWorker.register('./sw.js?v=0638h5',{updateViaCache:'none'});
    try{await r.update()}catch(_){}

    if(r.waiting&&navigator.serviceWorker.controller)ub();

    r.addEventListener('updatefound',()=>{
      const w=r.installing;
      if(w)w.addEventListener('statechange',()=>{
        if(w.state==='installed'&&navigator.serviceWorker.controller)ub();
      });
    });

    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      if(!u)return;
      sessionStorage.removeItem('liga-pwa-updating');
      location.replace('./index.html?v=0638h5');
    });
  }catch(e){console.warn('PWA:',e)}
}

document.readyState==='loading'
  ?document.addEventListener('DOMContentLoaded',s,{once:true})
  :s();
})();