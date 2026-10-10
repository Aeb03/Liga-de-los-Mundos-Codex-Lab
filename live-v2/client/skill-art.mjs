import {catalog} from './catalog.mjs?v=20261009-sapmine1';

// The approved sheets stay intact. SVG viewports show only each illustration,
// excluding the sheet heading, captions and neighbouring cells.
export const skillArtRegions=Object.freeze([
  [30,64,473,394],[535,64,470,394],[1033,64,474,394],
  [30,523,473,412],[535,523,470,412],[1033,523,474,412]
]);
const sources=Object.freeze(Object.fromEntries(Object.keys(catalog).map(id=>[
  id,new URL(`../assets/skills/${id}-abilities-v1.webp`,import.meta.url).href
])));

export function skillArt(championId,skillId){
  const index=catalog[championId]?.skills.findIndex(skill=>skill.id===skillId)??-1;
  if(index<0)return '<span aria-hidden="true">◇</span>';
  const region=skillArtRegions[index];
  return `<svg class="ability-art" data-art-skill="${skillId}" viewBox="${region.join(' ')}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><image href="${sources[championId]}" width="1536" height="1024"/></svg>`;
}
