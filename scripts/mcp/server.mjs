import {criarDelegadorCodex} from '../codex-delegado.mjs';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {fileURLToPath} from 'node:url';
import {ROOT,safe,readJSON,writeJSON,identifier} from '../lib/fs.mjs';
import {doctor,plan} from '../ecosystem.mjs';
import {listarEspecialidades,inventario} from '../registry.mjs';
import {executar,consultarFila,registrarInicio} from '../orchestrator.mjs';
import {listarInteligencias,carregarInteligencia,sugerirInteligencias} from '../intel.mjs';

const str={type:'string',minLength:1};
const schema=(properties={},required=[])=>({type:'object',properties,required,additionalProperties:false});
const run={projeto:str,runId:str};
const itemSchema=schema({id:str,role:{enum:['orquestrador','executor','revisor']},agente:str,especialidades:{type:'array',items:str},acceptance:str,dependsOn:{type:'array',items:str},files:{type:'array',items:str},tarefa:str,inteligencias:{type:'array',items:str}},['id','role','agente','especialidades','acceptance','dependsOn']);

export const FERRAMENTAS=[
  ['enviar_tarefa','Classifica o pedido e executa a fila de agentes.',schema({projeto:str,tarefa:str,workflow:str,itens:{type:'array',minItems:1,items:itemSchema},runId:str},['projeto','tarefa'])],
  ['listar_especialidades','Lista as especialidades disponíveis.',schema()],
  ['ler_contrato','Lê um contrato Markdown do núcleo.',schema({arquivo:str},['arquivo'])],
  ['criar_plano','Registra uma equipe planejada sem iniciar agentes.',schema({projeto:str,tarefa:str,agentes:{type:'integer',minimum:1,maximum:64},workflow:str},['projeto','tarefa','agentes'])],
  ['consultar_plano','Consulta um plano persistido.',schema(run,['projeto','runId'])],
  ['registrar_agente','Registra o ID real de início; não conclui a tarefa.',schema({...run,agenteId:str,runtimeId:str},['projeto','runId','agenteId','runtimeId'])],
  ['validar_integridade','Valida fontes e adaptadores.',schema()],
  ['ler_memoria','Lê Markdown na memória do projeto.',schema({projeto:str,arquivo:str},['projeto','arquivo'])],
  ['escrever_memoria','Escreve Markdown na memória do projeto.',schema({projeto:str,arquivo:str,conteudo:{type:'string'}},['projeto','arquivo','conteudo'])],
  ['status_orquestrador','Consulta a fila e o inventário.',schema(run,['projeto','runId'])],
  ['listar_inteligencias','Lista as oito inteligências acopladas aos agentes.',schema()],
  ['ler_inteligencia','Carrega uma inteligência e seus parâmetros de pensamento.',schema({id:str},['id'])]
].map(([name,description,inputSchema])=>({name,description,inputSchema}));

function validate(s,v,label='argumentos'){
  if(s.enum&&!s.enum.includes(v))throw Error(label+' inválido');
  if(s.type==='object'){
    if(!v||typeof v!=='object'||Array.isArray(v))throw Error(label+' deve ser objeto');
    for(const key of s.required??[])if(!(key in v))throw Error('Campo obrigatório: '+key);
    for(const [k,value] of Object.entries(v)){
      if(!s.properties[k])throw Error('Campo desconhecido: '+k);
      validate(s.properties[k],value,k);
    }
  }else if(s.type==='array'){
    if(!Array.isArray(v)||v.length<(s.minItems??0))throw Error(label+' deve ser lista');
    for(const x of v)validate(s.items,x,label);
  }else if(s.type==='string'){
    if(typeof v!=='string'||(s.minLength&&!v.trim()))throw Error(label+' deve ser texto');
  }else if(s.type==='integer'&&(!Number.isInteger(v)||v<s.minimum||v>s.maximum))throw Error(label+' inválido');
}

const md=f=>{if(path.extname(f).toLowerCase()!=='.md')throw Error('Somente arquivos .md');return f;};
function memory(projeto,arquivo,create=false){
  md(arquivo);
  if(path.isAbsolute(arquivo))throw Error('Caminho absoluto não permitido');
  const base=safe(projeto,'_memoria');
  const rel=path.relative(base,path.resolve(base,arquivo));
  if(rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))throw Error('Caminho fora da memória');
  if(create)fs.mkdirSync(base,{recursive:true});
  return safe(base,arquivo);
}

function call(name,a,ctx){
  const root=ctx.root??ROOT;
  switch(name){
    case 'enviar_tarefa':
      if(typeof ctx.delegador!=='function')throw Error('Delegador não configurado');
      const inteligencias=a.itens?undefined:sugerirInteligencias(a.tarefa,root).map(i=>i.id);
      return executar(a.projeto,a.tarefa,{workflow:a.workflow,itens:a.itens,inteligencias,runId:a.runId,delegador:ctx.delegador});
    case 'listar_especialidades':return listarEspecialidades(root);
    case 'ler_contrato':return {arquivo:a.arquivo,conteudo:fs.readFileSync(safe(root,md(a.arquivo)),'utf8')};
    case 'criar_plano':return plan(a.projeto,a.agentes,a.tarefa,a.workflow);
    case 'consultar_plano':{
      const stateFile=safe(a.projeto,`.mazyos/runs/${identifier(a.runId)}/state.json`);
      if(fs.existsSync(stateFile))return readJSON(stateFile);
      const queue=safe(a.projeto,`.mazyos/runs/${identifier(a.runId)}/fila.json`);
      if(fs.existsSync(queue))return consultarFila(a.projeto,a.runId);
      return readJSON(stateFile);
    }
    case 'registrar_agente':{
      identifier(a.runId);identifier(a.agenteId);
      if(!a.runtimeId.trim())throw Error('ID real obrigatório');
      const stateFile=safe(a.projeto,`.mazyos/runs/${a.runId}/state.json`);
      const queue=safe(a.projeto,`.mazyos/runs/${a.runId}/fila.json`);
      if(fs.existsSync(queue))return registrarInicio(a.projeto,a.runId,a.agenteId,a.runtimeId);
      const state=readJSON(stateFile),agent=state.agents.find(i=>i.id===a.agenteId);
      if(!agent)throw Error('Agente desconhecido');
      if(agent.runtimeId&&agent.runtimeId!==a.runtimeId.trim())throw Error('ID divergente');
      agent.runtimeId=a.runtimeId.trim();
      agent.status='em_execucao';
      state.startedAgents=state.agents.filter(i=>i.runtimeId).length;
      writeJSON(stateFile,state);
      return agent;
    }
    case 'validar_integridade':return doctor(root);
    case 'ler_memoria':return {arquivo:a.arquivo,conteudo:fs.readFileSync(memory(a.projeto,a.arquivo),'utf8')};
    case 'escrever_memoria':{
      const file=memory(a.projeto,a.arquivo,true);
      fs.mkdirSync(path.dirname(file),{recursive:true});
      fs.writeFileSync(file,a.conteudo);
      return {arquivo:a.arquivo,ok:true};
    }
    case 'status_orquestrador':return {...consultarFila(a.projeto,a.runId),inventario:inventario(root)};
    case 'listar_inteligencias':return listarInteligencias(root);
    case 'ler_inteligencia':return carregarInteligencia(a.id,root);
  }
}

const error=(id,code,message)=>({jsonrpc:'2.0',id:id??null,error:{code,message}});

export function handleMessage(msg,ctx={}){
  if(!msg||Array.isArray(msg)||msg.jsonrpc!=='2.0'||typeof msg.method!=='string')
    return error(msg?.id,-32600,'Mensagem inválida');
  if(msg.id===undefined)return null;
  const ok=result=>({jsonrpc:'2.0',id:msg.id,result});
  if(msg.method==='initialize')return ok({protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'medeiros-system',version:'1.0.0'}});
  if(msg.method==='ping')return ok({});
  if(msg.method==='tools/list')return ok({tools:FERRAMENTAS});
  if(msg.method!=='tools/call')return error(msg.id,-32601,'Método desconhecido');
  const tool=FERRAMENTAS.find(t=>t.name===msg.params?.name);
  if(!tool)return error(msg.id,-32601,'Ferramenta desconhecida');
  try{validate(tool.inputSchema,msg.params.arguments??{});}catch(e){return error(msg.id,-32602,e.message);}
  const wrap=value=>ok({content:[{type:'text',text:JSON.stringify(value,null,2)}]});
  try{
    const r=call(tool.name,msg.params.arguments??{},ctx);
    return r&&typeof r.then==='function'?r.then(wrap,e=>error(msg.id,-32603,e.message)):wrap(r);
  }catch(e){return error(msg.id,-32603,e.message);}
}

export function start(readStream=process.stdin,writeStream=process.stdout,ctx={}){
  const rl=readline.createInterface({input:readStream});
  const send=r=>{if(r)writeStream.write(JSON.stringify(r)+'\n');};
  rl.on('line',line=>{
    if(!line.trim())return;
    let msg;
    try{msg=JSON.parse(line);}catch{send(error(null,-32700,'JSON inválido'));return;}
    Promise.resolve(handleMessage(msg,ctx)).then(send,e=>send(error(msg?.id,-32603,e.message)));
  });
  return rl;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  start(process.stdin,process.stdout,{delegador:criarDelegadorCodex()});
