// Cabeçalho do negócio e as telas de quando ainda não tem negócio (sem pasta, pasta sem MazyOS).
import { FolderOpen, Sparkles } from 'lucide-react'
import type { Estado } from '../../src/shared/protocolo'
import { enviar } from '../ponte'
import { haQuanto, nomeDoArquivo, useAgora } from '../util'
import { Botao, MarcaMazy } from './Botoes'
import '../estilos/negocio.css'

export function Negocio({ estado }: { estado: Estado }) {
  const agora = useAgora(30_000)
  const ws = estado.workspace
  const nome = ws.nome ?? (ws.raiz ? nomeDoArquivo(ws.raiz) : 'Seu negócio')
  const estrategia = ws.arquivos.find((a) => a.chave === 'estrategia')
  return (
    <header className="mz-negocio">
      <h1 className="mz-negocio-nome">{nome}</h1>
      {ws.negocio && <p className="mz-negocio-faz">{ws.negocio}</p>}

      {ws.foco ? (
        <figure className="mz-foco">
          <figcaption>Foco agora</figcaption>
          <blockquote>{ws.foco}</blockquote>
        </figure>
      ) : (
        <button
          type="button"
          className="mz-foco mz-foco-vazio"
          onClick={() => enviar({ tipo: 'abrirArquivo', caminho: estrategia?.caminho ?? '_memoria/estrategia.md' })}
        >
          <span className="mz-foco-rotulo">Sem foco definido</span>
          <span>Escreve o que importa nesta semana em estrategia.md e o Mazy passa a puxar tudo pra isso.</span>
        </button>
      )}

      {ws.tom && (
        <p className="mz-negocio-tom">
          <span className="mz-calado">Tom</span> {ws.tom}
        </p>
      )}
      <p className="mz-negocio-lido">
        <span className="mz-ponto" data-estado="ok" aria-hidden />
        <span>Memória lida {haQuanto(ws.lidoEm, agora)}</span>
      </p>
    </header>
  )
}

export function SemPasta() {
  return (
    <div className="mz-convite">
      <span className="mz-convite-marca">
        <FolderOpen aria-hidden size={22} strokeWidth={1.75} />
      </span>
      <h1 className="mz-convite-titulo">Abre a pasta do seu negócio.</h1>
      <p>O MazyOS trabalha dentro de uma pasta: a memória da empresa, os dados e tudo que ele cria ficam nela, no seu computador.</p>
      <Botao variante="marca" icone={FolderOpen} cheio onClick={() => enviar({ tipo: 'abrirPastaDoNegocio' })}>
        Abrir uma pasta
      </Botao>
      <p className="mz-calado">Pode ser uma pasta nova, com o nome da empresa.</p>
    </div>
  )
}

export function BoasVindas({ estado }: { estado: Estado }) {
  const pasta = estado.workspace.raiz ? nomeDoArquivo(estado.workspace.raiz) : 'esta pasta'
  return (
    <div className="mz-convite mz-boas-vindas">
      <span className="mz-convite-marca">
        <MarcaMazy tamanho={22} />
      </span>
      <h1 className="mz-convite-titulo">Vamos ligar o MazyOS aqui.</h1>
      <p className="mz-convite-pasta mz-mono" title={estado.workspace.raiz ?? undefined}>
        {pasta}
      </p>
      <p>
        São 10 perguntas sobre o seu negócio, numa conversa no terminal ao lado. No fim, a pasta ganha a memória da empresa e o Mazy passa a te
        conhecer.
      </p>
      <Botao variante="marca" icone={Sparkles} cheio onClick={() => enviar({ tipo: 'instalar' })}>
        Ligar o MazyOS nesta pasta
      </Botao>
      <p className="mz-calado mz-convite-nota">Quem conduz a conversa é o agente escolhido aqui embaixo.</p>
    </div>
  )
}

export function Carregando() {
  return (
    <div className="mz-carregando" role="status" aria-live="polite">
      <span className="mz-sr">Lendo a pasta...</span>
      <span className="mz-esqueleto" style={{ width: '62%', height: 26 }} />
      <span className="mz-esqueleto" style={{ width: '92%' }} />
      <span className="mz-esqueleto" style={{ width: '74%' }} />
      <span className="mz-esqueleto" style={{ width: '100%', height: 54, marginTop: 12 }} />
    </div>
  )
}
