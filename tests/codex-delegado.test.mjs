import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {montarPrompt,criarDelegadorCodex} from '../scripts/codex-delegado.mjs';

const item={id:'a',role:'executor',agente:'engenheiro-features',especialidades:['expx-sprintx'],acceptance:'Teste verde',dependsOn:[]};

test('prompt isola a tarefa e proibe MCP de orquestracao',()=>{
  const p=montarPrompt(item,{projeto:'/proj',runId:'r1'});
  assert.match(p,/engenheiro-features/);
  assert.match(p,/expx-sprintx/);
  assert.match(p,/Teste verde/);
  assert.match(p,/n[aã]o use as ferramentas (?:MCP )?de orquestra[cç][aã]o/i);
});

test('prompt inclui parametros das inteligencias acopladas',()=>{
  const p=montarPrompt({...item,inteligencias:['intel-marketing-skills']},{projeto:'/proj',runId:'r1'});
  assert.match(p,/Biblioteca de Skills de Marketing/);
  assert.match(p,/portão de três perguntas/);
});

test('captura ID real do JSONL e grava evidencia',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'codex-fake-'));
  const chamadas=[];
  const fake=async(cmd,args)=>{
    chamadas.push(args);
    fs.writeFileSync(args[args.indexOf('-o')+1],'relatorio de inventario');
    return {stdout:'{"type":"thread","session_id":"0199-abc"}\n{"type":"done"}\n',stderr:''};
  };
  const delegar=criarDelegadorCodex({root:dir,executarComando:fake});
  const r=await delegar({...item,runId:'r1'});
  assert.equal(r.runtimeId,'0199-abc');
  assert.match(r.evidence,/relatorio de inventario/);
  assert.ok(chamadas[0].includes('--json'));
});

test('sem ID no JSONL o delegador falha',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'codex-fake-'));
  const fake=async()=>({stdout:'{"type":"done"}\n',stderr:''});
  const delegar=criarDelegadorCodex({root:dir,executarComando:fake});
  await assert.rejects(()=>delegar({...item,runId:'r1'}),/ID de sess[aã]o/);
});
