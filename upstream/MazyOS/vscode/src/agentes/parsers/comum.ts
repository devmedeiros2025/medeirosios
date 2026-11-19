// Utilitários dos parsers. Funções puras, sem `vscode` nem `node:*`.

/** O objeto JSON da linha, ou undefined se a linha não for um objeto JSON. */
export function lerJson(linha: string): Record<string, unknown> | undefined {
  const t = linha.trim()
  if (!t.startsWith('{')) return undefined
  try {
    const v: unknown = JSON.parse(t)
    return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined
  } catch {
    return undefined
  }
}

export function obj(v: unknown): Record<string, unknown> | undefined {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined
}

export function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

export function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

/** Uma linha só, sem espaços repetidos, com no máximo `maximo` caracteres. */
export function encurtar(texto: string, maximo = 120): string {
  const plano = texto.replace(/\s+/g, ' ').trim()
  return plano.length > maximo ? `${plano.slice(0, maximo - 1).trimEnd()}…` : plano
}

function semBarraFinal(caminho: string): string {
  return caminho.replace(/\\/g, '/').replace(/\/+$/, '')
}

/** O caminho relativo à raiz quando ele está dentro dela; senão, o próprio caminho. */
export function relativo(caminho: string, raiz?: string): string {
  const alvo = semBarraFinal(caminho.replace(/^file:\/\//, ''))
  if (raiz === undefined || raiz === '') return alvo
  const base = semBarraFinal(raiz)
  // No macOS, /tmp é /private/tmp: compara sem o prefixo.
  const sem = (c: string) => c.replace(/^\/private(?=\/)/, '')
  const a = sem(alvo)
  const b = sem(base)
  const dentro = (x: string, y: string) => x.toLowerCase().startsWith(`${y.toLowerCase()}/`)
  if (dentro(a, b)) return a.slice(b.length + 1)
  return alvo
}

/** Aviso pra uma linha de stdout que não é JSON (vazia não vira nada). */
export function avisoDeLinha(linha: string): { tipo: 'aviso'; texto: string }[] {
  const t = linha.trim()
  return t === '' ? [] : [{ tipo: 'aviso', texto: encurtar(t, 400) }]
}
