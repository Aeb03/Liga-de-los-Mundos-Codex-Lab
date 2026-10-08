import test from 'node:test';
import assert from 'node:assert/strict';
import {featuredChampion,nextChampion} from './lobby.mjs';
import {catalog} from './catalog.mjs';
test('Stored featured champion accepts only real catalog entries',()=>{assert.equal(featuredChampion('onod'),'onod');for(const invalid of ['missing','__proto__','constructor',null])assert.equal(featuredChampion(invalid),'arfeli');});
test('Carousel reaches every original champion and wraps both directions',()=>{const ids=Object.keys(catalog);let current=ids[0];const visited=[];for(let i=0;i<ids.length;i++){visited.push(current);current=nextChampion(current,1);}assert.deepEqual(visited,ids);assert.equal(current,ids[0]);assert.equal(nextChampion(ids[0],-1),ids.at(-1));});
