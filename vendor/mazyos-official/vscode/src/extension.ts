// Ponto de entrada da extensão: registra o painel, o console, os comandos, a barra
// de status e os watchers, e liga tudo ao `Host`.
import * as vscode from 'vscode'

import { AGENTES, IDS_AGENTES } from './agentes'
import { matarTodos } from './agentes/processo'
import { ExecucaoManager } from './execucoes'
import { Host } from './host'
import type { AgenteId, AgenteInfo, ParaExtensao } from './shared/protocolo'
import { GRUPOS, MARCAS } from './shared/protocolo'
import { ConsoleMazy } from './ui/console'
import { Painel } from './ui/painel'
import { BarraDeStatus } from './ui/status'

const MARCA_PAINEL = 'mazyos.painelMostrado'

let hostAtivo: Host | undefined

function mensagemDeErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

/** Embrulha um comando: erro vira notificação curta, nunca derruba a extensão. */
function seguro<A extends unknown[]>(fn: (...args: A) => unknown): (...args: A) => Promise<void> {
  return async (...args: A) => {
    try {
      await fn(...args)
    } catch (erro) {
      void vscode.window.showErrorMessage(`MazyOS: ${mensagemDeErro(erro)}`)
    }
  }
}

function descreverConta(info: AgenteInfo): string {
  switch (info.auth.estado) {
    case 'ausente':
      return 'não instalado'
    case 'verificando':
      return 'verificando a conta…'
    case 'desconectado':
      return 'sem conta conectada'
    case 'conectado': {
      const partes = [info.auth.metodo === 'chave' ? 'chave de API' : 'conectado']
      if (info.auth.conta) partes.push(info.auth.conta)
      if (info.auth.detalhe && info.auth.metodo !== 'chave') partes.push(info.auth.detalhe)
      return partes.join(' · ')
    }
  }
}

async function escolherAgenteNaLista(host: Host, titulo: string, filtro?: (id: AgenteId) => boolean): Promise<AgenteId | undefined> {
  const atual = host.config().agente
  const ids = IDS_AGENTES.filter(id => filtro === undefined || filtro(id))
  const itens = ids.map(id => {
    const info = host.agenteInfo(id)
    return {
      label: `${id === atual ? '$(check) ' : ''}${MARCAS[id].marca}`,
      description: info.nome,
      detail: `${descreverConta(info)} — ${info.descricao}`,
      id,
    }
  })
  const escolha = await vscode.window.showQuickPick(itens, { title: titulo, placeHolder: 'Escolha o agente' })
  return escolha?.id
}

export function activate(contexto: vscode.ExtensionContext): void {
  const execucoes = new ExecucaoManager(contexto.workspaceState)
  const host = new Host(contexto, execucoes)
  hostAtivo = host

  const receber = (mensagem: ParaExtensao) => void host.tratar(mensagem)
  const painel = new Painel(contexto.extensionUri, receber)
  const consoleMazy = new ConsoleMazy(contexto.extensionUri, receber)
  host.ligar({ painel, console: consoleMazy })

  const barra = new BarraDeStatus()
  const atualizarBarra = () => {
    const comDetalhes = vscode.workspace.getConfiguration('mazyos').get<boolean>('linhaDeStatus', true)
    barra.atualizar(host.ws, execucoes.emAndamento(), host.listaSkills, comDetalhes)
  }

  contexto.subscriptions.push(
    execucoes,
    host,
    painel,
    consoleMazy,
    barra,
    host.onMudou(atualizarBarra),
    vscode.window.registerWebviewViewProvider(Painel.id, painel, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  )

  // --- Watchers da memória ---------------------------------------------------
  let vigias: vscode.Disposable[] = []
  let espera: NodeJS.Timeout | undefined
  const reler = () => {
    if (espera !== undefined) clearTimeout(espera)
    espera = setTimeout(() => void host.recarregarWorkspace(), 300)
  }
  const montarVigias = () => {
    for (const v of vigias) v.dispose()
    vigias = []
    const pasta = vscode.workspace.workspaceFolders?.[0]
    if (pasta === undefined) return
    for (const padrao of ['_memoria/**/*.md', 'identidade/design-guide.md', 'CLAUDE.md', '_memoria']) {
      const vigia = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(pasta, padrao))
      vigia.onDidCreate(reler)
      vigia.onDidChange(reler)
      vigia.onDidDelete(reler)
      vigias.push(vigia)
    }
  }
  montarVigias()
  contexto.subscriptions.push(
    new vscode.Disposable(() => {
      for (const v of vigias) v.dispose()
      if (espera !== undefined) clearTimeout(espera)
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      montarVigias()
      void host.recarregarWorkspace()
    }),
    vscode.workspace.onDidChangeConfiguration(e => {
      if (!e.affectsConfiguration('mazyos')) return
      if (e.affectsConfiguration('mazyos.caminhos')) void host.recarregarAgentes(true)
      host.enviarEstado()
    }),
  )

  // --- Comandos ---------------------------------------------------------------
  const registrar = (id: string, fn: (...args: unknown[]) => unknown) =>
    contexto.subscriptions.push(vscode.commands.registerCommand(id, seguro(fn)))

  registrar('mazyos.abrirPainel', () => vscode.commands.executeCommand(`${Painel.id}.focus`))

  registrar('mazyos.pedir', async () => {
    if (painel.visivel) {
      await vscode.commands.executeCommand(`${Painel.id}.focus`)
      painel.postar({ tipo: 'foco', alvo: 'pedido' })
      return
    }
    const pedido = await vscode.window.showInputBox({
      title: 'Pedir algo ao Mazy',
      prompt: `Vai rodar com o ${MARCAS[host.config().agente].nome}, usando a memória do negócio.`,
      placeHolder: 'ex.: um post pro Instagram sobre a promoção desta semana',
      ignoreFocusOut: true,
    })
    if (pedido === undefined || pedido.trim() === '') return
    await host.rodar(pedido)
  })

  registrar('mazyos.rodarSkill', async () => {
    const skills = host.listaSkills
    if (skills.length === 0) {
      void vscode.window.showWarningMessage('MazyOS: nenhuma skill encontrada no MazyOS embutido.')
      return
    }
    type Item = vscode.QuickPickItem & { nome?: string }
    const itens: Item[] = []
    let grupo: string | undefined
    for (const skill of skills) {
      if (skill.grupo !== grupo) {
        grupo = skill.grupo
        itens.push({ label: GRUPOS[skill.grupo], kind: vscode.QuickPickItemKind.Separator })
      }
      itens.push({
        label: skill.rotulo,
        description: skill.modo === 'conversa' ? 'abre no terminal' : undefined,
        detail: skill.descricao,
        nome: skill.nome,
      })
    }
    const escolha = await vscode.window.showQuickPick(itens, {
      title: 'Rodar uma skill do MazyOS',
      placeHolder: 'Qual skill?',
      matchOnDetail: true,
    })
    const skill = skills.find(s => s.nome === escolha?.nome)
    if (skill === undefined) return
    if (skill.modo === 'conversa') {
      await host.conversar(skill.nome)
      return
    }
    const pedido = await vscode.window.showInputBox({
      title: skill.rotulo,
      prompt: 'O que você quer? Pode deixar em branco pra skill perguntar.',
      placeHolder: skill.exemplo,
      ignoreFocusOut: true,
    })
    if (pedido === undefined) return
    await host.rodar(pedido, skill.nome)
  })

  registrar('mazyos.instalar', () => host.conversar('instalar'))

  registrar('mazyos.recarregar', async () => {
    await Promise.all([host.recarregarWorkspace(), host.recarregarAgentes(true)])
    host.avisar('Memória e agentes recarregados.', 'ok')
  })

  registrar('mazyos.abrirMemoria', () => host.abrirMemoria())

  registrar('mazyos.escolherAgente', async () => {
    const id = await escolherAgenteNaLista(host, 'Qual agente roda as skills do MazyOS?')
    if (id === undefined) return
    await host.tratar({ tipo: 'escolherAgente', agente: id })
    const info = host.agenteInfo(id)
    if (info.auth.estado === 'ausente') {
      const instalar = 'Instalar'
      if ((await vscode.window.showWarningMessage(`MazyOS: o ${info.nome} não está instalado.`, instalar)) === instalar) {
        await host.instalarAgente(id)
      }
    } else if (info.auth.estado === 'desconectado') {
      const entrar = 'Entrar'
      if ((await vscode.window.showInformationMessage(`MazyOS: o ${info.nome} ainda não tem conta conectada.`, entrar)) === entrar) {
        await host.entrar(id)
      }
    }
  })

  registrar('mazyos.entrar', async () => {
    const id = await escolherAgenteNaLista(host, 'Entrar na conta de qual agente?')
    if (id !== undefined) await host.entrar(id)
  })

  registrar('mazyos.definirChave', async () => {
    const atual = host.config().agente
    const id = AGENTES[atual].aceitaChave
      ? atual
      : await escolherAgenteNaLista(host, 'Guardar a chave de API de qual agente?', i => AGENTES[i].aceitaChave)
    if (id !== undefined) await host.definirChave(id)
  })

  registrar('mazyos.abrirConsole', () => consoleMazy.mostrar(execucoes.lista()[0]?.id, false))

  registrar('mazyos.cancelar', () => {
    const rodando = execucoes.emAndamento()
    if (rodando === undefined) {
      void vscode.window.showInformationMessage('MazyOS: nenhuma execução em andamento.')
      return
    }
    execucoes.cancelar(rodando.id)
  })

  // --- Primeira leitura -------------------------------------------------------
  atualizarBarra()
  void (async () => {
    try {
      await host.recarregarWorkspace()
      atualizarBarra()
      // Como o plugin no session.start: na primeira ativação numa pasta com
      // `_memoria/`, abre o painel sozinho. Depois disso, não força mais nada.
      if (host.ws.instalado && contexto.workspaceState.get<boolean>(MARCA_PAINEL) !== true) {
        await contexto.workspaceState.update(MARCA_PAINEL, true)
        await vscode.commands.executeCommand(`${Painel.id}.focus`)
      }
    } catch {
      // a leitura falhar não pode impedir o resto
    }
    await host.recarregarAgentes(true).catch(() => undefined)
  })()
}

export function deactivate(): void {
  try {
    hostAtivo?.execucoes.cancelarTodas()
  } finally {
    matarTodos()
    hostAtivo = undefined
  }
}
