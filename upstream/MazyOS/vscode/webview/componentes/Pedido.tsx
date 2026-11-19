// "Pede aí": o pedido livre ou com uma skill escolhida.
import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { Estado } from '../../src/shared/protocolo'
import { useGuardado } from '../estado'
import { iconeDaSkill } from '../icones'
import { enviar } from '../ponte'
import { atalhoEnviar, rotuloDoModelo } from '../util'
import { Compositor } from './Compositor'

type Props = {
  estado: Estado
  skill: string | null
  aoTirarSkill: () => void
  /** Muda quando alguém (host ou lista de skills) pede foco no campo. */
  foco: number
}

export function Pedido({ estado, skill: nomeSkill, aoTirarSkill, foco }: Props) {
  const [texto, setTexto] = useGuardado('rascunho', '')
  const campo = useRef<HTMLTextAreaElement>(null)
  const agente = estado.agentes.find((a) => a.id === estado.config.agente)
  const skill = estado.skills.find((s) => s.nome === nomeSkill)

  useEffect(() => {
    if (!foco) return
    const el = campo.current
    if (!el) return
    el.focus()
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    el.setSelectionRange(el.value.length, el.value.length)
  }, [foco])

  const bloqueio = !agente
    ? 'Escolhe um agente.'
    : !agente.instalado || agente.auth.estado === 'ausente'
      ? `Instala o ${agente.marca} pra pedir.`
      : agente.auth.estado === 'desconectado'
        ? `Entra no ${agente.marca} pra pedir.`
        : agente.auth.estado === 'verificando'
          ? 'Conferindo a conta...'
          : null

  const mandar = () => {
    const pedido = texto.trim()
    enviar(skill ? { tipo: 'rodar', skill: skill.nome, pedido } : { tipo: 'rodar', pedido })
    setTexto('')
    aoTirarSkill()
  }

  const IconeSkill = skill ? iconeDaSkill(skill.icone) : null
  const marca = agente?.marca ?? 'agente'

  return (
    <section className="mz-pedido" aria-label="Pedido">
      <Compositor
        refCampo={campo}
        valor={texto}
        aoMudar={setTexto}
        aoEnviar={mandar}
        podeVazio={Boolean(skill)}
        bloqueado={Boolean(bloqueio)}
        placeholder={skill?.exemplo ? `${skill.exemplo}...` : 'Pede aí: um carrossel, um e-mail, um anúncio...'}
        rotuloCampo={skill ? `Pedido pra skill ${skill.rotulo}` : 'O que você quer que o Mazy faça'}
        rotuloEnviar={`Enviar pro ${marca}`}
        acima={
          skill &&
          IconeSkill && (
            <div className="mz-compositor-acima">
              <span className="mz-chip-skill">
                <IconeSkill aria-hidden size={13} strokeWidth={2} />
                <span>{skill.rotulo}</span>
                <button type="button" className="mz-chip-skill-tirar" aria-label={`Tirar a skill ${skill.rotulo}`} onClick={aoTirarSkill}>
                  <X aria-hidden size={12} strokeWidth={2.4} />
                </button>
              </span>
            </div>
          )
        }
        rodape={
          bloqueio ? (
            <span className="mz-compositor-aviso">{bloqueio}</span>
          ) : (
            <>
              <span className="mz-compositor-quem">
                <span className="mz-compositor-quem-ponto" aria-hidden />
                {marca}
                <span className="mz-calado"> {rotuloDoModelo(estado, estado.config.agente, agente?.modelo).split(',')[0]}</span>
              </span>
              <kbd className="mz-compositor-atalho">{atalhoEnviar(estado)}</kbd>
            </>
          )
        }
      />
    </section>
  )
}
