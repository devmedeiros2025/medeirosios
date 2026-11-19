import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { montarPedido, prepararPedido, substituir, trocarComandos } from '../src/nucleo/pedido'
import type { Skill, Workspace } from '../src/shared/protocolo'
import { apagar, escrever, pastaTemporaria, pluginFalso, TEMPLATE_PREFERENCIAS } from './ajuda'

const limpar: string[] = []
afterEach(async () => {
  await apagar(...limpar.splice(0))
})

const SKILLS: Pick<Skill, 'nome' | 'rotulo'>[] = [
  { nome: 'carrossel', rotulo: 'Carrossel' },
  { nome: 'seo', rotulo: 'SEO' },
]

function workspace(preenchidos: string[]): Workspace {
  const arquivos = [
    ['empresa', '_memoria/empresa.md', 'empresa.md'],
    ['preferencias', '_memoria/preferencias.md', 'preferencias.md'],
    ['estrategia', '_memoria/estrategia.md', 'estrategia.md'],
    ['design', 'identidade/design-guide.md', 'design-guide.md'],
  ] as const
  return {
    raiz: '/tmp/padaria-sol',
    instalado: true,
    nome: 'Padaria Sol',
    negocio: null,
    foco: null,
    tom: null,
    arquivos: arquivos.map(([chave, caminho, rotulo]) => ({
      chave,
      caminho,
      rotulo,
      existe: true,
      preenchido: preenchidos.includes(chave),
      mtimeMs: 1,
    })),
    lidoEm: 0,
  }
}

describe('substituições', () => {
  it('troca CLAUDE_PLUGIN_ROOT, CLAUDE_SKILL_DIR e /mazyos:<skill>', () => {
    const corpo = [
      'Templates em `${CLAUDE_PLUGIN_ROOT}/templates/`.',
      'Rode `python3 "${CLAUDE_SKILL_DIR}/scripts/auditar.py"`.',
      'Depois chame /mazyos:carrossel.',
      'Use a skill `/mazyos:publicar-tema` aqui.',
      '# /mazyos:salvar — Salvar',
    ].join('\n')
    const saida = substituir(corpo, '/ext/mazyos', 'criacao')
    expect(saida).toContain('`/ext/mazyos/templates/`')
    expect(saida).toContain(`"${path.join('/ext/mazyos', 'skills', 'criacao')}/scripts/auditar.py"`)
    expect(saida).toContain('Depois chame a skill carrossel do MazyOS.')
    expect(saida).toContain('Use a skill publicar-tema do MazyOS aqui.')
    expect(saida).toContain('# a skill salvar do MazyOS — Salvar')
    expect(saida).not.toMatch(/\$\{CLAUDE_|\/mazyos:/)
  })

  it('trocarComandos não repete "skill"', () => {
    expect(trocarComandos('(a skill `/mazyos:carrossel`)')).toBe('(a skill carrossel do MazyOS)')
    expect(trocarComandos('rode /mazyos:instalar agora')).toBe('rode a skill instalar do MazyOS agora')
  })
})

describe('montarPedido', () => {
  const memoria = [
    { caminho: '_memoria/empresa.md', texto: '# Empresa\n\n**Nome:** Padaria Sol\n' },
    { caminho: 'identidade/design-guide.md', texto: '## Cores\n\n- **Fundo:** creme' },
  ]

  it('com skill: regras, memória, skill e pedido, nessa ordem', () => {
    const prompt = montarPedido({
      workspace: workspace(['empresa', 'design']),
      memoria,
      skill: { nome: 'carrossel', texto: '---\nname: carrossel\ndescription: x\n---\n\n# Carrossel\n\nLeia ${CLAUDE_PLUGIN_ROOT}/x.md\n' },
      pedido: 'um carrossel sobre pão',
      raizPlugin: '/ext/mazyos',
      skills: SKILLS,
      modo: 'tarefa',
    })
    expect(prompt.startsWith('# MazyOS\n')).toBe(true)
    const ordem = ['# MazyOS', '## Memória do negócio', '### _memoria/empresa.md', '### identidade/design-guide.md', '## Skill: carrossel', '## Pedido']
    let ultimo = -1
    for (const marco of ordem) {
      const i = prompt.indexOf(marco)
      expect(i, marco).toBeGreaterThan(ultimo)
      ultimo = i
    }
    expect(prompt).toContain('Leia /ext/mazyos/x.md')
    expect(prompt).not.toContain('name: carrossel')
    expect(prompt).toContain('Trabalhe só dentro da pasta /tmp/padaria-sol')
    expect(prompt).toContain('Ainda em branco: preferencias.md, estrategia.md')
    expect(prompt).toContain('pergunta no fim da resposta e pare')
    expect(prompt.trimEnd().endsWith('um carrossel sobre pão')).toBe(true)
    expect(prompt).not.toMatch(/\/mazyos:/)
    // com skill, a lista em uma linha do pedido livre não entra
    expect(prompt).not.toContain('Skills do MazyOS que podem ajudar')
  })

  it('sem memória preenchida: sem a seção de memória', () => {
    const prompt = montarPedido({
      workspace: workspace([]),
      memoria: [],
      pedido: 'oi',
      raizPlugin: '/ext/mazyos',
      skills: SKILLS,
      modo: 'tarefa',
    })
    expect(prompt).not.toContain('## Memória do negócio')
    expect(prompt).toContain('Ainda em branco: empresa.md, preferencias.md, estrategia.md, design-guide.md')
  })

  it('pedido livre lista as skills e não tem seção de skill', () => {
    const prompt = montarPedido({
      workspace: workspace(['empresa']),
      memoria: memoria.slice(0, 1),
      pedido: 'me ajuda com o Instagram',
      raizPlugin: '/ext/mazyos',
      skills: SKILLS,
      modo: 'tarefa',
    })
    expect(prompt).not.toContain('## Skill:')
    expect(prompt).toContain('Skills do MazyOS que podem ajudar neste pedido (leia a SKILL.md da que combinar, ou sugira uma ao usuário): carrossel, seo.')
  })

  it('workspace não instalado: regras curtas, sem memória', () => {
    const ws = { ...workspace([]), instalado: false, nome: null }
    const prompt = montarPedido({ workspace: ws, memoria: [], pedido: 'x', raizPlugin: '/p', skills: SKILLS, modo: 'conversa' })
    expect(prompt).toContain('ainda não é um workspace MazyOS')
    expect(prompt).toContain('O usuário está no terminal com você')
    expect(prompt).not.toContain('## Contexto do negócio')
  })
})

describe('prepararPedido (lendo do disco)', () => {
  it('só a memória preenchida entra; skill inexistente é erro', async () => {
    const raiz = await pastaTemporaria()
    const plugin = await pluginFalso({
      seo: '---\nname: seo\ndescription: >\n  SEO.\n---\n\nPasta: ${CLAUDE_SKILL_DIR}\n',
    })
    limpar.push(raiz, plugin)
    await escrever(raiz, '_memoria/empresa.md', '# Empresa\n\n**Nome:** Padaria Sol\n')
    await escrever(raiz, '_memoria/preferencias.md', TEMPLATE_PREFERENCIAS)

    const { prompt, workspace: ws } = await prepararPedido({
      raiz,
      raizPlugin: plugin,
      skills: [],
      skill: 'seo',
      pedido: 'palavras-chave',
    })
    expect(ws.nome).toBe('Padaria Sol')
    expect(prompt).toContain('### _memoria/empresa.md')
    expect(prompt).not.toContain('### _memoria/preferencias.md')
    expect(prompt).toContain(`Pasta: ${path.join(plugin, 'skills', 'seo')}`)

    await expect(prepararPedido({ raiz, raizPlugin: plugin, skills: [], skill: 'nao-existe', pedido: '' })).rejects.toThrow(
      /não existe/,
    )
  })
})
