// O console do Mazy: um `WebviewPanel` único, aberto ao lado do editor e reaproveitado.
import * as vscode from 'vscode'

import type { ParaExtensao, ParaWebview } from '../shared/protocolo'
import { montarHtml, opcoesWebview } from './html'

export class ConsoleMazy implements vscode.Disposable {
  private painel: vscode.WebviewPanel | undefined
  private execucaoId: string | undefined

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly aoReceber: (mensagem: ParaExtensao) => void,
  ) {}

  get aberto(): boolean {
    return this.painel !== undefined
  }

  /**
   * Abre (ou traz pra frente) o console na execução `id`. Se ele já estava aberto em
   * outra execução, recarrega a página com o novo `execucaoId`: a interface pede o
   * estado de novo com `pronto` e recebe tudo, eventos inclusive.
   */
  mostrar(id?: string, preservarFoco = true): void {
    if (this.painel === undefined) {
      this.execucaoId = id
      const painel = vscode.window.createWebviewPanel(
        'mazyos.console',
        'Console do Mazy',
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: preservarFoco },
        { ...opcoesWebview(this.extensionUri), retainContextWhenHidden: true },
      )
      painel.iconPath = vscode.Uri.joinPath(this.extensionUri, 'media', 'mazyos.svg')
      painel.webview.html = montarHtml(painel.webview, this.extensionUri, { view: 'console', execucaoId: id })
      painel.webview.onDidReceiveMessage((mensagem: ParaExtensao) => this.aoReceber(mensagem))
      painel.onDidDispose(() => {
        if (this.painel === painel) {
          this.painel = undefined
          this.execucaoId = undefined
        }
      })
      this.painel = painel
      return
    }
    if (id !== undefined && id !== this.execucaoId) {
      this.execucaoId = id
      this.painel.webview.html = montarHtml(this.painel.webview, this.extensionUri, { view: 'console', execucaoId: id })
    }
    this.painel.reveal(this.painel.viewColumn ?? vscode.ViewColumn.Beside, preservarFoco)
  }

  postar(mensagem: ParaWebview): void {
    void this.painel?.webview.postMessage(mensagem).then(undefined, () => undefined)
  }

  dispose(): void {
    this.painel?.dispose()
  }
}
