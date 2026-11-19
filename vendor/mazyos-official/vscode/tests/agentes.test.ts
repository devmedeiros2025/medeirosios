import { describe, expect, it } from 'vitest'

import { antigravity, lerModelosAgy, semLoginAgy } from '../src/agentes/antigravity'
import { claude, lerAuthClaude } from '../src/agentes/claude'
import { codex, lerAuthCodex } from '../src/agentes/codex'
import type { RequisicaoExecucao } from '../src/agentes/tipos'
import { promptDoArquivo } from '../src/agentes/terminal'

function req(extra: Partial<RequisicaoExecucao> = {}): RequisicaoExecucao {
  return { binario: '/bin/x', prompt: 'Olá "mundo"', cwd: '/tmp/padaria-sol', modelo: null, permissoes: 'edicoes', ...extra }
}

describe('comandos de execução (headless)', () => {
  it('Claude: prompt no stdin, permissões, modelo, resume e chave', () => {
    expect(claude.comandoExecucao(req())).toEqual({
      comando: '/bin/x',
      args: ['-p', '--output-format', 'stream-json', '--verbose', '--permission-mode', 'acceptEdits'],
      env: undefined,
      stdin: 'Olá "mundo"',
    })
    const tudo = claude.comandoExecucao(req({ permissoes: 'tudo', modelo: 'opus', sessao: 's1', chave: 'sk-ant-x' }))
    expect(tudo.args).toEqual([
      '-p', '--output-format', 'stream-json', '--verbose', '--permission-mode', 'bypassPermissions', '--model', 'opus', '--resume', 's1',
    ])
    expect(tudo.env).toEqual({ ANTHROPIC_API_KEY: 'sk-ant-x' })
  })

  it('Codex: flags de exec antes do resume e "-" no fim', () => {
    expect(codex.comandoExecucao(req()).args).toEqual([
      'exec', '--json', '-s', 'workspace-write', '--skip-git-repo-check', '-C', '/tmp/padaria-sol', '-',
    ])
    const r = codex.comandoExecucao(req({ permissoes: 'tudo', modelo: 'gpt-6-luna', sessao: 't1', chave: 'sk-1' }))
    expect(r.args).toEqual([
      'exec', '--json', '--dangerously-bypass-approvals-and-sandbox', '--skip-git-repo-check', '-C', '/tmp/padaria-sol',
      '-m', 'gpt-6-luna', 'resume', 't1', '-',
    ])
    expect(r.env).toEqual({ OPENAI_API_KEY: 'sk-1' })
    expect(r.stdin).toBe('Olá "mundo"')
  })

  it('Antigravity: prompt como linha NDJSON', () => {
    const r = antigravity.comandoExecucao(req({ modelo: 'gemini-4-argon-low', sessao: 'c1' }))
    expect(r.args).toEqual([
      '--input-format', 'stream-json', '--output-format', 'stream-json', '--mode', 'accept-edits',
      '--model', 'gemini-4-argon-low', '--conversation', 'c1',
    ])
    expect(r.stdin).toBe('{"event":"user","message":{"content":"Olá \\"mundo\\""}}\n')
    expect(JSON.parse(r.stdin ?? '')).toEqual({ event: 'user', message: { content: 'Olá "mundo"' } })
    expect(antigravity.comandoExecucao(req({ permissoes: 'tudo' })).args).toContain('--dangerously-skip-permissions')
    expect(antigravity.comandoExecucao(req()).env).toBeUndefined()
  })
})

describe('comandos de terminal', () => {
  it('lê o prompt do arquivo no zsh/bash e no PowerShell', () => {
    expect(promptDoArquivo("/tmp/it's.md", 'posix')).toBe(`"$(cat '/tmp/it'\\''s.md')"`)
    expect(promptDoArquivo('C:\\x\\p.md', 'powershell')).toBe("(Get-Content -Raw 'C:\\x\\p.md')")
  })

  it('cada CLI no modo interativo', () => {
    const r = req({ binario: '/Users/exemplo/.local/bin/agy' })
    expect(claude.comandoInterativo({ ...r, binario: '/usr/local/bin/claude' }, '/tmp/p.md', 'posix')).toBe(
      `'/usr/local/bin/claude' --permission-mode acceptEdits "$(cat '/tmp/p.md')"`,
    )
    expect(codex.comandoInterativo({ ...r, binario: '/opt/homebrew/bin/codex' }, '/tmp/p.md', 'posix')).toBe(
      `'/opt/homebrew/bin/codex' -s workspace-write -a on-request -C /tmp/padaria-sol "$(cat '/tmp/p.md')"`,
    )
    expect(antigravity.comandoInterativo(r, '/tmp/p.md', 'posix')).toBe(
      `'/Users/exemplo/.local/bin/agy' --mode accept-edits --prompt-interactive "$(cat '/tmp/p.md')"`,
    )
    expect(claude.comandoInterativo({ ...r, binario: 'C:\\npm\\claude.cmd' }, 'C:\\t\\p.md', 'powershell')).toBe(
      `& 'C:\\npm\\claude.cmd' --permission-mode acceptEdits (Get-Content -Raw 'C:\\t\\p.md')`,
    )
  })

  it('login e logout', () => {
    expect(claude.comandoLogin('/b/claude', 'posix')).toBe(`'/b/claude' auth login`)
    expect(codex.comandoLogin('/b/codex', 'posix')).toBe(`'/b/codex' login`)
    expect(antigravity.comandoLogin('/b/agy', 'posix')).toBe(`'/b/agy'`)
    expect(claude.comandoLogout('/b/claude')).toEqual({ comando: '/b/claude', args: ['auth', 'logout'] })
    expect(antigravity.comandoLogout('/b/agy')).toBeNull()
  })
})

describe('leitura de conta e modelos', () => {
  it('claude auth status guarda só e-mail e plano', () => {
    const auth = lerAuthClaude(
      JSON.stringify({ loggedIn: true, authMethod: 'claude.ai', email: 'ana@exemplo.com', orgId: 'org-1', orgName: 'X', subscriptionType: 'max' }),
      0,
    )
    expect(auth).toEqual({ estado: 'conectado', metodo: 'assinatura', conta: 'ana@exemplo.com', detalhe: 'Max' })
    expect(lerAuthClaude(JSON.stringify({ loggedIn: false }), 1)).toEqual({ estado: 'desconectado' })
    expect(lerAuthClaude('lixo', -1).estado).toBe('desconectado')
  })

  it('codex login status', () => {
    expect(lerAuthCodex('Logged in using ChatGPT')).toMatchObject({ estado: 'conectado', metodo: 'assinatura', detalhe: 'ChatGPT' })
    expect(lerAuthCodex('Logged in using an API key - sk-***')).toMatchObject({ estado: 'conectado', metodo: 'chave' })
    expect(lerAuthCodex('Not logged in')).toEqual({ estado: 'desconectado' })
  })

  it('agy models', () => {
    const saida = 'Fetching available models...\ngemini-4-argon-low\tGemini 4 Argon (Low)\nclaude-opus-5-5-high\tClaude Opus 5.5 (High)\n'
    expect(lerModelosAgy(saida)).toEqual([
      { id: 'gemini-4-argon-low', rotulo: 'Gemini 4 Argon (Low)' },
      { id: 'claude-opus-5-5-high', rotulo: 'Claude Opus 5.5 (High)' },
    ])
    expect(semLoginAgy('Error: You are not logged into Antigravity')).toBe(true)
    expect(semLoginAgy(saida)).toBe(false)
  })
})
