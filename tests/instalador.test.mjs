import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {ROOT} from '../scripts/ecosystem.mjs';
import {planejarPayload,verificarSemCredenciais,MAGIA} from '../scripts/build-instalador.mjs';

function casaTemporaria(){
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'medeiros-inst-'));
 const arquivos={
  toml:path.join(home,'.codex','config.toml'),
  opencode:path.join(home,'.config','opencode','opencode.json'),
  claude:path.join(home,'.claude.json')
 };
 fs.mkdirSync(path.dirname(arquivos.toml),{recursive:true});
 fs.mkdirSync(path.dirname(arquivos.opencode),{recursive:true});
 fs.writeFileSync(arquivos.toml,'model = "teste"\n');
 fs.writeFileSync(arquivos.opencode,'{}\n');
 fs.writeFileSync(arquivos.claude,'{}\n');
 return {home,arquivos,limpar(){fs.rmSync(home,{recursive:true,force:true});}};
}
function registrar(home,cli){
 const env={...process.env,USERPROFILE:home};
 if(cli)env.OPENMAUSBOT_CLI=cli;else delete env.OPENMAUSBOT_CLI;
 return spawnSync(process.execPath,[path.join(ROOT,'scripts','instalar-mcp.mjs')],{cwd:ROOT,env,encoding:'utf8',timeout:60000});
}

test('instalar-mcp registra o CLI bundlado com caminho absoluto',()=>{
 const c=casaTemporaria();
 try{
  const cli='C:\\MedeirosSystem\\mausbot\\cli.js';
  const r=registrar(c.home,cli);
  assert.equal(r.status,0,r.stderr);
  const qNode=JSON.stringify(process.execPath),qCli=JSON.stringify(cli);
  const toml=fs.readFileSync(c.arquivos.toml,'utf8');
  assert.ok(toml.includes('[mcp_servers.openmausbot]'));
  assert.ok(toml.includes('command = '+qNode),toml);
  assert.ok(toml.includes('args = ['+qCli+', "mcp"]'),toml);
  const opencode=JSON.parse(fs.readFileSync(c.arquivos.opencode,'utf8'));
  assert.deepEqual(opencode.mcp.openmausbot.command,[process.execPath,cli,'mcp']);
  const claude=JSON.parse(fs.readFileSync(c.arquivos.claude,'utf8'));
  assert.deepEqual(claude.mcpServers.openmausbot,{command:process.execPath,args:[cli,'mcp']});
  assert.equal(fs.readdirSync(path.dirname(c.arquivos.toml)).some(n=>n.startsWith('config.toml.bak-')),true);
 }finally{c.limpar();}
});

test('instalar-mcp mantem fallback para CLI global',()=>{
 const c=casaTemporaria();
 try{
  const r=registrar(c.home,null);
  assert.equal(r.status,0,r.stderr);
  const toml=fs.readFileSync(c.arquivos.toml,'utf8');
  assert.ok(toml.includes('command = "'+(process.platform==='win32'?'openmausbot.cmd':'openmausbot')+'"'),toml);
 }finally{c.limpar();}
});

test('payload exclui historico git e dist e nao inclui credenciais',()=>{
 const plano=planejarPayload({repo:ROOT,nodeExe:'C:\\node\\node.exe',mausbot:'C:\\mausbot'});
 assert.deepEqual(plano.map(p=>p.destino),['node/node.exe','app','mausbot']);
 const app=plano.find(p=>p.destino==='app');
 assert.ok(app.excluir.includes('.git'));
 assert.ok(app.excluir.includes('dist'));
 assert.throws(()=>verificarSemCredenciais(['app/.env','mausbot/chaves/producao.key']),/credencial/i);
 assert.doesNotThrow(()=>verificarSemCredenciais(['app/scripts/lib/credenciais.mjs','mausbot/cli.js']));
 assert.equal(MAGIA.length,8);
});
