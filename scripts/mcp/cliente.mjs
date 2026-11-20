import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ROOT} from '../lib/fs.mjs';

const args=process.argv.slice(2);
const opcao=(nome,padrao)=>{
 const i=args.indexOf(nome);
 return i>=0?args[i+1]:padrao;
};
const servidor=opcao('--servidor','sistema');
const metodo=opcao('--metodo','tools/list');
const ferramenta=opcao('--ferramenta');
const argumentos=opcao('--args','{}');

const comandos={
 sistema:{command:process.execPath,args:[path.join(ROOT,'scripts/mcp/server.mjs')]},
 mausbot:process.platform==='win32'
  ?{command:'cmd.exe',args:['/d','/s','/c','openmausbot.cmd mcp']}
  :{command:'openmausbot',args:['mcp']}
};
const alvo=comandos[servidor];
if(!alvo){
 console.error('Servidor desconhecido. Use sistema ou mausbot.');
 process.exit(2);
}

const child=spawn(alvo.command,alvo.args,{cwd:ROOT,stdio:['pipe','pipe','pipe'],windowsHide:true});
let pendente=new Map(),sequencia=0,buffer='';
child.on('error',e=>{
 for(const resolver of pendente.values())resolver({error:{code:-1,message:e.message}});
 pendente.clear();
});
child.on('exit',()=>{
 for(const resolver of pendente.values())resolver({error:{code:-1,message:'servidor MCP encerrou'}});
 pendente.clear();
});
child.stdout.setEncoding('utf8');
child.stdout.on('data',chunk=>{
 buffer+=chunk;
 let ponto;
 while((ponto=buffer.indexOf('\n'))>=0){
  const linha=buffer.slice(0,ponto).replace(/\r$/,'');
  buffer=buffer.slice(ponto+1);
  if(!linha.trim())continue;
  let msg;try{msg=JSON.parse(linha);}catch{continue;}
  if(msg.id!==undefined&&pendente.has(msg.id)){
   pendente.get(msg.id)(msg);pendente.delete(msg.id);
  }
 }
});
child.stderr.on('data',chunk=>process.stderr.write(chunk));

const enviar=msg=>new Promise(resolve=>{
 const id=++sequencia;
 const timer=setTimeout(()=>{
  if(!pendente.has(id))return;
  pendente.delete(id);
  resolve({error:{code:-1,message:'tempo limite aguardando o servidor MCP'}});
 },15000);
 pendente.set(id,resposta=>{clearTimeout(timer);resolve(resposta);});
 child.stdin.write(JSON.stringify({...msg,id})+'\n');
});
const iniciar=async()=>{
 const resposta=await enviar({jsonrpc:'2.0',method:'initialize',params:{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'medeiros-system-client',version:'1.0.0'}}});
 if(resposta.error)throw Error(resposta.error.message);
 child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
 return resposta;
};

try{
 const init=await iniciar();
 let resposta;
 if(metodo==='tools/list')resposta=await enviar({jsonrpc:'2.0',method:'tools/list',params:{}});
 else if(metodo==='tools/call'){
  if(!ferramenta)throw Error('--ferramenta é obrigatório com tools/call');
  resposta=await enviar({jsonrpc:'2.0',method:'tools/call',params:{name:ferramenta,arguments:JSON.parse(argumentos)}});
 }else resposta=await enviar({jsonrpc:'2.0',method:metodo,params:{}});
 console.log(JSON.stringify({servidor,servidorInfo:init.result?.serverInfo,resposta},null,2));
}catch(e){
 console.error('Falha no cliente MCP:',e.message);
 process.exitCode=1;
}finally{
 child.stdin.end();
 child.kill();
 pendente.clear();
}
