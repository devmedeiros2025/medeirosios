import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {ROOT} from './ecosystem.mjs';
import {MAGIA} from './build-instalador.mjs';

const exe=process.argv[2]??path.join(ROOT,'dist','MEDEIROS-SYSTEM-Instalador.exe');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'medeiros-validar-'));
const instalado=path.join(temp,'instalado'),home=path.join(temp,'home');
const registro=path.join(temp,'argv.json'),cliFalso=path.join(temp,'cli-falso.mjs');
const servidorLog=path.join(temp,'painel.log');
let processo=null;

function falhar(mensagem){throw Error(mensagem);}
function esperar(ms){return new Promise(r=>setTimeout(r,ms));}
async function ateResponder(url,tentativas=40){
 for(let i=0;i<tentativas;i++){
  try{const r=await fetch(url);if(r.ok)return r;}catch{}
  await esperar(250);
 }
 falhar('Painel nao respondeu: '+url);
}

try{
 if(!fs.existsSync(exe))falhar('Executavel ausente: '+exe);
 const bytes=fs.readFileSync(exe);
 if(bytes.subarray(bytes.length-8).toString('ascii')!==MAGIA)falhar('Assinatura do instalador invalida');

 for(const [arquivo,conteudo] of [
  [path.join(home,'.codex','config.toml'),'model = "teste"\n'],
  [path.join(home,'.config','opencode','opencode.json'),'{}\n'],
  [path.join(home,'.claude.json'),'{}\n']
 ]){fs.mkdirSync(path.dirname(arquivo),{recursive:true});fs.writeFileSync(arquivo,conteudo);}
 fs.writeFileSync(cliFalso,`import fs from 'node:fs';\nfs.writeFileSync(${JSON.stringify(registro)},JSON.stringify(process.argv.slice(2)));`);

 const env={...process.env,USERPROFILE:home,MEDEIROS_INSTALL_DIR:instalado,MEDEIROS_NO_LAUNCH:'1',MEDEIROS_NO_SHORTCUT:'1'};
 delete env.MEDEIROS_CRED_DIR;delete env.OPENMAUSBOT_CLI;
 const r=spawnSync(exe,[],{env,encoding:'utf8',timeout:900000,windowsHide:true});
 if(r.status!==0)falhar('Instalador falhou: '+r.stdout+' '+r.stderr);
 const linha=r.stdout.split(/\r?\n/).filter(l=>l.trim().startsWith('{')).pop();
 const instalacao=JSON.parse(linha);
 if(instalacao.ok!==true)falhar('Instalador retornou ok=false: '+linha);

 const node=path.join(instalado,'node','node.exe');
 const cli=path.join(instalado,'mausbot','cli.js');
 const painel=path.join(instalado,'app','scripts','ui','server.mjs');
 for(const f of [node,cli,painel,path.join(instalado,'versao.txt')])if(!fs.existsSync(f))falhar('Ausente apos instalacao: '+f);

 const toml=fs.readFileSync(path.join(home,'.codex','config.toml'),'utf8');
 if(!toml.includes(JSON.stringify(node))||!toml.includes(JSON.stringify(cli)))falhar('MCP nao registrou os caminhos bundlados');
 const opencode=JSON.parse(fs.readFileSync(path.join(home,'.config','opencode','opencode.json'),'utf8'));
 if(opencode.mcp.openmausbot.command[0]!==node||opencode.mcp.openmausbot.command[1]!==cli)falhar('MCP opencode incorreto');

 const doctor=JSON.parse(spawnSync(node,[path.join(instalado,'app','scripts','ecosystem.mjs'),'doctor'],{
  cwd:path.join(instalado,'app'),encoding:'utf8',timeout:180000
 }).stdout);
 if(doctor.ok!==true||doctor.importedFiles!==1727||doctor.upstreamRepositories!==11||doctor.specialties!==31)falhar('Doctor do pacote divergiu: '+JSON.stringify(doctor));

 const ajuda=spawnSync(node,[cli,'help'],{encoding:'utf8',timeout:180000});
 if(ajuda.status!==0)falhar('CLI bundlado nao executou: '+(ajuda.stderr||'').slice(0,300));

 const porta=8800+Math.floor(Math.random()*900);
 const saida=fs.openSync(servidorLog,'w');
 processo=spawn(node,[painel],{
  cwd:path.join(instalado,'app'),
  env:{...process.env,PORTA:String(porta),MEDEIROS_CRED_DIR:path.join(temp,'cred'),OPENMAUSBOT_CLI:cliFalso},
  stdio:['ignore',saida,saida],windowsHide:true
 });
 const base='http://127.0.0.1:'+porta;
 await ateResponder(base+'/');
 const html=await (await fetch(base+'/')).text();
 if(!/Credenciais/i.test(html)||!/type="password"/i.test(html))falhar('Tela de credenciais ausente no pacote');

 const chave='sk-chave-ficticia-validacao';
 const resposta=await fetch(base+'/api/credenciais',{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({provedor:'claude',chave})
 });
 const corpo=await resposta.json();
 if(resposta.status!==200||corpo.ok!==true)falhar('Falha ao salvar credencial: '+JSON.stringify(corpo));
 if(JSON.stringify(corpo).includes(chave))falhar('Resposta revelou a chave');
 const estado=await (await fetch(base+'/api/credenciais')).json();
 if(estado.total!==1||JSON.stringify(estado).includes(chave))falhar('Status revelou a chave');
 const argv=JSON.parse(fs.readFileSync(registro,'utf8'));
 if(argv[2]!=='claude'||!argv.includes('--key-file')||argv.some(v=>String(v).includes(chave)))falhar('CLI chamado de forma insegura: '+JSON.stringify(argv));

 const resultado={
  ok:true,
  exe:path.basename(exe),
  sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
  tamanho:bytes.length,
  instalacao:instalacao.instalacao,
  etapas:instalacao.etapas,
  doctor:{ok:doctor.ok,importedFiles:doctor.importedFiles,upstreamRepositories:doctor.upstreamRepositories,specialties:doctor.specialties},
  cliBundlado:true,
  painel:true,
  credenciais:{salvou:true,segredoNaoExposto:true,caminhoArquivo:!argv.some(v=>String(v).includes(chave))}
 };
 console.log(JSON.stringify(resultado,null,2));
}finally{
 if(processo){try{processo.kill();}catch{}}
 fs.rmSync(temp,{recursive:true,force:true});
}
