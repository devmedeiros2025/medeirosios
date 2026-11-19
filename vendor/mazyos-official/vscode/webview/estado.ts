// O store da interface: aplica o que o host manda e entrega pros componentes.
import { useCallback, useState, useSyncExternalStore } from 'react'
import type { EventoExecucao, Execucao, ParaWebview, Estado } from '../src/shared/protocolo'
import { guardar, lerGuardado } from './ponte'

export type NivelAviso = 'info' | 'erro' | 'ok'
export type Aviso = { id: number; texto: string; nivel: NivelAviso }

export type Loja = {
  estado: Estado | null
  avisos: Aviso[]
  /** Muda toda vez que o host pede foco no campo de pedido. */
  focoPedido: number
  /** A última execução nova que o host anunciou: o console pula pra ela. */
  novaExecucao: { id: string; vez: number } | null
}

let loja: Loja = { estado: null, avisos: [], focoPedido: 0, novaExecucao: null }
const assinantes = new Set<() => void>()
let proximoAviso = 1

function definir(nova: Loja): void {
  loja = nova
  for (const avisar of assinantes) avisar()
}

function assinar(avisar: () => void): () => void {
  assinantes.add(avisar)
  return () => assinantes.delete(avisar)
}

/** Junta um evento novo na execução, atualizando o que o evento diz. */
function juntarEvento(execucao: Execucao, evento: EventoExecucao): Execucao {
  const nova: Execucao = { ...execucao, eventos: [...execucao.eventos, evento] }
  if (evento.tipo === 'inicio') {
    if (evento.modelo) nova.modelo = evento.modelo
    if (evento.sessao) nova.sessao = evento.sessao
  }
  if (evento.tipo === 'fim') {
    nova.estado = evento.status
    nova.resposta = evento.resposta || execucao.resposta
    nova.fim = execucao.fim ?? (evento.duracaoMs ? execucao.inicio + evento.duracaoMs : Date.now())
    if (evento.sessao) nova.sessao = evento.sessao
    if (evento.custoUsd !== undefined) nova.custoUsd = evento.custoUsd
  }
  return nova
}

/** Aplica uma mensagem do host. */
export function aplicar(mensagem: ParaWebview): void {
  switch (mensagem.tipo) {
    case 'estado':
      definir({ ...loja, estado: mensagem.estado })
      return
    case 'execucao': {
      if (!loja.estado) return
      const lista = loja.estado.execucoes
      const existe = lista.some((e) => e.id === mensagem.execucao.id)
      const execucoes = existe
        ? lista.map((e) => (e.id === mensagem.execucao.id ? mensagem.execucao : e))
        : [mensagem.execucao, ...lista]
      const novaExecucao = existe ? loja.novaExecucao : { id: mensagem.execucao.id, vez: (loja.novaExecucao?.vez ?? 0) + 1 }
      definir({ ...loja, estado: { ...loja.estado, execucoes }, novaExecucao })
      return
    }
    case 'evento': {
      if (!loja.estado) return
      const lista = loja.estado.execucoes
      if (!lista.some((e) => e.id === mensagem.id)) return
      const execucoes = lista.map((e) => (e.id === mensagem.id ? juntarEvento(e, mensagem.evento) : e))
      definir({ ...loja, estado: { ...loja.estado, execucoes } })
      return
    }
    case 'aviso':
      avisar(mensagem.texto, mensagem.nivel ?? 'info')
      return
    case 'foco':
      definir({ ...loja, focoPedido: loja.focoPedido + 1 })
      return
  }
}

/** Mostra um aviso no canto. Também usado pela própria interface. */
export function avisar(texto: string, nivel: NivelAviso = 'info'): void {
  const aviso: Aviso = { id: proximoAviso++, texto, nivel }
  // No máximo quatro na tela: o mais antigo sai primeiro.
  definir({ ...loja, avisos: [...loja.avisos, aviso].slice(-4) })
}

export function dispensarAviso(id: number): void {
  definir({ ...loja, avisos: loja.avisos.filter((a) => a.id !== id) })
}

export function useLoja(): Loja {
  return useSyncExternalStore(assinar, () => loja, () => loja)
}

/** Um `useState` que sobrevive quando a webview some e volta (getState/setState do editor). */
export function useGuardado<T>(chave: string, inicial: T): [T, (valor: T) => void] {
  const [valor, setValor] = useState<T>(() => lerGuardado(chave, inicial))
  const mudar = useCallback(
    (novo: T) => {
      setValor(novo)
      guardar(chave, novo)
    },
    [chave],
  )
  return [valor, mudar]
}
