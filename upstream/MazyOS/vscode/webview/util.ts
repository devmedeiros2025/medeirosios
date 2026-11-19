// Pequenas utilidades de texto e tempo, todas em pt-BR.
import { useEffect, useState } from 'react'
import type { AgenteId, Estado, Execucao } from '../src/shared/protocolo'

const MIN = 60_000
const HORA = 60 * MIN
const DIA = 24 * HORA

const formatoData = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' })
const formatoHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const formatoDolar = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** "agora", "há 3 min", "há 2 h", "ontem", "há 4 dias", "12 de out." */
export function haQuanto(quando: number, agora = Date.now()): string {
  const d = Math.max(0, agora - quando)
  if (d < 45_000) return 'agora'
  if (d < HORA) return `há ${Math.round(d / MIN)} min`
  if (d < DIA) return `há ${Math.round(d / HORA)} h`
  if (d < 2 * DIA) return 'ontem'
  if (d < 7 * DIA) return `há ${Math.floor(d / DIA)} dias`
  return formatoData.format(quando)
}

/** Hora curta: "14:32". */
export function horaCurta(quando: number): string {
  return formatoHora.format(quando)
}

/** "8 s", "1 min 12 s", "1 h 4 min". */
export function duracao(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  if (m < 60) return s % 60 ? `${m} min ${s % 60} s` : `${m} min`
  const h = Math.floor(m / 60)
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`
}

/** Relógio de execução: "0:42", "12:07". */
export function relogio(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function dolares(valor: number): string {
  return formatoDolar.format(valor)
}

/** Tira acento e caixa, pra busca. */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Junta classes, ignorando as falsas. */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

/** Re-renderiza a cada `intervaloMs` e devolve o "agora". */
export function useAgora(intervaloMs: number, ligado = true): number {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    if (!ligado) return
    setAgora(Date.now())
    const t = window.setInterval(() => setAgora(Date.now()), intervaloMs)
    return () => window.clearInterval(t)
  }, [intervaloMs, ligado])
  return agora
}

/** A primeira linha do pedido, cortada. */
export function resumir(texto: string, limite = 72): string {
  const linha = texto.trim().split('\n')[0] ?? ''
  return linha.length > limite ? `${linha.slice(0, limite - 1).trimEnd()}…` : linha
}

/** Rótulo curto da execução: a skill, se houver, ou o pedido resumido. */
export function tituloDaExecucao(execucao: Execucao, estado: Estado | null): string {
  if (execucao.skill) {
    const skill = estado?.skills.find((s) => s.nome === execucao.skill)
    return skill?.rotulo ?? execucao.skill
  }
  return resumir(execucao.pedido) || 'Pedido livre'
}

export const ROTULO_ESTADO: Record<Execucao['estado'], string> = {
  rodando: 'Rodando...',
  ok: 'Pronto',
  erro: 'Deu erro',
  cancelado: 'Cancelado',
}

export function marcaDoAgente(estado: Estado | null, id: AgenteId): string {
  return estado?.agentes.find((a) => a.id === id)?.marca ?? id
}

/** Rótulo do modelo pelo id; `null` vira "padrão". */
export function rotuloDoModelo(estado: Estado | null, agente: AgenteId, modelo: string | null | undefined): string {
  if (!modelo) return 'Padrão'
  const info = estado?.agentes.find((a) => a.id === agente)
  return info?.modelos.find((m) => m.id === modelo)?.rotulo ?? modelo
}

/** "Cmd Enter" no Mac, "Ctrl Enter" no resto. */
export function atalhoEnviar(estado: Estado | null): string {
  const mac = estado ? estado.ambiente.plataforma === 'mac' : /Mac/i.test(navigator.platform)
  return mac ? '⌘ Enter' : 'Ctrl Enter'
}

/** Os arquivos que a execução criou ou editou, sem repetir. */
export function arquivosDaExecucao(execucao: Execucao): Array<{ caminho: string; acao: 'criado' | 'editado' }> {
  const vistos = new Map<string, 'criado' | 'editado'>()
  for (const e of execucao.eventos) {
    if (e.tipo !== 'arquivo') continue
    if (e.acao === 'apagado') {
      vistos.delete(e.caminho)
      continue
    }
    if (!vistos.has(e.caminho)) vistos.set(e.caminho, e.acao)
  }
  return [...vistos].map(([caminho, acao]) => ({ caminho, acao }))
}

/** Só o nome do arquivo, sem a pasta. */
export function nomeDoArquivo(caminho: string): string {
  return caminho.split(/[\\/]/).filter(Boolean).pop() ?? caminho
}

/** O plural simples: "1 arquivo", "3 arquivos". */
export function contar(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`
}
