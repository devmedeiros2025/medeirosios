// Acha o binário dos CLIs, roda o processo, parte a saída em linhas, cancela e
// controla tempo. Só `node:*`: nada de `vscode` aqui.
import { spawn, type SpawnOptions } from 'node:child_process'
import { constants } from 'node:fs'
import { access, readdir, stat } from 'node:fs/promises'
import path from 'node:path'

import type { EventoExecucao } from '../shared/protocolo'
import type { ContextoAgente, Parser, SpecProcesso } from './tipos'

type EventoFim = Extract<EventoExecucao, { tipo: 'fim' }>

// ---------------------------------------------------------------------------
// Linhas

/** Junta pedaços de stdout e devolve só as linhas completas; o resto fica guardado. */
export class DivisorDeLinhas {
  private resto = ''

  empurrar(pedaco: string): string[] {
    this.resto += pedaco
    const partes = this.resto.split('\n')
    this.resto = partes.pop() ?? ''
    return partes.map(linha => linha.replace(/\r$/, ''))
  }

  /** O que sobrou sem `\n` no fim, quando o processo fecha. */
  terminar(): string[] {
    const final = this.resto.replace(/\r$/, '')
    this.resto = ''
    return final === '' ? [] : [final]
  }
}

// ---------------------------------------------------------------------------
// Achar o binário

const CACHE_MS = 60_000
const cacheBinarios = new Map<string, { valor: string | undefined; em: number }>()

export function limparCacheBinarios(): void {
  cacheBinarios.clear()
}

function expandirHome(caminho: string, home: string): string {
  if (caminho === '~') return home
  if (caminho.startsWith('~/') || caminho.startsWith('~\\')) return path.join(home, caminho.slice(2))
  return caminho
}

async function ehExecutavel(caminho: string, plataforma: NodeJS.Platform): Promise<boolean> {
  try {
    const s = await stat(caminho)
    if (!s.isFile()) return false
    if (plataforma === 'win32') return true
    await access(caminho, constants.X_OK)
    return true
  } catch {
    return false
  }
}

function nomesCandidatos(nome: string, ctx: ContextoAgente): string[] {
  if (ctx.plataforma !== 'win32') return [nome]
  if (/\.[a-z0-9]+$/i.test(nome)) return [nome]
  const extensoes = (ctx.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD')
    .split(';')
    .map(e => e.trim().toLowerCase())
    .filter(e => e !== '')
  // `.cmd` primeiro: é o que o npm instala; o `.exe` vem do instalador nativo.
  const ordenadas = ['.exe', '.cmd', ...extensoes.filter(e => e !== '.exe' && e !== '.cmd')]
  return ordenadas.map(e => `${nome}${e}`)
}

function separadorPath(plataforma: NodeJS.Platform): string {
  return plataforma === 'win32' ? ';' : ':'
}

async function versoesNvm(home: string): Promise<string[]> {
  const base = path.join(home, '.nvm', 'versions', 'node')
  try {
    const versoes = await readdir(base)
    return versoes
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
      .map(v => path.join(base, v, 'bin'))
  } catch {
    return []
  }
}

/** As pastas onde os instaladores costumam pôr os CLIs, na ordem da ARQUITETURA. */
export async function pastasConhecidas(ctx: ContextoAgente): Promise<string[]> {
  const h = ctx.home
  if (ctx.plataforma === 'win32') {
    const appData = ctx.env.APPDATA ?? path.join(h, 'AppData', 'Roaming')
    const local = ctx.env.LOCALAPPDATA ?? path.join(h, 'AppData', 'Local')
    return [
      path.join(h, '.local', 'bin'),
      path.join(appData, 'npm'),
      path.join(local, 'Programs'),
      path.join(local, 'Programs', 'claude'),
      path.join(local, 'Programs', 'codex'),
      path.join(local, 'Programs', 'antigravity', 'bin'),
      path.join(h, '.claude', 'local'),
      path.join(h, '.volta', 'bin'),
      path.join(h, '.bun', 'bin'),
    ]
  }
  return [
    path.join(h, '.local', 'bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    path.join(h, '.claude', 'local'),
    path.join(h, '.npm-global', 'bin'),
    path.join(h, '.volta', 'bin'),
    path.join(h, '.bun', 'bin'),
    ...(await versoesNvm(h)),
  ]
}

async function procurarEm(pastas: readonly string[], nome: string, ctx: ContextoAgente): Promise<string | undefined> {
  const nomes = nomesCandidatos(nome, ctx)
  for (const pasta of pastas) {
    if (pasta === '') continue
    for (const candidato of nomes) {
      const caminho = path.join(pasta, candidato)
      if (await ehExecutavel(caminho, ctx.plataforma)) return caminho
    }
  }
  return undefined
}

/** Último recurso: um shell de login **não interativo** (nunca `-i`: o `.zshrc` pode ter aliases). */
async function perguntarAoShell(nome: string, ctx: ContextoAgente): Promise<string | undefined> {
  if (ctx.plataforma === 'win32' || !/^[a-z0-9._-]+$/i.test(nome)) return undefined
  const tentativas: SpecProcesso[] = [
    { comando: '/bin/zsh', args: ['-lc', `whence -p ${nome}`] },
    { comando: '/bin/bash', args: ['-lc', `type -P ${nome}`] },
  ]
  for (const tentativa of tentativas) {
    if (!(await ehExecutavel(tentativa.comando, ctx.plataforma))) continue
    const r = await rodarCurto(tentativa, 3000, { env: ctx.env, cwd: ctx.home, plataforma: ctx.plataforma })
    const linha = r.stdout
      .split(/\r?\n/)
      .map(l => l.trim())
      .find(l => l.startsWith('/'))
    if (r.codigo === 0 && linha !== undefined && (await ehExecutavel(linha, ctx.plataforma))) return linha
  }
  return undefined
}

export type OpcoesAcharBinario = {
  /** Troca as pastas conhecidas (testes). */
  pastas?: readonly string[]
  /** Pergunta ao shell de login no fim (padrão: sim). */
  usarShell?: boolean
  /** Ignora o cache. */
  semCache?: boolean
}

/**
 * Acha o executável `nome`: caminho configurado → PATH do processo → pastas
 * conhecidas → shell de login não interativo. Guarda o resultado por 60 s.
 */
export async function acharBinario(
  nome: string,
  ctx: ContextoAgente,
  opcoes: OpcoesAcharBinario = {},
): Promise<string | undefined> {
  const chave = [nome, ctx.caminhoConfigurado ?? '', ctx.env.PATH ?? '', (opcoes.pastas ?? []).join('|')].join('\u0000')
  const guardado = cacheBinarios.get(chave)
  if (!opcoes.semCache && guardado !== undefined && Date.now() - guardado.em < CACHE_MS) return guardado.valor

  const achar = async (): Promise<string | undefined> => {
    const configurado = ctx.caminhoConfigurado?.trim()
    if (configurado) {
      const caminho = expandirHome(configurado, ctx.home)
      if (await ehExecutavel(caminho, ctx.plataforma)) return caminho
    }
    const doPath = (ctx.env.PATH ?? ctx.env.Path ?? '').split(separadorPath(ctx.plataforma))
    const noPath = await procurarEm(doPath, nome, ctx)
    if (noPath !== undefined) return noPath
    const conhecidas = opcoes.pastas ?? (await pastasConhecidas(ctx))
    const nasConhecidas = await procurarEm(conhecidas, nome, ctx)
    if (nasConhecidas !== undefined) return nasConhecidas
    if (opcoes.usarShell === false) return undefined
    return perguntarAoShell(nome, ctx)
  }

  const valor = await achar().catch(() => undefined)
  cacheBinarios.set(chave, { valor, em: Date.now() })
  return valor
}

// ---------------------------------------------------------------------------
// Rodar

/** Aspas no estilo do `cmd.exe`. */
function aspasCmd(arg: string): string {
  if (arg !== '' && !/[\s"&|<>^%()]/.test(arg)) return arg
  return `"${arg.replace(/"/g, '""')}"`
}

/** No Windows, `.cmd`/`.bat` (o que o npm instala) só roda via `cmd /c`. */
export function prepararComando(
  spec: SpecProcesso,
  plataforma: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
): { comando: string; args: string[]; verbatim: boolean } {
  if (plataforma === 'win32' && /\.(cmd|bat)$/i.test(spec.comando)) {
    const linha = [spec.comando, ...spec.args].map(aspasCmd).join(' ')
    return { comando: env.ComSpec ?? 'cmd.exe', args: ['/d', '/s', '/c', `"${linha}"`], verbatim: true }
  }
  return { comando: spec.comando, args: spec.args, verbatim: false }
}

/**
 * Põe a pasta do binário no começo do PATH do processo. O editor aberto pelo Dock tem
 * um PATH curto, e um CLI instalado pelo npm (`#!/usr/bin/env node`) precisa achar o
 * `node` que fica ao lado dele.
 */
export function comPastaNoPath(env: NodeJS.ProcessEnv, comando: string, plataforma: NodeJS.Platform): NodeJS.ProcessEnv {
  const absoluto = plataforma === 'win32' ? path.win32.isAbsolute(comando) : path.posix.isAbsolute(comando)
  if (!absoluto) return env
  const pasta = plataforma === 'win32' ? path.win32.dirname(comando) : path.posix.dirname(comando)
  const chave = Object.keys(env).find(k => k.toUpperCase() === 'PATH') ?? 'PATH'
  const atual = env[chave] ?? ''
  const sep = separadorPath(plataforma)
  if (atual.split(sep).includes(pasta)) return env
  return { ...env, [chave]: atual === '' ? pasta : `${pasta}${sep}${atual}` }
}

export type OpcoesRodar = {
  cwd?: string
  /** Ambiente base do processo (padrão: `process.env`). `spec.env` entra por cima. */
  env?: NodeJS.ProcessEnv
  sinal?: AbortSignal
  onLinha?: (linha: string) => void
  onStderr?: (pedaco: string) => void
  timeoutMs?: number
  plataforma?: NodeJS.Platform
  /** Espera entre o SIGTERM e o SIGKILL (padrão 2 s). */
  esperaKillMs?: number
}

export type ResultadoProcesso = {
  codigo: number | null
  sinal: NodeJS.Signals | null
  /** O fim do stderr (até 16 KB). */
  stderr: string
  /** Erro de spawn (binário não encontrado, sem permissão). */
  erro?: string
  cancelado: boolean
  tempoEsgotado: boolean
}

const MAX_STDERR = 16 * 1024

/** Processos vivos, pra `matarTodos()` no `deactivate`. */
const vivos = new Set<() => void>()

export function matarTodos(): void {
  for (const matar of [...vivos]) {
    try {
      matar()
    } catch {
      // ignora: o processo pode ter saído no meio do caminho
    }
  }
}

/**
 * Roda `spec`: escreve `spec.stdin` e fecha o stdin (os CLIs esperam EOF), entrega
 * cada linha de stdout em `onLinha` e resolve quando o processo fecha. Nunca rejeita.
 * Cancelamento (`sinal`) e timeout: SIGTERM no grupo do processo e, se não sair em
 * 2 s, SIGKILL.
 */
export function rodar(spec: SpecProcesso, opcoes: OpcoesRodar = {}): Promise<ResultadoProcesso> {
  const plataforma = opcoes.plataforma ?? process.platform
  const envBase = opcoes.env ?? process.env
  const env: NodeJS.ProcessEnv = comPastaNoPath({ ...envBase, ...(spec.env ?? {}) }, spec.comando, plataforma)
  const preparado = prepararComando(spec, plataforma, env)
  const esperaKill = opcoes.esperaKillMs ?? 2000

  return new Promise(resolve => {
    let stderr = ''
    let cancelado = false
    let tempoEsgotado = false
    let saiu = false
    let resolvido = false
    const timers: NodeJS.Timeout[] = []
    const divisor = new DivisorDeLinhas()

    const entregar = (linhas: string[]) => {
      for (const linha of linhas) {
        try {
          opcoes.onLinha?.(linha)
        } catch {
          // um ouvinte com defeito não derruba a leitura
        }
      }
    }

    const opcoesSpawn: SpawnOptions = {
      cwd: opcoes.cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      windowsVerbatimArguments: preparado.verbatim,
      // Grupo próprio no Unix: o kill alcança os filhos do CLI também.
      detached: plataforma !== 'win32',
    }

    let filho: ReturnType<typeof spawn>
    try {
      filho = spawn(preparado.comando, preparado.args, opcoesSpawn)
    } catch (erro) {
      resolve({
        codigo: null,
        sinal: null,
        stderr: '',
        erro: erro instanceof Error ? erro.message : String(erro),
        cancelado: false,
        tempoEsgotado: false,
      })
      return
    }

    const terminar = (codigo: number | null, sinal: NodeJS.Signals | null, erro?: string) => {
      if (resolvido) return
      resolvido = true
      vivos.delete(matar)
      for (const t of timers) clearTimeout(t)
      opcoes.sinal?.removeEventListener('abort', aoAbortar)
      entregar(divisor.terminar())
      resolve({ codigo, sinal, stderr, erro, cancelado, tempoEsgotado })
    }

    const enviarSinal = (sinal: NodeJS.Signals) => {
      const pid = filho.pid
      if (pid === undefined) return
      if (plataforma === 'win32') {
        try {
          spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }).on(
            'error',
            () => undefined,
          )
        } catch {
          filho.kill()
        }
        return
      }
      try {
        process.kill(-pid, sinal)
      } catch {
        try {
          filho.kill(sinal)
        } catch {
          // já saiu
        }
      }
    }

    function matar(): void {
      if (saiu) return
      enviarSinal('SIGTERM')
      const t = setTimeout(() => {
        if (!saiu) enviarSinal('SIGKILL')
      }, esperaKill)
      timers.push(t)
    }

    function aoAbortar(): void {
      cancelado = true
      matar()
    }

    vivos.add(matar)
    if (opcoes.sinal?.aborted) aoAbortar()
    else opcoes.sinal?.addEventListener('abort', aoAbortar, { once: true })

    if (opcoes.timeoutMs !== undefined && opcoes.timeoutMs > 0) {
      timers.push(
        setTimeout(() => {
          tempoEsgotado = true
          matar()
        }, opcoes.timeoutMs),
      )
    }

    filho.on('error', erro => {
      saiu = true
      terminar(null, null, erro.message)
    })

    filho.stdout?.setEncoding('utf8')
    filho.stdout?.on('data', (pedaco: string) => entregar(divisor.empurrar(pedaco)))
    filho.stderr?.setEncoding('utf8')
    filho.stderr?.on('data', (pedaco: string) => {
      stderr = (stderr + pedaco).slice(-MAX_STDERR)
      try {
        opcoes.onStderr?.(pedaco)
      } catch {
        // idem
      }
    })

    filho.stdin?.on('error', () => undefined)
    try {
      filho.stdin?.end(spec.stdin ?? '')
    } catch {
      // o processo pode ter morrido antes de ler
    }

    filho.on('exit', (codigo, sinal) => {
      saiu = true
      // Um neto que herdou o stdout pode segurar o `close`: depois de 2 s, segue sem ele.
      timers.push(
        setTimeout(() => {
          filho.stdout?.destroy()
          filho.stderr?.destroy()
          terminar(codigo, sinal)
        }, 2000),
      )
    })
    filho.on('close', (codigo, sinal) => {
      saiu = true
      terminar(codigo, sinal)
    })
  })
}

export type ResultadoCurto = { codigo: number; stdout: string; stderr: string }

/**
 * Pra detecção, auth e modelos: roda, junta stdout e devolve. Nunca lança.
 * `codigo` é -1 quando não deu pra rodar ou o tempo acabou.
 */
export async function rodarCurto(
  spec: SpecProcesso,
  timeoutMs: number,
  opcoes: Pick<OpcoesRodar, 'cwd' | 'env' | 'plataforma'> = {},
): Promise<ResultadoCurto> {
  try {
    const linhas: string[] = []
    const r = await rodar(spec, { ...opcoes, timeoutMs, onLinha: linha => linhas.push(linha), esperaKillMs: 500 })
    const codigo = r.erro !== undefined || r.tempoEsgotado || r.codigo === null ? -1 : r.codigo
    return { codigo, stdout: linhas.join('\n'), stderr: r.erro !== undefined ? r.erro : r.stderr }
  } catch (erro) {
    return { codigo: -1, stdout: '', stderr: erro instanceof Error ? erro.message : String(erro) }
  }
}

// ---------------------------------------------------------------------------
// Executar um agente

/** Tira cores ANSI, linhas vazias e corta no fim: o bastante pra explicar um erro. */
export function resumirStderr(stderr: string, maximo = 600): string {
  const linhas = stderr
    // eslint-disable-next-line no-control-regex
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l !== '')
  const texto = linhas.slice(-6).join('\n')
  return texto.length > maximo ? `…${texto.slice(-(maximo - 1))}` : texto
}

export type OpcoesExecutar = Omit<OpcoesRodar, 'onLinha'> & {
  onEvento: (evento: EventoExecucao) => void
}

/**
 * Roda um CLI de agente, passa cada linha pelo parser e entrega os eventos. Garante
 * exatamente um `fim`: se o CLI sair sem mandar o dele, fabrica um com o stderr resumido.
 */
export async function executarAgente(spec: SpecProcesso, parser: Parser, opcoes: OpcoesExecutar): Promise<EventoFim> {
  let fim: EventoFim | undefined
  const textos: string[] = []
  const emitir = (evento: EventoExecucao) => {
    if (evento.tipo === 'fim') {
      if (fim !== undefined) return
      // Cancelado pelo usuário: o CLI pode responder ao SIGTERM com um `result` de erro.
      if (opcoes.sinal?.aborted && evento.status !== 'ok') evento = { ...evento, status: 'cancelado', erro: undefined }
      fim = evento
    }
    if (evento.tipo === 'texto') textos.push(evento.texto)
    try {
      opcoes.onEvento(evento)
    } catch {
      // idem
    }
  }

  const r = await rodar(spec, {
    ...opcoes,
    onLinha: linha => {
      let eventos: EventoExecucao[]
      try {
        eventos = parser(linha)
      } catch (erro) {
        eventos = [{ tipo: 'aviso', texto: `Linha que o MazyOS não entendeu: ${String(erro).slice(0, 200)}` }]
      }
      for (const evento of eventos) emitir(evento)
    },
  })

  if (fim !== undefined) return fim

  const detalhe = resumirStderr(r.stderr)
  let fabricado: EventoFim
  if (r.cancelado) {
    fabricado = { tipo: 'fim', status: 'cancelado', resposta: textos.join('') }
  } else if (r.erro !== undefined) {
    fabricado = {
      tipo: 'fim',
      status: 'erro',
      resposta: '',
      erro: `Não deu pra iniciar o CLI (${spec.comando}): ${r.erro}`,
    }
  } else if (r.tempoEsgotado) {
    fabricado = {
      tipo: 'fim',
      status: 'erro',
      resposta: textos.join(''),
      erro: `O CLI passou do tempo limite e foi encerrado.${detalhe ? `\n${detalhe}` : ''}`,
    }
  } else if (r.codigo === 0) {
    fabricado = { tipo: 'fim', status: 'ok', resposta: textos.join('') }
  } else {
    const como = r.sinal !== null ? `pelo sinal ${r.sinal}` : `com código ${r.codigo ?? '?'}`
    fabricado = {
      tipo: 'fim',
      status: 'erro',
      resposta: textos.join(''),
      erro: detalhe !== '' ? detalhe : `O CLI saiu ${como} sem dizer o motivo.`,
    }
  }
  emitir(fabricado)
  return fabricado
}
