import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from '../../scripts/ecosystem.mjs';

export const PROIBIDOS=/expx|mazyos|thulio|bittencourt|alf[âa]ndega|harvey|mazzeoia|expxdev|modulex|orca/i;
export const ALVOS_TEXTO=[
  'README.md','AGENTS.md','CLAUDE.md',
  'docs/COMPATIBILIDADE.md','docs/ESCOPO-E-ORIGENS.md','docs/FLUXOS.md',
  'docs/PONTE-DE-EXECUCAO.md','docs/ROTEAMENTO.md','docs/HARNESS.md',
  'docs/INTELIGENCIAS.md',
  'knowledge/negocio.md','knowledge/revisao.md'
];

// A restrição do produto preserva IDs técnicos e marcadores; só a prosa muda.
export function textoVisivel(arquivo){
  let linhas=fs.readFileSync(path.join(ROOT,arquivo),'utf8').split('\n');
  if(arquivo.endsWith('/SKILL.md'))linhas=linhas.filter(l=>!/^name:/.test(l)&&!/\]\(/.test(l));
  let texto=linhas.join('\n');
  texto=texto.replace(/<!--[\s\S]*?-->/g,'');
  texto=texto.replace(/\.mazyos\/[\w./-]+/g,'');
  texto=texto.replace(/vendor\/[\w./-]+/g,'');
  texto=texto.replace(/\b(?:expx|mazyos)-[\w-]+\b/gi,'');
  texto=texto.replace(/(?:^|\s)\/(?:expx|mazyos):?[\w-]*/gi,'');
  texto=texto.replaceAll('MAZYOS-EXPX','');
  return texto;
}
