import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from '../scripts/ecosystem.mjs';
import {listarAgentes} from '../scripts/registry.mjs';
import {PROIBIDOS} from './helpers/nomes.mjs';

const catalogo=new Set(JSON.parse(fs.readFileSync(path.join(ROOT,'catalog.json'),'utf8')).skills.map(s=>s.id));

test('oito agentes com papeis e especialidades validas',()=>{
  const agentes=listarAgentes();
  assert.equal(agentes.length,8);
  assert.equal(agentes.filter(a=>a.role==='orquestrador').length,1);
  assert.equal(agentes.filter(a=>a.role==='revisor').length,2);
  for(const a of agentes){
    assert.ok(a.name&&a.description&&a.domain&&a.acceptance.length,a.id);
    assert.ok(a.limits.length>0,a.id);
    assert.ok(a.inteligencias.length>0,a.id+' sem inteligencias acopladas');
    for(const id of a.specialties)assert.ok(catalogo.has(id),a.id+' '+id);
  }
});

test('agentes nao citam terceiros em texto visivel',()=>{
  for(const nome of fs.readdirSync(path.join(ROOT,'.agents/agents'))){
    const texto=fs.readFileSync(path.join(ROOT,'.agents/agents',nome),'utf8')
      .split('\n').filter(l=>!/^(name|specialties|inteligencias):/.test(l)).join('\n');
    assert.equal(PROIBIDOS.test(texto),false,nome);
  }
});
