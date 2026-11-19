// O painel da barra lateral (view `mazyos.painel`).
import * as vscode from 'vscode'

import type { ParaExtensao, ParaWebview } from '../shared/protocolo'
import { montarHtml, opcoesWebview } from './html'

export class Painel implements vscode.WebviewViewProvider, vscode.Disposable {
  static readonly id = 'mazyos.painel'
  private view: vscode.WebviewView | undefined
  private readonly descartaveis: vscode.Disposable[] = []

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly aoReceber: (mensagem: ParaExtensao) => void,
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view
    view.webview.options = opcoesWebview(this.extensionUri)
    view.webview.html = montarHtml(view.webview, this.extensionUri, { view: 'painel' })
    this.descartaveis.push(
      view.webview.onDidReceiveMessage((mensagem: ParaExtensao) => this.aoReceber(mensagem)),
      view.onDidDispose(() => {
        if (this.view === view) this.view = undefined
      }),
    )
  }

  get visivel(): boolean {
    return this.view?.visible === true
  }

  postar(mensagem: ParaWebview): void {
    void this.view?.webview.postMessage(mensagem).then(undefined, () => undefined)
  }

  dispose(): void {
    for (const d of this.descartaveis) d.dispose()
  }
}
