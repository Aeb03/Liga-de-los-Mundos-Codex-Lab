(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LigaAsyncSnapshot=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const SCHEMA='ldm.combat.snapshot',VERSION=1,FORBIDDEN=new Set(['__proto__','prototype','constructor']);
function plain(v,path='$',seen=new Set()){
  if(v===null||typeof v==='string'||typeof v==='boolean')return v;
  if(typeof v==='number'){if(!Number.isFinite(v))throw new TypeError(`${path}: número no finito`);return v}
  if(typeof v!=='object')throw new TypeError(`${path}: valor no JSON (${typeof v})`);
  if(seen.has(v))throw new TypeError(`${path}: referencia circular`);seen.add(v);
  let out;
  if(Array.isArray(v))out=v.map((x,i)=>plain(x,`${path}[${i}]`,seen));
  else{const proto=Object.getPrototypeOf(v);if(proto!==Object.prototype&&proto!==null)throw new TypeError(`${path}: objeto no plano`);out={};for(const k of Object.keys(v).sort()){if(FORBIDDEN.has(k))throw new TypeError(`${path}: clave prohibida`);out[k]=plain(v[k],`${path}.${k}`,seen)}}
  seen.delete(v);return out;
}
function stableStringify(value){return JSON.stringify(plain(value))}
function hash(value){let h1=0xdeadbeef^0,h2=0x41c6ce57^0;const s=stableStringify(value);for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);h1=Math.imul(h1^c,2654435761);h2=Math.imul(h2^c,1597334677)}h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);return 'c1-'+(h2>>>0).toString(16).padStart(8,'0')+(h1>>>0).toString(16).padStart(8,'0')}
function assertInt(v,name,min=0){if(!Number.isInteger(v)||v<min)throw new TypeError(`${name} inválido`)}
function validate(s){
  plain(s);if(!s||s.schema!==SCHEMA||s.schemaVersion!==VERSION)throw new TypeError('schema de snapshot incompatible');
  assertInt(s.engineVersion,'engineVersion',1);assertInt(s.turnSequence,'turnSequence',0);
  const b=s.battle;if(!b||!Array.isArray(b.units)||!Array.isArray(b.order)||!b.units.length)throw new TypeError('combate incompleto');
  assertInt(b.round,'round',1);assertInt(b.turn,'turn',0);if(b.turn>=b.order.length)throw new TypeError('turn fuera de orden');
  const ids=new Set();for(const u of b.units){if(!u||typeof u.id!=='string'||!u.id||ids.has(u.id))throw new TypeError('unidad/id inválido');ids.add(u.id);if(!Number.isFinite(u.hp)||!Number.isFinite(u.x)||!Number.isFinite(u.y))throw new TypeError('estado de unidad inválido')}
  if(b.order.some(id=>!ids.has(id)))throw new TypeError('orden refiere unidad inexistente');
  for(const k of ['pillars','traps'])if(!Array.isArray(b[k]))throw new TypeError(`${k} inválido`);
  return true;
}
function create(battle,{engineVersion=1,turnSequence=0}={}){const snapshot={schema:SCHEMA,schemaVersion:VERSION,engineVersion,turnSequence,battle:plain(battle)};validate(snapshot);return snapshot}
function clone(s){validate(s);return JSON.parse(stableStringify(s))}
return {SCHEMA,VERSION,plain,stableStringify,hash,validate,create,clone};
});