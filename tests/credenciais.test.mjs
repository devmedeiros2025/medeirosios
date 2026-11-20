import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {status,salvar,remover,PROVEDORES} from '../scripts/lib/credenciais.mjs';

function ambiente(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'medeiros-cred-'));
 const anterior=process.env.MEDEIROS_CRED_DIR;
 const cliAnterior=process.env.OPENMAUSBOT_CLI;
 process.env.MEDEIROS_CRED_DIR=dir;
 const registro=path.join(dir,'argv.json');
 const cli=path.join(dir,'cli-falso.mjs');
 fs.writeFileSync(cli,`import fs from 'node:fs';\nfs.writeFileSync(${JSON.stringify(registro)},JSON.stringify(process.argv.slice(2)));`);
 process.env.OPENMAUSBOT_CLI=cli;
 return {dir,registro,restaurar(){
  if(anterior===undefined)delete process.env.MEDEIROS_CRED_DIR;else process.env.MEDEIROS_CRED_DIR=anterior;
  if(cliAnterior===undefined)delete process.env.OPENMAUSBOT_CLI;else process.env.OPENMAUSBOT_CLI=cliAnterior;
  fs.rmSync(dir,{recursive:true,force:true});
 }};
}

test('status comeca sem credenciais configuradas',()=>{
 const a=ambiente();
 try{const r=status();assert.equal(r.total,0);assert.deepEqual(r.configurados,[]);}finally{a.restaurar();}
});

test('salvar rejeita provedor desconhecido',()=>{
 const a=ambiente();
 try{assert.throws(()=>salvar({provedor:'inexistente',chave:'abc'}),/provedor/i);}finally{a.restaurar();}
});

test('salvar guarda a chave fora do repositorio e nao a devolve',()=>{
 const a=ambiente();
 try{
  const r=salvar({provedor:'claude',chave:'sk-teste-secreta'});
  assert.equal(r.ok,true);
  assert.equal(r.provedor,'claude');
  assert.equal(JSON.stringify(r).includes('sk-teste-secreta'),false);
  assert.equal(status().configurados.some(c=>c.provedor==='claude'),true);
  const arquivo=path.join(a.dir,'keys','claude.key');
  assert.equal(fs.readFileSync(arquivo,'utf8'),'sk-teste-secreta');
 }finally{a.restaurar();}
});

test('salvar chama o CLI com key-file sem expor a chave nos argumentos',()=>{
 const a=ambiente();
 try{
  salvar({provedor:'claude',chave:'sk-teste-secreta'});
  const argv=JSON.parse(fs.readFileSync(a.registro,'utf8'));
  assert.deepEqual(argv.slice(0,3),['engine','set','claude']);
  assert.equal(argv.includes('--key-file'),true);
  assert.equal(argv.some(v=>String(v).includes('sk-teste-secreta')),false);
 }finally{a.restaurar();}
});

test('remover apaga a chave e o status',()=>{
 const a=ambiente();
 try{
  salvar({provedor:'openai',chave:'sk-aberta'});
  assert.equal(remover('openai').ok,true);
  assert.equal(status().total,0);
  assert.equal(fs.existsSync(path.join(a.dir,'keys','openai.key')),false);
 }finally{a.restaurar();}
});

test('catalogo de provedores nao inclui a conta do autor',()=>{
 assert.equal(PROVEDORES.includes('claude'),true);
 assert.equal(PROVEDORES.some(p=>/mauricio|medeiros|devmedeiros/i.test(p)),false);
});
