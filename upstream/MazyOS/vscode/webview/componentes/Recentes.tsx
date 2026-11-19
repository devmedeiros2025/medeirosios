// As execuções recentes. A que está rodando pulsa e pode ser cancelada.
import { Square } from 'lucide-react'
import type { Estado, Execucao } from '../../src/shared/protocolo'
import { enviar } from '../ponte'
import { contar, arquivosDaExecucao, haQuanto, marcaDoAgente, relogio, ROTULO_ESTADO, tituloDaExecucao, useAgora } from '../util'
import { BotaoIcone } from './Botoes'
import '../estilos/recentes.css'

const PONTO: Record<Execucao['estado'], string> = { rodando: 'rodando', ok: 'ok', erro: 'erro', cancelado: 'vazio' }

/** O que está acontecendo agora numa execução que roda: a última ferramenta ou "Pensando". */
function agoraNaExecucao(e: Execucao): string {
  for (let i = e.eventos.length - 1; i >= 0; i--) {
    const ev = e.eventos[i]
    if (ev?.tipo === 'ferramenta') return ev.estado === 'rodando' ? ev.resumo : 'Escrevendo a resposta'
    if (ev?.tipo === 'texto') return 'Escrevendo a resposta'
  }
  return 'Começando'
}

export function Recentes({ estado, limite = 5 }: { estado: Estado; limite?: number }) {
  const rodando = estado.execucoes.some((e) => e.estado === 'rodando')
  const agora = useAgora(rodando ? 1000 : 30_000)
  const lista = estado.execucoes.slice(0, limite)

  if (lista.length === 0) {
    return <p className="mz-recentes-vazio">Nada rodou ainda nesta pasta. O que você pedir aparece aqui.</p>
  }

  return (
    <ol className="mz-recentes">
      {lista.map((e) => {
        const titulo = tituloDaExecucao(e, estado)
        const arquivos = arquivosDaExecucao(e).length
        const sub =
          e.estado === 'rodando'
            ? agoraNaExecucao(e)
            : e.estado === 'ok' && arquivos > 0
              ? `Pronto, ${contar(arquivos, 'arquivo')}`
              : ROTULO_ESTADO[e.estado]
        return (
          <li key={e.id} className="mz-exec" data-agente={e.agente} data-estado={e.estado}>
            <button
              type="button"
              className="mz-exec-abrir"
              onClick={() => enviar({ tipo: 'abrirConsole', id: e.id })}
              aria-label={`${titulo}. ${ROTULO_ESTADO[e.estado]}. Abrir no console`}
            >
              <span className="mz-exec-linha1">
                <span className="mz-exec-titulo">{titulo}</span>
                <span className="mz-exec-quando">{e.estado === 'rodando' ? relogio(agora - e.inicio) : haQuanto(e.fim ?? e.inicio, agora)}</span>
              </span>
              <span className="mz-exec-linha2">
                <span className="mz-ponto" data-estado={PONTO[e.estado]} aria-hidden />
                <span className="mz-exec-sub">{sub}</span>
                <span className="mz-exec-agente">{marcaDoAgente(estado, e.agente)}</span>
              </span>
            </button>
            {e.estado === 'rodando' && (
              <BotaoIcone
                className="mz-exec-cancelar"
                icone={Square}
                cheio
                tamanho={11}
                rotulo={`Cancelar ${titulo}`}
                onClick={() => enviar({ tipo: 'cancelar', id: e.id })}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
