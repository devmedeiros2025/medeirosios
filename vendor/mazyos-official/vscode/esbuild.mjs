// Monta a extensão (host do VS Code, Node) e a interface (webview, navegador).
// `node esbuild.mjs` compila uma vez; `--watch` fica observando; `--producao` minifica.
import * as esbuild from 'esbuild'
import { mkdirSync } from 'node:fs'

const producao = process.argv.includes('--producao')
const observar = process.argv.includes('--watch')

mkdirSync('dist', { recursive: true })

/** @type {import('esbuild').BuildOptions} */
const extensao = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['vscode'],
  outfile: 'dist/extension.js',
  sourcemap: producao ? false : true,
  minify: producao,
  logLevel: 'info',
}

/** @type {import('esbuild').BuildOptions} */
const webview = {
  entryPoints: ['webview/main.tsx'],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: ['es2022', 'chrome120'],
  outfile: 'dist/webview.js',
  sourcemap: producao ? false : 'inline',
  minify: producao,
  jsx: 'automatic',
  loader: {
    '.woff2': 'file',
    '.woff': 'file',
    '.svg': 'dataurl',
    '.png': 'file',
  },
  assetNames: '[name]',
  define: { 'process.env.NODE_ENV': producao ? '"production"' : '"development"' },
  logLevel: 'info',
}

if (observar) {
  const [a, b] = await Promise.all([esbuild.context(extensao), esbuild.context(webview)])
  await Promise.all([a.watch(), b.watch()])
  console.log('esbuild: observando src/ e webview/')
} else {
  await Promise.all([esbuild.build(extensao), esbuild.build(webview)])
}
