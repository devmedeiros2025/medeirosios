import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');

export function safe(root,relative){
  const target=path.resolve(root,relative),rel=path.relative(root,target);
  if(rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))throw Error('Caminho fora da raiz');
  let current=root;
  for(const part of rel.split(path.sep).filter(Boolean)){
    current=path.join(current,part);
    if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())throw Error('Link simbólico não permitido');
  }
  return target;
}

export function readJSON(file){return JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));}
export function writeJSON(file,value){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');
}
export function identifier(value){
  const id=String(value??'');
  if(!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(id))throw Error('Identificador inválido');
  return id;
}
