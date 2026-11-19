// A ponte entre a interface e o host da extensão.
// Dentro do editor usa `acquireVsCodeApi()`. No navegador (dev.html), cai no mock.
import type { ParaExtensao, ParaWebview } from '../src/shared/protocolo'
import type { VsCodeApi } from './global'
import { criarMock } from './mock'

type Ouvinte = (mensagem: ParaWebview) => void
type Persistido = Record<string, unknown>

export interface Canal {
  enviar(mensagem: ParaExtensao): void
  lerTudo(): Persistido
  gravarTudo(dados: Persistido): void
}

const ouvintes = new Set<Ouvinte>()

function entregar(mensagem: ParaWebview): void {
  for (const ouvinte of ouvintes) ouvinte(mensagem)
}

function ehMensagem(dado: unknown): dado is ParaWebview {
  return typeof dado === 'object' && dado !== null && typeof (dado as { tipo?: unknown }).tipo === 'string'
}

function criarCanalDoEditor(api: VsCodeApi): Canal {
  window.addEventListener('message', (evento: MessageEvent) => {
    if (ehMensagem(evento.data)) entregar(evento.data)
  })
  return {
    enviar: (mensagem) => api.postMessage(mensagem),
    lerTudo: () => {
      const salvo = api.getState()
      return typeof salvo === 'object' && salvo !== null ? (salvo as Persistido) : {}
    },
    gravarTudo: (dados) => api.setState(dados),
  }
}

const api = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : undefined

/** `true` quando a interface roda fora do editor, com dados de mentira. */
export const emPreVisualizacao = api === undefined

const canal: Canal = api ? criarCanalDoEditor(api) : criarMock(entregar)

/** Manda uma intenção pro host. */
export function enviar(mensagem: ParaExtensao): void {
  canal.enviar(mensagem)
}

/** Recebe as mensagens do host. Devolve a função que desliga o ouvinte. */
export function aoReceber(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte)
  return () => ouvintes.delete(ouvinte)
}

/** Lê um valor guardado pela webview (sobrevive quando o painel fica escondido). */
export function lerGuardado<T>(chave: string, padrao: T): T {
  const tudo = canal.lerTudo()
  return chave in tudo ? (tudo[chave] as T) : padrao
}

/** Guarda um valor da webview: rascunho do pedido, seções abertas, execução escolhida. */
export function guardar(chave: string, valor: unknown): void {
  canal.gravarTudo({ ...canal.lerTudo(), [chave]: valor })
}
