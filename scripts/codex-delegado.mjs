import {execFile} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {ROOT,safe,identifier} from './lib/fs.mjs';
import {carregarInteligencia} from './intel.mjs';

const executarPadrao=(cmd,args,options)=>new Promise((resolve,reject)=>{
  execFile(cmd,args,{...options,maxBuffer:8*1024*1024},(erro,stdout,stderr)=>{
    if(erro)reject(erro);else resolve({stdout,stderr});
  });
});

export function montarPrompt(item,{projeto,runId}={}){
  const blocos=(item.inteligencias??[]).map(id=>{
    try{
      const inteligencia=carregarInteligencia(id);
      return `Inteligência "${inteligencia.titulo}" — parâmetros:\n${inteligencia.parametros.map(p=>'- '+p).join('\n')}`;
    }catch{return null;}
  }).filter(Boolean);
  return [
    'Você é um agente delegado do MEDEIROS SYSTEM.',
    `Função: ${item.role}. Agente: ${item.agente}.`,
    `Especialidades: ${(item.especialidades??[]).join(', ')||'nenhuma declarada'}.`,
    `Critério de aceite: ${item.acceptance}.`,
    ...(blocos.length?['Inteligências acopladas — leia e aplique:',...blocos]:[]),
    `Tarefa: ${item.tarefa??'execute somente o item recebido'}.`,
    `Evidência: escreva o resultado em ${projeto??'.'}/.mazyos/runs/${runId??'avulso'}/${item.id}.md.`,
    'Não use as ferramentas MCP de orquestração; execute somente esta tarefa.'
  ].join('\n');
}

export function criarDelegadorCodex({root=ROOT,executarComando=executarPadrao,codex='codex'}={}){
  return async item=>{
    const runId=item.runId??'avulso';
    const evidenceFile=safe(root,`.mazyos/runs/${identifier(runId)}/${identifier(item.id)}.md`);
    fs.mkdirSync(path.dirname(evidenceFile),{recursive:true});
    const prompt=montarPrompt(item,{projeto:root,runId});
    const args=['exec','--json','--skip-git-repo-check','-C',root,'-o',evidenceFile,prompt];
    const {stdout}=await executarComando(codex,args,{cwd:root});
    let runtimeId=null;
    for(const linha of String(stdout).split(/\r?\n/)){
      if(!linha.trim())continue;
      let msg;
      try{msg=JSON.parse(linha);}catch{continue;}
      for(const chave of ['session_id','thread_id','id']){
        const valor=msg?.[chave];
        if(typeof valor==='string'&&valor.trim()){runtimeId=valor.trim();break;}
      }
      if(runtimeId)break;
    }
    if(!runtimeId)throw Error('Codex não retornou ID de sessão');
    const evidence=fs.existsSync(evidenceFile)
      ? fs.readFileSync(evidenceFile,'utf8').slice(0,20000)
      : String(stdout).trim().slice(0,2000);
    return {runtimeId,evidence};
  };
}
