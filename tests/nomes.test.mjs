import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from '../scripts/ecosystem.mjs';
import {PROIBIDOS,ALVOS_TEXTO,textoVisivel} from './helpers/nomes.mjs';

test('texto visivel nao cita terceiros',()=>{
  const alvos=[...ALVOS_TEXTO];
  for(const entry of fs.readdirSync(path.join(ROOT,'.agents/skills'),{withFileTypes:true})){
    if(entry.isDirectory())alvos.push(`.agents/skills/${entry.name}/SKILL.md`);
  }
  const falhas=[];
  for(const arquivo of alvos){
    if(!fs.existsSync(path.join(ROOT,arquivo)))continue;
    const texto=textoVisivel(arquivo);
    if(PROIBIDOS.test(texto))falhas.push(arquivo);
  }
  assert.deepEqual(falhas,[],'texto visivel com nomes de terceiros: '+falhas.join(', '));
});
