# Evidência final do harness — 2026-11-20

Repositório: `C:\Users\Mauricio Medeiros\AppData\Local\Temp\opencode\medeirosios`
Base remota: `https://github.com/devmedeiros2025/medeirosios.git` (branch `main`, sem push)

## Gates obrigatórios

| Gate | Comando | Resultado |
| --- | --- | --- |
| Suíte completa | `node --test tests/*.test.mjs` | `tests 42`, `pass 42`, `fail 0`, `EXIT=0` |
| Integridade do ecossistema | `node scripts/ecosystem.mjs doctor` | `ok:true`, `importedFiles:1727`, `upstreamRepositories:11`, `specialties:31`, `errors:[]` |
| Servidor MausBot | `openmausbot doctor --json` | `ok:true`, `health.status:"connected"`, `endpoint:"http://127.0.0.1:8799"` |
| Clientes MCP | `node scripts/verify-mcp.mjs` | `ok:true`, 6/6 checagens, cliente sistema com 12 ferramentas e cliente mausbot com 20 ferramentas |
| Team file | `openmausbot team apply config/mausbot-team.json --dry-run --json` | `ok:true`, `created:11`, `changed:0`, `applied:false`, `warnings:[]`, modelo `claude/claude-sonnet-5-5` aceito |
| Painel local | `node scripts/ui/server.mjs` + requests em `127.0.0.1:8765` | `/`, `/api/inventario`, `/api/integridade`, `/api/ferramentas`, `/api/inteligencias` → HTTP 200 |

## Aplicação real do team file no MausBot

- `openmausbot team apply config/mausbot-team.json --json` → `ok:true`, `created:11`, `applied:true`, `writes:22`, `warnings:[]`.
- `openmausbot team apply config/mausbot-team.json --check --json` → `ok:true`, `plan:[]`, `unchanged:35`, `EXIT=0` (idempotente).
- `list_bots` via MCP → 10 bots: os 9 do time `MEDEIROS SYSTEM` e o bot padrão preservado; modelo `claude/claude-sonnet-5-5`.
- `openmausbot team export --team "MEDEIROS SYSTEM" --out ...` → `1 teams, 9 bots, 1 rooms, 351 skills`; as 8 inteligências `intel-*` aparecem acopladas a cada bot.
- Nenhum `--prune` foi usado: nada foi deletado do workspace.

## Registro MCP nos clientes

`powershell -NoProfile -ExecutionPolicy Bypass -File scripts\install-mcp.ps1`

- `codex`: `[mcp_servers.openmausbot]` — backup `config.toml.bak-20261120025959276`
- `opencode`: `mcp.openmausbot` — backup `opencode.json.bak-20261120025959276`
- `claude`: `mcpServers.openmausbot` — backup `.claude.json.bak-20261120025959276`
- Resultado: `ok:true`, três clientes alterados, todos com backup prévio.

## Correções aplicadas nesta rodada

1. `scripts/mcp/cliente.mjs`: parsing de stdout por `indexOf('\n')` em vez de `split().shift()`, evitando perda de chunks parciais.
2. `scripts/mcp/cliente.mjs`: timeout de 15 s por requisição e resolução de pendências em `error`/`exit` do processo filho.
3. `scripts/mcp/cliente.mjs`: spawn do `openmausbot.cmd` via `cmd.exe /d /s /c openmausbot.cmd mcp` sem aspas internas, eliminando o aviso `DEP0190` e o erro de comando não reconhecido.

## Limitações reais (não mascaradas)

- Smoke test de delegação real via `codex exec` não pôde ser executado: limite externo `You've hit your usage limit ... try again at Nov 20th, 2026 3:35 AM`. Nenhum `runtimeId` foi inventado e nenhum item foi marcado como concluído sem retorno real.
- Google Stitch MCP respondeu `Not logged in`; as cores do painel foram inspiradas manualmente em Stitch/Material (índigo `#4f46e5`, superfícies claras).
- `gh repo list` retornou `HTTP 401: Bad credentials`; o clone por HTTPS com o helper de credenciais do GitHub CLI funciona.
- `openmausbot doctor` emitiu apenas o aviso de que `agent-browser` não está instalado nesta máquina; não bloqueia o harness.

## Estado de publicação

Nenhum `git push` foi executado. Publicação depende de autorização explícita.
