// Botões e peças pequenas reaproveitadas pela interface.
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Check, ChevronRight, Copy, type LucideIcon } from 'lucide-react'
import { enviar } from '../ponte'
import { cx } from '../util'
import '../estilos/botoes.css'

type Variante = 'principal' | 'marca' | 'secundario' | 'fantasma'

type BotaoProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante
  icone?: LucideIcon
  /** Ocupa a largura toda. */
  cheio?: boolean
}

export function Botao({ variante = 'secundario', icone: Icone, cheio, className, children, type, ...resto }: BotaoProps) {
  return (
    <button type={type ?? 'button'} className={cx('mz-botao', `mz-botao-${variante}`, cheio && 'mz-botao-cheio', className)} {...resto}>
      {Icone && <Icone aria-hidden size={14} strokeWidth={2} />}
      <span>{children}</span>
    </button>
  )
}

type BotaoIconeProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icone: LucideIcon
  /** Obrigatório: vira `aria-label` e dica. */
  rotulo: string
  tamanho?: number
  /** Ícone preenchido (o quadrado de parar). */
  cheio?: boolean
}

export function BotaoIcone({ icone: Icone, rotulo, tamanho = 15, cheio, className, type, ...resto }: BotaoIconeProps) {
  return (
    <button type={type ?? 'button'} className={cx('mz-botao-icone', className)} aria-label={rotulo} title={rotulo} {...resto}>
      <Icone aria-hidden size={tamanho} strokeWidth={2} fill={cheio ? 'currentColor' : 'none'} />
    </button>
  )
}

/** Copia pelo host e confirma no próprio botão. */
export function BotaoCopiar({ texto, rotulo = 'Copiar', discreto = false }: { texto: string; rotulo?: string; discreto?: boolean }) {
  const [copiado, setCopiado] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const copiar = () => {
    enviar({ tipo: 'copiar', texto })
    setCopiado(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopiado(false), 1600)
  }
  if (discreto) {
    return (
      <button type="button" className="mz-botao-mini" onClick={copiar} aria-label={rotulo} data-ok={copiado || undefined}>
        {copiado ? <Check aria-hidden size={12} /> : <Copy aria-hidden size={12} />}
        <span aria-live="polite">{copiado ? 'Copiado' : 'Copiar'}</span>
      </button>
    )
  }
  return (
    <Botao variante="secundario" icone={copiado ? Check : Copy} onClick={copiar} aria-label={rotulo} data-ok={copiado || undefined}>
      <span aria-live="polite">{copiado ? 'Copiado' : 'Copiar'}</span>
    </Botao>
  )
}

/** Cabeçalho de seção que abre e fecha. O estado aberto fica guardado por quem chama. */
export function Secao({
  id,
  titulo,
  extra,
  aberta,
  aoAlternar,
  children,
  className,
}: {
  id: string
  titulo: string
  extra?: ReactNode
  aberta: boolean
  aoAlternar: () => void
  children: ReactNode
  className?: string
}) {
  const corpo = `mz-secao-${id}`
  return (
    <section className={cx('mz-secao', className)} data-aberta={aberta || undefined} aria-labelledby={`${corpo}-titulo`}>
      <div className="mz-secao-cabeca">
        <button
          type="button"
          className="mz-secao-alternar"
          aria-expanded={aberta}
          aria-controls={corpo}
          id={`${corpo}-titulo`}
          onClick={aoAlternar}
        >
          <ChevronRight aria-hidden size={13} strokeWidth={2.25} className="mz-secao-seta" />
          <span className="mz-secao-titulo">{titulo}</span>
        </button>
        {extra && <div className="mz-secao-extra">{extra}</div>}
      </div>
      <div className="mz-secao-corpo" id={corpo} hidden={!aberta}>
        {children}
      </div>
    </section>
  )
}

/** A marca do MazyOS (o mesmo desenho do ícone da barra de atividades). */
export function MarcaMazy({ tamanho = 16 }: { tamanho?: number }) {
  return (
    <svg className="mz-marca" width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 20V5l9 9 9-9v15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="18.5" r="1.5" fill="currentColor" />
    </svg>
  )
}
