// Os quatro arquivos de memória e o estado de cada um.
import { Building2, Compass, MessageSquareQuote, Palette, type LucideIcon } from 'lucide-react'
import type { Estado, MazyosArquivo, MazyosChave } from '../../src/shared/protocolo'
import { enviar } from '../ponte'
import { haQuanto, useAgora } from '../util'

const ICONE: Record<MazyosChave, LucideIcon> = {
  empresa: Building2,
  preferencias: MessageSquareQuote,
  estrategia: Compass,
  design: Palette,
}

function situacao(a: MazyosArquivo, agora: number): { texto: string; tipo: 'ok' | 'vazio' | 'ausente' } {
  if (!a.existe) return { texto: 'Não existe', tipo: 'ausente' }
  if (!a.preenchido) return { texto: 'Em branco', tipo: 'vazio' }
  return { texto: `Atualizado ${haQuanto(a.mtimeMs, agora)}`, tipo: 'ok' }
}

/** "3 de 4": quanto o Mazy já sabe do negócio. */
export function MedidorMemoria({ arquivos }: { arquivos: MazyosArquivo[] }) {
  const cheios = arquivos.filter((a) => a.preenchido).length
  return (
    <span className="mz-medidor" role="img" aria-label={`${cheios} de ${arquivos.length} arquivos preenchidos`}>
      <span className="mz-medidor-barras" aria-hidden>
        {arquivos.map((a) => (
          <span key={a.chave} data-cheio={a.preenchido || undefined} />
        ))}
      </span>
      <span aria-hidden>
        {cheios} de {arquivos.length}
      </span>
    </span>
  )
}

export function Memoria({ estado }: { estado: Estado }) {
  const agora = useAgora(30_000)
  return (
    <ul className="mz-memoria">
      {estado.workspace.arquivos.map((a) => {
        const Icone = ICONE[a.chave]
        const s = situacao(a, agora)
        return (
          <li key={a.chave}>
            <button
              type="button"
              className="mz-memoria-item"
              data-tipo={s.tipo}
              title={a.caminho}
              onClick={() => enviar({ tipo: 'abrirArquivo', caminho: a.caminho })}
            >
              <Icone aria-hidden size={14} strokeWidth={1.75} className="mz-memoria-icone" />
              <span className="mz-memoria-rotulo">{a.rotulo}</span>
              <span className="mz-memoria-estado">{s.texto}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
