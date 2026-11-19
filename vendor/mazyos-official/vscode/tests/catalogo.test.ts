import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

import { beforeAll, describe, expect, it } from 'vitest'

import { encurtar, lerCatalogo, lerFrontmatter, METADADOS } from '../src/nucleo/catalogo'
import { GRUPOS } from '../src/shared/protocolo'

const raizExtensao = path.resolve(__dirname, '..')
const raizPlugin = path.join(raizExtensao, 'mazyos')

beforeAll(() => {
  if (!existsSync(path.join(raizPlugin, 'skills'))) {
    // A cópia do plugin é gerada por `npm run preparar`.
    execFileSync(process.execPath, [path.join(raizExtensao, 'scripts', 'preparar-plugin.mjs')], { cwd: raizExtensao })
  }
})

describe('catálogo real', () => {
  it('17 skills, todas com grupo, modo, ícone e descrição', async () => {
    const skills = await lerCatalogo(raizPlugin)
    expect(skills).toHaveLength(17)
    for (const skill of skills) {
      expect(Object.keys(GRUPOS)).toContain(skill.grupo)
      expect(['tarefa', 'conversa']).toContain(skill.modo)
      expect(skill.icone).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      expect(skill.descricao.length).toBeGreaterThan(20)
      expect(skill.descricao.length).toBeLessThanOrEqual(171)
      expect(skill.descricao).not.toMatch(/\/mazyos:/)
      expect(skill.rotulo).not.toBe('')
      expect(skill.exemplo).toBeTruthy()
      expect(METADADOS[skill.nome], skill.nome).toBeDefined()
    }
  })

  it('modos da ARQUITETURA', async () => {
    const skills = await lerCatalogo(raizPlugin)
    const conversa = skills.filter(s => s.modo === 'conversa').map(s => s.nome).sort()
    expect(conversa).toEqual(
      ['atualizar', 'criacao-canonica-de-skills', 'instalar', 'mapear-rotinas', 'novo-projeto', 'prospecta-maps'].sort(),
    )
    expect(skills.find(s => s.nome === 'carrossel')?.exemplo).toBe(
      'um carrossel sobre os 3 erros que mais vejo em clientes novos',
    )
  })

  it('ordem pelos grupos', async () => {
    const grupos = (await lerCatalogo(raizPlugin)).map(s => s.grupo)
    const ordem = Object.keys(GRUPOS)
    for (let i = 1; i < grupos.length; i++) {
      expect(ordem.indexOf(grupos[i] ?? '')).toBeGreaterThanOrEqual(ordem.indexOf(grupos[i - 1] ?? ''))
    }
  })

  it('pasta inexistente devolve lista vazia', async () => {
    expect(await lerCatalogo('/nao/existe')).toEqual([])
  })
})

describe('frontmatter', () => {
  it('bloco dobrado, linha única e aspas', () => {
    const dobrado = lerFrontmatter('---\nname: seo\ndescription: >\n  Primeira linha\n  segunda linha.\nlicense: MIT\nmetadata:\n  author: X\n---\n\n# Corpo\n')
    expect(dobrado.campos).toEqual({ name: 'seo', description: 'Primeira linha segunda linha.', license: 'MIT' })
    expect(dobrado.corpo).toBe('# Corpo\n')
    expect(lerFrontmatter('---\nname: "abrir"\ndescription: Uma linha só\n---\nx').campos).toEqual({
      name: 'abrir',
      description: 'Uma linha só',
    })
    expect(lerFrontmatter('sem frontmatter').corpo).toBe('sem frontmatter')
  })

  it('encurtar tira os gatilhos e o /mazyos:', () => {
    expect(encurtar('Faz o carrossel via /mazyos:carrossel. Use quando o usuário pedir "post".')).toBe(
      'Faz o carrossel via carrossel.',
    )
  })
})
