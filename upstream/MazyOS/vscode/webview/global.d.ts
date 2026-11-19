// Tipos do ambiente da webview: o que o host injeta antes do bundle.
import type { DadosIniciais } from '../src/shared/protocolo'

/** A API que o VS Code expõe dentro da webview. Só pode ser obtida uma vez. */
export interface VsCodeApi {
  postMessage(mensagem: unknown): void
  getState(): unknown
  setState(estado: unknown): void
}

declare global {
  interface Window {
    mazyos?: DadosIniciais
  }
  // Existe dentro do editor; no navegador (dev.html) é `undefined`.
  var acquireVsCodeApi: (() => VsCodeApi) | undefined
}

export {}
