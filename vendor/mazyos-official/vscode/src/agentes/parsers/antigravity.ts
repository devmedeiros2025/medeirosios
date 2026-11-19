// Parser do `agy --output-format stream-json`. Função pura.
import type { EventoExecucao } from '../../shared/protocolo'
import type { OpcoesParser, Parser } from '../tipos'
import { avisoDeLinha, encurtar, lerJson, num, obj, relativo, str } from './comum'

export type EstadoAntigravity = {
  raiz?: string
  /** Texto juntado de cada `agent_response`, pelo `step_index`. */
  textos: Map<number, string>
  /** Passos de ferramenta que já mandaram `rodando`. */
  rodando: Set<number>
  /** Passos de ferramenta já encerrados (não repetir `ok`). */
  encerrados: Set<number>
}

export function criarEstadoAntigravity(opcoes: OpcoesParser = {}): EstadoAntigravity {
  return { raiz: opcoes.raiz, textos: new Map(), rodando: new Set(), encerrados: new Set() }
}

const ESCRITA_CRIA = new Set(['write_to_file'])
const ESCRITA_EDITA = new Set(['replace_file_content', 'multi_replace_file_content'])

const CHAVES_DE_CAMINHO = [
  'TargetFile',
  'AbsolutePath',
  'FilePath',
  'Path',
  'File',
  'DirectoryPath',
  'SearchPath',
  'SearchDirectory',
  'path',
  'file_path',
]

function pareceCaminho(valor: string): boolean {
  return !/\n/.test(valor) && valor.length < 500 && /^(?:[a-zA-Z]:[\\/]|[~./\\]|file:\/\/)/.test(valor)
}

/** O primeiro parâmetro que pareça caminho de arquivo. */
export function caminhoDosParametros(parametros: Record<string, unknown>): string | undefined {
  for (const chave of CHAVES_DE_CAMINHO) {
    const v = str(parametros[chave])
    if (v !== undefined && v.trim() !== '') return v
  }
  for (const valor of Object.values(parametros)) {
    if (typeof valor === 'string' && pareceCaminho(valor)) return valor
  }
  return undefined
}

function resumoDosParametros(parametros: Record<string, unknown>, raiz?: string): string {
  const comando = str(parametros.CommandLine) ?? str(parametros.Command) ?? str(parametros.command)
  if (comando !== undefined) return encurtar(comando)
  const caminho = caminhoDosParametros(parametros)
  if (caminho !== undefined) return relativo(caminho, raiz)
  const busca = str(parametros.Query) ?? str(parametros.query) ?? str(parametros.Url) ?? str(parametros.url)
  if (busca !== undefined) return encurtar(busca)
  const primeiro = Object.values(parametros).find(v => typeof v === 'string')
  return typeof primeiro === 'string' ? encurtar(primeiro) : ''
}

export function parseLinhaAntigravity(linha: string, estado: EstadoAntigravity): EventoExecucao[] {
  const d = lerJson(linha)
  if (d === undefined) return avisoDeLinha(linha)
  const evento = str(d.event)

  if (evento === 'init') {
    const init = obj(d.init)
    return [{ tipo: 'inicio', modelo: str(init?.model), sessao: str(d.conversation_id) }]
  }

  if (evento === 'step_update') {
    const passo = obj(d.step_update)
    if (passo === undefined) return []
    const indice = num(passo.step_index) ?? -1
    const situacao = str(passo.state)
    const tipoPasso = str(passo.step_type)

    if (tipoPasso === 'agent_response') {
      const delta = str(passo.text_delta) ?? ''
      if (delta === '') return []
      estado.textos.set(indice, (estado.textos.get(indice) ?? '') + delta)
      return [{ tipo: 'texto', texto: delta }]
    }

    if (tipoPasso === 'tool') {
      const info = obj(passo.tool_info)
      const nome = str(passo.tool_name) ?? str(info?.name) ?? 'ferramenta'
      const parametros = obj(info?.parameters) ?? {}
      const id = `passo-${indice}`
      const resumo = resumoDosParametros(parametros, estado.raiz)

      if (situacao === 'ACTIVE') {
        if (estado.rodando.has(indice) || estado.encerrados.has(indice)) return []
        estado.rodando.add(indice)
        return [{ tipo: 'ferramenta', id, nome, resumo, estado: 'rodando' }]
      }

      if (estado.encerrados.has(indice)) return []
      estado.encerrados.add(indice)
      estado.rodando.delete(indice)
      const erro = obj(info?.error)
      const falhou = erro !== undefined || (situacao !== undefined && situacao !== 'DONE')
      const resumoFinal = falhou && str(erro?.message) ? encurtar(str(erro?.message) ?? '', 160) : resumo
      const eventos: EventoExecucao[] = [
        { tipo: 'ferramenta', id, nome, resumo: resumoFinal, estado: falhou ? 'erro' : 'ok' },
      ]
      if (!falhou && (ESCRITA_CRIA.has(nome) || ESCRITA_EDITA.has(nome))) {
        const caminho = caminhoDosParametros(parametros)
        if (caminho !== undefined) {
          eventos.push({
            tipo: 'arquivo',
            caminho: relativo(caminho, estado.raiz),
            acao: ESCRITA_CRIA.has(nome) ? 'criado' : 'editado',
          })
        }
      }
      return eventos
    }

    // user_input, checkpoint e outros passos: nada pra mostrar.
    return []
  }

  if (evento === 'result') {
    const r = obj(d.result) ?? {}
    const status = str(r.status)
    const ok = status === 'SUCCESS'
    const segundos = num(r.duration_seconds)
    const erro = obj(r.error)
    const mensagemErro = str(r.error) ?? str(erro?.message)
    const cancelado = status === 'CANCELED' || status === 'INTERRUPTED'
    return [
      {
        tipo: 'fim',
        status: ok ? 'ok' : cancelado ? 'cancelado' : 'erro',
        resposta: str(r.response) ?? [...estado.textos.values()].join(''),
        duracaoMs: segundos !== undefined ? Math.round(segundos * 1000) : undefined,
        sessao: str(r.conversation_id),
        erro: ok || cancelado ? undefined : (mensagemErro ?? `O Antigravity terminou com ${status ?? 'erro'}.`),
      },
    ]
  }

  if (evento === 'error') {
    const mensagem = str(d.message) ?? str(obj(d.error)?.message)
    return mensagem !== undefined ? [{ tipo: 'aviso', texto: encurtar(mensagem, 300) }] : []
  }

  return []
}

export function criarParserAntigravity(opcoes: OpcoesParser = {}): Parser {
  const estado = criarEstadoAntigravity(opcoes)
  return linha => parseLinhaAntigravity(linha, estado)
}
