// Tipos internos dos adaptadores de agente. Sem `vscode`: os adaptadores recebem por
// parâmetro tudo o que precisam (caminhos, ambiente, plataforma).
import type { AgenteId, EstadoAuth, EventoExecucao, Modelo } from '../shared/protocolo'

/** O que um adaptador precisa saber do ambiente pra achar e chamar o CLI. */
export type ContextoAgente = {
  /** `mazyos.caminhos.<id>` das configurações, se o usuário preencheu. */
  caminhoConfigurado?: string
  home: string
  plataforma: NodeJS.Platform
  env: NodeJS.ProcessEnv
}

export type Deteccao = {
  instalado: boolean
  binario?: string
  versao?: string
}

export type Permissoes = 'edicoes' | 'tudo'

/** O que o adaptador recebe pra montar um comando de execução. */
export type RequisicaoExecucao = {
  binario: string
  prompt: string
  cwd: string
  modelo: string | null
  permissoes: Permissoes
  /** Sessão/thread/conversa pra retomar. */
  sessao?: string
  /** Chave de API guardada no cofre do editor; entra só como variável de ambiente. */
  chave?: string
}

/** Um processo pronto pra rodar. `stdin` é escrito e depois o stdin é fechado. */
export type SpecProcesso = {
  comando: string
  args: string[]
  env?: Record<string, string>
  stdin?: string
}

/** Shell do terminal integrado, pra montar o texto do `terminal.sendText`. */
export type Shell = 'posix' | 'powershell' | 'cmd'

/** Parser de uma linha de stdout do CLI. O estado é criado uma vez por execução. */
export type Parser = (linha: string) => EventoExecucao[]

export type OpcoesParser = {
  /** Raiz do workspace, pra devolver caminhos relativos. */
  raiz?: string
  /** Só Codex: os modelos que a conta aceita, pra citar no erro de modelo. */
  modelosDisponiveis?: readonly string[]
}

export interface Agente {
  readonly id: AgenteId
  readonly nome: string
  readonly marca: string
  readonly descricao: string
  /** Nome do executável procurado no PATH e nas pastas conhecidas. */
  readonly executavel: string
  readonly aceitaChave: boolean
  readonly variavelChave: 'ANTHROPIC_API_KEY' | 'OPENAI_API_KEY' | null
  /** Comando de instalação (ou o endereço do instalador, quando não há comando). */
  readonly comandoInstalar: string
  /** O CLI aceita retomar uma sessão anterior. */
  readonly retomaSessao: boolean

  detectar(ctx: ContextoAgente): Promise<Deteccao>
  auth(ctx: ContextoAgente, binario: string): Promise<EstadoAuth>
  modelos(ctx: ContextoAgente, binario: string): Promise<Modelo[]>
  comandoExecucao(req: RequisicaoExecucao): SpecProcesso
  /** Texto pra `terminal.sendText`: abre o CLI interativo com o prompt lido de `arquivoPrompt`. */
  comandoInterativo(req: RequisicaoExecucao, arquivoPrompt: string, shell: Shell): string
  /** Texto pra `terminal.sendText` que faz o login oficial. */
  comandoLogin(binario: string, shell: Shell): string
  /** O logout, rodado em segundo plano; null quando o CLI não tem (Antigravity). */
  comandoLogout(binario: string): SpecProcesso | null
  criarParser(opcoes: OpcoesParser): Parser
}
