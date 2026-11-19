// Leitura do workspace MazyOS: a memória do negócio em `_memoria/` e a identidade
// visual. Porte de `../hooks/memoria.ts` (o plugin usa o `$.fs` do Claude Code; aqui
// é `node:fs/promises`). Sem `vscode`: testável com vitest.
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

import type { MazyosArquivo, MazyosChave, Workspace } from '../shared/protocolo'

type Fonte = { chave: MazyosChave; relativo: string; rotulo: string }

/** Os arquivos de memória de um workspace MazyOS, na ordem em que o painel os lista. */
export const FONTES: readonly Fonte[] = [
  { chave: 'empresa', relativo: '_memoria/empresa.md', rotulo: 'empresa.md' },
  { chave: 'preferencias', relativo: '_memoria/preferencias.md', rotulo: 'preferencias.md' },
  { chave: 'estrategia', relativo: '_memoria/estrategia.md', rotulo: 'estrategia.md' },
  { chave: 'design', relativo: 'identidade/design-guide.md', rotulo: 'design-guide.md' },
]

/** Editado um destes, o contexto do negócio mudou: a memória, a identidade e o CLAUDE.md do workspace. */
export const VIGIADOS: readonly string[] = [...FONTES.map(fonte => fonte.relativo), 'CLAUDE.md']

/** Títulos dos templates: um H1 igual a um deles não é o nome do negócio. */
const TITULOS_DE_TEMPLATE = new Set([
  'empresa',
  'preferências',
  'preferencias',
  'estratégia',
  'estrategia',
  'identidade visual',
])

/** Barras no padrão `/` e sem barra final, pra comparar caminhos de qualquer sistema. */
export function normalizar(caminho: string): string {
  return caminho.replace(/\\/g, '/').replace(/\/+$/, '')
}

export function juntar(raiz: string, relativo: string): string {
  return `${normalizar(raiz)}/${relativo}`
}

/**
 * O caminho relativo (`_memoria/empresa.md`) quando `caminho` é um arquivo
 * vigiado do workspace em `raiz`; undefined pra qualquer outro arquivo.
 */
export function arquivoVigiado(raiz: string, caminho: string): string | undefined {
  const base = `${normalizar(raiz).toLowerCase()}/`
  const alvo = normalizar(caminho)
  if (!alvo.toLowerCase().startsWith(base)) return undefined
  const relativo = alvo.slice(base.length).toLowerCase()
  return VIGIADOS.find(vigiado => vigiado.toLowerCase() === relativo)
}

/** O texto do arquivo, ou vazio quando ele não existe ou não pôde ser lido. */
export async function lerTexto(caminho: string): Promise<string> {
  try {
    return await readFile(caminho, 'utf8')
  } catch {
    return ''
  }
}

async function existe(caminho: string): Promise<{ existe: boolean; mtimeMs: number; pasta: boolean }> {
  try {
    const s = await stat(caminho)
    return { existe: true, mtimeMs: s.mtimeMs, pasta: s.isDirectory() }
  } catch {
    return { existe: false, mtimeMs: 0, pasta: false }
  }
}

/** Workspace vazio: sem pasta aberta no editor. */
export function workspaceSemPasta(agora = Date.now()): Workspace {
  return {
    raiz: null,
    instalado: false,
    nome: null,
    negocio: null,
    foco: null,
    tom: null,
    arquivos: FONTES.map(fonte => ({
      chave: fonte.chave,
      rotulo: fonte.rotulo,
      caminho: fonte.relativo,
      existe: false,
      preenchido: false,
      mtimeMs: 0,
    })),
    lidoEm: agora,
  }
}

/** O workspace lido e, junto, o texto de cada memória (pra montar o pedido sem reler). */
export type Leitura = { workspace: Workspace; textos: Partial<Record<MazyosChave, string>> }

/**
 * Lê o workspace em `raiz`: se está instalado, o estado de cada memória e o resumo
 * do negócio. `raizPlugin` é a cópia embutida do plugin (`vscode/mazyos`), onde
 * ficam os templates usados pra decidir se um arquivo ainda está em branco.
 */
export async function lerWorkspaceCompleto(
  raiz: string | null,
  raizPlugin: string,
  agora = Date.now(),
): Promise<Leitura> {
  if (raiz === null) return { workspace: workspaceSemPasta(agora), textos: {} }

  const pastaMemoria = await existe(path.join(raiz, '_memoria'))
  const instalado = pastaMemoria.existe && pastaMemoria.pasta
  const arquivos: MazyosArquivo[] = []
  const textos: Partial<Record<MazyosChave, string>> = {}

  for (const fonte of FONTES) {
    const caminho = path.join(raiz, ...fonte.relativo.split('/'))
    const info = instalado ? await existe(caminho) : { existe: false, mtimeMs: 0, pasta: false }
    const presente = info.existe && !info.pasta
    const texto = presente ? await lerTexto(caminho) : ''
    const modelo = presente
      ? await lerTexto(path.join(raizPlugin, 'templates', 'workspace', ...fonte.relativo.split('/')))
      : ''
    const preenchido = presente && temConteudo(texto) && !mesmoTexto(texto, modelo)
    textos[fonte.chave] = texto
    arquivos.push({
      chave: fonte.chave,
      rotulo: fonte.rotulo,
      caminho: fonte.relativo,
      existe: presente,
      preenchido,
      mtimeMs: presente ? info.mtimeMs : 0,
    })
  }

  const empresa = textos.empresa ?? ''
  const workspace: Workspace = {
    raiz: normalizar(raiz),
    instalado,
    nome: campo(empresa, ['Nome', 'Empresa', 'Negócio']) ?? tituloProprio(empresa),
    negocio: campo(empresa, ['O que faz', 'O que entrega', 'Negócio']),
    foco: campo(textos.estrategia ?? '', [
      'Prioridade principal',
      'Próximas prioridades',
      'Foco atual',
      'Foco',
      'Gargalo atual',
    ]),
    tom: campo(textos.preferencias ?? '', ['Tom de voz', 'Tom']),
    arquivos,
    lidoEm: agora,
  }
  return { workspace, textos }
}

/** Só o `Workspace`, como o protocolo pede. */
export async function lerWorkspace(raiz: string | null, raizPlugin: string, agora = Date.now()): Promise<Workspace> {
  return (await lerWorkspaceCompleto(raiz, raizPlugin, agora)).workspace
}

/** Uma linha diz algo quando não é título, citação, régua, campo vazio nem placeholder. */
export function dizAlgo(linha: string): boolean {
  const limpa = linha.trim()
  if (limpa === '' || limpa.startsWith('#') || limpa.startsWith('>') || /^-{3,}$/.test(limpa)) {
    return false
  }
  const campoComValor = /^(?:[-*]\s+)?(?:\*\*[^*]+:\*\*|[^:*`]+:)\s*(.*)$/.exec(limpa)
  const valor = campoComValor === null ? limpa : (campoComValor[1] ?? '')
  return valor !== '' && !/^\*\(.*\)\*$/.test(valor) && !/^\[.*\]$/.test(valor)
}

/** O texto tem conteúdo real (alguma linha que diz algo). */
export function temConteudo(texto: string): boolean {
  return texto.split(/\r?\n/).some(dizAlgo)
}

function mesmoTexto(a: string, b: string): boolean {
  const normal = (texto: string) => texto.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim()
  return b !== '' && normal(a) === normal(b)
}

function escapar(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Tira marcação de markdown, junta espaços e corta em `maximo` caracteres. */
export function limpar(texto: string, maximo = 90): string {
  const plano = texto
    .replace(/\*\*|__|`/g, '')
    .replace(/^[-*]\s+/, '')
    .replace(/\s+/g, ' ')
    .trim()
  return plano.length > maximo ? `${plano.slice(0, maximo - 1).trimEnd()}…` : plano
}

/**
 * O valor de um campo, pelo primeiro rótulo que achar: `**Rótulo:** valor`
 * numa linha, ou a primeira linha com conteúdo da seção `## Rótulo`. (Diferença do
 * plugin: lá um H1 `# Empresa` contava como seção do rótulo "Empresa".)
 */
export function campo(texto: string, rotulos: readonly string[]): string | null {
  for (const rotulo of rotulos) {
    const r = escapar(rotulo)
    const inline = new RegExp(`^\\s*(?:[-*]\\s+)?\\*\\*${r}:?\\*\\*:?[ \\t]*(.+?)\\s*$`, 'im').exec(texto)
    const valorInline = inline?.[1]
    if (valorInline !== undefined && dizAlgo(valorInline)) return limpar(valorInline)

    // Só seções de nível 2 pra baixo: o H1 é o título do arquivo ("# Empresa"), não um campo.
    const secao = new RegExp(
      `^#{2,6}[ \\t]*${r}[ \\t]*\\r?\\n([\\s\\S]*?)(?=^#{1,6}[ \\t]|(?![\\s\\S]))`,
      'im',
    ).exec(texto)
    const corpo = secao?.[1]
    if (corpo !== undefined) {
      const linha = corpo.split(/\r?\n/).find(dizAlgo)
      if (linha !== undefined) return limpar(linha)
    }
  }
  return null
}

/** O H1 do arquivo quando ele é um nome próprio, não o título do template. */
export function tituloProprio(texto: string): string | null {
  const h1 = /^#\s+(.+?)\s*$/m.exec(texto)?.[1]
  if (h1 === undefined) return null
  const limpo = limpar(h1)
  return TITULOS_DE_TEMPLATE.has(limpo.toLowerCase()) ? null : limpo
}
