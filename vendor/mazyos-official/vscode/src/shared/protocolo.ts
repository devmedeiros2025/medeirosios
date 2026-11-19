// Contrato entre o host da extensão (Node, `src/`) e a interface (webview, `webview/`).
// Este arquivo é importado dos dois lados: nada de `vscode`, `node:*` ou DOM aqui.

/** Os três agentes que a extensão sabe operar. */
export type AgenteId = 'claude' | 'codex' | 'antigravity'

/** Estado da conta de um agente, visto pela extensão. */
export type EstadoAuth = {
  /** `ausente` = o CLI não está instalado; `verificando` = ainda não respondeu. */
  estado: 'conectado' | 'desconectado' | 'ausente' | 'verificando'
  /** `assinatura` = login na conta (Claude, ChatGPT, Google); `chave` = chave de API guardada. */
  metodo?: 'assinatura' | 'chave'
  /** E-mail ou nome da conta, quando o CLI informa. */
  conta?: string
  /** Plano ou detalhe curto: "Max", "ChatGPT", "Google". */
  detalhe?: string
}

export type Modelo = { id: string; rotulo: string }

export type AgenteInfo = {
  id: AgenteId
  /** Nome do produto que roda: "Claude Code", "Codex", "Antigravity". */
  nome: string
  /** Nome curto da marca pra interface: "Claude", "GPT", "Antigravity". */
  marca: string
  /** Uma frase sobre a conta que ele usa. */
  descricao: string
  instalado: boolean
  versao?: string
  /** Caminho do binário encontrado, pra diagnóstico. */
  binario?: string
  auth: EstadoAuth
  modelos: Modelo[]
  /** Modelo escolhido nas configurações; `null` usa o padrão do CLI. */
  modelo: string | null
  /** Se aceita uma chave de API guardada no cofre do editor (Claude e Codex sim, Antigravity não). */
  aceitaChave: boolean
  /** Comando de instalação pra mostrar quando o CLI não existe. */
  comandoInstalar: string
}

export type MazyosChave = 'empresa' | 'preferencias' | 'estrategia' | 'design'

export type MazyosArquivo = {
  chave: MazyosChave
  rotulo: string
  /** Relativo à raiz do workspace. */
  caminho: string
  existe: boolean
  /** Existe, tem conteúdo e é diferente do template. */
  preenchido: boolean
  mtimeMs: number
}

export type Workspace = {
  /** Pasta aberta no editor; `null` sem pasta aberta. */
  raiz: string | null
  /** Tem a pasta `_memoria/`. */
  instalado: boolean
  nome: string | null
  negocio: string | null
  foco: string | null
  tom: string | null
  arquivos: MazyosArquivo[]
  lidoEm: number
}

export type Grupo = 'dia-a-dia' | 'conteudo' | 'ads' | 'prospeccao' | 'producao'

export type Skill = {
  /** Nome da pasta da skill: "carrossel", "seo"... */
  nome: string
  /** Como aparece na interface: "Carrossel". */
  rotulo: string
  /** A descrição do frontmatter da SKILL.md, encurtada. */
  descricao: string
  grupo: Grupo
  /**
   * `tarefa` roda em uma passada no console do Mazy (carrossel, seo, e-mail).
   * `conversa` abre o agente num terminal com a skill carregada, porque ela entrevista o usuário (instalar, novo-projeto).
   */
  modo: 'tarefa' | 'conversa'
  /** Exemplo de pedido pra sugerir no campo de texto. */
  exemplo?: string
  /** Nome de ícone (lucide) escolhido no catálogo. */
  icone: string
}

/** Um evento da execução de um agente, já normalizado entre os três CLIs. */
export type EventoExecucao =
  | { tipo: 'inicio'; modelo?: string; sessao?: string }
  | { tipo: 'texto'; texto: string }
  | { tipo: 'ferramenta'; id: string; nome: string; resumo: string; estado: 'rodando' | 'ok' | 'erro' }
  | { tipo: 'arquivo'; caminho: string; acao: 'criado' | 'editado' | 'apagado' }
  | { tipo: 'aviso'; texto: string }
  | {
      tipo: 'fim'
      status: 'ok' | 'erro' | 'cancelado'
      resposta: string
      custoUsd?: number
      duracaoMs?: number
      sessao?: string
      erro?: string
    }

export type Execucao = {
  id: string
  agente: AgenteId
  modelo?: string
  /** Skill que originou o pedido, se houver. */
  skill?: string
  /** O que o usuário pediu, do jeito que digitou. */
  pedido: string
  inicio: number
  fim?: number
  estado: 'rodando' | 'ok' | 'erro' | 'cancelado'
  eventos: EventoExecucao[]
  /** Texto final do agente, quando terminou. */
  resposta?: string
  /** Id de sessão/thread do CLI, pra retomar quando o CLI permite. */
  sessao?: string
  custoUsd?: number
}

export type Config = {
  agente: AgenteId
  permissoes: 'edicoes' | 'tudo'
  abrirConsoleAoRodar: boolean
}

export type Ambiente = {
  /** Qual editor está hospedando a extensão. */
  editor: 'vscode' | 'antigravity' | 'cursor' | 'outro'
  /** Versão do pacote da extensão. */
  versao: string
  /** Versão do plugin MazyOS embutido (skills e templates). */
  versaoPlugin: string
  plataforma: 'mac' | 'linux' | 'windows'
}

/** Foto completa do que a interface precisa pra desenhar. */
export type Estado = {
  ambiente: Ambiente
  workspace: Workspace
  agentes: AgenteInfo[]
  skills: Skill[]
  /** As execuções mais recentes primeiro. Os eventos vêm junto. */
  execucoes: Execucao[]
  config: Config
}

/** Mensagens do host pra interface. */
export type ParaWebview =
  | { tipo: 'estado'; estado: Estado }
  | { tipo: 'execucao'; execucao: Execucao }
  | { tipo: 'evento'; id: string; evento: EventoExecucao }
  | { tipo: 'aviso'; texto: string; nivel?: 'info' | 'erro' | 'ok' }
  | { tipo: 'foco'; alvo: 'pedido' }

/** Mensagens da interface pro host. */
export type ParaExtensao =
  | { tipo: 'pronto' }
  | { tipo: 'recarregar' }
  | { tipo: 'instalar' }
  | { tipo: 'rodar'; skill?: string; pedido: string }
  | { tipo: 'conversar'; skill: string }
  | { tipo: 'continuar'; id: string; pedido: string }
  | { tipo: 'cancelar'; id: string }
  | { tipo: 'abrirConsole'; id?: string }
  | { tipo: 'abrirArquivo'; caminho: string }
  | { tipo: 'abrirPasta'; caminho: string }
  | { tipo: 'abrirPastaDoNegocio' }
  | { tipo: 'escolherAgente'; agente: AgenteId }
  | { tipo: 'escolherModelo'; agente: AgenteId; modelo: string | null }
  | { tipo: 'entrar'; agente: AgenteId }
  | { tipo: 'sair'; agente: AgenteId }
  | { tipo: 'definirChave'; agente: AgenteId }
  | { tipo: 'removerChave'; agente: AgenteId }
  | { tipo: 'instalarAgente'; agente: AgenteId }
  | { tipo: 'copiar'; texto: string }
  | { tipo: 'salvarSaida'; id: string }
  | { tipo: 'configurar'; chave: keyof Config; valor: Config[keyof Config] }
  | { tipo: 'abrirExterno'; url: string }

/** O host injeta isto em `window.mazyos` antes de carregar o bundle da interface. */
export type DadosIniciais = {
  view: 'painel' | 'console'
  /** No console, a execução que deve aparecer aberta. */
  execucaoId?: string
}

/** Rótulo de cada agente, pra usar dos dois lados. */
export const MARCAS: Record<AgenteId, { nome: string; marca: string }> = {
  claude: { nome: 'Claude Code', marca: 'Claude' },
  codex: { nome: 'Codex', marca: 'GPT' },
  antigravity: { nome: 'Antigravity', marca: 'Antigravity' },
}

export const GRUPOS: Record<Grupo, string> = {
  'dia-a-dia': 'Pra tocar o dia a dia',
  conteudo: 'Conteúdo e SEO',
  ads: 'Google Ads e Meta Ads',
  prospeccao: 'Prospecção de clientes',
  producao: 'Produção',
}
