// Copia as skills e os templates do plugin (a raiz deste repositório) pra dentro
// da extensão, em `vscode/mazyos/`, que vai no .vsix. A extensão lê de lá em
// tempo de execução; a fonte da verdade continua sendo o plugin.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = path.dirname(fileURLToPath(import.meta.url))
const raizExtensao = path.resolve(aqui, '..')
const raizPlugin = path.resolve(raizExtensao, '..')
const destino = path.join(raizExtensao, 'mazyos')

const manifesto = JSON.parse(readFileSync(path.join(raizPlugin, '.claude-plugin', 'plugin.json'), 'utf8'))

rmSync(destino, { recursive: true, force: true })
mkdirSync(destino, { recursive: true })

const ignorar = (origem) => !/node_modules|\.DS_Store|\.env$|\.env\./.test(origem)
for (const pasta of ['skills', 'templates']) {
  cpSync(path.join(raizPlugin, pasta), path.join(destino, pasta), { recursive: true, filter: ignorar })
}

writeFileSync(
  path.join(destino, 'plugin.json'),
  JSON.stringify(
    {
      name: manifesto.name,
      version: manifesto.version,
      description: manifesto.description,
      preparadoEm: new Date().toISOString(),
    },
    null,
    2,
  ) + '\n',
)

console.log(`MazyOS ${manifesto.version}: skills e templates copiados pra ${path.relative(raizExtensao, destino)}/`)
