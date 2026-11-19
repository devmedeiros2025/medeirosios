// O campo de escrever pedido, usado no painel ("Pede aí") e no console ("Continuar a conversa").
import { useLayoutEffect, type ReactNode, type RefObject } from 'react'
import { ArrowUp } from 'lucide-react'
import { cx } from '../util'
import '../estilos/compositor.css'

type Props = {
  valor: string
  aoMudar: (valor: string) => void
  aoEnviar: () => void
  placeholder: string
  rotuloCampo: string
  rotuloEnviar: string
  /** Pode enviar mesmo com o campo vazio (quando uma skill está escolhida). */
  podeVazio?: boolean
  bloqueado?: boolean
  /** Uma linha embaixo do campo, à esquerda do botão. */
  rodape?: ReactNode
  /** Peças acima do campo, dentro da moldura (a skill escolhida). */
  acima?: ReactNode
  refCampo?: RefObject<HTMLTextAreaElement | null>
  linhasMax?: number
  className?: string
}

export function Compositor({
  valor,
  aoMudar,
  aoEnviar,
  placeholder,
  rotuloCampo,
  rotuloEnviar,
  podeVazio = false,
  bloqueado = false,
  rodape,
  acima,
  refCampo,
  linhasMax = 4,
  className,
}: Props) {
  const pode = !bloqueado && (podeVazio || valor.trim().length > 0)

  // Altura de 1 a `linhasMax` linhas, pra editores sem `field-sizing`.
  useLayoutEffect(() => {
    const el = refCampo?.current
    if (!el || CSS.supports('field-sizing', 'content')) return
    el.style.height = 'auto'
    const estilo = getComputedStyle(el)
    const linha = Number.parseFloat(estilo.lineHeight) || 19
    const extra = Number.parseFloat(estilo.paddingTop) + Number.parseFloat(estilo.paddingBottom)
    el.style.height = `${Math.min(el.scrollHeight, linha * linhasMax + extra)}px`
  }, [valor, refCampo, linhasMax])

  return (
    <form
      className={cx('mz-compositor', className)}
      style={{ ['--linhas-max' as string]: linhasMax }}
      data-bloqueado={bloqueado || undefined}
      onSubmit={(e) => {
        e.preventDefault()
        if (pode) aoEnviar()
      }}
    >
      {acima}
      <textarea
        ref={refCampo}
        className="mz-compositor-campo"
        rows={1}
        value={valor}
        placeholder={placeholder}
        aria-label={rotuloCampo}
        onChange={(e) => aoMudar(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            if (pode) aoEnviar()
          }
        }}
      />
      <div className="mz-compositor-base">
        <div className="mz-compositor-rodape">{rodape}</div>
        <button type="submit" className="mz-compositor-enviar" disabled={!pode} aria-label={rotuloEnviar} title={rotuloEnviar}>
          <ArrowUp aria-hidden size={16} strokeWidth={2.4} />
        </button>
      </div>
    </form>
  )
}
