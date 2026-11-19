import { afterEach, describe, expect, it } from 'vitest'

import { arquivoVigiado, campo, lerWorkspace, lerWorkspaceCompleto, temConteudo } from '../src/nucleo/memoria'
import {
  apagar,
  escrever,
  pastaTemporaria,
  pluginFalso,
  TEMPLATE_DESIGN,
  TEMPLATE_PREFERENCIAS,
} from './ajuda'

const limpar: string[] = []
afterEach(async () => {
  await apagar(...limpar.splice(0))
})

async function cenario(): Promise<{ raiz: string; plugin: string }> {
  const raiz = await pastaTemporaria()
  const plugin = await pluginFalso()
  limpar.push(raiz, plugin)
  return { raiz, plugin }
}

describe('lerWorkspace', () => {
  it('sem pasta aberta: raiz null e nada instalado', async () => {
    const ws = await lerWorkspace(null, '/nao/existe')
    expect(ws.raiz).toBeNull()
    expect(ws.instalado).toBe(false)
    expect(ws.arquivos).toHaveLength(4)
    expect(ws.arquivos.every(a => !a.existe && !a.preenchido)).toBe(true)
  })

  it('pasta sem _memoria/: não instalado', async () => {
    const { raiz, plugin } = await cenario()
    await escrever(raiz, 'CLAUDE.md', '# Qualquer coisa\n')
    const ws = await lerWorkspace(raiz, plugin)
    expect(ws.instalado).toBe(false)
    expect(ws.nome).toBeNull()
    expect(ws.arquivos.every(a => !a.existe)).toBe(true)
  })

  it('preenchido, igual ao template e ausente', async () => {
    const { raiz, plugin } = await cenario()
    await escrever(
      raiz,
      '_memoria/empresa.md',
      '# Empresa\n\n**Nome:** Padaria Sol\n**Negócio:** padaria de bairro\n**O que faz:** Pão de fermentação natural e café em Curitiba\n',
    )
    await escrever(raiz, '_memoria/preferencias.md', TEMPLATE_PREFERENCIAS)
    await escrever(
      raiz,
      '_memoria/estrategia.md',
      '# Estratégia\n\n## Fase\n\nCrescimento\n\n## Prioridade principal\n\nLançar o site novo até dezembro\n',
    )
    // identidade/design-guide.md ausente

    const ws = await lerWorkspace(raiz, plugin, 1234)
    expect(ws.instalado).toBe(true)
    expect(ws.lidoEm).toBe(1234)
    const porChave = Object.fromEntries(ws.arquivos.map(a => [a.chave, a]))
    expect(porChave.empresa).toMatchObject({ caminho: '_memoria/empresa.md', existe: true, preenchido: true })
    expect(porChave.empresa?.mtimeMs).toBeGreaterThan(0)
    expect(porChave.preferencias).toMatchObject({ existe: true, preenchido: false })
    expect(porChave.estrategia).toMatchObject({ existe: true, preenchido: true })
    expect(porChave.design).toMatchObject({ caminho: 'identidade/design-guide.md', existe: false, preenchido: false, mtimeMs: 0 })

    expect(ws.nome).toBe('Padaria Sol')
    expect(ws.negocio).toBe('Pão de fermentação natural e café em Curitiba')
    expect(ws.foco).toBe('Lançar o site novo até dezembro')
    expect(ws.tom).toBeNull()
  })

  it('template com espaços diferentes continua em branco', async () => {
    const { raiz, plugin } = await cenario()
    await escrever(raiz, 'identidade/design-guide.md', TEMPLATE_DESIGN.replace(/\n/g, '\r\n') + '\n\n')
    await escrever(raiz, '_memoria/empresa.md', '# Empresa\n\n**Nome:**\n')
    const ws = await lerWorkspace(raiz, plugin)
    expect(ws.arquivos.find(a => a.chave === 'design')?.preenchido).toBe(false)
    // só placeholders: existe, mas não tem conteúdo
    expect(ws.arquivos.find(a => a.chave === 'empresa')).toMatchObject({ existe: true, preenchido: false })
    expect(ws.nome).toBeNull()
  })

  it('tom de voz pela seção e nome pelo H1 quando não há campo', async () => {
    const { raiz, plugin } = await cenario()
    await escrever(raiz, '_memoria/empresa.md', '# Café Aurora\n\nCafeteria com torra própria.\n')
    await escrever(
      raiz,
      '_memoria/preferencias.md',
      '# Preferências\n\n## Tom de voz\n\n- **Próximo e bem-humorado**, sem gíria demais\n\n## O que evitar\n\nJargão\n',
    )
    const { workspace, textos } = await lerWorkspaceCompleto(raiz, plugin)
    expect(workspace.nome).toBe('Café Aurora')
    expect(workspace.tom).toBe('Próximo e bem-humorado, sem gíria demais')
    expect(textos.preferencias).toContain('## Tom de voz')
  })

  it('H1 igual ao do template não vira nome', async () => {
    const { raiz, plugin } = await cenario()
    await escrever(raiz, '_memoria/empresa.md', '# Empresa\n\nUma empresa qualquer.\n')
    expect((await lerWorkspace(raiz, plugin)).nome).toBeNull()
  })
})

describe('campo e temConteudo', () => {
  it('campo inline vazio não pega a linha seguinte', () => {
    expect(campo('**Nome:**\n**Negócio:** Loja\n', ['Nome'])).toBeNull()
    expect(campo('**Nome:**\nPadaria\n', ['Nome'])).toBeNull()
    expect(campo('- **Nome:** Loja Lima\n', ['Nome'])).toBe('Loja Lima')
  })

  it('ignora placeholders', () => {
    expect(temConteudo('# Título\n\n> citação\n\n**Arquivo:** *(ex: logo.png)*\n---\n')).toBe(false)
    expect(temConteudo('**Arquivo:** identidade/logo.png')).toBe(true)
    expect(campo('## Foco\n\n[preencher]\n\nVender mais\n', ['Foco'])).toBe('Vender mais')
  })

  it('arquivoVigiado', () => {
    expect(arquivoVigiado('/ws', '/ws/_memoria/empresa.md')).toBe('_memoria/empresa.md')
    expect(arquivoVigiado('C:\\ws', 'C:\\ws\\CLAUDE.md')).toBe('CLAUDE.md')
    expect(arquivoVigiado('/ws', '/ws/saidas/x.md')).toBeUndefined()
  })
})
