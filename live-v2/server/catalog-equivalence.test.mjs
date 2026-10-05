import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { EFFECTIVE_SKILLS } from "./authoritative-service.mjs";
const base = "0b4983953a37fca0a60867f1007f78c67b263683";
const files = {
  arfeli: "arfeli-rework-0626.js",
  coloso: "coloso-rework-0627.js",
  piplus: "piplus-rework-0628.js",
  onod: "onod-rework-0629.js",
  korgan: "korgan-rework-0630.js",
  houngan: "hougan-rework-0631.js",
};
test("catálogo de selección coincide con IDs finales de habilidades de los seis reworks", () => {
  for (const [champion, file] of Object.entries(files)) {
    const source = execFileSync("git", ["show", `${base}:${file}`], {encoding:"utf8"});
    const block = source.slice(source.indexOf("abilities:["),source.indexOf("function install"));
    const ids = [...block.matchAll(/\bid:'([^']+)'/g)].map((match) => match[1]);
    if(champion==="houngan"){
      const advanced=execFileSync("git",["show",`${base}:hougan-advanced-0632.js`],{encoding:"utf8"});
      const advancedBlock=advanced.slice(advanced.indexOf("existing.push("),advanced.indexOf("c.abilities=existing"));
      ids.push(...[...advancedBlock.matchAll(/\bid:'([^']+)'/g)].map(match=>match[1]));
    }
    assert.deepEqual(EFFECTIVE_SKILLS[champion], ids, champion);
  }
});
