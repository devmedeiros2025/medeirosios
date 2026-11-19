// Parser do `codex exec --json`. Função pura.
import type { EventoExecucao } from '../../shared/protocolo'
import type { OpcoesParser, Parser } from '../tipos'
import { avisoDeLinha, encurtar, lerJson, obj, relativo, str } from './comum'

export type EstadoCodex = {
  raiz?: string
  modelosDisponiveis: readonly string[]
  sessao?: string
  /** O último `agent_message` completado: é a resposta final. */
  ultimaMensagem: string
  /** Itens que já mandaram `rodando`. */
  iniciados: Set<string>
  terminou: boolean
}

export function criarEstadoCodex(opcoes: OpcoesParser = {}): EstadoCodex {
  return {
    raiz: opcoes.raiz,
    modelosDisponiveis: opcoes.modelosDisponiveis ?? [],
    ultimaMensagem: '',
    iniciados: new Set(),
    terminou: false,
  }
}

const ERRO_DE_MODELO = /model is not supported when using Codex with a ChatGPT account/i

/** A mensagem legível: o Codex às vezes manda o corpo da API como JSON dentro da string. */
export function mensagemDoCodex(mensagem: string): string {
  const t = mensagem.trim()
  if (t.startsWith('{')) {
    const d = lerJson(t)
    const detalhe = str(d?.detail) ?? str(obj(d?.error)?.message) ?? str(d?.message)
    if (detalhe !== undefined) return detalhe
  }
  return t
}

/** O erro de modelo, traduzido, citando os modelos que a conta aceita. */
export function erroDeModelo(mensagem: string, modelos: readonly string[]): string {
  const lista = modelos.length > 0 ? ` Modelos que a sua conta aceita: ${modelos.join(', ')}.` : ''
  return `O modelo configurado não funciona com a conta do ChatGPT. Troque o modelo do Codex nas configurações do MazyOS (mazyos.modelos) ou no painel.${lista}\n(${mensagem})`
}

/** `/bin/zsh -lc 'cat README.md'` → `cat README.md`. */
export function comandoLimpo(comando: string): string {
  const m = /^(?:\S*\/)?(?:zsh|bash|sh)\s+-l?c\s+(['"])([\s\S]*)\1\s*$/.exec(comando.trim())
  return m?.[2] ?? comando
}

function fimDeErro(estado: EstadoCodex, mensagemBruta: string): EventoExecucao[] {
  if (estado.terminou) return []
  estado.terminou = true
  const mensagem = mensagemDoCodex(mensagemBruta)
  return [
    {
      tipo: 'fim',
      status: 'erro',
      resposta: estado.ultimaMensagem,
      sessao: estado.sessao,
      erro: ERRO_DE_MODELO.test(mensagem) ? erroDeModelo(mensagem, estado.modelosDisponiveis) : mensagem,
    },
  ]
}

function nomeEResumo(item: Record<string, unknown>, raiz?: string): { nome: string; resumo: string } | undefined {
  switch (item.type) {
    case 'command_execution':
      return { nome: 'Comando', resumo: encurtar(comandoLimpo(str(item.command) ?? '')) }
    case 'file_change': {
      const mudancas = Array.isArray(item.changes) ? item.changes : []
      const caminhos = mudancas.map(m => str(obj(m)?.path)).filter((c): c is string => c !== undefined)
      return { nome: 'Arquivos', resumo: encurtar(caminhos.map(c => relativo(c, raiz)).join(', ')) }
    }
    case 'mcp_tool_call': {
      const servidor = str(item.server) ?? ''
      const ferramenta = str(item.tool) ?? 'mcp'
      return { nome: servidor !== '' ? `${servidor}.${ferramenta}` : ferramenta, resumo: '' }
    }
    case 'web_search':
      return { nome: 'Busca na web', resumo: encurtar(str(item.query) ?? '') }
    default:
      return undefined
  }
}

function estadoFinal(item: Record<string, unknown>): 'ok' | 'erro' {
  if (item.type === 'command_execution') {
    const codigo = item.exit_code
    if (typeof codigo === 'number') return codigo === 0 ? 'ok' : 'erro'
    return item.status === 'failed' || item.status === 'declined' ? 'erro' : 'ok'
  }
  if (item.error !== undefined && item.error !== null) return 'erro'
  return item.status === 'failed' || item.status === 'declined' ? 'erro' : 'ok'
}

export function parseLinhaCodex(linha: string, estado: EstadoCodex): EventoExecucao[] {
  const d = lerJson(linha)
  if (d === undefined) return avisoDeLinha(linha)
  const tipo = str(d.type)

  switch (tipo) {
    case 'thread.started':
      estado.sessao = str(d.thread_id)
      return [{ tipo: 'inicio', sessao: estado.sessao }]

    case 'turn.started':
      return []

    case 'turn.completed':
      if (estado.terminou) return []
      estado.terminou = true
      return [{ tipo: 'fim', status: 'ok', resposta: estado.ultimaMensagem, sessao: estado.sessao }]

    case 'turn.failed':
      return fimDeErro(estado, str(obj(d.error)?.message) ?? str(d.message) ?? 'O Codex falhou sem dizer o motivo.')

    case 'error': {
      const mensagem = str(d.message) ?? ''
      // Reconexões são avisos: o Codex tenta de novo sozinho.
      if (/^Reconnecting\b|retrying/i.test(mensagem)) return [{ tipo: 'aviso', texto: encurtar(mensagem, 300) }]
      return fimDeErro(estado, mensagem || 'O Codex falhou sem dizer o motivo.')
    }

    case 'item.started':
    case 'item.updated':
    case 'item.completed': {
      const item = obj(d.item)
      if (item === undefined) return []
      const id = str(item.id) ?? ''
      const itemTipo = str(item.type)

      if (itemTipo === 'agent_message') {
        if (tipo !== 'item.completed') return []
        const texto = str(item.text) ?? ''
        if (texto === '') return []
        estado.ultimaMensagem = texto
        return [{ tipo: 'texto', texto }]
      }
      if (itemTipo === 'reasoning' || itemTipo === 'todo_list') return []
      if (itemTipo === 'error') {
        if (tipo !== 'item.completed') return []
        const mensagem = mensagemDoCodex(str(item.message) ?? '')
        if (ERRO_DE_MODELO.test(mensagem)) return fimDeErro(estado, mensagem)
        return mensagem === '' ? [] : [{ tipo: 'aviso', texto: encurtar(mensagem, 300) }]
      }

      const descricao = nomeEResumo(item, estado.raiz)
      if (descricao === undefined) return []

      if (tipo !== 'item.completed') {
        if (estado.iniciados.has(id)) return []
        estado.iniciados.add(id)
        return [{ tipo: 'ferramenta', id, nome: descricao.nome, resumo: descricao.resumo, estado: 'rodando' }]
      }

      estado.iniciados.delete(id)
      const final = estadoFinal(item)
      const eventos: EventoExecucao[] = [
        { tipo: 'ferramenta', id, nome: descricao.nome, resumo: descricao.resumo, estado: final },
      ]
      if (itemTipo === 'file_change' && final === 'ok') {
        const mudancas = Array.isArray(item.changes) ? item.changes : []
        for (const mudanca of mudancas) {
          const m = obj(mudanca)
          const caminho = str(m?.path)
          if (caminho === undefined) continue
          const acao = m?.kind === 'add' ? 'criado' : m?.kind === 'delete' ? 'apagado' : 'editado'
          eventos.push({ tipo: 'arquivo', caminho: relativo(caminho, estado.raiz), acao })
        }
      }
      return eventos
    }

    default:
      return []
  }
}

export function criarParserCodex(opcoes: OpcoesParser = {}): Parser {
  const estado = criarEstadoCodex(opcoes)
  return linha => parseLinhaCodex(linha, estado)
}
