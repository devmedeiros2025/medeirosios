// Monta o prompt que vai pro agente: regras do sistema + memória do negócio +
// skill (com as substituições) + o pedido do usuário. É o mesmo texto pros três CLIs.
// Sem `vscode`.
import path from 'node:path'

import type { MazyosChave, Skill, Workspace } from '../shared/protocolo'
import { corpoSemFrontmatter, lerSkill } from './catalogo'
import { lerWorkspaceCompleto } from './memoria'
import { regrasDoSistema } from './sistema'

/**
 * Troca as menções a `/mazyos:<skill>` (os CLIs não têm o plugin carregado) por
 * "a skill <skill> do MazyOS". Se já vier depois da palavra "skill", não repete.
 */
export function trocarComandos(texto: string): string {
  return texto.replace(/(\bskill\s+)?`?\/mazyos:([a-z0-9-]+)`?/gi, (_tudo, antes: string | undefined, nome: string) =>
    antes !== undefined ? `${antes}${nome} do MazyOS` : `a skill ${nome} do MazyOS`,
  )
}

/** Substituições no corpo da skill: raiz do plugin, pasta da skill e `/mazyos:<skill>`. */
export function substituir(corpo: string, raizPlugin: string, nomeSkill: string): string {
  const pastaSkill = path.join(raizPlugin, 'skills', nomeSkill)
  return trocarComandos(
    corpo.replace(/\$\{CLAUDE_SKILL_DIR\}/g, pastaSkill).replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, raizPlugin),
  )
}

export type MemoriaPreenchida = { caminho: string; texto: string }

export type EntradaPedido = {
  workspace: Workspace
  /** Só os arquivos preenchidos, na ordem de `FONTES`. */
  memoria: readonly MemoriaPreenchida[]
  /** A skill escolhida, com o texto da SKILL.md (com ou sem frontmatter). */
  skill?: { nome: string; texto: string }
  pedido: string
  raizPlugin: string
  /** O catálogo, pra listar as skills (nas regras e no pedido livre). */
  skills: readonly Pick<Skill, 'nome' | 'rotulo'>[]
  modo: 'tarefa' | 'conversa'
}

/** O prompt final, em Markdown. Função pura. */
export function montarPedido(entrada: EntradaPedido): string {
  const nomes = entrada.skills.map(s => s.nome)
  const partes: string[] = [
    '# MazyOS',
    '',
    regrasDoSistema(entrada.workspace, { raizPlugin: entrada.raizPlugin, skills: nomes, modo: entrada.modo }),
  ]

  const memoria = entrada.memoria.filter(m => m.texto.trim() !== '')
  if (memoria.length > 0) {
    partes.push('', '## Memória do negócio')
    for (const arquivo of memoria) {
      partes.push('', `### ${arquivo.caminho}`, '', trocarComandos(arquivo.texto.trim()))
    }
  }

  if (entrada.skill !== undefined) {
    const corpo = substituir(corpoSemFrontmatter(entrada.skill.texto), entrada.raizPlugin, entrada.skill.nome)
    partes.push('', `## Skill: ${entrada.skill.nome}`, '', corpo.trim())
  } else if (nomes.length > 0) {
    partes.push(
      '',
      `Skills do MazyOS que podem ajudar neste pedido (leia a SKILL.md da que combinar, ou sugira uma ao usuário): ${nomes.join(', ')}.`,
    )
  }

  const pedido = entrada.pedido.trim()
  partes.push(
    '',
    '## Pedido',
    '',
    pedido !== ''
      ? pedido
      : entrada.skill !== undefined
        ? `Rode a skill ${entrada.skill.nome}.`
        : 'Sem pedido escrito: pergunte o que o usuário precisa.',
  )
  return `${partes.join('\n').trim()}\n`
}

/** A memória preenchida de um workspace, na ordem de exibição. */
export function memoriaPreenchida(
  ws: Workspace,
  textos: Partial<Record<MazyosChave, string>>,
): MemoriaPreenchida[] {
  return ws.arquivos
    .filter(arquivo => arquivo.preenchido)
    .map(arquivo => ({ caminho: arquivo.caminho, texto: textos[arquivo.chave] ?? '' }))
    .filter(m => m.texto.trim() !== '')
}

export type OpcoesPreparar = {
  raiz: string
  raizPlugin: string
  skills: readonly Skill[]
  skill?: string
  pedido: string
  modo?: 'tarefa' | 'conversa'
}

/** Lê o workspace e a skill do disco e monta o pedido. Skill inexistente é erro. */
export async function prepararPedido(opcoes: OpcoesPreparar): Promise<{ prompt: string; workspace: Workspace }> {
  const { workspace, textos } = await lerWorkspaceCompleto(opcoes.raiz, opcoes.raizPlugin)
  let skill: EntradaPedido['skill']
  if (opcoes.skill !== undefined && opcoes.skill !== '') {
    const texto = await lerSkill(opcoes.raizPlugin, opcoes.skill)
    if (texto === null) throw new Error(`A skill "${opcoes.skill}" não existe no MazyOS embutido.`)
    skill = { nome: opcoes.skill, texto }
  }
  const prompt = montarPedido({
    workspace,
    memoria: memoriaPreenchida(workspace, textos),
    skill,
    pedido: opcoes.pedido,
    raizPlugin: opcoes.raizPlugin,
    skills: opcoes.skills,
    modo: opcoes.modo ?? 'tarefa',
  })
  return { prompt, workspace }
}
