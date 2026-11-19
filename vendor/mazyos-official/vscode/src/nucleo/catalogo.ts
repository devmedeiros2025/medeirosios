// O catálogo das skills do MazyOS embutido: lê `mazyos/skills/*/SKILL.md`, pega
// `name` e `description` do frontmatter e junta com os metadados fixos da extensão
// (grupo, modo, ícone, exemplo). Sem `vscode`.
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import type { Grupo, Skill } from '../shared/protocolo'

type Meta = {
  rotulo: string
  /** Descrição curta pra interface, em segunda pessoa; substitui a do frontmatter. */
  descricao: string
  grupo: Grupo
  modo: Skill['modo']
  icone: string
  exemplo: string
}

/**
 * Metadados de cada skill, na ordem em que aparecem dentro do grupo.
 * Modo `conversa` = a skill entrevista o usuário em várias rodadas (abre no terminal).
 * As que só pedem uma confirmação pontual ficam em `tarefa`: o agente pergunta no fim e o
 * usuário responde pelo "continuar" do console.
 */
export const METADADOS: Readonly<Record<string, Meta>> = {
  // Pra tocar o dia a dia
  instalar: {
    rotulo: 'Ligar o MazyOS',
    descricao: 'Uma conversa de 10 perguntas e a pasta ganha a memória do seu negócio.',
    grupo: 'dia-a-dia',
    modo: 'conversa',
    icone: 'sparkles',
    exemplo: 'liga o MazyOS nesta pasta',
  },
  abrir: {
    rotulo: 'Abrir o dia',
    descricao: 'Resume o que está na memória e o foco do dia, pra começar sem repetir contexto.',
    grupo: 'dia-a-dia',
    modo: 'tarefa',
    icone: 'sunrise',
    exemplo: 'abre o dia com o resumo do negócio',
  },
  atualizar: {
    rotulo: 'Atualizar a memória',
    descricao: 'Passa pelo que mudou na pasta e atualiza a memória da empresa com você.',
    grupo: 'dia-a-dia',
    modo: 'conversa',
    icone: 'refresh-cw',
    exemplo: 'varre o projeto e atualiza a memória',
  },
  salvar: {
    rotulo: 'Salvar no GitHub',
    descricao: 'Guarda o trabalho no GitHub. Na primeira vez, configura o repositório.',
    grupo: 'dia-a-dia',
    modo: 'tarefa',
    icone: 'save',
    exemplo: 'salva o trabalho de hoje no GitHub',
  },
  'mapear-rotinas': {
    rotulo: 'Mapear rotinas',
    descricao: 'Levanta o que você faz toda semana e sugere skills pra automatizar.',
    grupo: 'dia-a-dia',
    modo: 'conversa',
    icone: 'route',
    exemplo: 'o que dá pra automatizar na minha semana?',
  },
  'novo-projeto': {
    rotulo: 'Novo projeto',
    descricao: 'Cria a pasta de um projeto ou cliente novo, com o contexto dele separado.',
    grupo: 'dia-a-dia',
    modo: 'conversa',
    icone: 'folder-plus',
    exemplo: 'novo projeto pro cliente Café Aurora',
  },
  // Conteúdo e SEO
  carrossel: {
    rotulo: 'Carrossel',
    descricao: 'Um carrossel pro Instagram com a sua identidade: texto, ordem dos slides e legenda.',
    grupo: 'conteudo',
    modo: 'tarefa',
    icone: 'gallery-horizontal',
    exemplo: 'um carrossel sobre os 3 erros que mais vejo em clientes novos',
  },
  'aprovar-post': {
    rotulo: 'Aprovar post',
    descricao: 'Revisa um post antes de publicar: tom, erros, gancho e chamada.',
    grupo: 'conteudo',
    modo: 'tarefa',
    icone: 'badge-check',
    exemplo: 'aprova o post sobre o cardápio de inverno',
  },
  'publicar-tema': {
    rotulo: 'Publicar tema',
    descricao: 'Transforma um tema em conteúdo pronto pra publicar, em mais de um formato.',
    grupo: 'conteudo',
    modo: 'tarefa',
    icone: 'megaphone',
    exemplo: 'transforma o tema "como escolher um bom café" em artigo e carrossel',
  },
  seo: {
    rotulo: 'SEO e GEO',
    descricao: 'Pesquisa palavras-chave e diz como aparecer no Google e nas respostas de IA.',
    grupo: 'conteudo',
    modo: 'tarefa',
    icone: 'search',
    exemplo: 'pesquisa as palavras-chave do meu nicho em Curitiba',
  },
  'email-profissional': {
    rotulo: 'E-mail profissional',
    descricao: 'Escreve um e-mail no seu tom, do assunto à assinatura.',
    grupo: 'conteudo',
    modo: 'tarefa',
    icone: 'mail',
    exemplo: 'um e-mail cobrando com educação a fatura atrasada da Loja Lima',
  },
  'responder-avaliacoes': {
    rotulo: 'Responder avaliações',
    descricao: 'Responde avaliações do Google e das redes com a sua voz.',
    grupo: 'conteudo',
    modo: 'tarefa',
    icone: 'star',
    exemplo: 'responde esta avaliação: "atendimento ótimo, mas demorou"',
  },
  // Google Ads e Meta Ads
  'anuncio-google': {
    rotulo: 'Campanha no Google Ads',
    descricao: 'Monta uma campanha de pesquisa no Google Ads: palavras, anúncios e orçamento.',
    grupo: 'ads',
    modo: 'tarefa',
    icone: 'target',
    exemplo: 'uma campanha de pesquisa pro serviço principal, R$ 30 por dia',
  },
  'relatorio-ads': {
    rotulo: 'Relatório de anúncios',
    descricao: 'Lê os dados das campanhas e entrega um relatório que dá pra mandar pro cliente.',
    grupo: 'ads',
    modo: 'tarefa',
    icone: 'bar-chart-3',
    exemplo: 'o relatório da semana com os CSVs que estão em dados/',
  },
  // Prospecção de clientes
  'prospecta-maps': {
    rotulo: 'Prospectar no Google Maps',
    descricao: 'Acha negócios no Google Maps, prepara a prévia de um site e as mensagens de abordagem.',
    grupo: 'prospeccao',
    modo: 'conversa',
    icone: 'map-pin',
    exemplo: 'pega 20 padarias sem site em Curitiba',
  },
  // Produção
  'analisar-dados': {
    rotulo: 'Analisar dados',
    descricao: 'Lê planilhas e CSVs da pasta dados/ e diz o que mudou e o que fazer.',
    grupo: 'producao',
    modo: 'tarefa',
    icone: 'file-text',
    exemplo: 'analisa a planilha de vendas em dados/ e me diz o que mudou',
  },
  'criacao-canonica-de-skills': {
    rotulo: 'Criar uma skill',
    descricao: 'Cria uma skill nova pra uma tarefa que você repete, no padrão do MazyOS.',
    grupo: 'producao',
    modo: 'conversa',
    icone: 'wand-sparkles',
    exemplo: 'cria uma skill pro orçamento que eu faço toda semana',
  },
}

const ORDEM_GRUPOS: readonly Grupo[] = ['dia-a-dia', 'conteudo', 'ads', 'prospeccao', 'producao']

export type Frontmatter = { campos: Record<string, string>; corpo: string }

function tirarAspas(valor: string): string {
  const v = valor.trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1)
  }
  return v
}

/**
 * Lê o frontmatter YAML de uma SKILL.md, só o bastante pra `name` e `description`:
 * valores de uma linha, entre aspas, e blocos `>` / `|` (com ou sem `-`/`+`).
 * Chaves aninhadas (como `metadata:`) são ignoradas.
 */
export function lerFrontmatter(texto: string): Frontmatter {
  const linhas = texto.replace(/^\uFEFF/, '').split(/\r?\n/)
  if (linhas[0]?.trim() !== '---') return { campos: {}, corpo: texto }
  const fim = linhas.findIndex((linha, i) => i > 0 && linha.trim() === '---')
  if (fim < 0) return { campos: {}, corpo: texto }

  const campos: Record<string, string> = {}
  for (let i = 1; i < fim; i++) {
    const linha = linhas[i] ?? ''
    const chave = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(linha)
    if (chave === null) continue
    const nome = chave[1] ?? ''
    const resto = (chave[2] ?? '').trim()
    if (/^[>|][-+]?$/.test(resto)) {
      const bloco: string[] = []
      while (i + 1 < fim && (/^\s+\S/.test(linhas[i + 1] ?? '') || (linhas[i + 1] ?? '').trim() === '')) {
        bloco.push((linhas[++i] ?? '').trim())
      }
      campos[nome] = resto.startsWith('>')
        ? bloco.join(' ').replace(/\s+/g, ' ').trim()
        : bloco.join('\n').trim()
    } else if (resto !== '') {
      campos[nome] = tirarAspas(resto)
    }
  }
  return { campos, corpo: linhas.slice(fim + 1).join('\n').replace(/^\s*\n/, '') }
}

/** O corpo da SKILL.md sem o frontmatter. */
export function corpoSemFrontmatter(texto: string): string {
  return lerFrontmatter(texto).corpo
}

/**
 * A descrição pronta pra interface: sem os gatilhos ("Use quando..."), sem
 * `/mazyos:`, e com no máximo `maximo` caracteres, cortando em fim de frase.
 */
export function encurtar(descricao: string, maximo = 170): string {
  let texto = descricao
    .replace(/`?\/mazyos:([a-z0-9-]+)`?/gi, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  const gatilho = /\s(?:Use|Acione|Usar)\s+(?:quando|sempre|when)\b/i.exec(texto)
  if (gatilho !== null && gatilho.index > 20) texto = texto.slice(0, gatilho.index).trim()
  if (texto.length <= maximo) return texto
  const frases = texto.match(/[^.!?]+[.!?]+/g) ?? []
  let curto = ''
  for (const frase of frases) {
    if ((curto + frase).trim().length > maximo) break
    curto += frase
  }
  if (curto.trim() !== '') return curto.trim()
  return `${texto.slice(0, maximo - 1).trimEnd()}…`
}

function rotuloPadrao(nome: string): string {
  const texto = nome.replace(/-/g, ' ')
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** Lê as skills de `raizPlugin/skills`, na ordem dos grupos. Pasta ausente devolve lista vazia. */
export async function lerCatalogo(raizPlugin: string): Promise<Skill[]> {
  const pasta = path.join(raizPlugin, 'skills')
  let nomes: string[]
  try {
    const entradas = await readdir(pasta, { withFileTypes: true })
    nomes = entradas.filter(e => e.isDirectory()).map(e => e.name)
  } catch {
    return []
  }

  const skills: Skill[] = []
  for (const pastaSkill of nomes) {
    let texto: string
    try {
      texto = await readFile(path.join(pasta, pastaSkill, 'SKILL.md'), 'utf8')
    } catch {
      continue
    }
    const { campos } = lerFrontmatter(texto)
    const nome = pastaSkill
    const meta = METADADOS[nome]
    skills.push({
      nome,
      rotulo: meta?.rotulo ?? rotuloPadrao(campos.name ?? nome),
      descricao: meta?.descricao ?? encurtar(campos.description ?? ''),
      grupo: meta?.grupo ?? 'producao',
      modo: meta?.modo ?? 'tarefa',
      exemplo: meta?.exemplo,
      icone: meta?.icone ?? 'sparkles',
    })
  }

  const ordem = Object.keys(METADADOS)
  const posicao = (s: Skill) => {
    const i = ordem.indexOf(s.nome)
    return i < 0 ? ordem.length : i
  }
  return skills.sort(
    (a, b) =>
      ORDEM_GRUPOS.indexOf(a.grupo) - ORDEM_GRUPOS.indexOf(b.grupo) ||
      posicao(a) - posicao(b) ||
      a.nome.localeCompare(b.nome),
  )
}

/** O texto da SKILL.md de uma skill (com frontmatter), ou null se ela não existe. */
export async function lerSkill(raizPlugin: string, nome: string): Promise<string | null> {
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(nome)) return null
  try {
    return await readFile(path.join(raizPlugin, 'skills', nome, 'SKILL.md'), 'utf8')
  } catch {
    return null
  }
}
