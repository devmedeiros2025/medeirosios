import test from 'node:test';
import assert from 'node:assert/strict';
import {listarEspecialidades,listarAgentes,listarFluxos,verificarLinks,inventario} from '../scripts/registry.mjs';
import {chooseWorkflow} from '../scripts/workflows.mjs';

test('inventario cruza especialidades, fluxos e links',()=>{
  assert.equal(listarEspecialidades().length,31);
  assert.equal(listarFluxos().length,7);
  assert.deepEqual(verificarLinks().broken,[]);
  const r=inventario();
  assert.equal(r.specialties,31);
  assert.equal(r.flows,7);
  assert.equal(r.ok,true);
  assert.ok(r.contracts.includes('AGENTS.md'));
});

test('classificacao ambigua prioriza manutencao',()=>{
  assert.equal(chooseWorkflow('Corrigir erro na página'),'manutencao');
  assert.equal(chooseWorkflow('Criar página e campanha'),'lancamento');
});
