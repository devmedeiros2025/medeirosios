// O coração do host: guarda o estado (workspace, skills, agentes, configuração),
// manda fotos completas pras webviews e executa as intenções que elas mandam.
import { readFileSync } from 'node:fs'
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import * as vscode from 'vscode'

import { AGENTES, IDS_AGENTES } from './agentes'
import { limparCacheAgy } from './agentes/antigravity'
import { lerModelosCodex } from './agentes/codex'
import { limparCacheBinarios, rodarCurto } from './agentes/processo'
import type { Agente, ContextoAgente, RequisicaoExecucao, Shell } from './agentes/tipos'
import { type ExecucaoManager, type Preparo } from './execucoes'
import { lerCatalogo } from './nucleo/catalogo'
import { lerWorkspace, workspaceSemPasta } from './nucleo/memoria'
import { prepararPedido } from './nucleo/pedido'
import type {
  AgenteId,
  AgenteInfo,
  Ambiente,
  Config,
  Estado,
  EstadoAuth,
  Execucao,
  ParaExtensao,
  ParaWebview,
  Skill,
  Workspace,
} from './shared/protocolo'
import { MARCAS } from './shared/protocolo'

const CACHE_AGENTES_MS = 60_000

export type Destinos = {
  painel: { postar(m: ParaWebview): void; readonly visivel: boolean }
  console: { postar(m: ParaWebview): void; mostrar(id?: string, preservarFoco?: boolean): void }
}

function mensagemDeErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

function plataforma(): Ambiente['plataforma'] {
  if (process.platform === 'win32') return 'windows'
  if (process.platform === 'darwin') return 'mac'
  return 'linux'
}

export function editorAtual(appName: string): Ambiente['editor'] {
  if (/antigravity/i.test(appName)) return 'antigravity'
  if (/cursor/i.test(appName)) return 'cursor'
  if (/visual studio code|vscode|vscodium/i.test(appName)) return 'vscode'
  return 'outro'
}

function shellDoTerminal(): Shell {
  const shell = vscode.env.shell ?? ''
  if (/pwsh|powershell/i.test(shell)) return 'powershell'
  if (/cmd(\.exe)?$/i.test(shell)) return 'cmd'
  if (shell === '' && process.platform === 'win32') return 'powershell'
  return 'posix'
}

function infoInicial(agente: Agente): AgenteInfo {
  return {
    id: agente.id,
    nome: agente.nome,
    marca: agente.marca,
    descricao: agente.descricao,
    instalado: false,
    auth: { estado: 'verificando' },
    modelos: [],
    modelo: null,
    aceitaChave: agente.aceitaChave,
    comandoInstalar: agente.comandoInstalar,
  }
}

export class Host implements vscode.Disposable {
  readonly raizPlugin: string
  private workspace: Workspace = workspaceSemPasta()
  private skills: Skill[] = []
  private readonly agentes: Record<AgenteId, AgenteInfo>
  private agentesLidosEm = 0
  private verificandoAgentes: Promise<void> | undefined
  private readonly ambiente: Ambiente
  private destinos: Destinos | undefined
  private readonly aoMudar = new vscode.EventEmitter<void>()
  /** Disparado quando o estado muda (barra de status escuta). */
  readonly onMudou = this.aoMudar.event
  private readonly terminais = new Map<vscode.Terminal, () => void>()
  private readonly descartaveis: vscode.Disposable[] = []

  constructor(
    private readonly contexto: vscode.ExtensionContext,
    readonly execucoes: ExecucaoManager,
  ) {
    this.raizPlugin = path.join(contexto.extensionPath, 'mazyos')
    this.agentes = {
      claude: infoInicial(AGENTES.claude),
      codex: infoInicial(AGENTES.codex),
      antigravity: infoInicial(AGENTES.antigravity),
    }
    let versaoPlugin = '?'
    try {
      versaoPlugin = (JSON.parse(readFileSync(path.join(this.raizPlugin, 'plugin.json'), 'utf8')) as { version?: string })
        .version ?? '?'
    } catch {
      // sem a cópia do plugin: a extensão foi empacotada sem `npm run preparar`
    }
    this.ambiente = {
      editor: editorAtual(vscode.env.appName),
      versao: String((contexto.extension.packageJSON as { version?: string }).version ?? '0.0.0'),
      versaoPlugin,
      plataforma: plataforma(),
    }

    this.descartaveis.push(
      this.aoMudar,
      execucoes.ouvir(mensagem => {
        this.postar(mensagem)
        if (mensagem.tipo === 'execucao') this.aoMudar.fire()
      }),
      vscode.window.onDidCloseTerminal(terminal => {
        const aoFechar = this.terminais.get(terminal)
        if (aoFechar !== undefined) {
          this.terminais.delete(terminal)
          aoFechar()
        }
      }),
    )
  }

  ligar(destinos: Destinos): void {
    this.destinos = destinos
  }

  // -------------------------------------------------------------------------
  // Estado

  get raiz(): string | null {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null
  }

  get ws(): Workspace {
    return this.workspace
  }

  get listaSkills(): readonly Skill[] {
    return this.skills
  }

  config(): Config {
    const c = vscode.workspace.getConfiguration('mazyos')
    const agente = c.get<string>('agente', 'claude')
    return {
      agente: (IDS_AGENTES as readonly string[]).includes(agente) ? (agente as AgenteId) : 'claude',
      permissoes: c.get<string>('permissoes', 'edicoes') === 'tudo' ? 'tudo' : 'edicoes',
      abrirConsoleAoRodar: c.get<boolean>('abrirConsoleAoRodar', true),
    }
  }

  modeloDe(id: AgenteId): string | null {
    const modelos = vscode.workspace.getConfiguration('mazyos').get<Record<string, unknown>>('modelos', {})
    const valor = modelos?.[id]
    return typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : null
  }

  private contextoAgente(id: AgenteId): ContextoAgente {
    const caminhos = vscode.workspace.getConfiguration('mazyos').get<Record<string, unknown>>('caminhos', {})
    const configurado = caminhos?.[id]
    return {
      caminhoConfigurado: typeof configurado === 'string' && configurado.trim() !== '' ? configurado : undefined,
      home: os.homedir(),
      plataforma: process.platform,
      env: process.env,
    }
  }

  estado(): Estado {
    for (const id of IDS_AGENTES) this.agentes[id].modelo = this.modeloDe(id)
    return {
      ambiente: this.ambiente,
      workspace: this.workspace,
      agentes: IDS_AGENTES.map(id => this.agentes[id]),
      skills: this.skills,
      execucoes: this.execucoes.lista(),
      config: this.config(),
    }
  }

  agenteInfo(id: AgenteId): AgenteInfo {
    return this.agentes[id]
  }

  postar(mensagem: ParaWebview): void {
    this.destinos?.painel.postar(mensagem)
    this.destinos?.console.postar(mensagem)
  }

  /** Manda a foto completa pras duas webviews e avisa a barra de status. */
  enviarEstado(): void {
    this.postar({ tipo: 'estado', estado: this.estado() })
    this.aoMudar.fire()
  }

  avisar(texto: string, nivel: 'info' | 'erro' | 'ok' = 'info'): void {
    this.postar({ tipo: 'aviso', texto, nivel })
  }

  /** Erro curto: notificação do editor e aviso na interface. */
  erro(texto: string): void {
    void vscode.window.showErrorMessage(`MazyOS: ${texto}`)
    this.avisar(texto, 'erro')
  }

  async recarregarWorkspace(): Promise<void> {
    try {
      this.workspace = await lerWorkspace(this.raiz, this.raizPlugin)
    } catch {
      this.workspace = workspaceSemPasta()
    }
    if (this.skills.length === 0) this.skills = await lerCatalogo(this.raizPlugin).catch(() => [])
    this.enviarEstado()
  }

  /** Detecção, conta e modelos dos três CLIs, em paralelo. Cache de 60 s. */
  async recarregarAgentes(forcar = false): Promise<void> {
    if (!forcar && Date.now() - this.agentesLidosEm < CACHE_AGENTES_MS) return
    if (this.verificandoAgentes !== undefined) return this.verificandoAgentes
    if (forcar) {
      limparCacheBinarios()
      limparCacheAgy()
    }
    this.verificandoAgentes = (async () => {
      await Promise.all(IDS_AGENTES.map(id => this.verificarAgente(id)))
      this.agentesLidosEm = Date.now()
      this.enviarEstado()
    })().finally(() => {
      this.verificandoAgentes = undefined
    })
    return this.verificandoAgentes
  }

  private async verificarAgente(id: AgenteId): Promise<void> {
    const agente = AGENTES[id]
    const ctx = this.contextoAgente(id)
    const info = this.agentes[id]
    try {
      const deteccao = await agente.detectar(ctx)
      info.instalado = deteccao.instalado
      info.versao = deteccao.versao
      info.binario = deteccao.binario
      if (!deteccao.instalado || deteccao.binario === undefined) {
        info.auth = { estado: 'ausente' }
        info.modelos = id === 'claude' ? await agente.modelos(ctx, '') : []
        return
      }
      const [auth, modelos, chave] = await Promise.all([
        agente.auth(ctx, deteccao.binario).catch((): EstadoAuth => ({ estado: 'desconectado' })),
        agente.modelos(ctx, deteccao.binario).catch(() => []),
        this.chave(id),
      ])
      info.auth = chave !== undefined ? { estado: 'conectado', metodo: 'chave', detalhe: 'Chave da API' } : auth
      info.modelos = modelos
    } catch {
      info.auth = { estado: 'desconectado' }
    }
  }

  private async chave(id: AgenteId): Promise<string | undefined> {
    if (!AGENTES[id].aceitaChave) return undefined
    try {
      const valor = await this.contexto.secrets.get(`mazyos.chave.${id}`)
      return valor !== undefined && valor !== '' ? valor : undefined
    } catch {
      return undefined
    }
  }

  // -------------------------------------------------------------------------
  // Mensagens das webviews

  async tratar(mensagem: ParaExtensao): Promise<void> {
    try {
      await this.tratarSemProteger(mensagem)
    } catch (erro) {
      this.erro(mensagemDeErro(erro))
    }
  }

  private async tratarSemProteger(m: ParaExtensao): Promise<void> {
    switch (m.tipo) {
      case 'pronto':
        this.postar({ tipo: 'estado', estado: this.estado() })
        void this.recarregarAgentes()
        return
      case 'recarregar':
        await Promise.all([this.recarregarWorkspace(), this.recarregarAgentes(true)])
        return
      case 'instalar':
        await this.conversar('instalar')
        return
      case 'rodar':
        await this.rodar(m.pedido, m.skill)
        return
      case 'conversar':
        await this.conversar(m.skill)
        return
      case 'continuar':
        await this.continuar(m.id, m.pedido)
        return
      case 'cancelar':
        this.execucoes.cancelar(m.id)
        return
      case 'abrirConsole':
        this.destinos?.console.mostrar(m.id ?? this.execucoes.lista()[0]?.id, false)
        return
      case 'abrirArquivo':
        await this.abrirArquivo(m.caminho)
        return
      case 'abrirPasta':
        await this.abrirPasta(m.caminho)
        return
      case 'abrirPastaDoNegocio':
        await vscode.commands.executeCommand('workbench.action.files.openFolder')
        return
      case 'escolherAgente':
        await this.gravarConfig('agente', m.agente)
        this.enviarEstado()
        return
      case 'escolherModelo':
        await this.escolherModelo(m.agente, m.modelo)
        return
      case 'entrar':
        await this.entrar(m.agente)
        return
      case 'sair':
        await this.sair(m.agente)
        return
      case 'definirChave':
        await this.definirChave(m.agente)
        return
      case 'removerChave':
        await this.removerChave(m.agente)
        return
      case 'instalarAgente':
        await this.instalarAgente(m.agente)
        return
      case 'copiar':
        await vscode.env.clipboard.writeText(m.texto)
        this.avisar('Copiado.', 'ok')
        return
      case 'salvarSaida': {
        const raiz = this.exigirRaiz()
        if (raiz === undefined) return
        const salvo = await this.execucoes.salvarSaida(m.id, raiz)
        this.avisar(`Salvo em ${salvo}.`, 'ok')
        return
      }
      case 'configurar':
        await this.configurar(m.chave, m.valor)
        return
      case 'abrirExterno':
        if (/^(https?:|mailto:)/i.test(m.url)) await vscode.env.openExternal(vscode.Uri.parse(m.url))
        return
      default:
        return
    }
  }

  // -------------------------------------------------------------------------
  // Configuração

  private async gravarConfig(chave: string, valor: unknown): Promise<void> {
    const c = vscode.workspace.getConfiguration('mazyos')
    const inspecao = c.inspect(chave)
    const alvo =
      inspecao?.workspaceValue !== undefined ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global
    await c.update(chave, valor, alvo)
  }

  async escolherModelo(agente: AgenteId, modelo: string | null): Promise<void> {
    const c = vscode.workspace.getConfiguration('mazyos')
    const inspecao = c.inspect<Record<string, string>>('modelos')
    const atual = {
      ...((inspecao?.workspaceValue !== undefined ? inspecao.workspaceValue : inspecao?.globalValue) ?? {}),
    }
    if (modelo === null || modelo === '') delete atual[agente]
    else atual[agente] = modelo
    await this.gravarConfig('modelos', atual)
    this.enviarEstado()
  }

  private async configurar(chave: keyof Config, valor: unknown): Promise<void> {
    if (chave === 'agente' && typeof valor === 'string' && (IDS_AGENTES as readonly string[]).includes(valor)) {
      await this.gravarConfig('agente', valor)
    } else if (chave === 'permissoes' && (valor === 'edicoes' || valor === 'tudo')) {
      await this.gravarConfig('permissoes', valor)
    } else if (chave === 'abrirConsoleAoRodar' && typeof valor === 'boolean') {
      await this.gravarConfig('abrirConsoleAoRodar', valor)
    } else {
      throw new Error('Configuração desconhecida.')
    }
    this.enviarEstado()
  }

  // -------------------------------------------------------------------------
  // Rodar

  private exigirRaiz(): string | undefined {
    const raiz = this.raiz
    if (raiz === null) this.erro('Abra a pasta do seu negócio no editor antes (Arquivo > Abrir pasta).')
    return raiz ?? undefined
  }

  /** O agente das configurações, já verificado; avisa e devolve undefined se não dá pra rodar. */
  private async agentePronto(id: AgenteId = this.config().agente): Promise<{ agente: Agente; binario: string } | undefined> {
    let info = this.agentes[id]
    if (info.auth.estado === 'verificando' || info.binario === undefined) {
      await this.verificarAgente(id)
      info = this.agentes[id]
    }
    if (!info.instalado || info.binario === undefined) {
      const instalar = 'Instalar'
      const escolha = await vscode.window.showWarningMessage(
        `MazyOS: o ${info.nome} não está instalado neste computador.`,
        instalar,
      )
      this.avisar(`O ${info.nome} não está instalado.`, 'erro')
      if (escolha === instalar) await this.instalarAgente(id)
      return undefined
    }
    return { agente: AGENTES[id], binario: info.binario }
  }

  private async requisicao(
    id: AgenteId,
    binario: string,
    prompt: string,
    cwd: string,
    sessao?: string,
    modelo?: string | null,
  ): Promise<RequisicaoExecucao> {
    return {
      binario,
      prompt,
      cwd,
      modelo: modelo === undefined ? this.modeloDe(id) : modelo,
      permissoes: this.config().permissoes,
      sessao,
      chave: await this.chave(id),
    }
  }

  private async preparo(
    agente: Agente,
    req: RequisicaoExecucao,
  ): Promise<Preparo> {
    const modelosCodex = agente.id === 'codex' ? (await lerModelosCodex(os.homedir())).map(m => m.id) : undefined
    return {
      spec: agente.comandoExecucao(req),
      parser: agente.criarParser({ raiz: req.cwd, modelosDisponiveis: modelosCodex }),
      cwd: req.cwd,
      env: process.env,
    }
  }

  /** Roda um pedido (com ou sem skill). Skill de modo `conversa` abre o terminal. */
  async rodar(pedido: string, skillPedida?: string): Promise<Execucao | undefined> {
    const raiz = this.exigirRaiz()
    if (raiz === undefined) return undefined
    const skill = skillPedida !== undefined && skillPedida.trim() !== '' ? skillPedida.trim() : undefined
    const meta = skill !== undefined ? this.skills.find(s => s.nome === skill) : undefined
    if (skill !== undefined && meta === undefined) throw new Error(`A skill "${skill}" não existe.`)
    if (meta?.modo === 'conversa') {
      await this.conversar(meta.nome, pedido)
      return undefined
    }
    if (pedido.trim() === '' && skill === undefined) {
      this.avisar('Escreva o que você precisa antes de pedir.', 'info')
      return undefined
    }
    const id = this.config().agente
    const pronto = await this.agentePronto(id)
    if (pronto === undefined) return undefined

    const execucao = this.execucoes.iniciar(
      { agente: id, modelo: this.modeloDe(id) ?? undefined, skill: meta?.nome, pedido },
      async () => {
        const { prompt } = await prepararPedido({
          raiz,
          raizPlugin: this.raizPlugin,
          skills: this.skills,
          skill: meta?.nome,
          pedido,
          modo: 'tarefa',
        })
        return this.preparo(pronto.agente, await this.requisicao(id, pronto.binario, prompt, raiz))
      },
    )
    if (this.config().abrirConsoleAoRodar) this.destinos?.console.mostrar(execucao.id)
    return execucao
  }

  /** Continua uma execução: retoma a sessão do CLI quando dá; senão, manda o contexto junto. */
  async continuar(id: string, pedido: string): Promise<void> {
    const raiz = this.exigirRaiz()
    if (raiz === undefined) return
    const anterior = this.execucoes.buscar(id)
    if (anterior === undefined) throw new Error('Essa execução não está mais no histórico.')
    if (pedido.trim() === '') return
    const pronto = await this.agentePronto(anterior.agente)
    if (pronto === undefined) return
    const retoma = pronto.agente.retomaSessao && anterior.sessao !== undefined

    const execucao = this.execucoes.iniciar(
      {
        agente: anterior.agente,
        modelo: this.modeloDe(anterior.agente) ?? undefined,
        skill: anterior.skill,
        pedido,
        sessao: retoma ? anterior.sessao : undefined,
      },
      async () => {
        let prompt = pedido
        if (!retoma) {
          const base = await prepararPedido({
            raiz,
            raizPlugin: this.raizPlugin,
            skills: this.skills,
            skill: anterior.skill,
            pedido: [
              'Continuação de uma conversa anterior.',
              '',
              `Pedido anterior: ${anterior.pedido}`,
              '',
              `Sua resposta anterior:\n${anterior.resposta ?? '(sem resposta)'}`,
              '',
              `Agora o usuário diz: ${pedido}`,
            ].join('\n'),
            modo: 'tarefa',
          })
          prompt = base.prompt
        }
        const modelo = this.modeloDe(anterior.agente)
        const req = await this.requisicao(
          anterior.agente,
          pronto.binario,
          prompt,
          raiz,
          retoma ? anterior.sessao : undefined,
          modelo,
        )
        return this.preparo(pronto.agente, req)
      },
    )
    if (this.config().abrirConsoleAoRodar) this.destinos?.console.mostrar(execucao.id)
  }

  /** Abre o CLI interativo num terminal com a skill carregada (skills que entrevistam). */
  async conversar(skill: string, pedido = ''): Promise<void> {
    const raiz = this.exigirRaiz()
    if (raiz === undefined) return
    const id = this.config().agente
    const pronto = await this.agentePronto(id)
    if (pronto === undefined) return
    const { prompt } = await prepararPedido({
      raiz,
      raizPlugin: this.raizPlugin,
      skills: this.skills,
      skill,
      pedido,
      modo: 'conversa',
    })
    const arquivo = await this.gravarPromptTemporario(prompt)
    const req = await this.requisicao(id, pronto.binario, prompt, raiz)
    const linha = pronto.agente.comandoInterativo(req, arquivo, shellDoTerminal())
    const meta = this.skills.find(s => s.nome === skill)
    this.abrirTerminal(
      `MazyOS · ${meta?.rotulo ?? skill}`,
      linha,
      raiz,
      req.chave !== undefined && pronto.agente.variavelChave !== null
        ? { [pronto.agente.variavelChave]: req.chave }
        : undefined,
      () => void this.recarregarWorkspace(),
    )
    this.avisar(`A skill ${meta?.rotulo ?? skill} abriu no terminal com o ${MARCAS[id].nome}.`, 'info')
  }

  private async gravarPromptTemporario(prompt: string): Promise<string> {
    const pasta = path.join(this.contexto.globalStorageUri.fsPath, 'pedidos')
    await mkdir(pasta, { recursive: true })
    // Limpa os pedidos de mais de um dia.
    try {
      const agora = Date.now()
      for (const nome of await readdir(pasta)) {
        const caminho = path.join(pasta, nome)
        const s = await stat(caminho)
        if (agora - s.mtimeMs > 24 * 60 * 60 * 1000) await rm(caminho, { force: true })
      }
    } catch {
      // limpeza é opcional
    }
    const arquivo = path.join(pasta, `pedido-${Date.now()}.md`)
    await writeFile(arquivo, prompt, 'utf8')
    return arquivo
  }

  private abrirTerminal(
    nome: string,
    linha: string,
    cwd: string | undefined,
    env?: Record<string, string>,
    aoFechar?: () => void,
  ): vscode.Terminal {
    const terminal = vscode.window.createTerminal({ name: nome, cwd, env })
    if (aoFechar !== undefined) this.terminais.set(terminal, aoFechar)
    terminal.show()
    terminal.sendText(linha, true)
    return terminal
  }

  // -------------------------------------------------------------------------
  // Arquivos

  private resolver(caminho: string): string | undefined {
    if (path.isAbsolute(caminho)) return caminho
    const raiz = this.raiz
    return raiz === null ? undefined : path.join(raiz, caminho)
  }

  async abrirArquivo(caminho: string): Promise<void> {
    const alvo = this.resolver(caminho)
    if (alvo === undefined) {
      this.erro('Abra uma pasta no editor antes.')
      return
    }
    const s = await stat(alvo).catch(() => undefined)
    if (s === undefined) {
      this.erro(`${caminho} não existe.`)
      return
    }
    const uri = vscode.Uri.file(alvo)
    if (s.isDirectory()) {
      await vscode.commands.executeCommand('revealInExplorer', uri)
      return
    }
    await vscode.commands.executeCommand('vscode.open', uri, { preview: false })
  }

  async abrirPasta(caminho: string): Promise<void> {
    const alvo = this.resolver(caminho)
    if (alvo === undefined) {
      this.erro('Abra uma pasta no editor antes.')
      return
    }
    const s = await stat(alvo).catch(() => undefined)
    if (s === undefined) {
      this.avisar(`A pasta ${caminho} ainda não existe.`, 'info')
      return
    }
    await vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(alvo))
  }

  async abrirMemoria(): Promise<void> {
    const raiz = this.exigirRaiz()
    if (raiz === undefined) return
    if (!this.workspace.instalado) {
      const ligar = 'Ligar o MazyOS aqui'
      const escolha = await vscode.window.showInformationMessage(
        'MazyOS: esta pasta ainda não tem a memória do negócio (_memoria/).',
        ligar,
      )
      if (escolha === ligar) await this.conversar('instalar')
      return
    }
    const existentes = this.workspace.arquivos.filter(a => a.existe)
    for (const arquivo of existentes) {
      const documento = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(raiz, arquivo.caminho)))
      await vscode.window.showTextDocument(documento, { preview: false, preserveFocus: true })
    }
    if (existentes.length === 0) this.avisar('Nenhum arquivo de memória encontrado.', 'info')
  }

  // -------------------------------------------------------------------------
  // Contas

  async entrar(id: AgenteId): Promise<void> {
    const pronto = await this.agentePronto(id)
    if (pronto === undefined) return
    const shell = shellDoTerminal()
    const linha = pronto.agente.comandoLogin(pronto.binario, shell)
    this.abrirTerminal(`MazyOS · entrar no ${MARCAS[id].nome}`, linha, this.raiz ?? undefined, undefined, () =>
      void this.recarregarAgentes(true),
    )
    if (id === 'antigravity') {
      void vscode.window.showInformationMessage(
        'MazyOS: o Antigravity abre o login da conta Google no navegador quando o agy começa. Depois de entrar, feche o agy (/quit) e o MazyOS confere a conta.',
      )
    } else {
      this.avisar(`Siga o login do ${MARCAS[id].nome} no terminal. Quando terminar, feche o terminal.`, 'info')
    }
  }

  async sair(id: AgenteId): Promise<void> {
    const pronto = await this.agentePronto(id)
    if (pronto === undefined) return
    const spec = pronto.agente.comandoLogout(pronto.binario)
    if (spec === null) {
      void vscode.window.showInformationMessage(
        'MazyOS: no Antigravity, a saída da conta é pelo comando /logout dentro do agy.',
      )
      this.abrirTerminal('MazyOS · Antigravity', pronto.agente.comandoLogin(pronto.binario, shellDoTerminal()), this.raiz ?? undefined, undefined, () =>
        void this.recarregarAgentes(true),
      )
      return
    }
    const r = await rodarCurto(spec, 15_000)
    await this.recarregarAgentes(true)
    if (r.codigo === 0) this.avisar(`Você saiu da conta do ${MARCAS[id].nome}.`, 'ok')
    else this.erro(`Não deu pra sair da conta do ${MARCAS[id].nome}.`)
  }

  async definirChave(id: AgenteId): Promise<void> {
    const agente = AGENTES[id]
    if (!agente.aceitaChave) {
      void vscode.window.showInformationMessage(
        'MazyOS: o Antigravity usa o login da conta Google e não aceita chave de API.',
      )
      return
    }
    const fabricante = id === 'claude' ? 'da Anthropic (começa com sk-ant-)' : 'da OpenAI (começa com sk-)'
    const chave = await vscode.window.showInputBox({
      title: `Chave de API pro ${agente.nome}`,
      prompt: `Cole a chave da API ${fabricante}. Ela fica no cofre do editor e só entra no processo do ${agente.nome}.`,
      password: true,
      ignoreFocusOut: true,
      validateInput: valor => (valor.trim() === '' ? 'A chave não pode ficar vazia.' : undefined),
    })
    if (chave === undefined) return
    await this.contexto.secrets.store(`mazyos.chave.${id}`, chave.trim())
    await this.verificarAgente(id)
    this.enviarEstado()
    this.avisar(`Chave do ${agente.nome} guardada no cofre do editor.`, 'ok')
  }

  async removerChave(id: AgenteId): Promise<void> {
    await this.contexto.secrets.delete(`mazyos.chave.${id}`)
    await this.verificarAgente(id)
    this.enviarEstado()
    this.avisar(`Chave do ${AGENTES[id].nome} removida.`, 'ok')
  }

  async instalarAgente(id: AgenteId): Promise<void> {
    const agente = AGENTES[id]
    if (/^https?:/i.test(agente.comandoInstalar)) {
      await vscode.env.openExternal(vscode.Uri.parse(agente.comandoInstalar))
      this.avisar(`Baixe o ${agente.nome} pelo instalador oficial e depois clique em Recarregar.`, 'info')
      return
    }
    this.abrirTerminal(`MazyOS · instalar o ${agente.nome}`, agente.comandoInstalar, this.raiz ?? undefined, undefined, () =>
      void this.recarregarAgentes(true),
    )
  }

  dispose(): void {
    for (const d of this.descartaveis) d.dispose()
  }
}
