// Montagem de linhas de comando pro terminal integrado (`terminal.sendText`). Sem `vscode`.
import type { Shell } from './tipos'

/** Um valor entre aspas pro shell. */
export function aspas(valor: string, shell: Shell): string {
  if (shell === 'cmd') return `"${valor.replace(/"/g, '""')}"`
  // posix e PowerShell: aspas simples; a simples interna se escreve diferente em cada um.
  if (shell === 'powershell') return `'${valor.replace(/'/g, "''")}'`
  return `'${valor.replace(/'/g, `'\\''`)}'`
}

/** Chamar um binário pelo caminho completo (assim nenhum alias do usuário entra no meio). */
export function invocar(binario: string, shell: Shell): string {
  return shell === 'powershell' ? `& ${aspas(binario, shell)}` : aspas(binario, shell)
}

/**
 * O prompt lido do arquivo, como argumento: `"$(cat '…')"` no zsh/bash,
 * `(Get-Content -Raw '…')` no PowerShell. O `cmd` não tem como: vai uma instrução
 * curta pedindo pro agente ler o arquivo.
 */
export function promptDoArquivo(arquivo: string, shell: Shell): string {
  if (shell === 'posix') return `"$(cat ${aspas(arquivo, shell)})"`
  if (shell === 'powershell') return `(Get-Content -Raw ${aspas(arquivo, shell)})`
  return aspas(`Leia o arquivo ${arquivo} e siga as instruções dele.`, shell)
}

/** Linha completa: binário + argumentos já tratados (cada um com aspas quando precisa). */
export function linhaDeComando(binario: string, args: readonly string[], shell: Shell, final?: string): string {
  const partes = [invocar(binario, shell), ...args.map(a => (/^[A-Za-z0-9_\-=./:]+$/.test(a) ? a : aspas(a, shell)))]
  if (final !== undefined) partes.push(final)
  return partes.join(' ')
}
