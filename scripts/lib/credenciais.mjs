import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

export const PROVEDORES=['claude','openai','openrouter','openai-compatible','xai','groq','greenference','modelgo','mistral','cerebras'];

// Nada de credencial dentro do repositorio: o destino fica no perfil de quem instala.
export function diretorio(){
 return process.env.MEDEIROS_CRED_DIR??path.join(os.homedir(),'.medeiros-system');
}
const estadoArquivo=()=>path.join(diretorio(),'estado.json');
const chaveArquivo=provedor=>path.join(diretorio(),'keys',provedor+'.key');

function lerEstado(){
 try{return JSON.parse(fs.readFileSync(estadoArquivo(),'utf8'));}catch{return {configurados:[]};}
}
function salvarEstado(estado){
 fs.mkdirSync(diretorio(),{recursive:true});
 fs.writeFileSync(estadoArquivo(),JSON.stringify(estado,null,2));
}

export function status(){
 const estado=lerEstado();
 const configurados=Array.isArray(estado.configurados)?estado.configurados:[];
 return {diretorio:diretorio(),configurados,total:configurados.length};
}

function executarCli(argv){
 const cli=process.env.OPENMAUSBOT_CLI;
 if(cli&&fs.existsSync(cli)){
  const r=spawnSync(process.execPath,[cli,...argv],{encoding:'utf8',timeout:60000,windowsHide:true});
  return {cli,ok:!r.error&&r.status===0,erro:r.error?.message??(r.status===0?'':(r.stderr||'').trim().slice(0,300))};
 }
 const comando=process.platform==='win32'?'openmausbot.cmd':'openmausbot';
 const r=spawnSync(comando,argv,{encoding:'utf8',timeout:60000,windowsHide:true,shell:process.platform==='win32'});
 return {cli:comando,ok:!r.error&&r.status===0,erro:r.error?.message??(r.status===0?'':(r.stderr||'').trim().slice(0,300))};
}

export function salvar({provedor,chave,baseUrl}={}){
 if(!PROVEDORES.includes(provedor))throw Error('Provedor desconhecido');
 if(typeof chave!=='string'||!chave.trim())throw Error('Chave obrigatoria');
 fs.mkdirSync(path.dirname(chaveArquivo(provedor)),{recursive:true});
 fs.writeFileSync(chaveArquivo(provedor),chave.trim());
 try{fs.chmodSync(chaveArquivo(provedor),0o600);}catch{}
 const argv=['engine','set',provedor,'--key-file',chaveArquivo(provedor)];
 if(baseUrl)argv.push('--base-url',String(baseUrl));
 const cli=executarCli(argv);
 const atualizadoEm=new Date().toISOString();
 const estado=lerEstado();
 const outros=(Array.isArray(estado.configurados)?estado.configurados:[]).filter(c=>c.provedor!==provedor);
 salvarEstado({configurados:[...outros,{provedor,atualizadoEm,baseUrl:Boolean(baseUrl)}]});
 return {ok:true,provedor,configuradoEm:atualizadoEm,cli:cli.cli,cliOk:cli.ok,cliErro:cli.ok?'':cli.erro};
}

export function remover(provedor){
 if(!PROVEDORES.includes(provedor))throw Error('Provedor desconhecido');
 try{fs.unlinkSync(chaveArquivo(provedor));}catch{}
 const estado=lerEstado();
 const configurados=(Array.isArray(estado.configurados)?estado.configurados:[]).filter(c=>c.provedor!==provedor);
 salvarEstado({configurados});
 return {ok:true,provedor};
}
