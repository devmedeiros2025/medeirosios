import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {criarFila,consultarFila,dispatchar,registrarConclusao,processarCiclo} from '../scripts/orchestrator.mjs';

const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'fila-test-'));
const itens=[
  {id:'a',role:'executor',agente:'engenheiro-features',especialidades:['expx-sprintx'],acceptance:'Teste passa',dependsOn:[]},
  {id:'b',role:'executor',agente:'estrategista-negocio',especialidades:['mazyos-seo'],acceptance:'Copy alinhada',dependsOn:[]},
  {id:'c',role:'executor',agente:'analista-dados',especialidades:['mazyos-analisar-dados'],acceptance:'Metrica calculada',dependsOn:[]}
];

test('tres independentes entram em execucao no mesmo ciclo',async()=>{
  const p=tmp(),f=criarFila(p,'Tarefa',{itens});
  const vistos=[];
  const delegador=async item=>{
    vistos.push(consultarFila(p,f.runId).ativa.length);
    return {runtimeId:'sess-'+item.id,evidence:'ok'};
  };
  await dispatchar(p,f.runId,delegador);
  assert.deepEqual(vistos,[3,3,3]);
  const r=consultarFila(p,f.runId);
  assert.equal(r.ativa.length,0);
  assert.equal(r.concluido,3);
});

test('falha e id ausente geram bloqueado, nunca concluido',async()=>{
  const p=tmp(),f=criarFila(p,'Tarefa',{itens});
  const delegador=async item=>{
    if(item.id==='b')throw new Error('timeout');
    if(item.id==='c')return {runtimeId:'  ',evidence:''};
    return {runtimeId:'sess-a',evidence:'ok'};
  };
  const r=await dispatchar(p,f.runId,delegador);
  assert.equal(r.concluido,1);
  assert.equal(r.bloqueado,2);
  assert.equal(r.ativa.length,2);
  const b=r.itens.find(i=>i.id==='b'),c=r.itens.find(i=>i.id==='c');
  assert.match(b.motivo,/timeout/);
  assert.match(c.motivo,/ID real/);
  assert.equal(c.runtimeId,null);
});

test('dependencia so entra depois que a anterior conclui',async()=>{
  const p=tmp(),dependentes=[
    {...itens[0]},
    {...itens[1],id:'d',dependsOn:['a']}
  ];
  const f=criarFila(p,'Tarefa',{itens:dependentes});
  const ordem=[];
  const delegador=async item=>{ordem.push(item.id);return {runtimeId:'s-'+item.id,evidence:'ok'};};
  const r=await processarCiclo(p,f.runId,delegador);
  assert.deepEqual(ordem,['a']);
  assert.equal(r.ativa.length,1);
  const r2=await processarCiclo(p,f.runId,delegador);
  assert.deepEqual(ordem,['a','d']);
  assert.equal(r2.ativa.length,0);
});

test('itens padrao herdam inteligencias sugeridas pela tarefa',()=>{
  const p=tmp();
  const f=criarFila(p,'Escrever copy com diagnóstico e portão de perguntas');
  assert.ok(f.itens.length>0);
  assert.ok(f.itens.every(i=>i.inteligencias.includes('intel-marketing-skills')));
});

test('retomada nao reenvia itens concluidos',async()=>{
  const p=tmp(),f=criarFila(p,'Tarefa',{itens});
  registrarConclusao(p,f.runId,'a',{runtimeId:'s-a',evidence:'ok'});
  const enviados=[];
  await processarCiclo(p,f.runId,async item=>{enviados.push(item.id);return {runtimeId:'s-'+item.id,evidence:'ok'};});
  assert.ok(!enviados.includes('a'));
  assert.deepEqual(enviados.sort(),['b','c']);
});

test('registrarConclusao sem ID real marca bloqueado',()=>{
  const p=tmp(),f=criarFila(p,'Tarefa',{itens});
  const item=registrarConclusao(p,f.runId,'a',{runtimeId:'',evidence:'ok'});
  assert.equal(item.status,'bloqueado');
  assert.match(item.motivo,/ID real/);
});
