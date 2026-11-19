// Parser do `claude -p --output-format stream-json --verbose`. Função pura.
import type { EventoExecucao } from '../../shared/protocolo'
import type { OpcoesParser, Parser } from '../tipos'
import { avisoDeLinha, encurtar, lerJson, num, obj, relativo, str } from './comum'

type Ferramenta = { nome: string; resumo: string; caminho?: string }

export type EstadoClaude = {
  raiz?: string
  /** `tool_use` em andamento, pelo id, pra ligar com o `tool_result`. */
  ferramentas: Map<string, Ferramenta>
}

export function criarEstadoClaude(opcoes: OpcoesParser = {}): EstadoClaude {
  return { raiz: opcoes.raiz, ferramentas: new Map() }
}

const ESCRITA = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit'])

/** O resumo curto de uma chamada de ferramenta do Claude Code. */
export function resumoFerramentaClaude(nome: string, entrada: Record<string, unknown>, raiz?: string): string {
  const caminho = str(entrada.file_path) ?? str(entrada.notebook_path) ?? str(entrada.path)
  switch (nome) {
    case 'Bash':
      return encurtar(str(entrada.command) ?? str(entrada.description) ?? '')
    case 'Read':
    case 'Write':
    case 'Edit':
    case 'MultiEdit':
    case 'NotebookEdit':
      return caminho !== undefined ? relativo(caminho, raiz) : ''
    case 'Glob':
    case 'Grep':
      return encurtar(str(entrada.pattern) ?? '')
    case 'WebFetch':
      return encurtar(str(entrada.url) ?? '')
    case 'WebSearch':
      return encurtar(str(entrada.query) ?? '')
    case 'Task':
    case 'Agent':
      return encurtar(str(entrada.description) ?? str(entrada.prompt) ?? '')
    case 'Skill':
      return encurtar(str(entrada.skill) ?? str(entrada.name) ?? '')
    default: {
      if (caminho !== undefined) return relativo(caminho, raiz)
      const primeiro = Object.values(entrada).find(v => typeof v === 'string')
      return typeof primeiro === 'string' ? encurtar(primeiro) : ''
    }
  }
}

/** O texto de um `tool_result` com erro, encurtado. */
function textoDoResultado(conteudo: unknown): string {
  if (typeof conteudo === 'string') return conteudo
  if (Array.isArray(conteudo)) {
    return conteudo
      .map(parte => str(obj(parte)?.text) ?? '')
      .filter(t => t !== '')
      .join('\n')
  }
  return ''
}

export function parseLinhaClaude(linha: string, estado: EstadoClaude): EventoExecucao[] {
  const d = lerJson(linha)
  if (d === undefined) return avisoDeLinha(linha)
  const tipo = str(d.type)

  if (tipo === 'system') {
    if (str(d.subtype) !== 'init') return []
    return [{ tipo: 'inicio', modelo: str(d.model), sessao: str(d.session_id) }]
  }

  if (tipo === 'assistant') {
    const mensagem = obj(d.message)
    const conteudo = Array.isArray(mensagem?.content) ? mensagem.content : []
    // Mensagens de subagentes (com `parent_tool_use_id`) não entram como texto principal.
    const deSubagente = str(d.parent_tool_use_id) !== undefined
    const eventos: EventoExecucao[] = []
    for (const bloco of conteudo) {
      const b = obj(bloco)
      if (b === undefined) continue
      if (b.type === 'text' && !deSubagente) {
        const texto = str(b.text) ?? ''
        if (texto !== '') eventos.push({ tipo: 'texto', texto })
      } else if (b.type === 'tool_use') {
        const id = str(b.id) ?? `ferramenta-${estado.ferramentas.size + 1}`
        const nome = str(b.name) ?? 'ferramenta'
        const entrada = obj(b.input) ?? {}
        const resumo = resumoFerramentaClaude(nome, entrada, estado.raiz)
        const caminho = str(entrada.file_path) ?? str(entrada.notebook_path)
        estado.ferramentas.set(id, { nome, resumo, caminho })
        eventos.push({ tipo: 'ferramenta', id, nome, resumo, estado: 'rodando' })
      }
    }
    return eventos
  }

  if (tipo === 'user') {
    const mensagem = obj(d.message)
    const conteudo = Array.isArray(mensagem?.content) ? mensagem.content : []
    const resultadoFerramenta = obj(d.tool_use_result)
    const eventos: EventoExecucao[] = []
    for (const bloco of conteudo) {
      const b = obj(bloco)
      if (b === undefined || b.type !== 'tool_result') continue
      const id = str(b.tool_use_id)
      if (id === undefined) continue
      const ferramenta = estado.ferramentas.get(id)
      if (ferramenta === undefined) continue
      estado.ferramentas.delete(id)
      const erro = b.is_error === true
      const resumo = erro ? encurtar(textoDoResultado(b.content), 160) || ferramenta.resumo : ferramenta.resumo
      eventos.push({ tipo: 'ferramenta', id, nome: ferramenta.nome, resumo, estado: erro ? 'erro' : 'ok' })
      if (!erro && ESCRITA.has(ferramenta.nome) && ferramenta.caminho !== undefined) {
        const criado = ferramenta.nome === 'Write' && str(resultadoFerramenta?.type) !== 'update'
        eventos.push({ tipo: 'arquivo', caminho: relativo(ferramenta.caminho, estado.raiz), acao: criado ? 'criado' : 'editado' })
      }
    }
    return eventos
  }

  if (tipo === 'result') {
    const erro = d.is_error === true
    const resposta = str(d.result) ?? ''
    const erros = Array.isArray(d.errors) ? d.errors.filter(e => typeof e === 'string').join('\n') : ''
    return [
      {
        tipo: 'fim',
        status: erro ? 'erro' : 'ok',
        resposta,
        custoUsd: num(d.total_cost_usd),
        duracaoMs: num(d.duration_ms),
        sessao: str(d.session_id),
        erro: erro ? resposta || erros || `O Claude Code terminou com erro (${str(d.subtype) ?? 'sem detalhe'}).` : undefined,
      },
    ]
  }

  // rate_limit_event, stream_event e o que vier de novo: ignora.
  return []
}

export function criarParserClaude(opcoes: OpcoesParser = {}): Parser {
  const estado = criarEstadoClaude(opcoes)
  return linha => parseLinhaClaude(linha, estado)
}
