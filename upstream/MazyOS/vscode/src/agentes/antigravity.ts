// Adaptador do Antigravity CLI (`agy`).
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { EstadoAuth, Modelo } from '../shared/protocolo'
import { criarParserAntigravity } from './parsers/antigravity'
import { acharBinario, rodarCurto } from './processo'
import { linhaDeComando, promptDoArquivo } from './terminal'
import type { Agente, ContextoAgente, Deteccao, RequisicaoExecucao, Shell, SpecProcesso } from './tipos'

/** A saída de `agy models`: `id<TAB>rótulo` por linha quando logado. */
export function lerModelosAgy(saida: string): Modelo[] {
  const modelos: Modelo[] = []
  for (const linha of saida.split(/\r?\n/)) {
    const m = /^([A-Za-z0-9][\w.:-]*)\t+(.+?)\s*$/.exec(linha)
    if (m?.[1] !== undefined && m[2] !== undefined) modelos.push({ id: m[1], rotulo: m[2] })
  }
  return modelos
}

export function semLoginAgy(saida: string): boolean {
  return /not logged in|authentication required|please (?:log|sign) ?in/i.test(saida)
}

/** O e-mail ativo em `~/.gemini/google_accounts.json` (só pra mostrar). */
export async function contaGoogle(home: string): Promise<string | undefined> {
  try {
    const d = JSON.parse(await readFile(path.join(home, '.gemini', 'google_accounts.json'), 'utf8')) as {
      active?: unknown
    }
    return typeof d.active === 'string' && d.active !== '' ? d.active : undefined
  } catch {
    return undefined
  }
}

const CACHE_MS = 60_000
let cacheModelos: { binario: string; em: number; codigo: number; saida: string } | undefined

/** `agy models` uma vez por minuto: serve pra auth e pra lista de modelos. */
async function consultarModelos(ctx: ContextoAgente, binario: string): Promise<{ codigo: number; saida: string }> {
  if (cacheModelos !== undefined && cacheModelos.binario === binario && Date.now() - cacheModelos.em < CACHE_MS) {
    return cacheModelos
  }
  const r = await rodarCurto({ comando: binario, args: ['models'] }, 15_000, { env: ctx.env, plataforma: ctx.plataforma })
  const resultado = { codigo: r.codigo, saida: `${r.stdout}\n${r.stderr}` }
  cacheModelos = { binario, em: Date.now(), ...resultado }
  return resultado
}

export function limparCacheAgy(): void {
  cacheModelos = undefined
}

function flagsModo(permissoes: RequisicaoExecucao['permissoes']): string[] {
  return permissoes === 'tudo' ? ['--dangerously-skip-permissions'] : ['--mode', 'accept-edits']
}

export const antigravity: Agente = {
  id: 'antigravity',
  nome: 'Antigravity',
  marca: 'Antigravity',
  descricao: 'Usa a sua conta Google, pela cota do Antigravity (Gemini, Claude e GPT-OSS).',
  executavel: 'agy',
  aceitaChave: false,
  variavelChave: null,
  comandoInstalar: 'https://antigravity.google',
  retomaSessao: true,

  async detectar(ctx: ContextoAgente): Promise<Deteccao> {
    const binario = await acharBinario(this.executavel, ctx)
    if (binario === undefined) return { instalado: false }
    const r = await rodarCurto({ comando: binario, args: ['--version'] }, 5000, { env: ctx.env, plataforma: ctx.plataforma })
    return { instalado: true, binario, versao: /\d+\.\d+\.\d+\S*/.exec(r.stdout)?.[0] }
  },

  async auth(ctx: ContextoAgente, binario: string): Promise<EstadoAuth> {
    const r = await consultarModelos(ctx, binario)
    if (semLoginAgy(r.saida)) return { estado: 'desconectado' }
    if (lerModelosAgy(r.saida).length > 0) {
      return { estado: 'conectado', metodo: 'assinatura', conta: await contaGoogle(ctx.home), detalhe: 'Google' }
    }
    return { estado: 'desconectado', detalhe: r.codigo === -1 ? 'Não deu pra consultar a conta' : undefined }
  },

  async modelos(ctx: ContextoAgente, binario: string): Promise<Modelo[]> {
    return lerModelosAgy((await consultarModelos(ctx, binario)).saida)
  },

  comandoExecucao(req: RequisicaoExecucao): SpecProcesso {
    const args = ['--input-format', 'stream-json', '--output-format', 'stream-json', ...flagsModo(req.permissoes)]
    if (req.modelo) args.push('--model', req.modelo)
    if (req.sessao) args.push('--conversation', req.sessao)
    return {
      comando: req.binario,
      args,
      stdin: `${JSON.stringify({ event: 'user', message: { content: req.prompt } })}\n`,
    }
  },

  comandoInterativo(req: RequisicaoExecucao, arquivoPrompt: string, shell: Shell): string {
    const args = [...flagsModo(req.permissoes)]
    if (req.modelo) args.push('--model', req.modelo)
    args.push('--prompt-interactive')
    return linhaDeComando(req.binario, args, shell, promptDoArquivo(arquivoPrompt, shell))
  },

  comandoLogin(binario: string, shell: Shell): string {
    // Não há subcomando de login: o `agy` interativo abre o login no navegador.
    return linhaDeComando(binario, [], shell)
  },

  comandoLogout(): null {
    return null
  },

  criarParser: criarParserAntigravity,
}
