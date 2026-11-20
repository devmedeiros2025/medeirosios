import {makeWorkflow} from './workflows.mjs';
import {executar} from './orchestrator.mjs';
import {criarDelegadorCodex} from './codex-delegado.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const BEGIN='<!-- MAZYOS-EXPX:BEGIN -->',END='<!-- MAZYOS-EXPX:END -->';
const read=p=>fs.readFileSync(p,'utf8'),json=p=>JSON.parse(read(p));
const write=(p,data)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,data);};
const slash=p=>p.replaceAll('\\','/');
function safe(root,relative){
 const target=path.resolve(root,relative),rel=path.relative(root,target);
 if(rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))throw Error('Caminho fora da raiz');
 let current=root;for(const part of rel.split(path.sep).filter(Boolean)){current=path.join(current,part);if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())throw Error('Link simbólico não permitido');}
 return target;
}
function projectDir(p){const dir=fs.realpathSync(p);if(!fs.statSync(dir).isDirectory())throw Error('Projeto deve ser pasta');return dir;}
function merge(old,block){
 const starts=old.split(BEGIN).length-1,ends=old.split(END).length-1;
 if(starts!==ends||starts>1)throw Error('Bloco de instruções gerenciadas inválido');
 if(!starts)return old+(old&&!old.endsWith('\n')?'\n':'')+(old?'\n':'')+block+'\n';
 const a=old.indexOf(BEGIN),b=old.indexOf(END);if(b<a)throw Error('Bloco de instruções gerenciadas invertido');
 return old.slice(0,a)+block+old.slice(b+END.length);
}
export function attach(project,root=ROOT){
 project=projectDir(project);root=fs.realpathSync(root);if(project===root)throw Error('A raiz já contém o harness');
 const pointer=slash(path.relative(project,root));
 const block=`${BEGIN}\n## Ecossistema MEDEIROS SYSTEM\nLeia o contrato compartilhado em \`${pointer}/AGENTS.md\` e o catálogo em \`${pointer}/docs/ROTEAMENTO.md\` antes de coordenar este projeto.\nPreserve as instruções locais. Grave trabalho e memória somente neste projeto. N agentes inclui o orquestrador; use delegação real quando disponível.\n${END}`;
 const skillRel='.agents/skills/mazyos-ecosystem/SKILL.md',configRel='.mazyos/ecosystem.json';
 const skillPointer=slash(path.relative(path.join(project,path.dirname(skillRel)),root));
 const skill=`---\nname: mazyos-ecosystem\ndescription: Coordena este projeto com o MEDEIROS SYSTEM quando o usuário pede trabalho com sua equipe de agentes.\n---\n\n<!-- MAZYOS-MANAGED-SKILL -->\nLeia [o contrato](<${skillPointer}/AGENTS.md>) e [o catálogo](<${skillPointer}/docs/ROTEAMENTO.md>). Carregue só as especialidades pertinentes. Não copie memória de outros projetos. N agentes inclui o orquestrador.\n`;
 const configPath=safe(project,configRel);
 if(fs.existsSync(configPath)&&json(configPath).managedBy!=='mazyos-expx')throw Error('Configuração não gerenciada');
 const pending=[];
 for(const name of ['AGENTS.md','CLAUDE.md']){const f=safe(project,name),exists=fs.existsSync(f),old=exists?read(f):'';pending.push({name,exists,old,next:merge(old,block)});}
 const skillPath=safe(project,skillRel),skillExists=fs.existsSync(skillPath);
 if(skillExists&&!read(skillPath).includes('<!-- MAZYOS-MANAGED-SKILL -->'))throw Error('Skill local já existe; nada alterado');
 pending.push({name:skillRel,exists:skillExists,old:skillExists?read(skillPath):'',next:skill});
 pending.push({name:configRel,exists:fs.existsSync(configPath),old:fs.existsSync(configPath)?read(configPath):'',next:JSON.stringify({schema:1,managedBy:'mazyos-expx',core:pointer},null,2)+'\n'});
 const changes=pending.filter(f=>f.old!==f.next),stamp=new Date().toISOString().replaceAll(':','-')+'-'+crypto.randomUUID().slice(0,8);
 const backup=safe(project,`.mazyos/backups/${stamp}`),changed=[];
 try{for(const f of changes){if(f.exists)write(path.join(backup,f.name),f.old);write(safe(project,f.name),f.next);changed.push(f);}}
 catch(e){for(const f of changed.reverse()){const dest=safe(project,f.name);if(f.exists)write(dest,f.old);else fs.unlinkSync(dest);}throw e;}
 return {project,changed:changes.map(f=>f.name),backup:changes.some(f=>f.exists)?backup:null};
}
export function plan(project,count,task,workflowId){
 project=projectDir(project);count=Number(count);if(!Number.isInteger(count)||count<1||count>64)throw Error('agents deve ser inteiro entre 1 e 64');
 if(typeof task!=='string'||!task.trim())throw Error('Informe a tarefa');
 const roles=[{id:'orquestrador',role:'orquestrador'}];
 for(let i=1;i<count;i++)roles.push({id:i===count-1&&count>=3?'revisor':`executor-${i}`,role:i===count-1&&count>=3?'revisor':'executor'});
 const id=new Date().toISOString().replaceAll(':','-')+'-'+crypto.randomUUID().slice(0,8),directory=safe(project,`.mazyos/runs/${id}`);
 const state={schema:1,id,task:task.trim(),status:'planejado',requestedAgents:count,startedAgents:0,runtime:null,agents:roles.map(r=>({...r,status:'nao_iniciado',runtimeId:null,files:[],dependsOn:r.role==='revisor'?roles.filter(x=>x.role==='executor').map(x=>x.id):[],acceptance:[],evidence:[]}))};
 state.workflow=makeWorkflow(task,state.agents,workflowId);
 write(path.join(directory,'state.json'),JSON.stringify(state,null,2)+'\n');
 write(path.join(directory,'ORQUESTRADOR.md'),`# Equipe planejada\n\nPedido: ${task.trim()}\n\nTotal solicitado: ${count}. Agentes iniciados: 0. Este registro não inicia agentes.\n\n${roles.map(r=>`- ${r.id}: ${r.role}`).join('\n')}\n\nDefinir arquivos exclusivos, dependências, aceite e evidências antes de delegar. Iniciar agentes pela ferramenta real da sessão e registrar runtimeId. Respeitar concorrência disponível. Revisor inspeciona o pedido e a entrega sem modificar a implementação.\n`);
 write(path.join(directory,'FLUXO.md'), '# '+state.workflow.title+'\n\n'+state.workflow.stages.map(s=>'## '+s.id+'\nResponsável: '+s.assignee+'\nAceite: '+s.acceptance+'\nEspecialidades: '+s.skills.join(', ')+'\n').join('\n'));
 return {directory,...state};
}
export function createProject(name,root=ROOT){
 if(!/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(name??''))throw Error('Nome inválido');
 const target=safe(root,`projects/${name}`);if(fs.existsSync(target))throw Error('Projeto já existe; use attach');
 fs.mkdirSync(target,{recursive:true});const link=attach(target,root);return {...link,workspace:bootstrap(target,root)};
}
export function bootstrap(project,root=ROOT){
 project=projectDir(project);
 const template=path.join(root,'vendor/mazyos-official/templates/workspace');
 if(!fs.existsSync(template))throw Error('Template de workspace ausente');
 const pending=[],preserved=[];
 function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const src=path.join(dir,entry.name),rel=path.relative(template,src);
  if(entry.isSymbolicLink())throw Error('Link em template não permitido');
  if(entry.isDirectory()){walk(src);continue;}
  const dest=safe(project,rel);
  if(fs.existsSync(dest))preserved.push(rel);else pending.push({src,dest,rel});
 }}
 walk(template);
 for(const file of pending){fs.mkdirSync(path.dirname(file.dest),{recursive:true});fs.copyFileSync(file.src,file.dest,fs.constants.COPYFILE_EXCL);}
 return {project,created:pending.map(f=>f.rel),preserved};
}

// O manifesto foi gerado no Windows (CRLF); o checkout do git pode gravar LF.
// Comparamos as formas canônicas para não confundir line endings com alteração de conteúdo.
function hashesIntegridade(buffer){
 const texto=buffer.toString('utf8');
 const variants=[buffer,Buffer.from(texto.replaceAll('\r\n','\n'),'utf8'),Buffer.from(texto.replace(/\r?\n/g,'\r\n'),'utf8')];
 return variants.map(b=>crypto.createHash('sha256').update(b).digest('hex'));
}
// Backups temporários listados no manifesto podem estar fora do controle de versão.
// A instalação portátil não exige git: nesse caso usamos os .gitignore do próprio pacote.
function regexPadrao(linha){
 let s=linha.trim();
 if(!s||s.startsWith('#'))return null;
 const negar=s.startsWith('!');if(negar)s=s.slice(1);
 const somenteDiretorio=s.endsWith('/');if(somenteDiretorio)s=s.slice(0,-1);
 s=s.replace(/^\//,'');
 const partes=s.split('/');
 let origem='^';
 for(let i=0;i<partes.length;i++){
  if(i)origem+='/';
  const parte=partes[i];
  if(parte==='**'){origem+='(?:.*/)?';continue;}
  origem+=parte.replace(/[.+^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'[^/]*').replace(/\?/g,'[^/]');
 }
 origem+=somenteDiretorio?'(?:/|$)':'$';
 return {regex:new RegExp(origem),negar,comBarra:s.includes('/')};
}
export function ignoradoSemGit(root,relative){
 const partes=relative.replaceAll('\\','/').split('/');
 let ignorado=false;
 for(let i=0;i<partes.length;i++){
  const arquivo=path.join(root,partes.slice(0,i).join('/'),'.gitignore');
  if(!fs.existsSync(arquivo))continue;
  const relativo=partes.slice(i).join('/');
  for(const linha of read(arquivo).split(/\r?\n/)){
   const padrao=regexPadrao(linha);
   if(!padrao)continue;
   const alvo=padrao.comBarra?relativo:partes[partes.length-1];
   if(padrao.regex.test(alvo))ignorado=!padrao.negar;
  }
 }
 return ignorado;
}
function ignoradoPeloGit(root,relative){
 const r=spawnSync('git',['-C',root,'check-ignore','-q','--',relative],{stdio:'ignore'});
 if(r.error||(r.status!==0&&r.status!==1))return ignoradoSemGit(root,relative);
 return r.status===0;
}
export function doctor(root=ROOT){
 const errors=[];
 for(const f of ['AGENTS.md','CLAUDE.md','README.md','docs/COMPATIBILIDADE.md','docs/ROTEAMENTO.md'])if(!fs.existsSync(path.join(root,f)))errors.push('Ausente: '+f);
 const provenance=json(path.join(root,'provenance.json'));
 for(const item of provenance.files){const target=safe(root,item.path);if(!fs.existsSync(target)){if(ignoradoPeloGit(root,item.path))continue;errors.push('Ausente: '+item.path);continue;}if(!hashesIntegridade(fs.readFileSync(target)).includes(item.sha256))errors.push('Hash divergente: '+item.path);}
 const catalog=json(path.join(root,'catalog.json'));
 for(const skill of catalog.skills){if(!fs.existsSync(safe(root,skill.source)))errors.push('Fonte ausente: '+skill.id);const file=path.join(root,'.agents/skills',skill.id,'SKILL.md');if(!fs.existsSync(file)||!read(file).replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').startsWith('---\nname:'))errors.push('Adaptador inválido: '+skill.id);}
 const lock=json(path.join(root,'sources.lock.json'));for(const source of lock.sources)if(!/^[a-f0-9]{40}$/.test(source.commit)||(source.licenseStatus!=='not-declared-at-root'&&!fs.existsSync(path.join(root,source.path,source.licensePath??'LICENSE'))))errors.push('Revisão/licença inválida: '+source.id);
 return {ok:errors.length===0,importedFiles:provenance.files.length,upstreamRepositories:lock.sources.length,specialties:catalog.skills.length,errors};
}
function main(){
 const [command,...args]=process.argv.slice(2),options={};for(let i=0;i<args.length;i+=2){if(!args[i].startsWith('--')||args[i+1]===undefined)throw Error('Argumentos inválidos');options[args[i].slice(2)]=args[i+1];}
 let result;if(command==='attach')result=attach(options.project);else if(command==='bootstrap')result=bootstrap(options.project);else if(command==='new')result=createProject(options.name);else if(command==='plan')result=plan(options.project,options.agents,options.task,options.workflow);else if(command==='run')result=executar(options.project,options.task,{workflow:options.workflow,delegador:criarDelegadorCodex({root:ROOT})});else if(command==='doctor'){result=doctor();if(!result.ok)process.exitCode=1;}else throw Error('Use attach --project PASTA | new --name NOME | plan --project PASTA --agents N --task PEDIDO | run --project PASTA --task PEDIDO | doctor');
 console.log(JSON.stringify(result,null,2));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{main();}catch(e){console.error(e.message);process.exitCode=1;}}
