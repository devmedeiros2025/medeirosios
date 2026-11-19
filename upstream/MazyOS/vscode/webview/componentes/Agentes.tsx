// Agente e conta: quem roda as skills (Claude, GPT ou Antigravity) e com qual conta.
import { useRef, type KeyboardEvent } from 'react'
import { Check, ChevronDown, Download, KeyRound, LogIn, LogOut, Trash2 } from 'lucide-react'
import type { AgenteId, AgenteInfo, Estado } from '../../src/shared/protocolo'
import { useGuardado } from '../estado'
import { enviar } from '../ponte'
import { cx, rotuloDoModelo } from '../util'
import { Botao, BotaoCopiar } from './Botoes'
import '../estilos/agentes.css'

type Situacao = { ponto: 'ok' | 'vazio' | 'ausente' | 'verificando'; texto: string }

export function situacaoDoAgente(a: AgenteInfo): Situacao {
  if (!a.instalado || a.auth.estado === 'ausente') return { ponto: 'ausente', texto: 'Não instalado' }
  if (a.auth.estado === 'verificando') return { ponto: 'verificando', texto: 'Conferindo' }
  if (a.auth.estado === 'conectado') return { ponto: 'ok', texto: 'Conectado' }
  return { ponto: 'vazio', texto: 'Desconectado' }
}

export function Agentes({ estado, titulo = 'Quem trabalha' }: { estado: Estado; titulo?: string }) {
  const atual = estado.config.agente
  const info = estado.agentes.find((a) => a.id === atual)
  const botoes = useRef<Array<HTMLButtonElement | null>>([])

  const escolher = (id: AgenteId) => {
    if (id !== atual) enviar({ tipo: 'escolherAgente', agente: id })
  }

  const teclas = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = estado.agentes.findIndex((a) => a.id === atual)
    const passo = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!passo) return
    e.preventDefault()
    const n = estado.agentes.length
    const proximo = estado.agentes[(i + passo + n) % n]
    if (!proximo) return
    escolher(proximo.id)
    botoes.current[(i + passo + n) % n]?.focus()
  }

  return (
    <section className="mz-agentes" aria-labelledby="mz-agentes-titulo">
      <h2 className="mz-agentes-titulo" id="mz-agentes-titulo">
        {titulo}
      </h2>
      <div
        className="mz-segmentos"
        role="radiogroup"
        aria-labelledby="mz-agentes-titulo"
        data-agente={atual}
        style={{ ['--i' as string]: Math.max(0, estado.agentes.findIndex((a) => a.id === atual)) }}
        onKeyDown={teclas}
      >
        {estado.agentes.map((a, i) => {
          const s = situacaoDoAgente(a)
          const marcado = a.id === atual
          return (
            <button
              key={a.id}
              ref={(el) => {
                botoes.current[i] = el
              }}
              type="button"
              role="radio"
              aria-checked={marcado}
              aria-label={`${a.marca}, ${s.texto.toLowerCase()}`}
              tabIndex={marcado ? 0 : -1}
              className="mz-segmento"
              data-agente={a.id}
              onClick={() => escolher(a.id)}
            >
              <span className="mz-ponto" data-estado={s.ponto} aria-hidden />
              <span className="mz-segmento-marca">{a.marca}</span>
            </button>
          )
        })}
      </div>
      {info && <Conta key={info.id} agente={info} estado={estado} />}
    </section>
  )
}

function Conta({ agente: a, estado }: { agente: AgenteInfo; estado: Estado }) {
  const [aberta, setAberta] = useGuardado(`conta-${a.id}`, false)
  const s = situacaoDoAgente(a)
  const auth = a.auth

  return (
    <div className="mz-conta" data-agente={a.id} data-situacao={s.ponto} aria-live="polite">
      <div className="mz-conta-topo">
        <span className="mz-conta-nome">{a.nome}</span>
        {a.versao && <span className="mz-conta-versao mz-mono">{a.versao}</span>}
      </div>

      {s.ponto === 'verificando' && (
        <div className="mz-conta-verificando" role="status">
          <p className="mz-conta-estado">
            <span className="mz-ponto" data-estado="verificando" aria-hidden />
            Conferindo a conta do {a.marca}...
          </p>
          <span className="mz-esqueleto" style={{ width: '70%' }} />
        </div>
      )}

      {s.ponto === 'ok' && (
        <>
          <p className="mz-conta-estado">
            <span className="mz-ponto" data-estado="ok" aria-hidden />
            <span>{auth.metodo === 'chave' ? 'Usando chave de API' : 'Conectado pela sua conta'}</span>
            {auth.detalhe && <span className="mz-conta-plano">{auth.detalhe}</span>}
          </p>
          {auth.conta && <p className="mz-conta-email">{auth.conta}</p>}
          <button type="button" className="mz-conta-alternar" aria-expanded={aberta} onClick={() => setAberta(!aberta)}>
            <span className="mz-calado">Modelo</span>
            <span className="mz-conta-modelo-atual">{rotuloDoModelo(estado, a.id, a.modelo)}</span>
            <ChevronDown aria-hidden size={14} className="mz-conta-seta" />
          </button>
          {aberta && <Detalhes agente={a} />}
        </>
      )}

      {s.ponto === 'vazio' && (
        <>
          <p className="mz-conta-estado">
            <span className="mz-ponto" data-estado="vazio" aria-hidden />
            Você ainda não entrou no {a.marca}.
          </p>
          <p className="mz-conta-descricao">{a.descricao}</p>
          <div className="mz-conta-acoes">
            <Botao variante="principal" icone={LogIn} onClick={() => enviar({ tipo: 'entrar', agente: a.id })}>
              {a.id === 'antigravity' ? 'Entrar com o Google' : `Entrar no ${a.marca}`}
            </Botao>
            {a.aceitaChave && (
              <Botao variante="secundario" icone={KeyRound} onClick={() => enviar({ tipo: 'definirChave', agente: a.id })}>
                Usar chave de API
              </Botao>
            )}
          </div>
          {a.id === 'antigravity' && (
            <p className="mz-conta-nota">O login é no navegador: o Antigravity abre num terminal e pede pra você entrar com a conta Google.</p>
          )}
        </>
      )}

      {s.ponto === 'ausente' && (
        <>
          <p className="mz-conta-estado">
            <span className="mz-ponto" data-estado="ausente" aria-hidden />O {a.nome} não está instalado neste computador.
          </p>
          <div className="mz-comando">
            <code className="mz-mono">{a.comandoInstalar}</code>
            <BotaoCopiar texto={a.comandoInstalar} rotulo="Copiar o comando" discreto />
          </div>
          <div className="mz-conta-acoes">
            <Botao variante="principal" icone={Download} onClick={() => enviar({ tipo: 'instalarAgente', agente: a.id })}>
              Instalar o {a.marca}
            </Botao>
          </div>
          <p className="mz-conta-nota">Abre um terminal do editor com esse comando. Depois é só entrar na conta.</p>
        </>
      )}
    </div>
  )
}

function Detalhes({ agente: a }: { agente: AgenteInfo }) {
  const opcoes: Array<{ id: string | null; rotulo: string }> = [{ id: null, rotulo: `Padrão do ${a.nome}` }, ...a.modelos]
  const chave = a.auth.metodo === 'chave'
  return (
    <div className="mz-conta-detalhes">
      <div className="mz-modelos" role="radiogroup" aria-label={`Modelo do ${a.marca}`}>
        {opcoes.map((m) => {
          const marcado = (a.modelo ?? null) === m.id
          return (
            <button
              key={m.id ?? 'padrao'}
              type="button"
              role="radio"
              aria-checked={marcado}
              className={cx('mz-modelo', marcado && 'mz-modelo-marcado')}
              onClick={() => enviar({ tipo: 'escolherModelo', agente: a.id, modelo: m.id })}
            >
              <span className="mz-modelo-marca" aria-hidden>
                {marcado && <Check size={12} strokeWidth={2.5} />}
              </span>
              <span className="mz-modelo-rotulo">{m.rotulo}</span>
              {m.id && m.id !== m.rotulo && <span className="mz-modelo-id mz-mono">{m.id}</span>}
            </button>
          )
        })}
      </div>

      <div className="mz-conta-acoes">
        {chave ? (
          <>
            <Botao variante="secundario" icone={Trash2} onClick={() => enviar({ tipo: 'removerChave', agente: a.id })}>
              Remover chave
            </Botao>
            <Botao variante="fantasma" icone={LogIn} onClick={() => enviar({ tipo: 'entrar', agente: a.id })}>
              Entrar com a conta
            </Botao>
          </>
        ) : (
          <>
            <Botao variante="secundario" icone={LogOut} onClick={() => enviar({ tipo: 'sair', agente: a.id })}>
              Sair
            </Botao>
            {a.aceitaChave && (
              <Botao variante="fantasma" icone={KeyRound} onClick={() => enviar({ tipo: 'definirChave', agente: a.id })}>
                Usar chave de API
              </Botao>
            )}
          </>
        )}
      </div>
      {a.binario && (
        <p className="mz-conta-binario mz-mono" title={a.binario}>
          {a.binario}
        </p>
      )}
    </div>
  )
}
