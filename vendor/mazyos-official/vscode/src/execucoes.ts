// Cria e acompanha as execuções ("tarefas") dos agentes, avisa os ouvintes (painel,
// console, barra de status) e guarda o histórico no `workspaceState`.
import { randomBytes } from 'node:crypto'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

import * as vscode from 'vscode'

import { executarAgente } from './agentes/processo'
import type { Parser, SpecProcesso } from './agentes/tipos'
import type { AgenteId, EventoExecucao, Execucao, ParaWebview } from './shared/protocolo'
import { MARCAS } from './shared/protocolo'

const CHAVE_HISTORICO = 'mazyos.execucoes'
const MAX_HISTORICO = 20
const MAX_EVENTOS_GUARDADOS = 200
const MAX_EVENTOS_MEMORIA = 3000

/** O que o host devolve pra uma execução poder começar. */
export type Preparo = {
  spec: SpecProcesso
  parser: Parser
  cwd: string
  env: NodeJS.ProcessEnv
}

export type DadosExecucao = {
  agente: AgenteId
  modelo?: string
  skill?: string
  pedido: string
  /** Sessão do CLI a retomar (continuação). */
  sessao?: string
}

type Viva = { execucao: Execucao; controle: AbortController }

function novoId(): string {
  return randomBytes(4).toString('hex')
}

/** Junta eventos de texto consecutivos (os deltas do Antigravity, por exemplo). */
export function juntarTextos(eventos: readonly EventoExecucao[]): EventoExecucao[] {
  const saida: EventoExecucao[] = []
  for (const evento of eventos) {
    const anterior = saida[saida.length - 1]
    if (evento.tipo === 'texto' && anterior?.tipo === 'texto') {
      saida[saida.length - 1] = { tipo: 'texto', texto: anterior.texto + evento.texto }
    } else {
      saida.push(evento)
    }
  }
  return saida
}

/** Corta a lista no máximo pedido, mantendo o `inicio` e o fim da execução. */
function limitar(eventos: EventoExecucao[], maximo: number): EventoExecucao[] {
  if (eventos.length <= maximo) return eventos
  const inicio = eventos[0]?.tipo === 'inicio' ? [eventos[0]] : []
  const cortados = eventos.length - maximo + 1
  return [
    ...inicio,
    { tipo: 'aviso', texto: `${cortados} eventos mais antigos foram resumidos.` },
    ...eventos.slice(-(maximo - inicio.length - 1)),
  ]
}

/** Nome de arquivo seguro a partir de um texto livre. */
export function slug(texto: string, maximo = 40): string {
  const s = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maximo)
    .replace(/-+$/g, '')
  return s === '' ? 'pedido' : s
}

function dataLocal(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export class ExecucaoManager implements vscode.Disposable {
  private execucoes: Execucao[] = []
  private readonly vivas = new Map<string, Viva>()
  private readonly ouvintes = new Set<(mensagem: ParaWebview) => void>()

  constructor(private readonly armazem: vscode.Memento) {
    const guardadas = armazem.get<Execucao[]>(CHAVE_HISTORICO, [])
    this.execucoes = Array.isArray(guardadas)
      ? guardadas.map(e =>
          e.estado === 'rodando'
            ? {
                ...e,
                estado: 'cancelado',
                fim: e.fim ?? Date.now(),
                eventos: [...e.eventos, { tipo: 'aviso', texto: 'Interrompida quando o editor fechou.' }],
              }
            : e,
        )
      : []
  }

  /** Recebe `execucao` e `evento`. Devolve a função que desliga o ouvinte. */
  ouvir(ouvinte: (mensagem: ParaWebview) => void): vscode.Disposable {
    this.ouvintes.add(ouvinte)
    return new vscode.Disposable(() => this.ouvintes.delete(ouvinte))
  }

  private emitir(mensagem: ParaWebview): void {
    for (const ouvinte of this.ouvintes) {
      try {
        ouvinte(mensagem)
      } catch {
        // ouvinte com defeito não para a execução
      }
    }
  }

  /** As mais recentes primeiro. */
  lista(): Execucao[] {
    return this.execucoes.slice(0, MAX_HISTORICO)
  }

  buscar(id: string): Execucao | undefined {
    return this.execucoes.find(e => e.id === id)
  }

  /** A execução rodando mais recente, se houver. */
  emAndamento(): Execucao | undefined {
    return this.execucoes.find(e => e.estado === 'rodando')
  }

  /** Começa uma execução. `preparar` monta o processo; erro nele vira `fim` com erro. */
  iniciar(dados: DadosExecucao, preparar: (execucao: Execucao) => Promise<Preparo>): Execucao {
    const execucao: Execucao = {
      id: novoId(),
      agente: dados.agente,
      modelo: dados.modelo,
      skill: dados.skill,
      pedido: dados.pedido,
      inicio: Date.now(),
      estado: 'rodando',
      eventos: [],
      sessao: dados.sessao,
    }
    const controle = new AbortController()
    this.execucoes.unshift(execucao)
    this.vivas.set(execucao.id, { execucao, controle })
    this.emitir({ tipo: 'execucao', execucao })
    void this.persistir()

    void (async () => {
      try {
        const preparo = await preparar(execucao)
        if (controle.signal.aborted) {
          this.registrar(execucao, { tipo: 'fim', status: 'cancelado', resposta: '' })
          return
        }
        await executarAgente(preparo.spec, preparo.parser, {
          cwd: preparo.cwd,
          env: preparo.env,
          sinal: controle.signal,
          onEvento: evento => this.registrar(execucao, evento),
        })
      } catch (erro) {
        const mensagem = erro instanceof Error ? erro.message : String(erro)
        this.registrar(execucao, { tipo: 'fim', status: 'erro', resposta: '', erro: mensagem })
      } finally {
        this.vivas.delete(execucao.id)
        if (execucao.estado === 'rodando') {
          this.registrar(execucao, { tipo: 'fim', status: 'erro', resposta: '', erro: 'A execução terminou sem resposta.' })
        }
      }
    })()

    return execucao
  }

  private registrar(execucao: Execucao, evento: EventoExecucao): void {
    if (execucao.estado !== 'rodando') return
    const ultimo = execucao.eventos[execucao.eventos.length - 1]
    if (evento.tipo === 'texto' && ultimo?.tipo === 'texto') {
      execucao.eventos[execucao.eventos.length - 1] = { tipo: 'texto', texto: ultimo.texto + evento.texto }
    } else {
      execucao.eventos.push(evento)
      if (execucao.eventos.length > MAX_EVENTOS_MEMORIA) {
        execucao.eventos = limitar(execucao.eventos, MAX_EVENTOS_MEMORIA)
      }
    }

    if (evento.tipo === 'inicio') {
      if (evento.sessao) execucao.sessao = evento.sessao
      if (evento.modelo && !execucao.modelo) execucao.modelo = evento.modelo
    }

    this.emitir({ tipo: 'evento', id: execucao.id, evento })

    if (evento.tipo === 'fim') {
      execucao.estado = evento.status
      execucao.fim = Date.now()
      execucao.resposta = evento.resposta
      if (evento.sessao) execucao.sessao = evento.sessao
      if (evento.custoUsd !== undefined) execucao.custoUsd = evento.custoUsd
      this.emitir({ tipo: 'execucao', execucao })
      void this.persistir()
    }
  }

  cancelar(id: string): boolean {
    const viva = this.vivas.get(id)
    if (viva === undefined) return false
    viva.controle.abort()
    return true
  }

  cancelarTodas(): void {
    for (const viva of this.vivas.values()) viva.controle.abort()
  }

  private async persistir(): Promise<void> {
    const compactas = this.execucoes.slice(0, MAX_HISTORICO).map(e => ({
      ...e,
      eventos: limitar(juntarTextos(e.eventos), MAX_EVENTOS_GUARDADOS),
    }))
    this.execucoes = this.execucoes.slice(0, MAX_HISTORICO * 2)
    try {
      await this.armazem.update(CHAVE_HISTORICO, compactas)
    } catch {
      // o histórico é conveniência: falhar aqui não pode parar nada
    }
  }

  /**
   * Grava a resposta em `saidas/<data>-<skill-ou-pedido>.md` na raiz e abre o
   * arquivo. Devolve o caminho relativo.
   */
  async salvarSaida(id: string, raiz: string): Promise<string> {
    const execucao = this.buscar(id)
    if (execucao === undefined) throw new Error('Essa execução não está mais no histórico.')
    const textos = execucao.eventos.flatMap(e => (e.tipo === 'texto' ? [e.texto] : [])).join('')
    const resposta = (execucao.resposta || textos).trim()
    if (resposta === '') throw new Error('Essa execução ainda não tem resposta pra salvar.')

    const pasta = path.join(raiz, 'saidas')
    await mkdir(pasta, { recursive: true })
    const base = `${dataLocal(execucao.inicio)}-${slug(execucao.skill ?? execucao.pedido)}`
    let nome = `${base}.md`
    for (let n = 2; n < 100; n++) {
      const existe = await stat(path.join(pasta, nome)).then(
        () => true,
        () => false,
      )
      if (!existe) break
      nome = `${base}-${n}.md`
    }

    const titulo = execucao.skill !== undefined ? `Skill ${execucao.skill}` : 'Pedido ao Mazy'
    const quando = new Date(execucao.inicio).toLocaleString('pt-BR')
    const conteudo = [
      `# ${titulo}`,
      '',
      `> ${execucao.pedido.replace(/\r?\n/g, ' ').trim() || '(sem pedido escrito)'}`,
      `> ${MARCAS[execucao.agente].nome}${execucao.modelo ? ` (${execucao.modelo})` : ''} · ${quando}`,
      '',
      resposta,
      '',
    ].join('\n')

    const caminho = path.join(pasta, nome)
    await writeFile(caminho, conteudo, 'utf8')
    const documento = await vscode.workspace.openTextDocument(vscode.Uri.file(caminho))
    await vscode.window.showTextDocument(documento, { preview: false })
    return `saidas/${nome}`
  }

  dispose(): void {
    this.cancelarTodas()
    this.ouvintes.clear()
  }
}
