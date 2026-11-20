import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import readline from 'node:readline';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {FERRAMENTAS,handleMessage} from '../scripts/mcp/server.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

test('initialize e tools/list',()=>{
  const init=handleMessage({jsonrpc:'2.0',id:1,method:'initialize',params:{}});
  assert.equal(init.result.protocolVersion,'2024-11-05');
  assert.deepEqual(init.result.capabilities,{tools:{}});
  const list=handleMessage({jsonrpc:'2.0',id:2,method:'tools/list'});
  assert.equal(list.result.tools.length,12);
  assert.ok(FERRAMENTAS.some(f=>f.name==='enviar_tarefa'));
  assert.equal(handleMessage({jsonrpc:'2.0',method:'notifications/initialized'}),null);
});

test('validar_integridade pelo protocolo',()=>{
  const r=handleMessage({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'validar_integridade',arguments:{}}});
  const dados=JSON.parse(r.result.content[0].text);
  assert.equal(dados.ok,true);
  assert.deepEqual(dados.errors,[]);
});

test('argumento invalido responde erro e nao derruba o servidor',()=>{
  const bad=handleMessage({jsonrpc:'2.0',id:4,method:'tools/call',params:{name:'criar_plano',arguments:{}}});
  assert.ok(bad.error);
  const ok=handleMessage({jsonrpc:'2.0',id:5,method:'tools/list'});
  assert.equal(ok.result.tools.length,12);
});

test('listar_inteligencias e ler_inteligencia pelo protocolo',()=>{
  const lista=handleMessage({jsonrpc:'2.0',id:6,method:'tools/call',params:{name:'listar_inteligencias',arguments:{}}});
  const dados=JSON.parse(lista.result.content[0].text);
  assert.equal(dados.length,8);
  const leitura=handleMessage({jsonrpc:'2.0',id:7,method:'tools/call',params:{name:'ler_inteligencia',arguments:{id:'intel-marketing-skills'}}});
  const inteligencia=JSON.parse(leitura.result.content[0].text);
  assert.equal(inteligencia.id,'intel-marketing-skills');
  assert.ok(inteligencia.parametros.length>=6);
  const invalida=handleMessage({jsonrpc:'2.0',id:8,method:'tools/call',params:{name:'ler_inteligencia',arguments:{id:'../catalog.json'}}});
  assert.ok(invalida.error);
});

test('stdio responde JSONL',async()=>{
  const child=spawn(process.execPath,[path.join(ROOT,'scripts/mcp/server.mjs')],{cwd:ROOT,stdio:['pipe','pipe','pipe']});
  const linhas=[];
  const pronto=new Promise(resolve=>{
    const rl=readline.createInterface({input:child.stdout});
    rl.on('line',l=>{linhas.push(JSON.parse(l));if(linhas.length===2){rl.close();resolve();}});
  });
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{}})+'\n');
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/list'})+'\n');
  await pronto;
  child.kill();
  assert.equal(linhas[0].result.protocolVersion,'2024-11-05');
  assert.equal(linhas[1].result.tools.length,12);
});
