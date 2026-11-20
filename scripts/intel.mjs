import fs from 'node:fs';
import path from 'node:path';
import {ROOT,safe,identifier} from './lib/fs.mjs';

const DIR='.agents/skills';
const validarId=id=>{
 identifier(id);
 if(!/^intel-[a-z0-9-]+$/.test(id))throw Error('Identificador inválido');
 return id;
};
const normalizar=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

function frontmatter(texto){
 const m=texto.match(/^---\r?\n([\s\S]*?)\r?\n---/);
 if(!m)return {};
 const out={};
 for(const linha of m[1].split(/\r?\n/)){
  const i=linha.indexOf(':');
  if(i>0)out[linha.slice(0,i).trim()]=linha.slice(i+1).trim();
 }
 return out;
}

function secoes(texto){
 const marcas=[...texto.matchAll(/^## (.+)$/gm)];
 const out={};
 for(let i=0;i<marcas.length;i++){
  const inicio=marcas[i].index+marcas[i][0].length;
  const fim=i+1<marcas.length?marcas[i+1].index:texto.length;
  out[marcas[i][1].trim()]=texto.slice(inicio,fim).trim();
 }
 return out;
}

function lista(texto=''){
 return texto.split(/\r?\n/)
  .map(l=>l.replace(/^\s*(?:[-*]|\d+[.)])\s+/,'').trim())
  .filter(Boolean);
}

export function listarInteligencias(root=ROOT){
 const dir=safe(root,DIR);
 if(!fs.existsSync(dir))return [];
 return fs.readdirSync(dir,{withFileTypes:true})
  .filter(e=>e.isDirectory()&&/^intel-[a-z0-9-]+$/.test(e.name))
  .map(e=>{
   const rel=`${DIR}/${e.name}/SKILL.md`;
   const file=safe(root,rel);
   if(!fs.existsSync(file))return null;
   const fm=frontmatter(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
   return {
    id:e.name,
    titulo:fm.titulo??e.name,
    descricao:fm.description??'',
    categoria:fm.categoria??'',
    palavrasChave:(fm['palavras-chave']??'').split(',').map(s=>s.trim()).filter(Boolean),
    arquivo:rel
   };
  })
  .filter(Boolean)
  .sort((a,b)=>a.id.localeCompare(b.id));
}

export function carregarInteligencia(id,root=ROOT){
 validarId(id);
 const rel=`${DIR}/${id}/SKILL.md`;
 const file=safe(root,rel);
 if(!fs.existsSync(file))throw Error('Inteligência desconhecida: '+id);
 const texto=fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'');
 const fm=frontmatter(texto),s=secoes(texto);
 return {
  id,
  titulo:fm.titulo??id,
  descricao:fm.description??'',
  categoria:fm.categoria??'',
  conteudo:texto,
  parametros:lista(s['Parâmetros de pensamento']),
  fluxo:lista(s['Fluxo de trabalho']),
  entradasSaidas:lista(s['Entradas e saídas']),
  limites:lista(s['Limites e ressalvas']),
  quandoUsar:lista(s['Quando usar']),
  quandoNaoUsar:lista(s['Quando não usar']),
  fontes:lista(s['Fontes de sustentação'])
 };
}

export function sugerirInteligencias(tarefa,root=ROOT,limite=3){
 const alvo=normalizar(tarefa);
 const tokens=alvo.split(/[^a-z0-9]+/).filter(t=>t.length>=3);
 return listarInteligencias(root).map(i=>{
  let score=0;
  for(const bruta of i.palavrasChave){
   const termo=normalizar(bruta);
   if(alvo.includes(termo))score+=3;
   else if(tokens.some(t=>termo.includes(t)||t.includes(termo)))score+=1;
  }
  return {...i,score};
 }).filter(i=>i.score>0)
  .sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id))
  .slice(0,limite);
}
