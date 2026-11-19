// A linha do tempo de uma execução: ferramentas, arquivos, avisos e textos intermediários.
import { useState } from 'react'
import { Check, ChevronRight, FileMinus, FilePen, FilePlus, LoaderCircle, TriangleAlert, X } from 'lucide-react'
import type { EventoExecucao, Execucao } from '../../src/shared/protocolo'
import { iconeDaFerramenta } from '../icones'
import { Markdown } from '../markdown'
import { enviar } from '../ponte'
import { contar, nomeDoArquivo } from '../util'
import '../estilos/tempo.css'

type Ferramenta = Extract<EventoExecucao, { tipo: 'ferramenta' }>
type Arquivo = Extract<EventoExecucao, { tipo: 'arquivo' }>

export type ItemTempo =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'ferramenta'; ferramenta: Ferramenta }
  | { tipo: 'arquivos'; arquivos: Arquivo[] }
  | { tipo: 'aviso'; texto: string }

/**
 * Junta dois pedaços de texto. Os CLIs mandam ora a mensagem inteira, ora aos pedaços (deltas).
 * Pedaço cola direto. Só duas mensagens longas e inteiras, a primeira terminando em ponto e a
 * segunda começando com maiúscula, ganham um parágrafo entre elas.
 */
export function juntarTextos(a: string, b: string): string {
  if (!a) return b
  const inteiras = a.length > 80 && b.length > 80
  if (inteiras && /[.!?:]$/.test(a) && /^[A-ZÀ-Ý#*>|]/.test(b)) return `${a}\n\n${b}`
  return a + b
}

const compactar = (t: string): string => t.replace(/\s+/g, ' ').trim()

/** Transforma os eventos crus em itens da linha do tempo. */
export function montarItens(eventos: EventoExecucao[]): ItemTempo[] {
  const itens: ItemTempo[] = []
  const porId = new Map<string, number>()
  for (const ev of eventos) {
    const ultimo = itens[itens.length - 1]
    switch (ev.tipo) {
      case 'texto':
        if (ultimo?.tipo === 'texto') ultimo.texto = juntarTextos(ultimo.texto, ev.texto)
        else itens.push({ tipo: 'texto', texto: ev.texto })
        break
      case 'ferramenta': {
        const i = porId.get(ev.id)
        if (i !== undefined) itens[i] = { tipo: 'ferramenta', ferramenta: ev }
        else {
          porId.set(ev.id, itens.length)
          itens.push({ tipo: 'ferramenta', ferramenta: ev })
        }
        break
      }
      case 'arquivo':
        if (ultimo?.tipo === 'arquivos') {
          if (!ultimo.arquivos.some((a) => a.caminho === ev.caminho)) ultimo.arquivos.push(ev)
        } else itens.push({ tipo: 'arquivos', arquivos: [ev] })
        break
      case 'aviso':
        itens.push({ tipo: 'aviso', texto: ev.texto })
        break
    }
  }
  return itens
}

/**
 * Separa a linha do tempo do texto final. Rodando, o texto depois da última ferramenta é a
 * resposta chegando. Pronta, o último texto igual à resposta sai da linha do tempo.
 */
export function separarResposta(execucao: Execucao): { itens: ItemTempo[]; escrevendo: string } {
  const itens = montarItens(execucao.eventos)
  const ultimo = itens[itens.length - 1]
  if (execucao.estado === 'rodando') {
    if (ultimo?.tipo === 'texto' && itens.some((i) => i.tipo !== 'texto')) return { itens: itens.slice(0, -1), escrevendo: ultimo.texto }
    if (ultimo?.tipo === 'texto' && itens.length === 1 && ultimo.texto.length > 160) return { itens: [], escrevendo: ultimo.texto }
    return { itens, escrevendo: '' }
  }
  const resposta = execucao.resposta ? compactar(execucao.resposta) : ''
  if (resposta) {
    // O texto que chegou depois da última ferramenta é a própria resposta: sai da linha do tempo.
    const filtrados = itens.filter((item, i) => {
      if (item.tipo !== 'texto') return true
      const texto = compactar(item.texto)
      if (texto === resposta) return false
      return !(i === itens.length - 1 && (resposta.includes(texto) || texto.includes(resposta)))
    })
    return { itens: filtrados, escrevendo: '' }
  }
  return { itens, escrevendo: '' }
}

const ICONE_ARQUIVO = { criado: FilePlus, editado: FilePen, apagado: FileMinus }
const ROTULO_ARQUIVO = { criado: 'criado', editado: 'editado', apagado: 'apagado' }

export function ChipArquivo({ caminho, acao }: { caminho: string; acao: Arquivo['acao'] }) {
  const Icone = ICONE_ARQUIVO[acao]
  const apagado = acao === 'apagado'
  return (
    <button
      type="button"
      className="mz-chip-arquivo"
      data-acao={acao}
      title={caminho}
      disabled={apagado}
      aria-label={`${nomeDoArquivo(caminho)}, ${ROTULO_ARQUIVO[acao]}${apagado ? '' : '. Abrir'}`}
      onClick={() => enviar({ tipo: 'abrirArquivo', caminho })}
    >
      <Icone aria-hidden size={13} strokeWidth={2} />
      <span>{caminho}</span>
      <small>{ROTULO_ARQUIVO[acao]}</small>
    </button>
  )
}

function Passo({ item }: { item: ItemTempo }) {
  switch (item.tipo) {
    case 'ferramenta': {
      const f = item.ferramenta
      const Icone = iconeDaFerramenta(f.nome)
      return (
        <li className="mz-passo" data-tipo="ferramenta" data-estado={f.estado}>
          <span className="mz-passo-no" aria-hidden>
            <Icone size={12} strokeWidth={2} />
          </span>
          <span className="mz-passo-texto" title={f.nome}>
            {f.resumo || f.nome}
          </span>
          <span className="mz-passo-estado">
            {f.estado === 'rodando' && <LoaderCircle aria-hidden size={13} className="mz-gira" />}
            {f.estado === 'ok' && <Check aria-hidden size={13} strokeWidth={2.5} />}
            {f.estado === 'erro' && <X aria-hidden size={13} strokeWidth={2.5} />}
            <span className="mz-sr">{f.estado === 'rodando' ? 'rodando' : f.estado === 'ok' ? 'feito' : 'deu erro'}</span>
          </span>
        </li>
      )
    }
    case 'arquivos':
      return (
        <li className="mz-passo" data-tipo="arquivos">
          <span className="mz-passo-no mz-passo-no-pequeno" aria-hidden />
          <div className="mz-passo-arquivos">
            {item.arquivos.map((a) => (
              <ChipArquivo key={a.caminho} caminho={a.caminho} acao={a.acao} />
            ))}
          </div>
        </li>
      )
    case 'aviso':
      return (
        <li className="mz-passo" data-tipo="aviso">
          <span className="mz-passo-no" aria-hidden>
            <TriangleAlert size={12} strokeWidth={2} />
          </span>
          <span className="mz-passo-texto">{item.texto}</span>
        </li>
      )
    case 'texto':
      return (
        <li className="mz-passo" data-tipo="texto">
          <span className="mz-passo-no mz-passo-no-pequeno" aria-hidden />
          <div className="mz-passo-fala">
            <Markdown fonte={item.texto} compacto />
          </div>
        </li>
      )
  }
}

/** Quantos passos mostrar fechada, quando a execução já terminou. */
const LIMITE_FECHADA = 6

export function LinhaDoTempo({ itens, rodando }: { itens: ItemTempo[]; rodando: boolean }) {
  const [aberta, setAberta] = useState(false)
  if (itens.length === 0) return null
  const passos = itens.filter((i) => i.tipo === 'ferramenta').length
  const recolher = !rodando && itens.length > LIMITE_FECHADA && !aberta
  const visiveis = recolher ? itens.slice(-3) : itens
  return (
    <section className="mz-tempo-secao" aria-label="O que o Mazy fez">
      {!rodando && itens.length > LIMITE_FECHADA && (
        <button type="button" className="mz-tempo-alternar" aria-expanded={aberta} onClick={() => setAberta(!aberta)}>
          <ChevronRight aria-hidden size={13} className="mz-tempo-seta" />
          <span>{aberta ? 'Esconder os passos' : `Ver todos os ${contar(passos, 'passo')}`}</span>
        </button>
      )}
      <ol className="mz-tempo" data-rodando={rodando || undefined}>
        {visiveis.map((item, i) => (
          <Passo key={(recolher ? itens.length - 3 : 0) + i} item={item} />
        ))}
      </ol>
    </section>
  )
}
