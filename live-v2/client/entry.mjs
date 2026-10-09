const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const accountAllowed=user=>Boolean(user&&!user.is_anonymous&&user.email_confirmed_at);
export function mountEntry(root,{client,onEnter}){
 let user=null,view='login',busy=false,message='';
 const paint=()=>{root.innerHTML=`<section class="entry-screen" aria-label="Entrada al circuito"><div class="entry-brand"><span>BIENVENIDO AL CIRCUITO</span><h1>LIGA DE LOS MUNDOS</h1><p>Estrategia. Campeones. Tu próxima jugada.</p></div><section class="entry-card"><h2>${accountAllowed(user)?'Tu lugar en la arena':view==='register'?'Crear cuenta':view==='reset'?'Recuperar acceso':'Ingresar al circuito'}</h2>${accountAllowed(user)?`<p>${escape(user.email)}</p><button class="entry-primary" data-entry="account">Ingresar al circuito</button><button data-entry="logout">Cambiar cuenta</button>`:`<form data-entry-form="${view}"><label>Correo<input name="email" type="email" autocomplete="email" required></label>${view!=='reset'?`<label>Contraseña<input name="password" type="password" autocomplete="${view==='register'?'new-password':'current-password'}" ${view==='register'?'minlength="8"':''} required></label>`:''}<button class="entry-primary" ${busy?'disabled':''}>${busy?'Conectando…':view==='register'?'Crear cuenta':view==='reset'?'Enviar instrucciones':'Entrar con mi cuenta'}</button></form><div class="entry-links"><button data-entry="${view==='login'?'register':'login'}">${view==='login'?'Crear cuenta':'Ya tengo cuenta'}</button>${view==='login'?'<button data-entry="reset">Olvidé mi contraseña</button>':''}</div>`}<p class="entry-status" role="status">${escape(message)}</p><div class="entry-demo"><button data-entry="demo">Probar demo como invitado</button><small>Tutorial y partida normal contra IA. Sin guardar resultados.</small></div></section></section>`;root.querySelectorAll('button').forEach(b=>b.disabled=busy);};
 root.addEventListener('click',async event=>{const action=event.target.closest('[data-entry]')?.dataset.entry;if(!action||busy)return;
  if(action==='demo'||action==='account'){root.hidden=true;document.body.classList.remove('at-entry');onEnter(action);return;}
  if(action==='logout'){busy=true;paint();const {error}=await client.auth.signOut();busy=false;if(error)message=error.message;else user=null;paint();return;}
  view=action;message='';paint();
 });
 root.addEventListener('submit',async event=>{const form=event.target.closest('[data-entry-form]');if(!form)return;event.preventDefault();if(busy)return;const values=Object.fromEntries(new FormData(form));busy=true;message='';paint();
  try{let result;const redirect=location.origin+location.pathname;
   if(view==='register'){result=await client.auth.signUp({...values,options:{emailRedirectTo:redirect}});if(result.error)throw result.error;message='Revisá tu correo para confirmar la cuenta.';}
   else if(view==='reset'){result=await client.auth.resetPasswordForEmail(values.email,{redirectTo:redirect});if(result.error)throw result.error;message='Si el correo tiene una cuenta, recibirás las instrucciones.';}
   else{result=await client.auth.signInWithPassword(values);if(result.error)throw result.error;user=result.data.user;if(!accountAllowed(user))throw new Error('Confirmá tu correo antes de entrar.');root.hidden=true;document.body.classList.remove('at-entry');onEnter('account');return;}
  }catch(error){message=error.message;}finally{busy=false;if(!root.hidden)paint();}
 });
 return {async show(){root.hidden=false;document.body.classList.add('at-entry');paint();const {data,error}=await client.auth.getUser();user=error?null:data.user;paint();}};
}
