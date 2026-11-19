// A barra de status do MazyOS (à esquerda).
import * as vscode from 'vscode'

import type { Execucao, Skill, Workspace } from '../shared/protocolo'

function curto(texto: string, maximo: number): string {
  return texto.length > maximo ? `${texto.slice(0, maximo - 1).trimEnd()}…` : texto
}

export class BarraDeStatus implements vscode.Disposable {
  private readonly item = vscode.window.createStatusBarItem('mazyos.status', vscode.StatusBarAlignment.Left, 100)

  constructor() {
    this.item.name = 'MazyOS'
    this.item.text = '$(rocket) MazyOS'
    this.item.command = 'mazyos.abrirPainel'
    this.item.show()
  }

  atualizar(ws: Workspace, rodando: Execucao | undefined, skills: readonly Skill[], comDetalhes: boolean): void {
    if (rodando !== undefined) {
      const skill = skills.find(s => s.nome === rodando.skill)
      this.item.text = `$(sync~spin) Mazy · ${curto(skill?.rotulo ?? rodando.skill ?? 'pedido', 30)}`
      this.item.tooltip = `O Mazy está trabalhando: ${curto(rodando.pedido || (skill?.rotulo ?? ''), 120)}\nClique pra abrir o console.`
      this.item.command = 'mazyos.abrirConsole'
      return
    }
    this.item.command = 'mazyos.abrirPainel'
    if (!ws.instalado || !comDetalhes) {
      this.item.text = '$(rocket) MazyOS'
      this.item.tooltip = ws.instalado
        ? 'Abrir o painel do MazyOS'
        : ws.raiz === null
          ? 'MazyOS: abra a pasta do seu negócio'
          : 'MazyOS: esta pasta ainda não tem a memória do negócio. Clique pra abrir o painel.'
      return
    }
    const partes = ['$(rocket) MazyOS', curto(ws.nome ?? 'negócio sem nome', 30)]
    if (ws.foco !== null) partes.push(`foco: ${curto(ws.foco, 40)}`)
    this.item.text = partes.join(' · ')
    const memoria = ws.arquivos.map(a => `${a.preenchido ? '●' : '○'} ${a.rotulo}`).join('\n')
    this.item.tooltip = `${ws.nome ?? 'MazyOS'}${ws.negocio ? `\n${ws.negocio}` : ''}\n\n${memoria}\n\nClique pra abrir o painel.`
  }

  dispose(): void {
    this.item.dispose()
  }
}
