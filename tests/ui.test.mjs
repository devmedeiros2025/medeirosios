import test from 'node:test';
import assert from 'node:assert/strict';
import {criarServidor} from '../scripts/ui/server.mjs';

test('painel expoe rotas, inteligencias e ferramentas',async()=>{
 const servidor=criarServidor();
 await new Promise(resolve=>servidor.listen(0,'127.0.0.1',resolve));
 try{
  const base=`http://127.0.0.1:${servidor.address().port}`;
  for(const rota of ['/','/api/inventario','/api/integridade','/api/ferramentas','/api/inteligencias']){
   const res=await fetch(base+rota);
   assert.equal(res.status,200,rota);
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
