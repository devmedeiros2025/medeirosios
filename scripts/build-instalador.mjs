import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {ROOT} from './ecosystem.mjs';

export const MAGIA='MSISTLR1';

// Nenhum arquivo de credencial do autor pode entrar no pacote.
const PADROES_CREDENCIAL=[
 /(^|\/)\.git-credentials$/i,
 /(^|\/)\.npmrc$/i,
 /(^|\/)\.env$/i,
 /\.(key|pem|pfx|p12)$/i,
 /(^|\/)credentials?\.(json|txt|ya?ml)$/i,
 /(^|\/)\.ssh(\/|$)/i,
 /(^|\/)id_rsa/i,
 /(^|\/)\.medeiros-system(\/|$)/i
];

export function planejarPayload({repo=ROOT,nodeExe,mausbot}={}){
 if(!nodeExe||!mausbot)throw Error('nodeExe e mausbot sao obrigatorios');
 return [
  {origem:nodeExe,destino:'node/node.exe',arquivo:true},
  {origem:repo,destino:'app',diretorio:true,excluir:['.git','dist','.mazyos/runs']},
  {origem:mausbot,destino:'mausbot',diretorio:true}
 ];
}

export function verificarSemCredenciais(caminhos){
 const ruins=caminhos.filter(c=>PADROES_CREDENCIAL.some(r=>r.test(String(c).replaceAll('\\','/'))));
 if(ruins.length)throw Error('Possivel credencial no payload: '+ruins.slice(0,5).join(', '));
 return true;
}

function listarArquivos(dir,base=dir,acumulador=[]){
 for(const item of fs.readdirSync(dir,{withFileTypes:true})){
  const p=path.join(dir,item.name);
  if(item.isDirectory())listarArquivos(p,base,acumulador);
  else acumulador.push(p);
 }
 return acumulador;
}

function copiarArvore(origem,destino,excluir=[]){
 fs.mkdirSync(destino,{recursive:true});
 for(const item of fs.readdirSync(origem,{withFileTypes:true})){
  if(excluir.includes(item.name))continue;
  const src=path.join(origem,item.name),dst=path.join(destino,item.name);
  if(item.isDirectory())copiarArvore(src,dst,excluir);
  else fs.copyFileSync(src,dst);
 }
}

function executar(comando,args,timeout){
 const r=spawnSync(comando,args,{encoding:'utf8',timeout,windowsHide:true,maxBuffer:16*1024*1024});
 if(r.error||r.status!==0)throw Error('Falha ao executar '+comando+': '+(r.error?.message??(r.stderr||r.stdout||'')).slice(0,600));
 return r;
}

export function construir({
 repo=ROOT,
 nodeExe=process.execPath,
 mausbot=path.join(os.homedir(),'AppData','Roaming','npm','node_modules','openmausbot'),
 saida=path.join(ROOT,'dist','MEDEIROS-SYSTEM-Instalador.exe'),
 csc=path.join(process.env.SystemRoot??'C:\\Windows','Microsoft.NET','Framework64','v4.0.30319','csc.exe'),
 tar=path.join(process.env.SystemRoot??'C:\\Windows','System32','tar.exe'),
 manterTemporario=false
}={}){
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'medeiros-build-'));
 const palco=path.join(tmp,'palco'),compactado=path.join(tmp,'payload.tar.gz'),exe=path.join(tmp,'Instalador.exe');
 try{
  const plano=planejarPayload({repo,nodeExe,mausbot});
  for(const item of plano){
   if(!fs.existsSync(item.origem))throw Error('Origem ausente: '+item.origem);
   const destino=path.join(palco,item.destino);
   if(item.arquivo){fs.mkdirSync(path.dirname(destino),{recursive:true});fs.copyFileSync(item.origem,destino);}
   else copiarArvore(item.origem,destino,item.excluir??[]);
  }
  const arquivos=listarArquivos(palco).map(p=>path.relative(palco,p));
  verificarSemCredenciais(arquivos);
  executar(tar,['-czf',compactado,'-C',palco,'.'],900000);

  const codigo=path.join(ROOT,'scripts','instalador','Program.cs');
  if(!fs.existsSync(codigo))throw Error('Fonte do instalador ausente: '+codigo);
  executar(csc,['/nologo','/target:exe','/out:'+exe,'/r:System.dll','/r:System.Core.dll',codigo],180000);

  const bytesExe=fs.readFileSync(exe),bytesPayload=fs.readFileSync(compactado);
  const tamanho=Buffer.alloc(8);tamanho.writeBigUInt64LE(BigInt(bytesPayload.length));
  const resultado=Buffer.concat([bytesExe,bytesPayload,tamanho,Buffer.from(MAGIA,'ascii')]);
  fs.mkdirSync(path.dirname(saida),{recursive:true});
  fs.writeFileSync(saida,resultado);
  return {ok:true,exe:saida,tamanho:resultado.length,payload:bytesPayload.length,arquivos:arquivos.length,sha256:crypto.createHash('sha256').update(resultado).digest('hex')};
 }finally{
  if(!manterTemporario)fs.rmSync(tmp,{recursive:true,force:true});
 }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 console.log(JSON.stringify(construir(),null,2));
}
