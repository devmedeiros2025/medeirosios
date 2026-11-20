import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {ROOT} from './lib/fs.mjs';

const home=os.homedir();
const codex=path.join(home,'.codex','config.toml');
const opencode=path.join(home,'.config','opencode','opencode.json');
const claude=path.join(home,'.claude.json');
const checagens=[];
const checar=(nome,ok,detalhe)=>checagens.push({nome,ok:Boolean(ok),detalhe});

const codexTexto=fs.existsSync(codex)?fs.readFileSync(codex,'utf8'):'';
checar('codex: medeiros_system registrado',/\[mcp_servers\.medeiros_system\]/.test(codexTexto),codex);
checar('codex: mausbot registrado',/\[mcp_servers\.(?:openmausbot|mausbot)\]/.test(codexTexto),codex);

const opencodeTexto=fs.existsSync(opencode)?fs.readFileSync(opencode,'utf8'):'';
checar('opencode: mausbot registrado',/"(?:openmausbot|mausbot)"\s*:/.test(opencodeTexto),opencode);

const claudeTexto=fs.existsSync(claude)?fs.readFileSync(claude,'utf8'):'';
checar('claude: mausbot registrado',/"(?:openmausbot|mausbot)"\s*:/.test(claudeTexto),claude);

const cliente=path.join(ROOT,'scripts/mcp/cliente.mjs');
for(const servidor of ['sistema','mausbot']){
 const r=spawnSync(process.execPath,[cliente,'--servidor',servidor],{cwd:ROOT,encoding:'utf8',timeout:30000,windowsHide:true});
 let ferramentas=0;
 try{ferramentas=JSON.parse(r.stdout).resposta?.result?.tools?.length??0;}catch{}
 checar(`cliente MCP ${servidor}`,r.status===0&&ferramentas>0,`${ferramentas} ferramentas; ${(r.stderr||'').trim().slice(0,160)}`);
}

const ok=checagens.every(c=>c.ok);
console.log(JSON.stringify({ok,checagens},null,2));
if(!ok)process.exitCode=1;
