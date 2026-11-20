import test from 'node:test';
import assert from 'node:assert/strict';
import {listarInteligencias,carregarInteligencia,sugerirInteligencias} from '../scripts/intel.mjs';
import {PROIBIDOS} from './helpers/nomes.mjs';

const IDS=[
 'intel-comfyui-grafos-geracao',
 'intel-hyperframes-video-html',
 'intel-video-curto-mpt',
 'intel-video-programavel-remotion',
 'intel-diagramas-excalidraw',
 'intel-radar-opiniao-30-dias',
 'intel-marketing-skills',
 'intel-postiz-engineering'
];

test('catalogo com oito inteligencias acopladas',()=>{
 const lista=listarInteligencias();
 assert.equal(lista.length,8);
 assert.deepEqual(lista.map(i=>i.id).sort(),IDS.slice().sort());
 for(const i of lista){
  assert.match(i.id,/^intel-[a-z0-9-]+$/,i.id);
  assert.ok(i.titulo,i.id);
  assert.ok(i.descricao.length>0&&i.descricao.length<=160,i.id+' descricao longa');
  assert.ok(i.categoria,i.id);
  assert.ok(i.palavrasChave.length>=3,i.id);
 }
});

test('carregarInteligencia devolve secoes acionaveis',()=>{
 for(const id of IDS){
  const i=carregarInteligencia(id);
  assert.equal(i.id,id);
  assert.ok(i.conteudo.length>500,id);
  assert.ok(i.parametros.length>=6,id+' parametros');
  assert.ok(i.fluxo.length>=4,id+' fluxo');
  assert.ok(i.limites.length>=3,id+' limites');
  assert.ok(i.fontes.length>=1,id+' fontes');
  assert.equal(PROIBIDOS.test(i.conteudo.replace(/^name:.*$/m,'')),false,id+' prosa');
 }
});

test('carregarInteligencia rejeita identificador invalido',()=>{
 assert.throws(()=>carregarInteligencia('../catalog.json'),/Identificador inválido/);
 assert.throws(()=>carregarInteligencia('../../etc/passwd'),/Identificador inválido/);
 assert.throws(()=>carregarInteligencia('intel-inexistente'),/Inteligência desconhecida/);
});

test('sugestao prioriza a inteligencia da tarefa',()=>{
 const casos=[
  ['gerar imagem com grafo de nos e semente fixa','intel-comfyui-grafos-geracao'],
  ['renderizar mp4 determinístico a partir de html','intel-hyperframes-video-html'],
  ['criar reels com narração legendas e música','intel-video-curto-mpt'],
  ['componente react com framecurrent e interpolate','intel-video-programavel-remotion'],
  ['desenhar diagrama e exportar svg do whiteboard','intel-diagramas-excalidraw'],
  ['pesquisar tendências dos últimos 30 dias com engajamento','intel-radar-opiniao-30-dias'],
  ['escrever copy com diagnóstico e portão de perguntas','intel-marketing-skills'],
  ['agendar publicação multicanal com prisma e camadas dto','intel-postiz-engineering']
 ];
 for(const [tarefa,esperado] of casos){
  const sugestoes=sugerirInteligencias(tarefa);
  assert.equal(sugestoes[0].id,esperado,tarefa);
 }
});
