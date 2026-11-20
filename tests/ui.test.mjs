import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {criarServidor} from '../scripts/ui/server.mjs';

test('painel expoe rotas, inteligencias e ferramentas',async()=>{
 const servidor=criarServidor();
 await new Promise(resolve=>servidor.listen(0,'127.0.0.1',resolve));
 try{
  const base=`http://127.0.0.1:${servidor.address().port}`;
  for(const rota of ['/','/api/inventario','/api/integridade','/api/ferramentas','/api/inteligencias']){
   const res=await fetch(base+rota);
   assert.equal(res.status,200,rota+' '+(await res.text()).slice(0,200));
  }
  const inventario=await (await fetch(base+'/api/inventario')).json();
  assert.equal(inventario.inteligencias.length,8);
  const inteligencias=await (await fetch(base+'/api/inteligencias')).json();
  assert.equal(inteligencias.length,8);
  const ferramentas=await (await fetch(base+'/api/ferramentas')).json();
  assert.equal(ferramentas.length,12);
  const html=await (await fetch(base+'/')).text();
  assert.match(html,/4f46e5/i);
  assert.match(html,/Inteligências/i);
 }finally{
  await new Promise(resolve=>servidor.close(resolve));
 }
});
test('painel oferece tela de credenciais proprias sem revelar segredos',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'medeiros-ui-cred-'));
 const anterior=process.env.MEDEIROS_CRED_DIR;
 const cliAnterior=process.env.OPENMAUSBOT_CLI;
 process.env.MEDEIROS_CRED_DIR=dir;
 const cli=path.join(dir,'cli.mjs');
 fs.writeFileSync(cli,'');
 process.env.OPENMAUSBOT_CLI=cli;
 const servidor=criarServidor();
 await new Promise(resolve=>servidor.listen(0,'127.0.0.1',resolve));
 try{
  const base=`http://127.0.0.1:${servidor.address().port}`;
  const html=await (await fetch(base+'/')).text();
  assert.match(html,/Credenciais/i);
  assert.match(html,/type=\"password\"/i);
  const antes=await (await fetch(base+'/api/credenciais')).json();
  assert.equal(antes.total,0);
  const resposta=await fetch(base+'/api/credenciais',{
   method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({provedor:'claude',chave:'sk-ultra-secreta'})
  });
  const corpo=await resposta.json();
  assert.equal(resposta.status,200,JSON.stringify(corpo));
  assert.equal(corpo.ok,true);
  assert.equal(JSON.stringify(corpo).includes('sk-ultra-secreta'),false);
  const depois=await (await fetch(base+'/api/credenciais')).json();
  assert.equal(depois.total,1);
  assert.equal(JSON.stringify(depois).includes('sk-ultra-secreta'),false);
 }finally{
  await new Promise(resolve=>servidor.close(resolve));
  if(anterior===undefined)delete process.env.MEDEIROS_CRED_DIR;else process.env.MEDEIROS_CRED_DIR=anterior;
  if(cliAnterior===undefined)delete process.env.OPENMAUSBOT_CLI;else process.env.OPENMAUSBOT_CLI=cliAnterior;
  fs.rmSync(dir,{recursive:true,force:true});
 }
});
