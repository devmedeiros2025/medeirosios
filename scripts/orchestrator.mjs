import crypto from 'node:crypto';
import path from 'node:path';
import {ROOT,safe,readJSON,writeJSON,identifier} from './lib/fs.mjs';
import {listarAgentes,listarFluxos} from './registry.mjs';
import {chooseWorkflow} from './workflows.mjs';
import {sugerirInteligencias} from './intel.mjs';

export const ESTADOS=['pendente','em_execucao','concluido','bloqueado'];
const LIMITE_CICLOS=64;

function arquivoFila(projeto,runId){
  return safe(projeto,`.mazyos/runs/${identifier(runId)}/fila.json`);
}

function salvar(projeto,runId,fila){
  fila.updatedAt=new Date().toISOString();
  writeJSON(arquivoFila(projeto,runId),fila);
  return fila;
}

function itensPadrao(tarefa,opcoes,projeto){
  if(Array.isArray(opcoes.itens)&&opcoes.itens.length)return opcoes.itens.map(i=>({...i}));
  const agentes=listarAgentes(projeto);
  const fluxos=listarFluxos();
  const id=opcoes.workflow??chooseWorkflow(tarefa);
  const fluxo=fluxos.find(f=>f.id===id);
  if(!fluxo)throw Error('Fluxo desconhecido: '+id);
  return fluxo.stages.map(stage=>({
    id:stage.id,
    role:stage.role,
    agente:agentes.find(a=>a.role===stage.role)?.id??'orquestrador',
    especialidades:stage.skills,
    acceptance:stage.acceptance,
    dependsOn:stage.dependsOn,
    inteligencias:opcoes.inteligencias??sugerirInteligencias(tarefa).map(i=>i.id),
    files:[]
  }));
}

export function criarFila(projeto,tarefa,opcoes={}){
  if(typeof tarefa!=='string'||!tarefa.trim())throw Error('Informe a tarefa');
  const runId=opcoes.runId?identifier(opcoes.runId):
    new Date().toISOString().replaceAll(':','-')+'-'+crypto.randomUUID().slice(0,8);
  const dir=safe(projeto,`.mazyos/runs/${identifier(runId)}`);
  const itens=itensPadrao(tarefa,opcoes,projeto).map(item=>({
    ...item,
    runId,
    tarefa:item.tarefa??tarefa,
    status:'pendente',
    runtimeId:null,
    evidence:[],
    motivo:null,
    concluidoEm:null
  }));
  const fila={
    schema:1,runId,tarefa:tarefa.trim(),
    workflowId:opcoes.workflow??chooseWorkflow(tarefa),
    createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
    itens
  };
  writeJSON(arquivoFila(projeto,runId),fila);
  return {dir,runId,tarefa:fila.tarefa,workflowId:fila.workflowId,itens:fila.itens};
}

export function consultarFila(projeto,runId){
  const fila=readJSON(arquivoFila(projeto,runId));
  const contagem=estado=>fila.itens.filter(i=>i.status===estado).length;
  return {
    runId:fila.runId,tarefa:fila.tarefa,workflowId:fila.workflowId,
    total:fila.itens.length,
    ativa:fila.itens.filter(i=>i.status!=='concluido').map(i=>i.id),
    pendente:contagem('pendente'),em_execucao:contagem('em_execucao'),
    concluido:contagem('concluido'),bloqueado:contagem('bloqueado'),
    updatedAt:fila.updatedAt,itens:fila.itens
  };
}

export function marcarBloqueado(projeto,runId,itemId,motivo){
  const fila=readJSON(arquivoFila(projeto,runId));
  const item=fila.itens.find(i=>i.id===itemId);
  if(!item)throw Error('Item desconhecido: '+itemId);
  item.status='bloqueado';
  item.motivo=String(motivo);
  salvar(projeto,runId,fila);
  return item;
}

export function registrarInicio(projeto,runId,itemId,runtimeId){
  if(!String(runtimeId??'').trim())throw Error('ID real obrigatório');
  const fila=readJSON(arquivoFila(projeto,runId));
  const item=fila.itens.find(i=>i.id===itemId);
  if(!item)throw Error('Item desconhecido: '+itemId);
  if(item.runtimeId&&item.runtimeId!==runtimeId.trim())throw Error('ID divergente');
  item.runtimeId=runtimeId.trim();
  item.status='em_execucao';
  item.motivo=null;
  salvar(projeto,runId,fila);
  return item;
}

export function registrarConclusao(projeto,runId,itemId,resultado){
  const id=String(resultado?.runtimeId??'').trim();
  if(!id)return marcarBloqueado(projeto,runId,itemId,'Delegador não retornou ID real');
  const fila=readJSON(arquivoFila(projeto,runId));
  const item=fila.itens.find(i=>i.id===itemId);
  if(!item)throw Error('Item desconhecido: '+itemId);
  item.status='concluido';
  item.runtimeId=id;
  item.evidence=resultado.evidence??[];
  item.motivo=null;
  item.concluidoEm=new Date().toISOString();
  salvar(projeto,runId,fila);
  return item;
}

export async function dispatchar(projeto,runId,delegador){
  const fila=readJSON(arquivoFila(projeto,runId));
  const prontos=fila.itens.filter(item=>
    item.status==='pendente'&&
    item.dependsOn.every(dep=>fila.itens.find(i=>i.id===dep)?.status==='concluido')
  );
  for(const item of prontos)item.status='em_execucao';
  salvar(projeto,runId,fila);
  await Promise.all(prontos.map(async item=>{
    try{
      const resultado=await delegador(item);
      registrarConclusao(projeto,runId,item.id,resultado);
    }catch(e){
      marcarBloqueado(projeto,runId,item.id,e?.message??String(e));
    }
  }));
  return consultarFila(projeto,runId);
}

export async function processarCiclo(projeto,runId,delegador){
  return dispatchar(projeto,runId,delegador);
}

export async function executar(projeto,tarefa,opcoes={}){
  const criada=criarFila(projeto,tarefa,opcoes);
  const delegador=opcoes.delegador??(async()=>{throw Error('Delegador não configurado');});
  let consulta=consultarFila(projeto,criada.runId);
  let ciclos=0;
  while(consulta.ativa.length&&ciclos<LIMITE_CICLOS){
    const antes=JSON.stringify(consulta.itens.map(i=>[i.id,i.status]));
    consulta=await processarCiclo(projeto,criada.runId,delegador);
    ciclos++;
    const depois=JSON.stringify(consulta.itens.map(i=>[i.id,i.status]));
    if(antes===depois)break;
  }
  return {dir:criada.dir,runId:criada.runId,...consulta};
}
