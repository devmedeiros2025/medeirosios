import { chmod } from 'node:fs/promises'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  acharBinario,
  comPastaNoPath,
  DivisorDeLinhas,
  executarAgente,
  limparCacheBinarios,
  prepararComando,
  resumirStderr,
  rodar,
  rodarCurto,
} from '../src/agentes/processo'
import type { ContextoAgente } from '../src/agentes/tipos'
import { apagar, escrever, pastaTemporaria } from './ajuda'

const limpar: string[] = []
afterEach(async () => {
  limparCacheBinarios()
  await apagar(...limpar.splice(0))
})

async function executavel(pasta: string, nome: string): Promise<string> {
  const caminho = await escrever(pasta, nome, '#!/bin/sh\necho 1.0.0\n')
  await chmod(caminho, 0o755)
  return caminho
}

function ctx(extra: Partial<ContextoAgente> = {}): ContextoAgente {
  return { home: '/home/ninguem', plataforma: 'darwin', env: { PATH: '' }, ...extra }
}

const NODE = process.execPath

describe('acharBinario', () => {
  it.skipIf(process.platform === 'win32')('ordem: configurado, PATH, pastas conhecidas', async () => {
    const base = await pastaTemporaria()
    limpar.push(base)
    const noPath = await executavel(path.join(base, 'path'), 'claude')
    const conhecida = await executavel(path.join(base, 'conhecida'), 'claude')
    const configurado = await executavel(path.join(base, 'config'), 'meu-claude')
    await escrever(base, 'naoexec/claude', 'x') // sem permissão de execução: ignorado

    const pastas = [path.join(base, 'naoexec'), path.join(base, 'conhecida')]
    const semShell = { pastas, usarShell: false, semCache: true }

    expect(await acharBinario('claude', ctx(), semShell)).toBe(conhecida)
    expect(await acharBinario('claude', ctx({ env: { PATH: path.join(base, 'path') } }), semShell)).toBe(noPath)
    expect(
      await acharBinario('claude', ctx({ env: { PATH: path.join(base, 'path') }, caminhoConfigurado: configurado }), semShell),
    ).toBe(configurado)
    // configurado que não existe: segue procurando
    expect(await acharBinario('claude', ctx({ caminhoConfigurado: '/nao/existe' }), semShell)).toBe(conhecida)
    expect(await acharBinario('codex', ctx(), semShell)).toBeUndefined()
  })

  it.skipIf(process.platform === 'win32')('caminho configurado com ~ e cache de 60 s', async () => {
    const home = await pastaTemporaria()
    limpar.push(home)
    const bin = await executavel(path.join(home, 'bin'), 'agy')
    const c = ctx({ home, caminhoConfigurado: '~/bin/agy' })
    expect(await acharBinario('agy', c, { pastas: [], usarShell: false })).toBe(bin)
    await apagar(path.join(home, 'bin'))
    // ainda no cache
    expect(await acharBinario('agy', c, { pastas: [], usarShell: false })).toBe(bin)
    limparCacheBinarios()
    expect(await acharBinario('agy', c, { pastas: [], usarShell: false })).toBeUndefined()
  })

  it('Windows: procura .cmd e .exe', async () => {
    const base = await pastaTemporaria()
    limpar.push(base)
    const cmd = await escrever(base, 'npm/codex.cmd', '@echo off')
    const achado = await acharBinario('codex', { home: base, plataforma: 'win32', env: { PATH: '', PATHEXT: '.EXE;.CMD' } }, {
      pastas: [path.join(base, 'npm')],
      usarShell: false,
      semCache: true,
    })
    expect(achado).toBe(cmd)
  })
})

describe('prepararComando e PATH', () => {
  it('.cmd no Windows roda via cmd /c', () => {
    const p = prepararComando({ comando: 'C:\\npm\\codex.cmd', args: ['exec', '-C', 'C:\\Minha Pasta', '-'] }, 'win32', {})
    expect(p.comando).toBe('cmd.exe')
    expect(p.args.slice(0, 3)).toEqual(['/d', '/s', '/c'])
    expect(p.args[3]).toBe('"C:\\npm\\codex.cmd exec -C "C:\\Minha Pasta" -"')
    expect(p.verbatim).toBe(true)
    expect(prepararComando({ comando: '/usr/bin/claude', args: ['-p'] }, 'darwin', {})).toEqual({
      comando: '/usr/bin/claude',
      args: ['-p'],
      verbatim: false,
    })
  })

  it('a pasta do binário entra no começo do PATH', () => {
    expect(comPastaNoPath({ PATH: '/usr/bin' }, '/opt/node/bin/claude', 'darwin').PATH).toBe('/opt/node/bin:/usr/bin')
    expect(comPastaNoPath({ PATH: '/opt/node/bin:/usr/bin' }, '/opt/node/bin/claude', 'darwin').PATH).toBe('/opt/node/bin:/usr/bin')
    expect(comPastaNoPath({ Path: 'C:\\Windows' }, 'C:\\npm\\codex.cmd', 'win32').Path).toBe('C:\\npm;C:\\Windows')
    expect(comPastaNoPath({ PATH: '/usr/bin' }, 'claude', 'darwin').PATH).toBe('/usr/bin')
  })
})

describe('DivisorDeLinhas', () => {
  it('junta pedaços parciais e CRLF', () => {
    const d = new DivisorDeLinhas()
    expect(d.empurrar('{"a":')).toEqual([])
    expect(d.empurrar('1}\n{"b"')).toEqual(['{"a":1}'])
    expect(d.empurrar(':2}\r\n\n{"c":3}')).toEqual(['{"b":2}', ''])
    expect(d.terminar()).toEqual(['{"c":3}'])
    expect(d.terminar()).toEqual([])
  })
})

describe('rodar', () => {
  it('escreve o stdin, fecha e entrega as linhas', async () => {
    const linhas: string[] = []
    const script = `
      let dados = ''
      process.stdin.on('data', d => (dados += d))
      process.stdin.on('end', () => {
        process.stdout.write('linha 1\\nlinha')
        setTimeout(() => {
          process.stdout.write(' 2\\n' + JSON.stringify({ recebido: dados }) + '\\nsem fim')
          process.stderr.write('aviso no stderr\\n')
        }, 20)
      })`
    const r = await rodar(
      { comando: NODE, args: ['-e', script], stdin: 'olá, ação\n' },
      { onLinha: l => linhas.push(l) },
    )
    expect(r.codigo).toBe(0)
    expect(r.cancelado).toBe(false)
    expect(linhas).toEqual(['linha 1', 'linha 2', JSON.stringify({ recebido: 'olá, ação\n' }), 'sem fim'])
    expect(r.stderr).toContain('aviso no stderr')
  })

  it('passa o env do spec por cima do env base', async () => {
    const r = await rodarCurto(
      { comando: NODE, args: ['-e', 'console.log(process.env.MAZYOS_TESTE)'], env: { MAZYOS_TESTE: 'sim' } },
      5000,
      { env: { ...process.env, MAZYOS_TESTE: 'nao' } },
    )
    expect(r).toMatchObject({ codigo: 0, stdout: 'sim' })
  })

  it('cancelamento mata o processo', async () => {
    const controle = new AbortController()
    const inicio = Date.now()
    const promessa = rodar({ comando: NODE, args: ['-e', 'setInterval(() => {}, 1000)'] }, { sinal: controle.signal })
    setTimeout(() => controle.abort(), 100)
    const r = await promessa
    expect(r.cancelado).toBe(true)
    expect(Date.now() - inicio).toBeLessThan(4000)
  })

  it('SIGKILL quando o SIGTERM é ignorado', async () => {
    const controle = new AbortController()
    const promessa = rodar(
      { comando: NODE, args: ['-e', "process.on('SIGTERM', () => {}); console.log('pronto'); setInterval(() => {}, 1000)"] },
      {
        sinal: controle.signal,
        esperaKillMs: 200,
        onLinha: () => controle.abort(),
      },
    )
    const r = await promessa
    expect(r.cancelado).toBe(true)
    if (process.platform !== 'win32') expect(r.sinal).toBe('SIGKILL')
  })

  it('timeout e binário inexistente nunca lançam', async () => {
    const lento = await rodarCurto({ comando: NODE, args: ['-e', 'setTimeout(() => {}, 10000)'] }, 150)
    expect(lento.codigo).toBe(-1)
    const ausente = await rodarCurto({ comando: '/nao/existe/claude', args: [] }, 1000)
    expect(ausente.codigo).toBe(-1)
    expect(ausente.stderr).toMatch(/ENOENT/)
  })
})

describe('executarAgente', () => {
  const parserDeTeste = (linha: string) =>
    linha.startsWith('T:') ? [{ tipo: 'texto' as const, texto: linha.slice(2) }] : []

  it('sem fim do CLI e código de erro: fabrica fim com o stderr resumido', async () => {
    const eventos: unknown[] = []
    const fim = await executarAgente(
      { comando: NODE, args: ['-e', "console.log('T:parcial'); console.error('\\u001b[31merro: authentication required\\u001b[0m'); process.exit(3)"] },
      parserDeTeste,
      { onEvento: e => eventos.push(e) },
    )
    expect(fim).toMatchObject({ tipo: 'fim', status: 'erro', resposta: 'parcial', erro: 'erro: authentication required' })
    expect(eventos).toHaveLength(2)
  })

  it('sem fim do CLI e código 0: fim ok com o texto juntado', async () => {
    const fim = await executarAgente(
      { comando: NODE, args: ['-e', "console.log('T:a'); console.log('T:b')"] },
      parserDeTeste,
      { onEvento: () => undefined },
    )
    expect(fim).toEqual({ tipo: 'fim', status: 'ok', resposta: 'ab' })
  })

  it('um fim só, mesmo se o parser mandar dois', async () => {
    const eventos: { tipo: string }[] = []
    await executarAgente(
      { comando: NODE, args: ['-e', "console.log('F'); console.log('F')"] },
      linha => (linha === 'F' ? [{ tipo: 'fim', status: 'ok', resposta: 'x' }] : []),
      { onEvento: e => eventos.push(e) },
    )
    expect(eventos.filter(e => e.tipo === 'fim')).toHaveLength(1)
  })

  it('cancelado vira fim cancelado', async () => {
    const controle = new AbortController()
    setTimeout(() => controle.abort(), 100)
    const fim = await executarAgente(
      { comando: NODE, args: ['-e', 'setInterval(() => {}, 1000)'] },
      parserDeTeste,
      { sinal: controle.signal, onEvento: () => undefined },
    )
    expect(fim.status).toBe('cancelado')
  })

  it('resumirStderr', () => {
    expect(resumirStderr('\n\n a \n\u001b[1mb\u001b[0m\n')).toBe('a\nb')
  })
})
