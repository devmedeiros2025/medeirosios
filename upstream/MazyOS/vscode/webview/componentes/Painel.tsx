// O painel da barra lateral.
import { useCallback, useState } from 'react'
import { RefreshCw, SquareTerminal } from 'lucide-react'
import type { Estado, Skill } from '../../src/shared/protocolo'
import { useGuardado, useLoja } from '../estado'
import { enviar } from '../ponte'
import { contar } from '../util'
import { Agentes } from './Agentes'
import { BotaoIcone, MarcaMazy, Secao } from './Botoes'
import { Memoria, MedidorMemoria } from './Memoria'
import { BoasVindas, Carregando, Negocio, SemPasta } from './Negocio'
import { Pedido } from './Pedido'
import { Recentes } from './Recentes'
import { Skills } from './Skills'
import '../estilos/painel.css'

type Abertas = { recentes: boolean; skills: boolean; memoria: boolean }

export function Painel() {
  const { estado, focoPedido } = useLoja()
  return (
    <div className="mz-app mz-painel" data-agente={estado?.config.agente ?? 'claude'}>
      {!estado ? (
        <Carregando />
      ) : !estado.workspace.raiz ? (
        <SemPasta />
      ) : !estado.workspace.instalado ? (
        <>
          <BoasVindas estado={estado} />
          <Agentes estado={estado} titulo="Quem conduz a conversa" />
        </>
      ) : (
        <Instalado estado={estado} focoDoHost={focoPedido} />
      )}
      {estado && <Rodape estado={estado} />}
    </div>
  )
}

function Instalado({ estado, focoDoHost }: { estado: Estado; focoDoHost: number }) {
  const [skill, setSkill] = useGuardado<string | null>('skill', null)
  const [abertas, setAbertas] = useGuardado<Abertas>('secoes', { recentes: true, skills: true, memoria: true })
  const [focoLocal, setFocoLocal] = useState(0)

  const alternar = (chave: keyof Abertas) => setAbertas({ ...abertas, [chave]: !abertas[chave] })
  const escolher = useCallback(
    (s: Skill) => {
      setSkill(skill === s.nome ? null : s.nome)
      setFocoLocal((n) => n + 1)
    },
    [skill, setSkill],
  )

  const rodando = estado.execucoes.filter((e) => e.estado === 'rodando').length

  return (
    <>
      <Negocio estado={estado} />
      <Agentes estado={estado} />
      <Pedido estado={estado} skill={skill} aoTirarSkill={() => setSkill(null)} foco={focoDoHost + focoLocal} />

      <div className="mz-secoes">
        <Secao
          id="recentes"
          titulo="Recentes"
          aberta={abertas.recentes}
          aoAlternar={() => alternar('recentes')}
          extra={rodando > 0 ? <span className="mz-secao-rodando">{rodando === 1 ? 'uma rodando' : `${rodando} rodando`}</span> : undefined}
        >
          <Recentes estado={estado} />
        </Secao>
        <Secao
          id="skills"
          titulo="Skills"
          aberta={abertas.skills}
          aoAlternar={() => alternar('skills')}
          extra={<span>{contar(estado.skills.length, 'skill')}</span>}
        >
          <Skills estado={estado} escolhida={skill} aoEscolher={escolher} />
        </Secao>
        <Secao
          id="memoria"
          titulo="Memória"
          aberta={abertas.memoria}
          aoAlternar={() => alternar('memoria')}
          extra={<MedidorMemoria arquivos={estado.workspace.arquivos} />}
        >
          <Memoria estado={estado} />
        </Secao>
      </div>
    </>
  )
}

function Rodape({ estado }: { estado: Estado }) {
  return (
    <footer className="mz-rodape">
      <span className="mz-rodape-marca">
        <MarcaMazy tamanho={13} />
        <span>MazyOS {estado.ambiente.versao}</span>
      </span>
      <span className="mz-rodape-acoes">
        <BotaoIcone icone={RefreshCw} tamanho={14} rotulo="Reler a memória" onClick={() => enviar({ tipo: 'recarregar' })} />
        {estado.workspace.instalado && (
          <BotaoIcone icone={SquareTerminal} tamanho={14} rotulo="Abrir o console do Mazy" onClick={() => enviar({ tipo: 'abrirConsole' })} />
        )}
      </span>
    </footer>
  )
}
