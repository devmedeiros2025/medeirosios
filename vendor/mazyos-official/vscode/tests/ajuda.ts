// Utilitários dos testes: pastas temporárias e um "plugin" falso com templates.
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

export async function pastaTemporaria(prefixo = 'mazyos-teste-'): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), prefixo))
}

export async function escrever(raiz: string, relativo: string, texto: string): Promise<string> {
  const caminho = path.join(raiz, ...relativo.split('/'))
  await mkdir(path.dirname(caminho), { recursive: true })
  await writeFile(caminho, texto, 'utf8')
  return caminho
}

export async function apagar(...pastas: string[]): Promise<void> {
  for (const pasta of pastas) await rm(pasta, { recursive: true, force: true })
}

export const TEMPLATE_EMPRESA = `# Empresa

> Memória central do negócio.

**Nome:**
**Negócio:**
**O que faz:**

## Contexto adicional
`

export const TEMPLATE_PREFERENCIAS = `# Preferências

> Como o Claude escreve em nome do seu negócio.

## Tom de voz

## O que evitar
`

export const TEMPLATE_ESTRATEGIA = `# Estratégia

> O que importa agora.

## Fase

## Prioridade principal

## O que pode esperar
`

export const TEMPLATE_DESIGN = `# Identidade visual

> Como a marca aparece.

## Cores

- **Fundo principal:**
`

/** Um plugin falso com os templates do workspace e, se pedir, skills. */
export async function pluginFalso(skills: Record<string, string> = {}): Promise<string> {
  const raiz = await pastaTemporaria('mazyos-plugin-')
  await escrever(raiz, 'templates/workspace/_memoria/empresa.md', TEMPLATE_EMPRESA)
  await escrever(raiz, 'templates/workspace/_memoria/preferencias.md', TEMPLATE_PREFERENCIAS)
  await escrever(raiz, 'templates/workspace/_memoria/estrategia.md', TEMPLATE_ESTRATEGIA)
  await escrever(raiz, 'templates/workspace/identidade/design-guide.md', TEMPLATE_DESIGN)
  for (const [nome, texto] of Object.entries(skills)) await escrever(raiz, `skills/${nome}/SKILL.md`, texto)
  return raiz
}
