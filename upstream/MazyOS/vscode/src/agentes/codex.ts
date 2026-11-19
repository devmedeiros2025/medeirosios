// Adaptador do Codex CLI (`codex`).
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { EstadoAuth, Modelo } from '../shared/protocolo'
import { criarParserCodex } from './parsers/codex'
import { acharBinario, rodarCurto } from './processo'
import { linhaDeComando, promptDoArquivo } from './terminal'
import type { Agente, ContextoAgente, Deteccao, RequisicaoExecucao, Shell, SpecProcesso } from './tipos'

/** `codex login status` → `EstadoAuth`. A saída vai pro stdout ou pro stderr conforme a versão. */
export function lerAuthCodex(saida: string): EstadoAuth {
  if (/not logged in/i.test(saida)) return { estado: 'desconectado' }
  if (/logged in using chatgpt/i.test(saida)) return { estado: 'conectado', metodo: 'assinatura', detalhe: 'ChatGPT' }
  if (/logged in using an? api key/i.test(saida)) return { estado: 'conectado', metodo: 'chave', detalhe: 'Chave da API' }
  if (/logged in/i.test(saida)) return { estado: 'conectado', metodo: 'assinatura' }
  return { estado: 'desconectado' }
}

/** Os modelos de `~/.codex/models_cache.json` que a conta lista (sem os escondidos). */
export async function lerModelosCodex(home: string): Promise<Modelo[]> {
  try {
    const texto = await readFile(path.join(home, '.codex', 'models_cache.json'), 'utf8')
    const d = JSON.parse(texto) as { models?: unknown }
    if (!Array.isArray(d.models)) return []
    const modelos: Modelo[] = []
    for (const m of d.models) {
      if (m === null || typeof m !== 'object') continue
      const r = m as Record<string, unknown>
      if (typeof r.slug !== 'string' || r.visibility === 'hide') continue
      modelos.push({ id: r.slug, rotulo: typeof r.display_name === 'string' ? r.display_name : r.slug })
    }
    return modelos
  } catch {
    return []
  }
}

function flagsPermissao(permissoes: RequisicaoExecucao['permissoes']): string[] {
  return permissoes === 'tudo' ? ['--dangerously-bypass-approvals-and-sandbox'] : ['-s', 'workspace-write']
}

export const codex: Agente = {
  id: 'codex',
  nome: 'Codex',
  marca: 'GPT',
  descricao: 'Usa a sua conta do ChatGPT (Plus, Pro ou Business) ou uma chave da API da OpenAI.',
  executavel: 'codex',
  aceitaChave: true,
  variavelChave: 'OPENAI_API_KEY',
  comandoInstalar: 'npm install -g @openai/codex',
  retomaSessao: true,

  async detectar(ctx: ContextoAgente): Promise<Deteccao> {
    const binario = await acharBinario(this.executavel, ctx)
    if (binario === undefined) return { instalado: false }
    const r = await rodarCurto({ comando: binario, args: ['--version'] }, 5000, { env: ctx.env, plataforma: ctx.plataforma })
    return { instalado: true, binario, versao: /\d+\.\d+\.\d+\S*/.exec(r.stdout)?.[0] }
  },

  async auth(ctx: ContextoAgente, binario: string): Promise<EstadoAuth> {
    const r = await rodarCurto({ comando: binario, args: ['login', 'status'] }, 8000, {
      env: ctx.env,
      plataforma: ctx.plataforma,
    })
    return lerAuthCodex(`${r.stdout}\n${r.stderr}`)
  },

  async modelos(ctx: ContextoAgente): Promise<Modelo[]> {
    return lerModelosCodex(ctx.home)
  },

  comandoExecucao(req: RequisicaoExecucao): SpecProcesso {
    // As flags de `exec` vêm antes do `resume`: o subcomando não aceita `-s` nem `-C`.
    const args = ['exec', '--json', ...flagsPermissao(req.permissoes), '--skip-git-repo-check', '-C', req.cwd]
    if (req.modelo) args.push('-m', req.modelo)
    if (req.sessao) args.push('resume', req.sessao)
    args.push('-')
    return {
      comando: req.binario,
      args,
      env: req.chave ? { OPENAI_API_KEY: req.chave } : undefined,
      stdin: req.prompt,
    }
  },

  comandoInterativo(req: RequisicaoExecucao, arquivoPrompt: string, shell: Shell): string {
    const args =
      req.permissoes === 'tudo'
        ? ['--dangerously-bypass-approvals-and-sandbox']
        : ['-s', 'workspace-write', '-a', 'on-request']
    args.push('-C', req.cwd)
    if (req.modelo) args.push('-m', req.modelo)
    return linhaDeComando(req.binario, args, shell, promptDoArquivo(arquivoPrompt, shell))
  },

  comandoLogin(binario: string, shell: Shell): string {
    return linhaDeComando(binario, ['login'], shell)
  },

  comandoLogout(binario: string): SpecProcesso {
    return { comando: binario, args: ['logout'] }
  },

  criarParser: criarParserCodex,
}
