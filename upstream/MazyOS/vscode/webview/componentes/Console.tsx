// O console do Mazy: uma execução por vez, com a linha do tempo e a resposta.
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ArrowDown, ChevronDown, CircleStop, Clock, LogIn, RotateCcw, Save } from 'lucide-react'
import type { Estado, Execucao } from '../../src/shared/protocolo'
import { useGuardado, useLoja } from '../estado'
import { iconeDaSkill } from '../icones'
import { Markdown } from '../markdown'
import { enviar, lerGuardado } from '../ponte'
import {
  arquivosDaExecucao,
  atalhoEnviar,
  cx,
  dolares,
  duracao,
  haQuanto,
  horaCurta,
  marcaDoAgente,
  relogio,
  rotuloDoModelo,
  ROTULO_ESTADO,
  tituloDaExecucao,
  useAgora,
} from '../util'
import { Botao, BotaoCopiar, MarcaMazy } from './Botoes'
import { Compositor } from './Compositor'
import { ChipArquivo, LinhaDoTempo, separarResposta } from './LinhaDoTempo'
import '../estilos/console.css'

const PONTO: Record<Execucao['estado'], string> = { rodando: 'rodando', ok: 'ok', erro: 'erro', cancelado: 'vazio' }

export function Console() {
  const { estado, novaExecucao } = useLoja()
  const [id, setId] = useState<string | null>(() => window.mazyos?.execucaoId ?? lerGuardado<string | null>('execucao', null))
  const [, guardarId] = useGuardado<string | null>('execucao', null)

  const escolher = (novo: string) => {
    setId(novo)
    guardarId(novo)
  }

  // Execução nova anunciada pelo host: o console pula pra ela.
  useEffect(() => {
    if (novaExecucao) escolher(novaExecucao.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [novaExecucao?.vez])

  if (!estado) {
    return (
      <div className="mz-app mz-console" data-agente="claude">
        <div className="mz-console-carregando" role="status">
          <span className="mz-esqueleto" style={{ width: 220, height: 30 }} />
          <span className="mz-esqueleto" style={{ width: 340 }} />
          <span className="mz-sr">Carregando o console...</span>
        </div>
      </div>
    )
  }

  const execucao = estado.execucoes.find((e) => e.id === id) ?? estado.execucoes[0]

  return (
    <div className="mz-app mz-console" data-agente={execucao?.agente ?? estado.config.agente}>
      <header className="mz-console-barra">
        <span className="mz-console-nome">
          <MarcaMazy tamanho={15} />
          <span>Console do Mazy</span>
        </span>
        {execucao && estado.execucoes.length > 1 && (
          <Seletor estado={estado} atual={execucao} aoEscolher={escolher} />
        )}
      </header>

      <div className="mz-console-corpo">
        {estado.execucoes.length > 1 && (
          <nav className="mz-trilho" aria-label="Execuções">
            <h2 className="mz-trilho-titulo">Execuções</h2>
            <ol>
              {estado.execucoes.map((e) => (
                <li key={e.id}>
                  <ItemTrilho estado={estado} execucao={e} atual={e.id === execucao?.id} aoEscolher={() => escolher(e.id)} />
                </li>
              ))}
            </ol>
          </nav>
        )}
        {execucao ? <Leitura key={execucao.id} estado={estado} execucao={execucao} /> : <SemExecucao estado={estado} />}
      </div>
    </div>
  )
}

function ItemTrilho({ estado, execucao: e, atual, aoEscolher }: { estado: Estado; execucao: Execucao; atual: boolean; aoEscolher: () => void }) {
  const agora = useAgora(e.estado === 'rodando' ? 1000 : 30_000)
  return (
    <button type="button" className="mz-trilho-item" data-agente={e.agente} aria-current={atual || undefined} onClick={aoEscolher}>
      <span className="mz-trilho-item-titulo">{tituloDaExecucao(e, estado)}</span>
      <span className="mz-trilho-item-meta">
        <span className="mz-ponto" data-estado={PONTO[e.estado]} aria-hidden />
        <span>{e.estado === 'rodando' ? `Rodando ${relogio(agora - e.inicio)}` : ROTULO_ESTADO[e.estado]}</span>
        {e.estado !== 'rodando' && <span className="mz-trilho-item-quando">{haQuanto(e.fim ?? e.inicio, agora)}</span>}
      </span>
    </button>
  )
}

/** Escolha de execução quando o console é estreito (sem a lista lateral). */
function Seletor({ estado, atual, aoEscolher }: { estado: Estado; atual: Execucao; aoEscolher: (id: string) => void }) {
  const [aberto, setAberto] = useState(false)
  const [ativo, setAtivo] = useState(0)
  const raiz = useRef<HTMLDivElement>(null)
  const botao = useRef<HTMLButtonElement>(null)
  const lista = useRef<HTMLUListElement>(null)
  const execucoes = estado.execucoes

  useEffect(() => {
    if (!aberto) return
    setAtivo(Math.max(0, execucoes.findIndex((e) => e.id === atual.id)))
    lista.current?.focus()
    const fora = (ev: MouseEvent) => {
      if (!raiz.current?.contains(ev.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto])

  const fechar = () => {
    setAberto(false)
    botao.current?.focus()
  }

  const teclas = (ev: KeyboardEvent<HTMLUListElement>) => {
    if (ev.key === 'ArrowDown') setAtivo((i) => Math.min(execucoes.length - 1, i + 1))
    else if (ev.key === 'ArrowUp') setAtivo((i) => Math.max(0, i - 1))
    else if (ev.key === 'Home') setAtivo(0)
    else if (ev.key === 'End') setAtivo(execucoes.length - 1)
    else if (ev.key === 'Enter' || ev.key === ' ') {
      const e = execucoes[ativo]
      if (e) aoEscolher(e.id)
      fechar()
    } else if (ev.key === 'Escape' || ev.key === 'Tab') fechar()
    else return
    ev.preventDefault()
  }

  return (
    <div className="mz-seletor" ref={raiz}>
      <button
        ref={botao}
        type="button"
        className="mz-seletor-botao"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-label={`Execução aberta: ${tituloDaExecucao(atual, estado)}. Trocar`}
        onClick={() => setAberto(!aberto)}
      >
        <Clock aria-hidden size={13} />
        <span>Outras execuções</span>
        <ChevronDown aria-hidden size={13} />
      </button>
      {aberto && (
        <ul
          ref={lista}
          className="mz-seletor-lista"
          role="listbox"
          tabIndex={-1}
          aria-label="Execuções"
          aria-activedescendant={`mz-op-${execucoes[ativo]?.id}`}
          onKeyDown={teclas}
        >
          {execucoes.map((e, i) => (
            <li
              key={e.id}
              id={`mz-op-${e.id}`}
              role="option"
              aria-selected={e.id === atual.id}
              data-ativo={i === ativo || undefined}
              data-agente={e.agente}
              className="mz-seletor-opcao"
              onMouseEnter={() => setAtivo(i)}
              onClick={() => {
                aoEscolher(e.id)
                fechar()
              }}
            >
              <span className="mz-ponto" data-estado={PONTO[e.estado]} aria-hidden />
              <span className="mz-seletor-opcao-titulo">{tituloDaExecucao(e, estado)}</span>
              <span className="mz-seletor-opcao-meta">{e.estado === 'rodando' ? 'Rodando' : haQuanto(e.fim ?? e.inicio)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SemExecucao({ estado }: { estado: Estado }) {
  const [texto, setTexto] = useState('')
  const marca = marcaDoAgente(estado, estado.config.agente)
  return (
    <main className="mz-coluna">
      <div className="mz-rolagem">
        <div className="mz-leitura mz-console-vazio">
          <h1 className="mz-ex-pedido">Nada rodou ainda.</h1>
          <p className="mz-calado">Pede alguma coisa aqui embaixo ou escolhe uma skill no painel do MazyOS. O que o {marca} fizer aparece passo a passo nesta tela.</p>
        </div>
      </div>
      <div className="mz-continuar">
        <Compositor
          valor={texto}
          aoMudar={setTexto}
          aoEnviar={() => {
            enviar({ tipo: 'rodar', pedido: texto.trim() })
            setTexto('')
          }}
          placeholder="Pede aí: um carrossel, um e-mail, um anúncio..."
          rotuloCampo="O que você quer que o Mazy faça"
          rotuloEnviar={`Enviar pro ${marca}`}
          rodape={<kbd className="mz-compositor-atalho">{atalhoEnviar(estado)}</kbd>}
        />
      </div>
    </main>
  )
}

type Falha = { tipo: 'modelo' | 'conta' | 'limite' | 'outro'; explicacao: string }

function entenderFalha(mensagem: string, marca: string): Falha {
  if (/model.*(not supported|unsupported|not found|not available|does not exist)|invalid model|unknown model/i.test(mensagem))
    return { tipo: 'modelo', explicacao: `O modelo escolhido não funciona com a conta conectada no ${marca}. Escolhe outro e tenta de novo.` }
  if (/auth|not logged|log ?in|unauthori[sz]ed|\b401\b|api key|credential/i.test(mensagem))
    return { tipo: 'conta', explicacao: `O ${marca} não reconheceu a sua conta. Entra de novo e tenta outra vez.` }
  if (/rate.?limit|quota|\b429\b|usage limit|limite/i.test(mensagem))
    return { tipo: 'limite', explicacao: `A conta do ${marca} bateu o limite de uso. Espera um pouco ou troca de agente no painel.` }
  return { tipo: 'outro', explicacao: `O ${marca} parou no meio do caminho. A mensagem dele tá aqui embaixo, se ajudar.` }
}

function Leitura({ estado, execucao: e }: { estado: Estado; execucao: Execucao }) {
  const rodando = e.estado === 'rodando'
  const agora = useAgora(1000, rodando)
  const rolagem = useRef<HTMLDivElement>(null)
  const [colado, setColado] = useState(true)
  const [texto, setTexto] = useGuardado(`continuar-${e.id}`, '')
  const [pedidoAberto, setPedidoAberto] = useState(false)

  const { itens, escrevendo } = separarResposta(e)
  const resposta = rodando ? escrevendo : (e.resposta ?? '')
  const fim = [...e.eventos].reverse().find((ev) => ev.tipo === 'fim')
  const erro = fim?.tipo === 'fim' ? fim.erro : undefined
  const custo = e.custoUsd ?? (fim?.tipo === 'fim' ? fim.custoUsd : undefined)
  const levou = e.fim ? e.fim - e.inicio : fim?.tipo === 'fim' && fim.duracaoMs ? fim.duracaoMs : rodando ? agora - e.inicio : undefined
  const arquivos = arquivosDaExecucao(e)
  const agente = estado.agentes.find((a) => a.id === e.agente)
  const marca = agente?.marca ?? e.agente
  const skill = estado.skills.find((s) => s.nome === e.skill)
  const IconeSkill = skill ? iconeDaSkill(skill.icone) : null
  const pedido = e.pedido.trim() || skill?.rotulo || 'Pedido sem texto'
  const longo = pedido.length > 220

  // Auto-rolagem: segue o fim enquanto roda, a não ser que a pessoa tenha subido.
  const tamanho = e.eventos.length + resposta.length
  useLayoutEffect(() => {
    const el = rolagem.current
    if (el && rodando && colado) el.scrollTop = el.scrollHeight
  }, [tamanho, rodando, colado])

  useLayoutEffect(() => {
    const el = rolagem.current
    if (el) el.scrollTop = rodando ? el.scrollHeight : 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const aoRolar = () => {
    const el = rolagem.current
    if (!el) return
    setColado(el.scrollHeight - el.scrollTop - el.clientHeight < 48)
  }

  const irProFim = () => {
    const el = rolagem.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    setColado(true)
  }

  const repetir = () => enviar(e.skill ? { tipo: 'rodar', skill: e.skill, pedido: e.pedido } : { tipo: 'rodar', pedido: e.pedido })
  const falha = e.estado === 'erro' ? entenderFalha(erro || e.resposta || '', marca) : null

  return (
    <main className="mz-coluna">
      <div className="mz-rolagem" ref={rolagem} onScroll={aoRolar}>
        <article className="mz-leitura" aria-busy={rodando || undefined}>
          <div className="mz-ex-meta">
            <span className="mz-ex-agente">
              <span className="mz-ex-agente-ponto" aria-hidden />
              {marca}
            </span>
            {e.modelo && <span className="mz-ex-etiqueta">{rotuloDoModelo(estado, e.agente, e.modelo).split(',')[0]}</span>}
            {skill && IconeSkill && (
              <span className="mz-ex-etiqueta">
                <IconeSkill aria-hidden size={12} strokeWidth={2} />
                {skill.rotulo}
              </span>
            )}
            <span className="mz-ex-estado" data-estado={e.estado}>
              <span className="mz-ponto" data-estado={PONTO[e.estado]} aria-hidden />
              {rodando ? `Rodando ${relogio(agora - e.inicio)}` : ROTULO_ESTADO[e.estado]}
            </span>
          </div>

          <h1 className={cx('mz-ex-pedido', longo && !pedidoAberto && 'mz-ex-pedido-cortado')}>{pedido}</h1>
          {longo && (
            <button type="button" className="mz-botao-mini mz-ex-pedido-mais" aria-expanded={pedidoAberto} onClick={() => setPedidoAberto(!pedidoAberto)}>
              {pedidoAberto ? 'Mostrar menos' : 'Ver o pedido inteiro'}
            </button>
          )}
          <div className="mz-ex-sob">
            <span className="mz-calado">
              Começou às {horaCurta(e.inicio)}
              {Date.now() - e.inicio > 20 * 3_600_000 ? `, ${haQuanto(e.inicio)}` : ''}
            </span>
            {rodando && (
              <Botao variante="secundario" icone={CircleStop} onClick={() => enviar({ tipo: 'cancelar', id: e.id })}>
                Cancelar
              </Botao>
            )}
          </div>

          <LinhaDoTempo itens={itens} rodando={rodando} />

          {rodando && !resposta && itens.length === 0 && (
            <p className="mz-ex-pensando" role="status">
              <span className="mz-ponto" data-estado="rodando" aria-hidden />O {marca} tá lendo a memória do negócio...
            </p>
          )}

          {resposta && (
            <section className="mz-resposta" aria-label={`Resposta do ${marca}`} aria-live={rodando ? 'off' : undefined}>
              <p className="mz-resposta-quem">
                {rodando ? `O ${marca} tá escrevendo` : `Resposta do ${marca}`}
                {!rodando && e.fim && <span className="mz-calado"> às {horaCurta(e.fim)}</span>}
              </p>
              <Markdown fonte={resposta} escrevendo={rodando} />
              {!rodando && (
                <div className="mz-resposta-acoes">
                  <BotaoCopiar texto={resposta} rotulo="Copiar a resposta" />
                  <Botao variante="secundario" icone={Save} onClick={() => enviar({ tipo: 'salvarSaida', id: e.id })}>
                    Salvar em saidas/
                  </Botao>
                </div>
              )}
            </section>
          )}

          {arquivos.length > 0 && !rodando && (
            <section className="mz-ex-arquivos" aria-labelledby={`arq-${e.id}`}>
              <h2 id={`arq-${e.id}`} className="mz-ex-arquivos-titulo">
                {arquivos.length === 1 ? 'O arquivo que ele mexeu' : `Os ${arquivos.length} arquivos que ele mexeu`}
              </h2>
              <div className="mz-ex-arquivos-lista">
                {arquivos.map((a) => (
                  <ChipArquivo key={a.caminho} caminho={a.caminho} acao={a.acao} />
                ))}
              </div>
            </section>
          )}

          {falha && (
            <section className="mz-falha" role="alert">
              <h2 className="mz-falha-titulo">Não deu certo.</h2>
              <p>{falha.explicacao}</p>
              {falha.tipo === 'modelo' && agente && (
                <div className="mz-falha-modelos" role="group" aria-label="Trocar o modelo">
                  {[{ id: null as string | null, rotulo: `Padrão do ${agente.nome}` }, ...agente.modelos].map((m) => (
                    <button
                      key={m.id ?? 'padrao'}
                      type="button"
                      className="mz-falha-modelo"
                      aria-pressed={(agente.modelo ?? null) === m.id}
                      onClick={() => enviar({ tipo: 'escolherModelo', agente: agente.id, modelo: m.id })}
                    >
                      {m.rotulo}
                    </button>
                  ))}
                </div>
              )}
              <div className="mz-falha-acoes">
                {falha.tipo === 'conta' && (
                  <Botao variante="principal" icone={LogIn} onClick={() => enviar({ tipo: 'entrar', agente: e.agente })}>
                    {e.agente === 'antigravity' ? 'Entrar com o Google' : `Entrar no ${marca}`}
                  </Botao>
                )}
                <Botao variante={falha.tipo === 'conta' ? 'secundario' : 'principal'} icone={RotateCcw} onClick={repetir}>
                  Tentar de novo
                </Botao>
              </div>
              {(erro || e.resposta) && (
                <details className="mz-falha-detalhe">
                  <summary>Mensagem do {agente?.nome ?? marca}</summary>
                  <pre className="mz-mono">{erro || e.resposta}</pre>
                </details>
              )}
            </section>
          )}

          {e.estado === 'cancelado' && (
            <section className="mz-cancelado">
              <p>Você cancelou. O que já tinha saído ficou aqui em cima.</p>
              <Botao variante="secundario" icone={RotateCcw} onClick={repetir}>
                Rodar de novo
              </Botao>
            </section>
          )}

          {(levou !== undefined || custo !== undefined) && !rodando && (
            <footer className="mz-ex-rodape">
              {levou !== undefined && <span>Levou {duracao(levou)}</span>}
              {custo !== undefined && <span>Custou {dolares(custo)}</span>}
              {e.sessao && (
                <span className="mz-mono" title="Sessão do agente">
                  {e.sessao}
                </span>
              )}
            </footer>
          )}
        </article>
      </div>

      {rodando && !colado && (
        <button type="button" className="mz-ir-pro-fim" onClick={irProFim}>
          <ArrowDown aria-hidden size={13} />
          Acompanhar ao vivo
        </button>
      )}

      <div className="mz-continuar">
        <Compositor
          valor={texto}
          aoMudar={setTexto}
          bloqueado={rodando}
          aoEnviar={() => {
            enviar({ tipo: 'continuar', id: e.id, pedido: texto.trim() })
            setTexto('')
          }}
          placeholder={rodando ? 'Espera terminar pra continuar...' : 'Continuar a conversa: ajusta, troca o tom, pede outra versão...'}
          rotuloCampo="Continuar a conversa"
          rotuloEnviar={`Continuar com o ${marca}`}
          linhasMax={6}
          rodape={
            <>
              <span className="mz-compositor-quem">
                <span className="mz-compositor-quem-ponto" aria-hidden />
                Continua com o {marca}
              </span>
              {!rodando && <kbd className="mz-compositor-atalho">{atalhoEnviar(estado)}</kbd>}
            </>
          }
        />
      </div>
    </main>
  )
}
