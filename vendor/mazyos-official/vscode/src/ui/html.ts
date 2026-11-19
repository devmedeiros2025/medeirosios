// O HTML das duas webviews (painel e console): CSP com nonce, os dados iniciais em
// `window.mazyos` e o bundle de `dist/`.
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import path from 'node:path'

import * as vscode from 'vscode'

import type { DadosIniciais } from '../shared/protocolo'

export function opcoesWebview(extensionUri: vscode.Uri): vscode.WebviewOptions {
  return {
    enableScripts: true,
    localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist'), vscode.Uri.joinPath(extensionUri, 'media')],
  }
}

function nonce(): string {
  return randomBytes(18).toString('base64').replace(/[^A-Za-z0-9]/g, '')
}

/** JSON seguro pra dentro de um `<script>`. */
function jsonNoScript(valor: unknown): string {
  return JSON.stringify(valor)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

export function montarHtml(webview: vscode.Webview, extensionUri: vscode.Uri, dados: DadosIniciais): string {
  const n = nonce()
  const fonte = webview.cspSource
  const script = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview.js'))
  const temCss = existsSync(path.join(extensionUri.fsPath, 'dist', 'webview.css'))
  const css = temCss ? webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview.css')) : undefined
  const csp = [
    "default-src 'none'",
    `style-src ${fonte} 'unsafe-inline'`,
    `script-src 'nonce-${n}'`,
    `font-src ${fonte}`,
    `img-src ${fonte} data: https:`,
  ].join('; ')
  const titulo = dados.view === 'console' ? 'Console do Mazy' : 'MazyOS'

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${titulo}</title>
${css !== undefined ? `<link rel="stylesheet" href="${css.toString()}">` : ''}
</head>
<body>
<div id="raiz"></div>
<script nonce="${n}">window.mazyos = ${jsonNoScript(dados)};</script>
<script nonce="${n}" src="${script.toString()}"></script>
</body>
</html>`
}
