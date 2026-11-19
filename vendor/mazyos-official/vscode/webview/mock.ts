// Dados de mentira pra abrir a interface no navegador (webview/dev.html), sem o editor.
// Imita o host: responde às intenções, manda `estado`, `execucao`, `evento` e `aviso`.
// Cenários por `?cenario=normal|vazio|nao-instalado|verificando`.
import type {
  AgenteId,
  AgenteInfo,
  Estado,
  EventoExecucao,
  Execucao,
  ParaExtensao,
  ParaWebview,
  Skill,
} from '../src/shared/protocolo'
import type { Canal } from './ponte'

type Entregar = (mensagem: ParaWebview) => void

const MIN = 60_000
const HORA = 60 * MIN
const DIA = 24 * HORA

const SKILLS: Skill[] = [
  { nome: 'instalar', rotulo: 'Instalar', descricao: 'Monta a pasta e faz a entrevista que cria a memória do negócio.', grupo: 'dia-a-dia', modo: 'conversa', icone: 'sunrise' },
  { nome: 'abrir', rotulo: 'Abrir o dia', descricao: 'Resume o contexto em cinco linhas e pergunta o que vamos fazer.', grupo: 'dia-a-dia', modo: 'tarefa', icone: 'sun-medium', exemplo: 'Abre o dia e me diz o que tá pendente' },
  { nome: 'atualizar', rotulo: 'Atualizar a memória', descricao: 'Compara a memória com o que tá na pasta e propõe o que atualizar.', grupo: 'dia-a-dia', modo: 'conversa', icone: 'refresh-cw' },
  { nome: 'salvar', rotulo: 'Salvar no GitHub', descricao: 'Faz commit e push, até pra quem nunca usou git.', grupo: 'dia-a-dia', modo: 'tarefa', icone: 'cloud-upload', exemplo: 'Salva tudo no GitHub' },
  { nome: 'mapear-rotinas', rotulo: 'Mapear rotinas', descricao: 'Pergunta o que você repete toda semana e cria uma skill pra cada coisa.', grupo: 'dia-a-dia', modo: 'conversa', icone: 'route' },
  { nome: 'novo-projeto', rotulo: 'Novo projeto', descricao: 'Cria uma pasta isolada pra um cliente ou iniciativa, com contexto próprio.', grupo: 'dia-a-dia', modo: 'conversa', icone: 'folder-plus' },
  { nome: 'carrossel', rotulo: 'Carrossel', descricao: 'Carrossel pro Instagram na identidade da marca, com a legenda pronta.', grupo: 'conteudo', modo: 'tarefa', icone: 'gallery-horizontal', exemplo: 'Um carrossel de 6 slides sobre por que o pão de fermentação natural dura mais' },
  { nome: 'aprovar-post', rotulo: 'Aprovar post', descricao: 'Publica blog, Instagram e Facebook num comando só.', grupo: 'conteudo', modo: 'tarefa', icone: 'badge-check', exemplo: 'Aprova o post do pão de queijo que tá na fila' },
  { nome: 'publicar-tema', rotulo: 'Publicar um tema', descricao: 'Pega um tema e entrega artigo, carrossel e três legendas amarrados.', grupo: 'conteudo', modo: 'tarefa', icone: 'newspaper', exemplo: 'Tema: como escolher o pão certo pro café da manhã' },
  { nome: 'seo', rotulo: 'SEO', descricao: 'Oito passos: demanda, concorrência, Google Meu Negócio, on-page e GEO.', grupo: 'conteudo', modo: 'tarefa', icone: 'search', exemplo: 'Faz o SEO da padaria pra Campinas' },
  { nome: 'email-profissional', rotulo: 'E-mail profissional', descricao: 'Rascunha um e-mail a partir do que você contar.', grupo: 'conteudo', modo: 'tarefa', icone: 'mail', exemplo: 'E-mail pro fornecedor de farinha pedindo prazo de 45 dias' },
  { nome: 'responder-avaliacoes', rotulo: 'Responder avaliações', descricao: 'Respostas humanas pras avaliações do Google.', grupo: 'conteudo', modo: 'tarefa', icone: 'message-square-heart', exemplo: 'Responde as avaliações novas do Google' },
  { nome: 'anuncio-google', rotulo: 'Anúncio no Google', descricao: 'Monta a campanha inteira num CSV pronto pro Google Ads Editor.', grupo: 'ads', modo: 'tarefa', icone: 'megaphone', exemplo: 'Campanha de encomenda de bolo em Campinas, R$ 30 por dia' },
  { nome: 'relatorio-ads', rotulo: 'Relatório de anúncios', descricao: 'Lê os exports do Google e do Meta Ads e mostra onde o dinheiro tá vazando.', grupo: 'ads', modo: 'tarefa', icone: 'chart-column', exemplo: 'Relatório da semana com os CSVs que tão em dados/' },
  { nome: 'prospecta-maps', rotulo: 'Prospectar no Maps', descricao: 'Busca empresas no Google Maps, confere o CNPJ e monta um site de prévia pra cada lead.', grupo: 'prospeccao', modo: 'conversa', icone: 'map-pin' },
  { nome: 'analisar-dados', rotulo: 'Analisar dados', descricao: 'Lê CSV, planilha ou PDF e devolve um resumo executivo.', grupo: 'producao', modo: 'tarefa', icone: 'table', exemplo: 'Analisa dados/vendas-outubro.csv' },
  { nome: 'criacao-canonica-de-skills', rotulo: 'Criar skills', descricao: 'Cria, refatora e audita skills com um método mais profundo.', grupo: 'producao', modo: 'conversa', icone: 'wand-sparkles' },
]

function agentes(verificando: boolean): AgenteInfo[] {
  const v = { estado: 'verificando' } as const
  return [
    {
      id: 'claude',
      nome: 'Claude Code',
      marca: 'Claude',
      descricao: 'Usa a sua conta Claude (Pro, Max ou Team) ou uma chave da API da Anthropic.',
      instalado: true,
      versao: '2.1.318',
      binario: '/Users/ana/.local/bin/claude',
      auth: verificando ? v : { estado: 'conectado', metodo: 'assinatura', conta: 'ana@padariasol.com.br', detalhe: 'Max' },
      modelos: [
        { id: 'opus', rotulo: 'Opus, o mais capaz' },
        { id: 'sonnet', rotulo: 'Sonnet, equilíbrio' },
        { id: 'haiku', rotulo: 'Haiku, o mais rápido' },
      ],
      modelo: 'opus',
      aceitaChave: true,
      comandoInstalar: 'npm install -g @anthropic-ai/claude-code',
    },
    {
      id: 'codex',
      nome: 'Codex',
      marca: 'GPT',
      descricao: 'Usa a sua conta do ChatGPT (Plus, Pro ou Business) ou uma chave da API da OpenAI.',
      instalado: true,
      versao: '0.166.0',
      binario: '/opt/homebrew/bin/codex',
      auth: verificando ? v : { estado: 'conectado', metodo: 'chave', detalhe: 'Chave da OpenAI' },
      modelos: [
        { id: 'gpt-6-luna', rotulo: 'GPT-6 Luna' },
        { id: 'gpt-5.6-terra', rotulo: 'GPT-5.6 Terra' },
        { id: 'gpt-5.6-luna', rotulo: 'GPT-5.6 Luna' },
      ],
      modelo: null,
      aceitaChave: true,
      comandoInstalar: 'npm install -g @openai/codex',
    },
    {
      id: 'antigravity',
      nome: 'Antigravity',
      marca: 'Antigravity',
      descricao: 'Usa a sua conta Google, pela cota do Antigravity (Gemini, Claude e GPT-OSS).',
      instalado: true,
      versao: '1.5.0',
      binario: '/Users/ana/.local/bin/agy',
      auth: verificando ? v : { estado: 'desconectado' },
      modelos: [
        { id: 'gemini-4-argon-high', rotulo: 'Gemini 4 Argon (alto)' },
        { id: 'gemini-4-argon-medium', rotulo: 'Gemini 4 Argon (médio)' },
        { id: 'gemini-3.8-flash-medium', rotulo: 'Gemini 3.8 Flash' },
        { id: 'claude-sonnet-5-5-medium', rotulo: 'Claude Sonnet 5.5' },
        { id: 'gpt-oss-120b-medium', rotulo: 'GPT-OSS 120B' },
      ],
      modelo: 'gemini-4-argon-high',
      aceitaChave: false,
      comandoInstalar: 'curl -fsSL https://antigravity.google/cli/install.sh | sh',
    },
  ]
}

const RESPOSTA_AVALIACOES = `## Cinco respostas prontas

Escrevi no tom da casa: próximo, sem frase pronta, citando o que cada pessoa contou. Ficou tudo em \`saidas/avaliacoes-2026-11-05.md\` pra você colar no Google.

**Marta S.** (3 estrelas, reclamou da fila de sábado)
> Marta, você tem razão: sábado às 9h a fila dobra a esquina e isso não é justo com quem vem cedo. A partir deste sábado dá pra encomendar pelo WhatsApp até sexta às 18h e retirar no balcão da lateral, sem fila. Obrigada por avisar, e volta pra provar o de nozes!

**Ricardo T.** (5 estrelas)
> Ricardo, que alegria saber que o italiano chegou inteiro na viagem pra Holambra. É a casca grossa que segura, fermentação de 36 horas. Até a próxima!

**Fernanda L.** (5 estrelas)
> Fernanda, o bolo de laranja foi o primeiro que a gente fez quando abriu. Contar que virou o do aniversário da sua filha deixou a cozinha inteira boba aqui.

1. Respondi primeiro a da Marta, porque crítica sem resposta pesa mais.
2. Nenhuma resposta repete o agradecimento de abertura.
3. Deixei as duas mais curtas sem emoji, do jeito que tá na sua preferência.

| Avaliação | Nota | Tema | Prioridade |
| --- | :---: | --- | --- |
| Marta S. | 3 | Fila de sábado | Alta |
| Ricardo T. | 5 | Pão italiano | Normal |
| Fernanda L. | 5 | Bolo de laranja | Normal |
| João P. | 5 | Café | Normal |
| Lúcia M. | 4 | Preço do sourdough | Média |

Quer que eu transforme a resposta da Marta num aviso pro Instagram sobre a retirada sem fila? Dá pra usar a skill de carrossel ou um post único.`

const RESPOSTA_CARROSSEL = `## Carrossel pronto: seis slides

Montei na identidade da Padaria Sol (creme, marrom da casca e o amarelo do logo) e renderizei os PNGs em 1080×1350.

1. **Capa:** "Por que o nosso pão dura três dias?"
2. **A massa-mãe:** fermento vivo, alimentado todo dia desde 2019.
3. **36 horas:** a fermentação longa que deixa a casca grossa.
4. **Acidez natural:** o que segura o mofo sem conservante.
5. **Como guardar:** pano de algodão, nunca na geladeira.
6. **Chamada:** encomenda pelo WhatsApp até sexta, retira sábado sem fila.

A legenda tá em \`saidas/carrossel-fermentacao/legenda.md\` e os slides em \`saidas/carrossel-fermentacao/\`. Se quiser, troco a capa por uma foto do forno.`

function execucoesIniciais(agora: number): Execucao[] {
  const inicioRodando = agora - 18_000
  return [
    {
      id: 'a7f3',
      agente: 'claude',
      modelo: 'opus',
      skill: 'carrossel',
      pedido: 'Um carrossel de 6 slides sobre por que o pão de fermentação natural dura mais, pra postar sábado de manhã',
      inicio: inicioRodando,
      estado: 'rodando',
      eventos: [
        { tipo: 'inicio', modelo: 'claude-opus-5-5', sessao: 'sess-a7f3' },
        { tipo: 'texto', texto: 'Vou ler a memória e o guia de identidade antes de montar os slides.' },
        { tipo: 'ferramenta', id: 't1', nome: 'Read', resumo: 'Leu _memoria/empresa.md', estado: 'ok' },
        { tipo: 'ferramenta', id: 't2', nome: 'Read', resumo: 'Leu identidade/design-guide.md', estado: 'ok' },
        { tipo: 'ferramenta', id: 't3', nome: 'Read', resumo: 'Leu skills/carrossel/template.html', estado: 'ok' },
      ],
    },
    {
      id: 'b2c9',
      agente: 'claude',
      modelo: 'sonnet',
      skill: 'responder-avaliacoes',
      pedido: 'Responde as 5 avaliações novas do Google. A da Marta reclamou da fila de sábado, quero explicar a retirada sem fila.',
      inicio: agora - 3 * HORA,
      fim: agora - 3 * HORA + 74_000,
      estado: 'ok',
      sessao: 'sess-b2c9',
      custoUsd: 0.38,
      resposta: RESPOSTA_AVALIACOES,
      eventos: [
        { tipo: 'inicio', modelo: 'claude-sonnet-5-5', sessao: 'sess-b2c9' },
        { tipo: 'ferramenta', id: 'u1', nome: 'Read', resumo: 'Leu _memoria/preferencias.md', estado: 'ok' },
        { tipo: 'ferramenta', id: 'u2', nome: 'Read', resumo: 'Leu dados/avaliacoes-google.csv', estado: 'ok' },
        { tipo: 'texto', texto: 'Cinco avaliações novas desde segunda. Uma de 3 estrelas, sobre a fila de sábado: começo por ela.' },
        { tipo: 'ferramenta', id: 'u3', nome: 'Write', resumo: 'Escreveu saidas/avaliacoes-2026-11-05.md', estado: 'ok' },
        { tipo: 'arquivo', caminho: 'saidas/avaliacoes-2026-11-05.md', acao: 'criado' },
        { tipo: 'aviso', texto: 'O CSV tinha duas linhas repetidas; considerei só uma de cada.' },
        { tipo: 'texto', texto: RESPOSTA_AVALIACOES },
        { tipo: 'fim', status: 'ok', resposta: RESPOSTA_AVALIACOES, custoUsd: 0.38, duracaoMs: 74_000, sessao: 'sess-b2c9' },
      ],
    },
    {
      id: 'c1d0',
      agente: 'codex',
      skill: 'relatorio-ads',
      pedido: 'Relatório da semana com os CSVs do Google Ads e do Meta que tão em dados/',
      inicio: agora - 26 * HORA,
      fim: agora - 26 * HORA + 6_000,
      estado: 'erro',
      eventos: [
        { tipo: 'inicio', modelo: 'gpt-5.5-codex', sessao: 'th-c1d0' },
        {
          tipo: 'fim',
          status: 'erro',
          resposta: '',
          duracaoMs: 6_000,
          erro: "The 'gpt-5.5-codex' model is not supported when using Codex with a ChatGPT account.",
        },
      ],
    },
    {
      id: 'e9a1',
      agente: 'claude',
      modelo: 'haiku',
      pedido: 'Escreve um post curto sobre o Dia do Pão, sem promoção, só contando a história do forno',
      inicio: agora - 2 * DIA - 3 * HORA,
      fim: agora - 2 * DIA - 3 * HORA + 21_000,
      estado: 'cancelado',
      eventos: [
        { tipo: 'inicio', modelo: 'claude-haiku-5' },
        { tipo: 'texto', texto: 'Começo pela história do forno a lenha que veio de Minas em 2019...' },
        { tipo: 'fim', status: 'cancelado', resposta: '', duracaoMs: 21_000 },
      ],
    },
  ]
}

function estadoBase(cenario: string, agora: number): Estado {
  const semPasta = cenario === 'vazio'
  const naoInstalado = cenario === 'nao-instalado'
  const instalado = !semPasta && !naoInstalado
  return {
    ambiente: { editor: 'vscode', versao: '0.1.0', versaoPlugin: '1.4.0', plataforma: /Mac/i.test(navigator.platform) ? 'mac' : 'windows' },
    workspace: {
      raiz: semPasta ? null : '/Users/ana/Negócios/Padaria Sol',
      instalado,
      nome: instalado ? 'Padaria Sol' : null,
      negocio: instalado ? 'Padaria de fermentação natural no Cambuí, em Campinas. Pão, café e encomenda de bolo.' : null,
      foco: instalado ? 'Lotar a fornada de sábado com encomendas pelo WhatsApp' : null,
      tom: instalado ? 'Próximo e bem-humorado, sem gíria demais' : null,
      arquivos: instalado
        ? [
            { chave: 'empresa', rotulo: 'Empresa', caminho: '_memoria/empresa.md', existe: true, preenchido: true, mtimeMs: agora - 2 * DIA },
            { chave: 'preferencias', rotulo: 'Preferências e tom', caminho: '_memoria/preferencias.md', existe: true, preenchido: true, mtimeMs: agora - 5 * DIA },
            { chave: 'estrategia', rotulo: 'Estratégia e foco', caminho: '_memoria/estrategia.md', existe: true, preenchido: true, mtimeMs: agora - 40 * MIN },
            { chave: 'design', rotulo: 'Identidade visual', caminho: 'identidade/design-guide.md', existe: true, preenchido: false, mtimeMs: agora - 9 * DIA },
          ]
        : [],
      lidoEm: agora - 3 * MIN,
    },
    agentes: agentes(cenario === 'verificando'),
    skills: SKILLS,
    execucoes: instalado ? execucoesIniciais(agora) : [],
    config: { agente: 'claude', permissoes: 'edicoes', abrirConsoleAoRodar: true },
  }
}

type Passo = { espera: number; evento: EventoExecucao }

/** Fatia o texto em pedaços de umas poucas palavras, sem perder nada. */
function fatiar(texto: string, tamanho: number): string[] {
  const pedacos: string[] = []
  let atual = ''
  for (const palavra of texto.split(/(?<=\s)/)) {
    if (atual && atual.length + palavra.length > tamanho) {
      pedacos.push(atual)
      atual = ''
    }
    atual += palavra
  }
  if (atual) pedacos.push(atual)
  return pedacos
}

function roteiroDoCarrossel(): Passo[] {
  const passos: Passo[] = [
    { espera: 1400, evento: { tipo: 'texto', texto: 'Tenho o tom e as cores. Agora os seis slides.' } },
    { espera: 900, evento: { tipo: 'ferramenta', id: 't4', nome: 'Write', resumo: 'Escrevendo saidas/carrossel-fermentacao/slides.html', estado: 'rodando' } },
    { espera: 1600, evento: { tipo: 'ferramenta', id: 't4', nome: 'Write', resumo: 'Escreveu saidas/carrossel-fermentacao/slides.html', estado: 'ok' } },
    { espera: 200, evento: { tipo: 'arquivo', caminho: 'saidas/carrossel-fermentacao/slides.html', acao: 'criado' } },
    { espera: 700, evento: { tipo: 'ferramenta', id: 't5', nome: 'Bash', resumo: 'Renderizando os 6 slides em PNG', estado: 'rodando' } },
    { espera: 2600, evento: { tipo: 'ferramenta', id: 't5', nome: 'Bash', resumo: 'Renderizou os 6 slides em PNG', estado: 'ok' } },
    { espera: 200, evento: { tipo: 'arquivo', caminho: 'saidas/carrossel-fermentacao/slide-1.png', acao: 'criado' } },
    { espera: 120, evento: { tipo: 'arquivo', caminho: 'saidas/carrossel-fermentacao/slide-2.png', acao: 'criado' } },
    { espera: 500, evento: { tipo: 'ferramenta', id: 't6', nome: 'Write', resumo: 'Escreveu saidas/carrossel-fermentacao/legenda.md', estado: 'ok' } },
    { espera: 150, evento: { tipo: 'arquivo', caminho: 'saidas/carrossel-fermentacao/legenda.md', acao: 'criado' } },
  ]
  // A resposta chega aos pedaços, como num streaming.
  const pedacos = fatiar(RESPOSTA_CARROSSEL, 28)
  pedacos.forEach((p, i) => passos.push({ espera: i === 0 ? 900 : 70, evento: { tipo: 'texto', texto: p } }))
  passos.push({ espera: 400, evento: { tipo: 'fim', status: 'ok', resposta: RESPOSTA_CARROSSEL, custoUsd: 0.61, sessao: 'sess-a7f3' } })
  return passos
}

function roteiroGenerico(pedido: string, skill: Skill | undefined, conectado: boolean, marca: string): Passo[] {
  if (!conectado) {
    return [
      {
        espera: 1200,
        evento: {
          tipo: 'fim',
          status: 'erro',
          resposta: '',
          erro: `authentication required: você não entrou no ${marca}.`,
        },
      },
    ]
  }
  const arquivo = `saidas/${skill?.nome ?? 'pedido'}-${new Date().toISOString().slice(0, 10)}.md`
  const resposta = `## Feito\n\nPedido: *${pedido || skill?.exemplo || skill?.rotulo || 'sem texto'}*.\n\nDeixei o resultado em \`${arquivo}\`. Isto é uma pré-visualização: no editor quem responde é o agente de verdade.\n\n- Li a memória da Padaria Sol\n- Segui o tom: **próximo e bem-humorado**\n- Nada foi publicado`
  const passos: Passo[] = [
    { espera: 500, evento: { tipo: 'inicio', modelo: 'padrão' } },
    { espera: 700, evento: { tipo: 'ferramenta', id: 'g1', nome: 'Read', resumo: 'Leu _memoria/empresa.md', estado: 'ok' } },
    { espera: 600, evento: { tipo: 'ferramenta', id: 'g2', nome: 'Write', resumo: `Escrevendo ${arquivo}`, estado: 'rodando' } },
    { espera: 1400, evento: { tipo: 'ferramenta', id: 'g2', nome: 'Write', resumo: `Escreveu ${arquivo}`, estado: 'ok' } },
    { espera: 100, evento: { tipo: 'arquivo', caminho: arquivo, acao: 'criado' } },
  ]
  const pedacos = fatiar(resposta, 24)
  pedacos.forEach((p) => passos.push({ espera: 60, evento: { tipo: 'texto', texto: p } }))
  passos.push({ espera: 300, evento: { tipo: 'fim', status: 'ok', resposta, custoUsd: 0.07 } })
  return passos
}

export function criarMock(entregar: Entregar): Canal {
  const params = new URLSearchParams(location.search)
  let cenario = params.get('cenario') ?? 'normal'
  // `?so=1` deixa uma execução só, pra conferir o console sem a lista lateral.
  const montarEstado = (c: string): Estado => {
    const base = estadoBase(c, Date.now())
    return params.get('so') === '1' ? { ...base, execucoes: base.execucoes.slice(0, 1) } : base
  }
  let estado = montarEstado(cenario)
  const timers = new Map<string, number>()
  let roteiroInicialFeito = false
  let contador = 1

  const mandarEstado = () => entregar({ tipo: 'estado', estado: structuredClone(estado) })
  const aviso = (texto: string, nivel: 'info' | 'erro' | 'ok' = 'info') => entregar({ tipo: 'aviso', texto, nivel })

  const mudarAgente = (id: AgenteId, mudar: (a: AgenteInfo) => AgenteInfo) => {
    estado = { ...estado, agentes: estado.agentes.map((a) => (a.id === id ? mudar(a) : a)) }
    mandarEstado()
  }
  const marca = (id: AgenteId) => estado.agentes.find((a) => a.id === id)?.marca ?? id

  const atualizarExecucao = (id: string, evento: EventoExecucao) => {
    estado = {
      ...estado,
      execucoes: estado.execucoes.map((e) => {
        if (e.id !== id) return e
        const nova: Execucao = { ...e, eventos: [...e.eventos, evento] }
        if (evento.tipo === 'fim') {
          nova.estado = evento.status
          nova.resposta = evento.resposta
          nova.fim = Date.now()
          if (evento.custoUsd !== undefined) nova.custoUsd = evento.custoUsd
        }
        return nova
      }),
    }
  }

  const tocar = (id: string, passos: Passo[]) => {
    let i = 0
    const proximo = () => {
      const passo = passos[i++]
      if (!passo) {
        timers.delete(id)
        return
      }
      timers.set(
        id,
        window.setTimeout(() => {
          atualizarExecucao(id, passo.evento)
          entregar({ tipo: 'evento', id, evento: passo.evento })
          if (passo.evento.tipo === 'fim') {
            timers.delete(id)
            if (passo.evento.status === 'ok') aviso('Pronto. O Mazy terminou.', 'ok')
            return
          }
          proximo()
        }, passo.espera),
      )
    }
    proximo()
  }

  const novaExecucao = (pedido: string, skillNome?: string) => {
    const agente = estado.config.agente
    const info = estado.agentes.find((a) => a.id === agente)
    const skill = estado.skills.find((s) => s.nome === skillNome)
    const execucao: Execucao = {
      id: `m${contador++}`,
      agente,
      modelo: info?.modelo ?? undefined,
      skill: skillNome,
      pedido: pedido || skill?.exemplo || '',
      inicio: Date.now(),
      estado: 'rodando',
      eventos: [],
    }
    estado = { ...estado, execucoes: [execucao, ...estado.execucoes].slice(0, 20) }
    entregar({ tipo: 'execucao', execucao: structuredClone(execucao) })
    tocar(execucao.id, roteiroGenerico(pedido, skill, info?.auth.estado === 'conectado', info?.marca ?? agente))
  }

  const tratar = (m: ParaExtensao) => {
    switch (m.tipo) {
      case 'pronto': {
        const espera = cenario === 'verificando' ? 1100 : 250
        window.setTimeout(() => {
          estado = montarEstado(cenario)
          mandarEstado()
          if (cenario === 'verificando') {
            window.setTimeout(() => {
              estado = { ...estado, agentes: agentes(false) }
              mandarEstado()
            }, 2600)
          }
          if (!roteiroInicialFeito && estado.execucoes.some((e) => e.id === 'a7f3')) {
            roteiroInicialFeito = true
            tocar('a7f3', roteiroDoCarrossel())
          }
        }, espera)
        return
      }
      case 'recarregar':
        estado = { ...estado, workspace: { ...estado.workspace, lidoEm: Date.now() } }
        mandarEstado()
        aviso('Memória relida.', 'ok')
        return
      case 'instalar':
        aviso('Abri a conversa de instalação num terminal. Responde as perguntas por lá.')
        window.setTimeout(() => {
          cenario = 'normal'
          estado = { ...estadoBase('normal', Date.now()), execucoes: [], agentes: estado.agentes, config: estado.config }
          mandarEstado()
          aviso('O MazyOS tá ligado nesta pasta.', 'ok')
        }, 3000)
        return
      case 'rodar':
        novaExecucao(m.pedido, m.skill)
        return
      case 'continuar': {
        const anterior = estado.execucoes.find((e) => e.id === m.id)
        novaExecucao(m.pedido, anterior?.skill)
        return
      }
      case 'conversar': {
        const skill = estado.skills.find((s) => s.nome === m.skill)
        aviso(`Abri "${skill?.rotulo ?? m.skill}" num terminal com o ${marca(estado.config.agente)}.`)
        return
      }
      case 'cancelar': {
        const t = timers.get(m.id)
        if (t !== undefined) window.clearTimeout(t)
        timers.delete(m.id)
        const fim: EventoExecucao = { tipo: 'fim', status: 'cancelado', resposta: '' }
        atualizarExecucao(m.id, fim)
        entregar({ tipo: 'evento', id: m.id, evento: fim })
        return
      }
      case 'abrirConsole': {
        const url = new URL(location.href)
        url.searchParams.set('view', 'console')
        if (m.id) url.searchParams.set('exec', m.id)
        aviso(`No editor, o console abre ao lado. Aqui: ${url.search}`)
        return
      }
      case 'abrirArquivo':
        aviso(`Abrindo ${m.caminho}`)
        return
      case 'abrirPasta':
        aviso(`Abrindo a pasta ${m.caminho}`)
        return
      case 'escolherAgente':
        estado = { ...estado, config: { ...estado.config, agente: m.agente } }
        mandarEstado()
        return
      case 'escolherModelo':
        mudarAgente(m.agente, (a) => ({ ...a, modelo: m.modelo }))
        return
      case 'entrar': {
        const ag = m.agente
        aviso(ag === 'antigravity' ? 'Abri o Antigravity num terminal. Entra com a conta Google no navegador.' : `Abri o login do ${marca(ag)} no navegador.`)
        mudarAgente(ag, (a) => ({ ...a, auth: { estado: 'verificando' } }))
        window.setTimeout(() => {
          const detalhe = ag === 'antigravity' ? 'Google' : ag === 'codex' ? 'ChatGPT Plus' : 'Pro'
          mudarAgente(ag, (a) => ({ ...a, auth: { estado: 'conectado', metodo: 'assinatura', conta: 'ana@padariasol.com.br', detalhe } }))
          aviso(`Conectado no ${marca(ag)}.`, 'ok')
        }, 2200)
        return
      }
      case 'sair':
        mudarAgente(m.agente, (a) => ({ ...a, auth: { estado: 'desconectado' } }))
        aviso(`Você saiu do ${marca(m.agente)}.`)
        return
      case 'definirChave':
        mudarAgente(m.agente, (a) => ({ ...a, auth: { estado: 'conectado', metodo: 'chave', detalhe: m.agente === 'claude' ? 'Chave da Anthropic' : 'Chave da OpenAI' } }))
        aviso('Chave guardada no cofre do editor.', 'ok')
        return
      case 'removerChave':
        mudarAgente(m.agente, (a) => ({ ...a, auth: { estado: 'desconectado' } }))
        aviso('Chave removida.')
        return
      case 'instalarAgente':
        aviso(`Abri um terminal com o comando de instalação do ${marca(m.agente)}.`)
        window.setTimeout(() => mudarAgente(m.agente, (a) => ({ ...a, instalado: true, auth: { estado: 'desconectado' } })), 2500)
        return
      case 'copiar':
        void navigator.clipboard?.writeText(m.texto).catch(() => undefined)
        return
      case 'salvarSaida':
        aviso(`Salvo em saidas/resposta-${m.id}.md`, 'ok')
        return
      case 'configurar':
        estado = { ...estado, config: { ...estado.config, [m.chave]: m.valor } }
        mandarEstado()
        return
      case 'abrirExterno':
        window.open(m.url, '_blank', 'noopener')
        return
    }
  }

  const memoria = (() => {
    try {
      return JSON.parse(sessionStorage.getItem('mazyos-dev') ?? '{}') as Record<string, unknown>
    } catch {
      return {}
    }
  })()

  return {
    enviar: (m) => {
      console.debug('[mazyos → host]', m)
      tratar(m)
    },
    lerTudo: () => memoria,
    gravarTudo: (dados) => {
      Object.assign(memoria, dados)
      try {
        sessionStorage.setItem('mazyos-dev', JSON.stringify(memoria))
      } catch {
        /* sem armazenamento, segue em memória */
      }
    },
  }
}
