import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { criarParserAntigravity } from '../src/agentes/parsers/antigravity'
import { criarParserClaude } from '../src/agentes/parsers/claude'
import { comandoLimpo, criarParserCodex } from '../src/agentes/parsers/codex'
import type { Parser } from '../src/agentes/tipos'
import type { EventoExecucao } from '../src/shared/protocolo'

const RAIZ = '/tmp/padaria-sol'

function fixture(nome: string): string[] {
  return readFileSync(path.join(__dirname, 'fixtures', nome), 'utf8').split('\n')
}

function rodar(parser: Parser, linhas: readonly string[]): EventoExecucao[] {
  return linhas.flatMap(linha => parser(linha))
}

/** Forma curta pra comparar sequências: tipo + o campo que importa. */
function forma(e: EventoExecucao): string {
  switch (e.tipo) {
    case 'inicio':
      return 'inicio'
    case 'texto':
      return 'texto'
    case 'ferramenta':
      return `ferramenta ${e.nome} ${e.estado}`
    case 'arquivo':
      return `arquivo ${e.acao} ${e.caminho}`
    case 'aviso':
      return 'aviso'
    case 'fim':
      return `fim ${e.status}`
  }
}

function fimDe(eventos: EventoExecucao[]): Extract<EventoExecucao, { tipo: 'fim' }> {
  const fim = eventos.find(e => e.tipo === 'fim')
  if (fim?.tipo !== 'fim') throw new Error('sem fim')
  return fim
}

describe('Claude Code', () => {
  it('claude.jsonl', () => {
    const eventos = rodar(criarParserClaude({ raiz: RAIZ }), fixture('claude.jsonl'))
    expect(eventos.map(forma)).toEqual(['inicio', 'texto', 'fim ok'])
    expect(eventos[0]).toEqual({ tipo: 'inicio', modelo: 'claude-sonnet-5-5', sessao: '8e6ec1fc-da5d-4322-8306-3b6ef43e5b82' })
    expect(fimDe(eventos)).toMatchObject({ resposta: 'OK', custoUsd: 0.1088155, duracaoMs: 1132, sessao: '8e6ec1fc-da5d-4322-8306-3b6ef43e5b82' })
  })

  it('claude-tool.jsonl', () => {
    const eventos = rodar(criarParserClaude({ raiz: RAIZ }), fixture('claude-tool.jsonl'))
    expect(eventos.map(forma)).toEqual(['inicio', 'ferramenta Read rodando', 'ferramenta Read ok', 'texto', 'fim ok'])
    const [, rodando, ok] = eventos
    expect(rodando).toEqual({ tipo: 'ferramenta', id: 'toolu_01UDtoz4zQk2tiM7noRQdAvL', nome: 'Read', resumo: 'README.md', estado: 'rodando' })
    expect(ok).toMatchObject({ id: 'toolu_01UDtoz4zQk2tiM7noRQdAvL', estado: 'ok', resumo: 'README.md' })
    const fim = fimDe(eventos)
    expect(fim.custoUsd).toBeCloseTo(0.1194313, 6)
    expect(fim.sessao).toBe('1c8e7031-d78d-4e0c-a73c-680b0e74936c')
    expect(fim.resposta).toContain('Padaria Sol')
  })

  it('escrita vira arquivo; erro de ferramenta vira erro; Bash resume o comando', () => {
    const parser = criarParserClaude({ raiz: RAIZ })
    const uso = (id: string, name: string, input: object) =>
      JSON.stringify({ type: 'assistant', parent_tool_use_id: null, message: { content: [{ type: 'tool_use', id, name, input }] } })
    const resultado = (id: string, erro = false, extra: object = {}) =>
      JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, content: erro ? 'Permissão negada' : 'ok', is_error: erro }] }, ...extra })
    const eventos = rodar(parser, [
      uso('a', 'Write', { file_path: `${RAIZ}/saidas/post.md`, content: 'x' }),
      resultado('a', false, { tool_use_result: { type: 'create' } }),
      uso('b', 'Edit', { file_path: `${RAIZ}/_memoria/empresa.md` }),
      resultado('b'),
      uso('c', 'Bash', { command: 'ls -la', description: 'Lista' }),
      resultado('c', true),
      uso('d', 'Write', { file_path: '/fora/x.md' }),
      resultado('d', false, { tool_use_result: { type: 'update' } }),
    ])
    expect(eventos.map(forma)).toEqual([
      'ferramenta Write rodando',
      'ferramenta Write ok',
      'arquivo criado saidas/post.md',
      'ferramenta Edit rodando',
      'ferramenta Edit ok',
      'arquivo editado _memoria/empresa.md',
      'ferramenta Bash rodando',
      'ferramenta Bash erro',
      'ferramenta Write rodando',
      'ferramenta Write ok',
      'arquivo editado /fora/x.md',
    ])
    expect(eventos[6]).toMatchObject({ resumo: 'ls -la' })
    expect(eventos[7]).toMatchObject({ resumo: 'Permissão negada' })
  })

  it('result com erro, linha que não é JSON e linha vazia', () => {
    const parser = criarParserClaude()
    expect(parser('')).toEqual([])
    expect(parser('   ')).toEqual([])
    expect(parser('Aviso solto no stdout')).toEqual([{ tipo: 'aviso', texto: 'Aviso solto no stdout' }])
    expect(parser('{"type":"rate_limit_event"}')).toEqual([])
    const [fim] = parser('{"type":"result","subtype":"success","is_error":true,"result":"Not logged in · Please run /login","session_id":"s"}')
    expect(fim).toMatchObject({ tipo: 'fim', status: 'erro', erro: 'Not logged in · Please run /login', sessao: 's' })
  })
})

describe('Codex', () => {
  it('codex.jsonl', () => {
    const eventos = rodar(criarParserCodex({ raiz: RAIZ }), fixture('codex.jsonl'))
    expect(eventos.map(forma)).toEqual(['inicio', 'aviso', 'texto', 'fim ok'])
    expect(eventos[0]).toEqual({ tipo: 'inicio', sessao: '01a1ad23-2997-7fc2-83fb-c7bf3d63288d' })
    expect(fimDe(eventos)).toMatchObject({ resposta: 'OK', sessao: '01a1ad23-2997-7fc2-83fb-c7bf3d63288d' })
  })

  it('codex-tool.jsonl', () => {
    const eventos = rodar(criarParserCodex({ raiz: RAIZ }), fixture('codex-tool.jsonl'))
    expect(eventos.map(forma)).toEqual([
      'inicio',
      'aviso',
      'texto',
      'ferramenta Comando rodando',
      'ferramenta Comando ok',
      'texto',
      'fim ok',
    ])
    expect(eventos[3]).toMatchObject({ id: 'item_2', resumo: 'cat README.md' })
    expect(eventos[4]).toMatchObject({ id: 'item_2', resumo: 'cat README.md' })
    expect(fimDe(eventos).resposta).toBe(
      'O README descreve a Padaria Sol, uma padaria de bairro em Curitiba que está focada em lançar um novo site.',
    )
  })

  it('erro de modelo da conta do ChatGPT vira um fim só, citando os modelos', () => {
    const [thread, aviso, turno] = fixture('codex.jsonl')
    const detalhe = "The 'gpt-5.5' model is not supported when using Codex with a ChatGPT account."
    const linhas = [
      thread ?? '',
      aviso ?? '',
      turno ?? '',
      JSON.stringify({ type: 'error', message: JSON.stringify({ detail: detalhe }) }),
      JSON.stringify({ type: 'turn.failed', error: { message: JSON.stringify({ detail: detalhe }) } }),
    ]
    const eventos = rodar(criarParserCodex({ modelosDisponiveis: ['gpt-6-luna', 'gpt-5.6-terra'] }), linhas)
    expect(eventos.map(forma)).toEqual(['inicio', 'aviso', 'fim erro'])
    const fim = fimDe(eventos)
    expect(fim.erro).toMatch(/Troque o modelo/)
    expect(fim.erro).toContain('gpt-6-luna, gpt-5.6-terra')
    expect(fim.sessao).toBe('01a1ad23-2997-7fc2-83fb-c7bf3d63288d')
  })

  it('comando com erro, file_change, mcp e busca', () => {
    const linhas = [
      { type: 'item.started', item: { id: 'c', type: 'command_execution', command: "bash -lc 'false'", status: 'in_progress' } },
      { type: 'item.completed', item: { id: 'c', type: 'command_execution', command: "bash -lc 'false'", exit_code: 1, status: 'failed' } },
      { type: 'item.completed', item: { id: 'f', type: 'file_change', status: 'completed', changes: [
        { path: `${RAIZ}/saidas/a.md`, kind: 'add' },
        { path: `${RAIZ}/b.md`, kind: 'update' },
        { path: `${RAIZ}/c.md`, kind: 'delete' },
      ] } },
      { type: 'item.started', item: { id: 'm', type: 'mcp_tool_call', server: 'docs', tool: 'buscar', status: 'in_progress' } },
      { type: 'item.completed', item: { id: 'm', type: 'mcp_tool_call', server: 'docs', tool: 'buscar', status: 'failed', error: { message: 'x' } } },
      { type: 'item.completed', item: { id: 'w', type: 'web_search', query: 'padarias curitiba' } },
      { type: 'item.completed', item: { id: 'r', type: 'reasoning', text: 'pensando' } },
      { type: 'turn.failed', error: { message: 'stream disconnected' } },
    ].map(l => JSON.stringify(l))
    const eventos = rodar(criarParserCodex({ raiz: RAIZ }), linhas)
    expect(eventos.map(forma)).toEqual([
      'ferramenta Comando rodando',
      'ferramenta Comando erro',
      'ferramenta Arquivos ok',
      'arquivo criado saidas/a.md',
      'arquivo editado b.md',
      'arquivo apagado c.md',
      'ferramenta docs.buscar rodando',
      'ferramenta docs.buscar erro',
      'ferramenta Busca na web ok',
      'fim erro',
    ])
    expect(fimDe(eventos).erro).toBe('stream disconnected')
  })

  it('comandoLimpo', () => {
    expect(comandoLimpo("/bin/zsh -lc 'cat README.md'")).toBe('cat README.md')
    expect(comandoLimpo('ls')).toBe('ls')
  })
})

describe('Antigravity', () => {
  it('agy-tool.jsonl', () => {
    const eventos = rodar(criarParserAntigravity({ raiz: RAIZ }), fixture('agy-tool.jsonl'))
    const formas = eventos.map(forma)
    expect(formas[0]).toBe('inicio')
    expect(formas.slice(1, 3)).toEqual(['ferramenta read_file rodando', 'ferramenta read_file ok'])
    expect(formas.slice(3, -1).every(f => f === 'texto')).toBe(true)
    expect(formas.slice(3, -1).length).toBe(7)
    expect(formas[formas.length - 1]).toBe('fim ok')
    expect(eventos[0]).toEqual({ tipo: 'inicio', modelo: 'gemini-3.8-flash-low', sessao: '6f35db12-87b5-4dc7-8d41-cbefd87bfd94' })
    expect(eventos[1]).toMatchObject({ id: 'passo-2', resumo: 'README.md' })
    const texto = eventos.flatMap(e => (e.tipo === 'texto' ? [e.texto] : [])).join('')
    expect(texto).toContain('descreve a **Padaria Sol**')
    expect(fimDe(eventos)).toMatchObject({ status: 'ok', duracaoMs: 7451, sessao: '6f35db12-87b5-4dc7-8d41-cbefd87bfd94' })
  })

  it('agy.jsonl e agy-stdin.jsonl', () => {
    for (const [nome, resposta] of [
      ['agy.jsonl', 'OK\n'],
      ['agy-stdin.jsonl', 'BANANA\n'],
    ] as const) {
      const eventos = rodar(criarParserAntigravity({ raiz: RAIZ }), fixture(nome))
      expect(eventos.map(forma), nome).toEqual(['inicio', 'texto', 'texto', 'fim ok'])
      expect(fimDe(eventos).resposta).toBe(resposta)
    }
  })

  it('escrita vira arquivo, erro de ferramenta e result com erro', () => {
    const passo = (step_index: number, state: string, tool_name: string, tool_info: object) =>
      JSON.stringify({ event: 'step_update', step_update: { step_index, state, step_type: 'tool', tool_name, tool_info } })
    const eventos = rodar(criarParserAntigravity({ raiz: RAIZ }), [
      passo(1, 'ACTIVE', 'write_to_file', { name: 'write_to_file', parameters: { TargetFile: `${RAIZ}/saidas/x.md` } }),
      passo(1, 'ACTIVE', 'write_to_file', { name: 'write_to_file', parameters: { TargetFile: `${RAIZ}/saidas/x.md` } }),
      passo(1, 'DONE', 'write_to_file', { name: 'write_to_file', parameters: { TargetFile: `${RAIZ}/saidas/x.md` } }),
      passo(2, 'DONE', 'replace_file_content', { parameters: { Instruction: 'troca', Arquivo: `${RAIZ}/a.md` } }),
      passo(3, 'DONE', 'run_command', { parameters: { CommandLine: 'rm -rf /' }, error: { type: 'denied', message: 'Comando negado' } }),
      JSON.stringify({ event: 'result', result: { conversation_id: 'c1', status: 'ERROR', error: 'authentication required', duration_seconds: 0.5 } }),
    ])
    expect(eventos.map(forma)).toEqual([
      'ferramenta write_to_file rodando',
      'ferramenta write_to_file ok',
      'arquivo criado saidas/x.md',
      'ferramenta replace_file_content ok',
      'arquivo editado a.md',
      'ferramenta run_command erro',
      'fim erro',
    ])
    expect(eventos[5]).toMatchObject({ resumo: 'Comando negado' })
    expect(fimDe(eventos)).toMatchObject({ erro: 'authentication required', duracaoMs: 500, sessao: 'c1' })
  })
})
