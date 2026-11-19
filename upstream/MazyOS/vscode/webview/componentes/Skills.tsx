// As skills por grupo, com busca instantânea.
import { useMemo, useState } from 'react'
import { MessagesSquare, Search, SquareTerminal, X } from 'lucide-react'
import { GRUPOS, type Estado, type Grupo, type Skill } from '../../src/shared/protocolo'
import { iconeDaSkill } from '../icones'
import { enviar } from '../ponte'
import { cx, normalizar } from '../util'
import { Botao } from './Botoes'
import '../estilos/skills.css'

type Props = {
  estado: Estado
  escolhida: string | null
  aoEscolher: (skill: Skill) => void
}

export function Skills({ estado, escolhida, aoEscolher }: Props) {
  const [busca, setBusca] = useState('')
  const [conversaAberta, setConversaAberta] = useState<string | null>(null)

  const grupos = useMemo(() => {
    const termo = normalizar(busca.trim())
    const filtradas = termo
      ? estado.skills.filter((s) => normalizar(`${s.rotulo} ${s.nome} ${s.descricao}`).includes(termo))
      : estado.skills
    return (Object.keys(GRUPOS) as Grupo[])
      .map((g) => ({ grupo: g, skills: filtradas.filter((s) => s.grupo === g) }))
      .filter((g) => g.skills.length > 0)
  }, [busca, estado.skills])

  const total = grupos.reduce((n, g) => n + g.skills.length, 0)
  const marca = estado.agentes.find((a) => a.id === estado.config.agente)?.marca ?? 'agente'

  return (
    <div className="mz-skills">
      <label className="mz-busca">
        <Search aria-hidden size={13} className="mz-busca-icone" />
        <input
          className="mz-campo mz-busca-campo"
          type="search"
          value={busca}
          placeholder="Procurar skill"
          aria-label="Procurar skill"
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && busca) {
              e.preventDefault()
              setBusca('')
            }
          }}
        />
        {busca && (
          <button type="button" className="mz-busca-limpar" aria-label="Limpar a busca" onClick={() => setBusca('')}>
            <X aria-hidden size={12} />
          </button>
        )}
      </label>

      <p className="mz-sr" aria-live="polite">
        {busca ? `${total} skills encontradas` : ''}
      </p>

      {total === 0 && (
        <p className="mz-skills-nada">
          Nenhuma skill com "{busca}". Pede direto no campo lá em cima: o Mazy entende pedido livre.
        </p>
      )}

      {grupos.map(({ grupo, skills }) => (
        <div key={grupo} className="mz-grupo" role="group" aria-labelledby={`mz-grupo-${grupo}`}>
          <h3 className="mz-grupo-titulo" id={`mz-grupo-${grupo}`}>
            {GRUPOS[grupo]}
          </h3>
          <ul className="mz-grupo-lista">
            {skills.map((s) => {
              const Icone = iconeDaSkill(s.icone)
              const conversa = s.modo === 'conversa'
              const aberta = conversaAberta === s.nome
              const marcada = escolhida === s.nome
              return (
                <li key={s.nome} className={cx('mz-skill', marcada && 'mz-skill-marcada', aberta && 'mz-skill-aberta')}>
                  <button
                    type="button"
                    className="mz-skill-botao"
                    aria-pressed={conversa ? undefined : marcada}
                    aria-expanded={conversa ? aberta : undefined}
                    onClick={() => (conversa ? setConversaAberta(aberta ? null : s.nome) : aoEscolher(s))}
                  >
                    <span className="mz-skill-icone" aria-hidden>
                      <Icone size={15} strokeWidth={1.75} />
                    </span>
                    <span className="mz-skill-texto">
                      <span className="mz-skill-rotulo">
                        {s.rotulo}
                        {conversa && (
                          <span className="mz-skill-modo" title="Abre uma conversa no terminal">
                            <MessagesSquare aria-hidden size={11} strokeWidth={2} />
                            <span>conversa</span>
                          </span>
                        )}
                      </span>
                      <span className="mz-skill-descricao">{s.descricao}</span>
                    </span>
                  </button>
                  {conversa && aberta && (
                    <div className="mz-skill-conversa">
                      <p>
                        Essa skill te faz perguntas, então ela abre o {marca} num terminal do editor. Você responde por lá até o fim.
                      </p>
                      <Botao variante="principal" icone={SquareTerminal} onClick={() => enviar({ tipo: 'conversar', skill: s.nome })}>
                        Abrir conversa
                      </Botao>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
