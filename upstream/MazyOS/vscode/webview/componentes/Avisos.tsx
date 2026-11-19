// Os avisos no canto de baixo. Somem sozinhos; erro fica mais tempo.
import { useEffect } from 'react'
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { dispensarAviso, useLoja, type Aviso } from '../estado'
import '../estilos/avisos.css'

const ICONE = { info: Info, ok: CircleCheck, erro: CircleAlert }
const TEMPO = { info: 4200, ok: 3200, erro: 9000 }

function UmAviso({ aviso }: { aviso: Aviso }) {
  useEffect(() => {
    const t = window.setTimeout(() => dispensarAviso(aviso.id), TEMPO[aviso.nivel])
    return () => window.clearTimeout(t)
  }, [aviso.id, aviso.nivel])
  const Icone = ICONE[aviso.nivel]
  return (
    <li className="mz-aviso" data-nivel={aviso.nivel} role={aviso.nivel === 'erro' ? 'alert' : 'status'}>
      <Icone aria-hidden size={15} strokeWidth={2} className="mz-aviso-icone" />
      <p>{aviso.texto}</p>
      <button type="button" className="mz-aviso-fechar" aria-label="Fechar o aviso" onClick={() => dispensarAviso(aviso.id)}>
        <X aria-hidden size={13} />
      </button>
    </li>
  )
}

export function Avisos() {
  const { avisos } = useLoja()
  return (
    <ol className="mz-avisos" aria-live="polite">
      {avisos.map((a) => (
        <UmAviso key={a.id} aviso={a} />
      ))}
    </ol>
  )
}
