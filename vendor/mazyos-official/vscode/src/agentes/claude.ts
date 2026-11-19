// Adaptador do Claude Code (`claude`).
import type { EstadoAuth, Modelo } from '../shared/protocolo'
import { criarParserClaude } from './parsers/claude'
import { acharBinario, rodarCurto } from './processo'
import { linhaDeComando, promptDoArquivo } from './terminal'
import type { Agente, ContextoAgente, Deteccao, RequisicaoExecucao, Shell, SpecProcesso } from './tipos'

const MODELOS: Modelo[] = [
  { id: 'opus', rotulo: 'Opus, o mais capaz' },
  { id: 'sonnet', rotulo: 'Sonnet, equilíbrio' },
  { id: 'haiku', rotulo: 'Haiku, o mais rápido' },
]

function modoPermissao(permissoes: RequisicaoExecucao['permissoes']): string {
  return permissoes === 'tudo' ? 'bypassPermissions' : 'acceptEdits'
}

function plano(tipo: string | undefined): string | undefined {
  if (tipo === undefined || tipo === '') return undefined
  return tipo.charAt(0).toUpperCase() + tipo.slice(1)
}

/** `claude auth status` → `EstadoAuth`, guardando só e-mail e plano. */
export function lerAuthClaude(stdout: string, codigo: number): EstadoAuth {
  try {
    const d = JSON.parse(stdout) as Record<string, unknown>
    if (d.loggedIn === true) {
      return {
        estado: 'conectado',
        metodo: 'assinatura',
        conta: typeof d.email === 'string' ? d.email : undefined,
        detalhe: plano(typeof d.subscriptionType === 'string' ? d.subscriptionType : undefined) ?? 'Conta Claude',
      }
    }
    return { estado: 'desconectado' }
  } catch {
    return { estado: 'desconectado', detalhe: codigo === -1 ? 'Não deu pra consultar a conta' : undefined }
  }
}

export const claude: Agente = {
  id: 'claude',
  nome: 'Claude Code',
  marca: 'Claude',
  descricao: 'Usa a sua conta Claude (Pro, Max ou Team) ou uma chave da API da Anthropic.',
  executavel: 'claude',
  aceitaChave: true,
  variavelChave: 'ANTHROPIC_API_KEY',
  comandoInstalar: 'npm install -g @anthropic-ai/claude-code',
  retomaSessao: true,

  async detectar(ctx: ContextoAgente): Promise<Deteccao> {
    const binario = await acharBinario(this.executavel, ctx)
    if (binario === undefined) return { instalado: false }
    const r = await rodarCurto({ comando: binario, args: ['--version'] }, 5000, { env: ctx.env, plataforma: ctx.plataforma })
    return { instalado: true, binario, versao: /\d+\.\d+\.\d+\S*/.exec(r.stdout)?.[0] }
  },

  async auth(ctx: ContextoAgente, binario: string): Promise<EstadoAuth> {
    const r = await rodarCurto({ comando: binario, args: ['auth', 'status'] }, 8000, {
      env: ctx.env,
      plataforma: ctx.plataforma,
    })
    return lerAuthClaude(r.stdout, r.codigo)
  },

  async modelos(): Promise<Modelo[]> {
    return MODELOS
  },

  comandoExecucao(req: RequisicaoExecucao): SpecProcesso {
    const args = ['-p', '--output-format', 'stream-json', '--verbose', '--permission-mode', modoPermissao(req.permissoes)]
    if (req.modelo) args.push('--model', req.modelo)
    if (req.sessao) args.push('--resume', req.sessao)
    return {
      comando: req.binario,
      args,
      env: req.chave ? { ANTHROPIC_API_KEY: req.chave } : undefined,
      stdin: req.prompt,
    }
  },

  comandoInterativo(req: RequisicaoExecucao, arquivoPrompt: string, shell: Shell): string {
    const args = ['--permission-mode', modoPermissao(req.permissoes)]
    if (req.modelo) args.push('--model', req.modelo)
    return linhaDeComando(req.binario, args, shell, promptDoArquivo(arquivoPrompt, shell))
  },

  comandoLogin(binario: string, shell: Shell): string {
    return linhaDeComando(binario, ['auth', 'login'], shell)
  },

  comandoLogout(binario: string): SpecProcesso {
    return { comando: binario, args: ['auth', 'logout'] }
  },

  criarParser: criarParserClaude,
}
