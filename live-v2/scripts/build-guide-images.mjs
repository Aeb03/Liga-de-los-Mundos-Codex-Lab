// Export actual game SVG scenes, embedding their existing art for portable WebP images.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {catalog} from '../client/catalog.mjs';
import {abilityExample,exampleCaption} from '../client/guide-examples.mjs';
import {renderArena} from '../client/presentation.mjs';
const require=createRequire(import.meta.url),sharp=require('sharp');
const root=fileURLToPath(new URL('../../',import.meta.url)),out=path.join(root,'live-v2/assets/guide');await fs.mkdir(out,{recursive:true});
const cache=new Map();
async function image(src){const file=path.resolve(root,'live-v2',src.split('?')[0]);if(!cache.has(file))cache.set(file,`data:image/png;base64,${(await fs.readFile(file)).toString('base64')}`);return cache.get(file);}
const css=await fs.readFile(path.join(root,'live-v2/client/presentation.css'),'utf8');
const base=await image('../assets/arenas/central/arena-central-base.png');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const selected=new Set(process.argv.slice(2));
const manifest={};let exported=0;
for(const [championId,c] of Object.entries(catalog))for(const skill of c.skills){
 const example=abilityExample(championId,skill.id);manifest[skill.id]=exampleCaption(example);
 if(selected.size&&!selected.has(skill.id))continue;
 for(const phase of ['before','after']){
  const combat=example[phase],slots=Object.fromEntries(combat.units.map(u=>[u.id,{...u,skills:c.skills.slice(0,4).map(s=>s.id),confirmed:true}]));
  const state={id:'teaching-scene',phase:'combat',combat,slots,arena:{id:'demo',name:'Arena Central',deployment:{A:[],B:[]},pieces:[]}};
  const html=renderArena({state,actor:'demo',slotId:'A1',canMove:phase==='before',blocked:false,remaining:30,abilitySelection:phase==='before'?{...example.command}:null});
  let svg=html.match(/<svg class="live-board[\s\S]*?<\/svg>/)[0];
  for(const src of [...new Set([...svg.matchAll(/href="([^"]+)"/g)].map(m=>m[1]))])svg=svg.replaceAll(`href="${src}"`,`href="${await image(src)}"`);
  svg=svg.replace(/viewBox="0 0 520 280"/,'x="0" y="85" width="960" height="490" viewBox="70 -30 380 280"').replace('<defs>',`<style><![CDATA[${css} .live-board .tile{fill:transparent;stroke:#a4b47b99;stroke-width:.8}.piece-health text{font-family:DejaVu Sans,sans-serif}.piece-hitbox{fill:transparent}.marker{fill:#64c6f222;stroke-width:2}]]></style><image href="${base}" x="-92" y="-54" width="722" height="388"/><defs>`);
  svg=svg.replace(/<polygon class="([^"]*)"/g,(tag,classes)=>classes.includes('ability-effect')?tag+' style="fill:#ed9844;fill-opacity:.65;stroke:#fff0bc;stroke-width:2.5"':classes.includes('forced-destination')?tag+' style="fill:#8856bb;fill-opacity:.65;stroke:#d6adff;stroke-width:2.5"':tag);
  const a=combat.units.find(u=>u.id==='A1'),b=combat.units.find(u=>u.id==='B1');
  const statuses=entity=>[entity.status.wound?`Herida ${entity.status.wound}`:'',entity.status.poison?`Veneno ${entity.status.poison}`:'',entity.status.pmPenaltyNext?`−${entity.status.pmPenaltyNext} PM próximo turno`:'',entity.status.paPenaltyNext?`−${entity.status.paPenaltyNext} PA próximo turno`:'',entity.status.markedBy?'Marcado':'',entity.linkedTargetId?'Vínculo activo':'',entity.houganPainTransfer?'Dolor 50/50':'',entity.houganDance?'Danza preparada':'',entity.piplusFixationTargetId?'Fijación activa':''].filter(Boolean).join(' · ');
  const shield=(a.shield??[]).reduce((n,s)=>n+s.amount,0);
  const canvas=`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640"><rect width="960" height="640" fill="#0c171e"/><style>text{font-family:DejaVu Sans,sans-serif;fill:#edf3ed}</style><text x="28" y="34" font-size="22" font-weight="bold">${esc(skill.name)} · ${phase==='before'?'Objetivo':'Resultado'}</text><text x="28" y="66" font-size="18" fill="#64c6f2">${esc(a.name)}: ${a.hp} PV · ${a.pa} PA · ${a.pm} PM${shield?` · Escudo ${shield}`:''}</text><text x="590" y="66" font-size="18" fill="#f18b83">Rival: ${b.hp} PV · ${b.pa} PA · ${b.pm} PM</text>${svg}<rect x="0" y="575" width="960" height="65" fill="#14242e"/><text x="28" y="599" font-size="16">${esc(statuses(a)||'Azul · campeón que usa la habilidad')}</text><text x="28" y="624" font-size="16">${esc(statuses(b)||'Rojo · rival')}</text></svg>`;
  exported++;await sharp(Buffer.from(canvas)).webp({quality:82}).toFile(path.join(out,`${championId}-${skill.id}-${phase}.webp`));
 }
}
await fs.writeFile(path.join(out,'captions.json'),JSON.stringify(manifest,null,2)+'\n');console.log(`Exported ${exported} game images`);
