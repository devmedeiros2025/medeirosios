// Conversor de Markdown próprio e seguro: monta elementos React, nunca HTML cru.
// Cobre títulos, parágrafos, listas (com tarefas e um nível de aninhamento), negrito,
// itálico, tachado, código inline e em bloco, citações, tabelas simples, links e regras.
// Links da web abrem por `abrirExterno`; caminhos do workspace (saidas/carrossel.md) por `abrirArquivo`.
import type { ReactNode } from 'react'
import { FileText, Folder } from 'lucide-react'
import { enviar } from './ponte'
import { BotaoCopiar } from './componentes/Botoes'
import './estilos/markdown.css'

type Alinhamento = 'left' | 'center' | 'right' | undefined
type Item = { linhas: string[]; marcado?: boolean }
type Bloco =
  | { t: 'titulo'; nivel: number; texto: string }
  | { t: 'paragrafo'; texto: string }
  | { t: 'lista'; ordenada: boolean; inicio: number; itens: Item[] }
  | { t: 'codigo'; lingua: string; texto: string }
  | { t: 'citacao'; texto: string }
  | { t: 'tabela'; cabecalho: string[]; alinhamentos: Alinhamento[]; linhas: string[][] }
  | { t: 'regra' }

const RE_CERCA = /^\s{0,3}(`{3,}|~{3,})\s*([\w+#.-]*)/
const RE_TITULO = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/
const RE_REGRA = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/
const RE_LISTA = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/
const RE_SEPARADOR = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/
const RE_CITACAO = /^\s{0,3}>\s?(.*)$/
const RE_TAREFA = /^\[([ xX])\]\s+(.*)$/

function celulas(linha: string): string[] {
  let l = linha.trim()
  if (l.startsWith('|')) l = l.slice(1)
  if (l.endsWith('|') && !l.endsWith('\\|')) l = l.slice(0, -1)
  return l.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'))
}

function ehTabela(linha: string, proxima: string | undefined): boolean {
  return linha.includes('|') && proxima !== undefined && proxima.includes('-') && RE_SEPARADOR.test(proxima)
}

function iniciaBloco(linha: string, proxima: string | undefined): boolean {
  return (
    RE_CERCA.test(linha) ||
    RE_TITULO.test(linha) ||
    RE_REGRA.test(linha) ||
    RE_LISTA.test(linha) ||
    RE_CITACAO.test(linha) ||
    ehTabela(linha, proxima)
  )
}

const recuo = (l: string): number => (/^\s*/.exec(l)?.[0].length ?? 0)

/** Parte o texto em blocos. Tolera texto pela metade (cerca de código sem fechar, durante o streaming). */
export function analisar(fonte: string): Bloco[] {
  const linhas = fonte.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n')
  const blocos: Bloco[] = []
  let i = 0

  while (i < linhas.length) {
    const linha = linhas[i] ?? ''
    if (!linha.trim()) {
      i++
      continue
    }

    const cerca = RE_CERCA.exec(linha)
    if (cerca) {
      const marca = cerca[1] ?? '```'
      const fecho = new RegExp(`^\\s{0,3}\\${marca[0]}{${marca.length},}\\s*$`)
      const corpo: string[] = []
      i++
      while (i < linhas.length && !fecho.test(linhas[i] ?? '')) corpo.push(linhas[i++] ?? '')
      i++
      blocos.push({ t: 'codigo', lingua: cerca[2] ?? '', texto: corpo.join('\n') })
      continue
    }

    const titulo = RE_TITULO.exec(linha)
    if (titulo) {
      blocos.push({ t: 'titulo', nivel: titulo[1]?.length ?? 1, texto: titulo[2] ?? '' })
      i++
      continue
    }

    if (RE_REGRA.test(linha)) {
      blocos.push({ t: 'regra' })
      i++
      continue
    }

    if (ehTabela(linha, linhas[i + 1])) {
      const cabecalho = celulas(linha)
      const alinhamentos: Alinhamento[] = celulas(linhas[i + 1] ?? '').map((c) =>
        c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : c.startsWith(':') ? 'left' : undefined,
      )
      i += 2
      const corpo: string[][] = []
      while (i < linhas.length && (linhas[i] ?? '').includes('|') && (linhas[i] ?? '').trim()) {
        corpo.push(celulas(linhas[i++] ?? ''))
      }
      blocos.push({ t: 'tabela', cabecalho, alinhamentos, linhas: corpo })
      continue
    }

    if (RE_CITACAO.test(linha)) {
      const corpo: string[] = []
      while (i < linhas.length) {
        const l = linhas[i] ?? ''
        const m = RE_CITACAO.exec(l)
        if (m) corpo.push(m[1] ?? '')
        else if (l.trim() && !iniciaBloco(l, linhas[i + 1])) corpo.push(l)
        else break
        i++
      }
      blocos.push({ t: 'citacao', texto: corpo.join('\n') })
      continue
    }

    const lista = RE_LISTA.exec(linha)
    if (lista) {
      const base = lista[1]?.length ?? 0
      const ordenada = /\d/.test(lista[2] ?? '')
      const conteudo = base + (lista[2]?.length ?? 1) + 1
      const itens: Item[] = []
      while (i < linhas.length) {
        const l = linhas[i] ?? ''
        const m = RE_LISTA.exec(l)
        if (m && (m[1]?.length ?? 0) <= base + 1) {
          if (/\d/.test(m[2] ?? '') !== ordenada) break
          let texto = m[3] ?? ''
          let marcado: boolean | undefined
          const tarefa = RE_TAREFA.exec(texto)
          if (tarefa) {
            marcado = tarefa[1] !== ' '
            texto = tarefa[2] ?? ''
          }
          itens.push({ linhas: [texto], marcado })
          i++
          continue
        }
        const atual = itens[itens.length - 1]
        if (!atual) break
        if (!l.trim()) {
          const prox = linhas[i + 1]
          const continua =
            prox !== undefined && (recuo(prox) >= conteudo || (RE_LISTA.test(prox) && recuo(prox) <= base + 1))
          if (!continua) break
          atual.linhas.push('')
          i++
          continue
        }
        if (recuo(l) > base) {
          atual.linhas.push(l.slice(Math.min(recuo(l), conteudo)))
          i++
          continue
        }
        if (!iniciaBloco(l, linhas[i + 1])) {
          atual.linhas.push(l.trim())
          i++
          continue
        }
        break
      }
      blocos.push({ t: 'lista', ordenada, inicio: ordenada ? Number.parseInt(lista[2] ?? '1', 10) : 1, itens })
      continue
    }

    const corpo: string[] = [linha]
    i++
    while (i < linhas.length) {
      const l = linhas[i] ?? ''
      if (!l.trim() || iniciaBloco(l, linhas[i + 1])) break
      corpo.push(l)
      i++
    }
    blocos.push({ t: 'paragrafo', texto: corpo.join('\n') })
  }
  return blocos
}

// ---------------------------------------------------------------- inline

const RE_INLINE = new RegExp(
  [
    '(`+)([^`]|[^`][\\s\\S]*?[^`])\\1(?!`)', // 1, 2: código
    '\\[([^\\]\\n]+)\\]\\(\\s*<?([^)\\s>]+)>?(?:\\s+"[^"]*")?\\s*\\)', // 3, 4: link
    '<((?:https?:\\/\\/|mailto:)[^>\\s]+)>', // 5: autolink
    '(https?:\\/\\/[^\\s<]*[^\\s<.,:;"\')\\]!?*_~])', // 6: url solta
    '\\*\\*(?=\\S)([\\s\\S]*?\\S)\\*\\*', // 7: negrito
    '__(?=\\S)([\\s\\S]*?\\S)__(?!\\w)', // 8: negrito
    '~~(?=\\S)([\\s\\S]*?\\S)~~', // 9: tachado
    '\\*(?=[^\\s*])([\\s\\S]*?[^\\s*])\\*(?!\\*)', // 10: itálico
    '(?<![\\w\\\\])_(?=[^\\s_])([\\s\\S]*?[^\\s_])_(?!\\w)', // 11: itálico
    '(?<![\\w/:@.\\-])((?:\\.{1,2}\\/)?(?:[\\w\\-\\u00C0-\\u017F][\\w.\\-\\u00C0-\\u017F]*\\/)+[\\w\\-\\u00C0-\\u017F][\\w.\\-\\u00C0-\\u017F]*\\.[A-Za-z][A-Za-z0-9]{0,7})(?![\\w/])', // 12: caminho
    '\\\\([\\\\`*_{}\\[\\]()#+\\-.!|~>])', // 13: escape
  ].join('|'),
  'g',
)

const RE_CAMINHO_CODIGO = /^(?:\.{0,2}\/|~\/)?(?:[^\s`/][^`/]*\/)+[^\s`/][^`/]*\.[A-Za-z][A-Za-z0-9]{0,7}$|^[\w.\-À-ſ]+\.(?:md|html|csv|pdf|png|jpg|jpeg|svg|json|txt|xlsx|docx|pptx)$/
const RE_PASTA_CODIGO = /^(?:\.{0,2}\/)?(?:[\w.\-À-ſ]+\/)+$/

function abrirLink(href: string): void {
  if (/^(https?:|mailto:)/i.test(href)) enviar({ tipo: 'abrirExterno', url: href })
  else enviar({ tipo: 'abrirArquivo', caminho: decodeURIComponentSeguro(href.replace(/^\.\//, '')) })
}

function decodeURIComponentSeguro(texto: string): string {
  try {
    return decodeURIComponent(texto)
  } catch {
    return texto
  }
}

/** Link pra um arquivo do workspace. */
export function LinkArquivo({ caminho, children, codigo }: { caminho: string; children?: ReactNode; codigo?: boolean }) {
  return (
    <a
      className={codigo ? 'mz-md-arquivo mz-md-arquivo-codigo' : 'mz-md-arquivo'}
      href="#"
      title={`Abrir ${caminho}`}
      onClick={(e) => {
        e.preventDefault()
        enviar({ tipo: 'abrirArquivo', caminho })
      }}
    >
      <FileText aria-hidden size={12} strokeWidth={2} />
      <span>{children ?? caminho}</span>
    </a>
  )
}

function quebrarLinhas(texto: string, chave: string): ReactNode[] {
  const partes = texto.split('\n')
  return partes.flatMap((parte, i) => (i === 0 ? [parte] : [<br key={`${chave}-br${i}`} />, parte]))
}

export function inline(texto: string, chave = 'i'): ReactNode[] {
  const saida: ReactNode[] = []
  let ultimo = 0
  let n = 0
  for (const m of texto.matchAll(RE_INLINE)) {
    const inicio = m.index ?? 0
    if (inicio > ultimo) saida.push(...quebrarLinhas(texto.slice(ultimo, inicio), `${chave}t${n}`))
    const k = `${chave}-${n++}`
    if (m[2] !== undefined) {
      const codigo = m[2].replace(/^ (.*) $/, '$1')
      if (RE_CAMINHO_CODIGO.test(codigo)) saida.push(<LinkArquivo key={k} caminho={codigo} codigo />)
      else if (RE_PASTA_CODIGO.test(codigo))
        saida.push(
          <a
            key={k}
            className="mz-md-arquivo mz-md-arquivo-codigo"
            href="#"
            title={`Abrir a pasta ${codigo}`}
            onClick={(e) => {
              e.preventDefault()
              enviar({ tipo: 'abrirPasta', caminho: codigo })
            }}
          >
            <Folder aria-hidden size={12} strokeWidth={2} />
            <span>{codigo}</span>
          </a>,
        )
      else saida.push(<code key={k}>{codigo}</code>)
    } else if (m[3] !== undefined && m[4] !== undefined) {
      const href = m[4]
      const permitido = /^(https?:|mailto:)/i.test(href) || !/^[a-z][\w+.-]*:/i.test(href)
      saida.push(
        permitido && !href.startsWith('#') ? (
          <a
            key={k}
            className="mz-md-link"
            href={/^(https?:|mailto:)/i.test(href) ? href : '#'}
            title={href}
            onClick={(e) => {
              e.preventDefault()
              abrirLink(href)
            }}
          >
            {inline(m[3], k)}
          </a>
        ) : (
          <span key={k}>{inline(m[3], k)}</span>
        ),
      )
    } else if (m[5] !== undefined || m[6] !== undefined) {
      const url = (m[5] ?? m[6]) as string
      saida.push(
        <a
          key={k}
          className="mz-md-link"
          href={url}
          title={url}
          onClick={(e) => {
            e.preventDefault()
            abrirLink(url)
          }}
        >
          {url.replace(/^https?:\/\/(www\.)?/, '').replace(/^mailto:/, '')}
        </a>,
      )
    } else if (m[7] !== undefined || m[8] !== undefined) {
      saida.push(<strong key={k}>{inline((m[7] ?? m[8]) as string, k)}</strong>)
    } else if (m[9] !== undefined) {
      saida.push(<del key={k}>{inline(m[9], k)}</del>)
    } else if (m[10] !== undefined || m[11] !== undefined) {
      saida.push(<em key={k}>{inline((m[10] ?? m[11]) as string, k)}</em>)
    } else if (m[12] !== undefined) {
      saida.push(<LinkArquivo key={k} caminho={m[12]} />)
    } else if (m[13] !== undefined) {
      saida.push(m[13])
    }
    ultimo = inicio + m[0].length
  }
  if (ultimo < texto.length) saida.push(...quebrarLinhas(texto.slice(ultimo), `${chave}t${n}`))
  return saida
}

// ---------------------------------------------------------------- render

const Cursor = () => <span className="mz-md-cursor" aria-hidden />

function renderItem(item: Item, k: string): ReactNode {
  const sub = analisar(item.linhas.join('\n'))
  const conteudo =
    sub.length === 1 && sub[0]?.t === 'paragrafo' ? inline(sub[0].texto, k) : sub.map((b, i) => renderBloco(b, `${k}-${i}`))
  if (item.marcado === undefined) return <li key={k}>{conteudo}</li>
  return (
    <li key={k} className="mz-md-tarefa" data-feita={item.marcado || undefined}>
      <span className="mz-md-caixa" role="img" aria-label={item.marcado ? 'Feito' : 'A fazer'} />
      <span>{conteudo}</span>
    </li>
  )
}

function renderBloco(bloco: Bloco, k: string, cursor = false): ReactNode {
  switch (bloco.t) {
    case 'titulo': {
      const Tag = (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const)[Math.min(bloco.nivel, 6) - 1] ?? 'h6'
      return (
        <Tag key={k}>
          {inline(bloco.texto, k)}
          {cursor && <Cursor />}
        </Tag>
      )
    }
    case 'paragrafo':
      return (
        <p key={k}>
          {inline(bloco.texto, k)}
          {cursor && <Cursor />}
        </p>
      )
    case 'lista': {
      const itens = bloco.itens.map((item, i) => renderItem(item, `${k}-${i}`))
      const ordenada = bloco.ordenada
      return ordenada ? (
        <ol key={k} start={bloco.inicio === 1 ? undefined : bloco.inicio}>
          {itens}
        </ol>
      ) : (
        <ul key={k}>{itens}</ul>
      )
    }
    case 'codigo':
      return (
        <figure key={k} className="mz-md-codigo">
          <figcaption>
            <span>{bloco.lingua || 'texto'}</span>
            <BotaoCopiar texto={bloco.texto} rotulo="Copiar o código" discreto />
          </figcaption>
          <pre tabIndex={0}>
            <code>{bloco.texto}</code>
          </pre>
        </figure>
      )
    case 'citacao':
      return <blockquote key={k}>{analisar(bloco.texto).map((b, i) => renderBloco(b, `${k}-${i}`))}</blockquote>
    case 'tabela':
      return (
        <div key={k} className="mz-md-tabela" tabIndex={0} role="region" aria-label="Tabela">
          <table>
            <thead>
              <tr>
                {bloco.cabecalho.map((c, i) => (
                  <th key={i} style={{ textAlign: bloco.alinhamentos[i] }}>
                    {inline(c, `${k}-h${i}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bloco.linhas.map((linha, r) => (
                <tr key={r}>
                  {bloco.cabecalho.map((_, c) => (
                    <td key={c} style={{ textAlign: bloco.alinhamentos[c] }}>
                      {inline(linha[c] ?? '', `${k}-${r}-${c}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'regra':
      return <hr key={k} />
  }
}

/** Markdown renderizado. Com `escrevendo`, mostra o cursor no fim do texto. */
export function Markdown({ fonte, escrevendo = false, compacto = false }: { fonte: string; escrevendo?: boolean; compacto?: boolean }) {
  const blocos = analisar(fonte)
  const ultimo = blocos.length - 1
  const cursorNoFim = escrevendo && (ultimo < 0 || !['paragrafo', 'titulo'].includes(blocos[ultimo]?.t ?? ''))
  return (
    <div className={compacto ? 'mz-md mz-md-compacto' : 'mz-md'}>
      {blocos.map((b, i) => renderBloco(b, `b${i}`, escrevendo && i === ultimo))}
      {cursorNoFim && <Cursor />}
    </div>
  )
}
