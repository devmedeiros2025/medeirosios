import fs from 'node:fs';
import path from 'node:path';
import {ROOT,readJSON,safe} from './lib/fs.mjs';
import {workflows} from './workflows.mjs';
import {listarInteligencias} from './intel.mjs';

export function listarEspecialidades(root=ROOT){
  return readJSON(path.join(root,'catalog.json')).skills.map(s=>({
    id:s.id,origin:s.origin,source:s.source,adapter:`.agents/skills/${s.id}/SKILL.md`
  }));
}

export function listarAgentes(root=ROOT){
  const dir=safe(root,'.agents/agents');
  if(!fs.existsSync(dir))return [];
  return fs.readdirSync(dir).filter(n=>n.endsWith('.md')).sort().map(n=>{
    const text=fs.readFileSync(safe(root,`.agents/agents/${n}`),'utf8').replace(/^\uFEFF/,'');
    const match=text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if(!match)throw Error('Contrato de agente inválido: '+n);
    const a={id:n.slice(0,-3)};
    for(const line of match[1].split(/\r?\n/)){
      const at=line.indexOf(':');
      if(at>0)a[line.slice(0,at)]=line.slice(at+1).trim();
    }
    for(const key of ['specialties','limits','acceptance','inteligencias'])
      a[key]=(a[key]??'').split(',').map(s=>s.trim()).filter(Boolean);
    return a;
  });
}

export function listarFluxos(){
  return Object.entries(workflows).map(([id,f])=>({
    id,title:f.title,
    stages:f.stages.map(([id,role,skills,acceptance],i)=>({
      id,role,skills,acceptance,dependsOn:i?[f.stages[i-1][0]]:[]
    }))
  }));
}

export function verificarLinks(root=ROOT){
  const broken=[];
  const alvos=[...listarEspecialidades(root).map(s=>s.adapter)];
  const dirInteligencias=safe(root,'.agents/skills');
  if(fs.existsSync(dirInteligencias)){
    for(const entrada of fs.readdirSync(dirInteligencias,{withFileTypes:true})){
      if(entrada.isDirectory()&&entrada.name.startsWith('intel-'))
        alvos.push(`.agents/skills/${entrada.name}/SKILL.md`);
    }
  }
  for(const adapter of alvos){
    const file=safe(root,adapter);
    if(!fs.existsSync(file)){broken.push({file:adapter,target:adapter});continue;}
    for(const m of fs.readFileSync(file,'utf8').matchAll(/\]\(([^)]+)\)/g)){
      const target=m[1].replace(/^<|>$/g,'').replace(/^"|"$/g,'');
      if(/^(https?:|#|mailto:)/.test(target))continue;
      if(!fs.existsSync(path.resolve(path.dirname(file),target.split('#')[0])))
        broken.push({file:adapter,target});
    }
  }
  return {ok:!broken.length,broken};
}

export function inventario(root=ROOT){
  const links=verificarLinks(root);
  return {
    specialties:listarEspecialidades(root).length,
    agents:listarAgentes(root).length,
    flows:listarFluxos().length,
    inteligencias:listarInteligencias(root).map(i=>i.id),
    contracts:['AGENTS.md','CLAUDE.md','docs/FLUXOS.md','docs/ROTEAMENTO.md'],
    brokenLinks:links.broken,ok:links.ok
  };
}
