# Harness de execução

Este documento descreve o loop real do MEDEIROS SYSTEM: como um pedido vira fila,
como cada agente recebe inteligência, como o resultado é verificado e como o
MausBot coordena o ecossistema.

## 1. Classificação

`chooseWorkflow` em `scripts/workflows.mjs` escolhe um dos sete fluxos. A escolha
pode ser forçada com `--workflow`. Cada etapa tem responsável, especialidades,
dependências e critério de aceite.

## 2. Fila persistente

`scripts/orchestrator.mjs` grava `.mazyos/runs/<runId>/fila.json`. Estados:
`pendente`, `em_execucao`, `concluido` e `bloqueado`.

- Nenhum item vira `concluido` sem `runtimeId` real retornado pelo delegador.
- Falha ou ID ausente gera `bloqueado` com motivo — nunca conclusão inventada.
- A retomada reenvia somente itens pendentes; concluídos não são reenviados.
- Itens independentes do mesmo ciclo são despachados em paralelo.

## 3. Inteligências

`scripts/intel.mjs` sugere inteligências a partir da tarefa e grava os IDs no item.
`scripts/codex-delegado.mjs` injeta os parâmetros no prompt. O índice completo está
em `docs/INTELIGENCIAS.md`.

## 4. Delegação real

`scripts/codex-delegado.mjs` chama `codex exec --json` e lê `session_id`/`thread_id`
do JSONL. O ID real é registrado na fila. Bloqueios externos (limite de uso, falta de
autenticação) são reportados comobloqueio — nunca como sucesso.

## 5. MCP

`scripts/mcp/server.mjs` implementa JSON-RPC 2.0 sobre stdio com 12 ferramentas:

| Ferramenta | Função |
| --- | --- |
| `enviar_tarefa` | Classifica, sugere inteligências e executa a fila |
| `listar_especialidades` | Lista as 31 especialidades |
| `ler_contrato` | Lê um contrato Markdown do núcleo |
| `criar_plano` | Registra equipe sem iniciar agentes |
| `consultar_plano` | Consulta plano ou fila persistida |
| `registrar_agente` | Registra ID real de início |
| `validar_integridade` | Executa `doctor` |
| `ler_memoria` / `escrever_memoria` | Memória do projeto ativo |
| `status_orquestrador` | Fila + inventário |
| `listar_inteligencias` / `ler_inteligencia` | Inteligências acopladas |

## 6. Painel Windows

`scripts/iniciar-sistema.cmd` inicia `scripts/ui/server.mjs` em `http://127.0.0.1:8765`
com Node puro, sem dependências. As rotas `/api/inventario`, `/api/integridade`,
`/api/ferramentas` e `/api/inteligencias` expõem o estado do harness.

## 7. MausBot

O MausBot é o orquestrador do ecossistema. A integração usa a CLI oficial:

- `openmausbot mcp` — servidor MCP do MausBot para registrar nos clientes.
- `openmausbot serve --port 8799 --no-pair` — harness local.
- `openmausbot team apply <arquivo>` — aplica a equipe com Room Lead e 8 agentes.
- `openmausbot run` / `send` / `wait` — execução e acompanhamento headless.

O arquivo de equipe fica em `config/mausbot-team.json`. Nenhuma mensagem é enviada e
nenhuma publicação é feita sem autorização explícita.

## 8. Verificação

```powershell
node --test tests/*.test.mjs
node scripts/ecosystem.mjs doctor
node scripts/mcp/cliente.mjs
node scripts/verify-mcp.mjs
```

O gate de integridade exige `ok:true`, `errors:[]`, `importedFiles:1727`,
`upstreamRepositories:11` e `specialties:31`. Hashes do manifesto são comparados
nas formas LF e CRLF porque o manifesto foi gerado no Windows e o checkout do git
pode gravar outro terminador de linha.
