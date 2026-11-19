# MazyOS para VS Code e Antigravity: arquitetura

Este documento é o contrato de trabalho da extensão. Quem mexe em `src/`, `webview/`
ou `tests/` lê isto antes.

## O que a extensão é

O MazyOS é um plugin do Claude Code (a raiz deste repositório): memória do negócio em
`_memoria/`, identidade em `identidade/`, 17 skills. A extensão leva o mesmo sistema pra
dentro do VS Code e do Antigravity IDE (que é um fork do VS Code e instala extensões do
Open VSX) e deixa o usuário escolher **qual agente roda as skills**, cada um com a conta
que ele já paga, pelo caminho oficial de cada fabricante:

| Agente (`AgenteId`) | CLI que a extensão chama | Conta | Login oficial |
| --- | --- | --- | --- |
| `claude` | Claude Code (`claude`) | Claude Pro, Max ou Team, ou chave da API da Anthropic | `claude auth login` |
| `codex` | Codex CLI (`codex`) | ChatGPT Plus, Pro ou Business, ou chave da API da OpenAI | `codex login` (navegador) ou `codex login --device-auth` |
| `antigravity` | Antigravity CLI (`agy`) | Conta Google (cota do Antigravity: Gemini, Claude e GPT-OSS) | o próprio `agy` abre o login no navegador na primeira execução |

A extensão **nunca** fala com as APIs dos fabricantes por conta própria nem reaproveita
token de outro produto. Ela monta o pedido, chama o CLI em modo headless com saída em
JSON por linha e desenha o que acontece. Chave de API, quando o usuário preferir, fica no
`SecretStorage` do editor e entra só como variável de ambiente do processo do CLI
(`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`). O Antigravity não aceita chave: é login Google.

## Pastas

```
vscode/
  package.json            manifesto da extensão (contribuições, comandos, configurações)
  esbuild.mjs             dois bundles: dist/extension.js (Node) e dist/webview.js (+ .css)
  scripts/preparar-plugin.mjs  copia ../skills e ../templates pra vscode/mazyos/ (vai no .vsix)
  media/                  ícone da activity bar (mazyos.svg) e do marketplace (icone.png)
  src/
    extension.ts          activate(): registra comandos, painel, console, barra de status, watchers
    shared/protocolo.ts   tipos trocados entre host e webview (sem vscode, sem node, sem DOM)
    nucleo/               lógica pura, testável sem vscode:
      memoria.ts          lê _memoria/*.md e identidade/design-guide.md (porte de ../hooks/memoria.ts)
      sistema.ts          o texto de regras que vai no pedido (porte de ../hooks/sistema.ts)
      catalogo.ts         lista as skills do plugin embutido + metadados (grupo, modo, ícone, exemplo)
      pedido.ts           monta o prompt final: regras + memória + skill + pedido do usuário
    agentes/
      tipos.ts            interface Agente e tipos internos
      processo.ts         acha o binário, roda o CLI, parte a saída em linhas, cancela, timeouts
      claude.ts codex.ts antigravity.ts   um adaptador por CLI (detecção, auth, modelos, comando, terminal)
      parsers/            uma função pura por CLI: linha de stdout -> EventoExecucao[]
    execucoes.ts          gerencia execuções em andamento e o histórico (workspaceState)
    ui/
      painel.ts           WebviewViewProvider da barra lateral (view mazyos.painel)
      console.ts          WebviewPanel do console do Mazy (abre ao lado do editor)
      html.ts             monta o HTML das webviews com CSP, nonce e URIs do dist/
  webview/
    main.tsx              ponto de entrada; lê window.mazyos.view e monta <Painel/> ou <Console/>
    ...                   componentes, estilos e hooks da interface (React 19, CSS puro)
  tests/                  vitest; fixtures/*.jsonl são saídas reais dos três CLIs
  mazyos/                 gerado por `npm run preparar`: skills/, templates/, plugin.json (ignorado no git)
```

Regras de código:

- Nomes em português, como no plugin (`memoria`, `pedido`, `execucao`). Identificadores
  técnicos de fora (`activate`, `WebviewViewProvider`, nomes de flags) ficam como são.
- `src/nucleo/`, `src/agentes/parsers/` e `src/shared/` **não importam `vscode`**. Isso é o
  que permite testar com vitest. Tudo que depende do editor fica em `src/ui/`,
  `src/execucoes.ts` e `src/extension.ts`. Os adaptadores em `src/agentes/*.ts` recebem o que
  precisam (caminhos, env, callbacks) por parâmetro e usam só `node:*`.
- Nada quebra a extensão: erro de CLI vira `EventoExecucao` de tipo `fim` com `status: 'erro'`
  e um aviso na interface. Falha de detecção vira `auth.estado = 'ausente'`/`'desconhecido'`.
- Nunca imprimir chaves ou tokens em log, toast ou console.
- Nunca escrever dentro de `vscode/mazyos/` em tempo de execução (é a cópia do plugin).

## Fluxo de uma execução ("tarefa")

1. A interface manda `{ tipo: 'rodar', skill?, pedido }`.
2. `execucoes.ts` cria uma `Execucao` (id curto, agente e modelo das configurações) e avisa
   a interface com `{ tipo: 'execucao' }`.
3. `nucleo/pedido.ts` monta o prompt (seção "Composição do pedido" abaixo).
4. O adaptador do agente devolve `{ comando, args, env, stdin? }`; `processo.ts` faz o spawn
   com `cwd` = raiz do workspace, **stdin fechado** depois de escrever o prompt (o Codex e o
   Claude esperam EOF; sem isso o processo fica pendurado).
5. Cada linha de stdout passa pelo parser do agente e vira zero ou mais `EventoExecucao`,
   mandados pra interface com `{ tipo: 'evento', id, evento }` e acumulados na `Execucao`.
6. No fim (evento `fim`), a `Execucao` recebe `estado`, `resposta`, `sessao`, `custoUsd`;
   o histórico vai pro `workspaceState` (últimas 20, com os eventos de texto juntados).
7. Se o pedido mexeu em `_memoria/` ou `identidade/design-guide.md`, o watcher relê o
   workspace e manda um `estado` novo.

Cancelar: `SIGTERM` no processo; se não sair em 2 s, `SIGKILL`. A execução termina com
`status: 'cancelado'`.

Skills de modo `conversa` (as que entrevistam o usuário: `instalar`, `novo-projeto`,
`mapear-rotinas`, `atualizar`, `criacao-canonica-de-skills`, `prospecta-maps`) não rodam
no console: a extensão escreve o prompt num arquivo temporário e abre o CLI **interativo**
num terminal do editor com esse prompt inicial (`claude "<prompt>"`, `codex "<prompt>"`,
`agy --prompt-interactive='<prompt>'`). No terminal o usuário conversa com o agente até o fim.
Pra não estourar a linha de comando, o texto vai pelo arquivo: no zsh/bash,
`claude "$(cat '/caminho/pedido.md')"`; no PowerShell, `claude (Get-Content -Raw 'C:\...\pedido.md')`.

## Os três CLIs em modo headless

Tudo abaixo foi verificado nesta máquina (Claude Code 2.1.318, Codex 0.166.0, Antigravity
CLI 1.5.0); as saídas reais estão em `tests/fixtures/`.

### Claude Code

```
claude -p --output-format stream-json --verbose --permission-mode <modo> [--model <id>] [--resume <sessao>]
```

- O prompt vai pelo **stdin** (com `-p` e sem prompt posicional, o Claude lê o stdin até EOF).
- `--verbose` é obrigatório com `stream-json` em `-p`.
- Permissões: `edicoes` → `--permission-mode acceptEdits`; `tudo` → `--permission-mode bypassPermissions`.
- Eventos (uma linha JSON por evento): `{"type":"system","subtype":"init","session_id","model","tools":[...]}`,
  `{"type":"assistant","message":{"content":[{"type":"text","text"}|{"type":"tool_use","id","name","input"}]}}`,
  `{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id","content","is_error"?}]}}`,
  `{"type":"result","subtype":"success"|"error_*","result":"<texto final>","is_error","session_id","total_cost_usd","duration_ms","num_turns"}`.
  Pode vir `{"type":"rate_limit_event",...}` (ignorar). Com `--include-partial-messages` viriam
  `stream_event` com deltas; não usamos por padrão (o texto chega por mensagem inteira).
- Arquivo editado: `tool_use` com `name` em `Write`/`Edit`/`MultiEdit`/`NotebookEdit` e `input.file_path`.
- Auth: `claude auth status` imprime JSON `{loggedIn, authMethod ("claude.ai"), email, subscriptionType ("max"), loginExpiresAt, ...}`.
  Login: `claude auth login`. Logout: `claude auth logout`. Com `ANTHROPIC_API_KEY` no ambiente o CLI usa a chave.
- Modelos: lista fixa de apelidos que o CLI aceita: `opus`, `sonnet`, `haiku` (rótulos: "Opus, o mais capaz", "Sonnet, equilíbrio", "Haiku, o mais rápido"), mais "padrão do Claude Code" (= sem `--model`).
- Instalação: `npm install -g @anthropic-ai/claude-code` (ou o instalador nativo em claude.ai/code).

### Codex

```
codex exec --json -s <sandbox> --skip-git-repo-check -C <cwd> [-m <modelo>] -
```

- O `-` final diz que o prompt vem pelo stdin. Mesmo com prompt posicional o Codex lê o
  stdin ("Reading additional input from stdin..."), então **sempre** fechar o stdin.
- Permissões: `edicoes` → `-s workspace-write`; `tudo` → `--dangerously-bypass-approvals-and-sandbox`.
- Eventos: `{"type":"thread.started","thread_id"}`, `{"type":"turn.started"}`,
  `{"type":"item.started"|"item.updated"|"item.completed","item":{"id","type","..."}}` onde `item.type` é
  `agent_message` (`text`), `reasoning` (`text`), `command_execution` (`command`, `aggregated_output`, `exit_code`, `status`),
  `file_change` (`changes:[{path, kind:"add"|"update"|"delete"}]`, `status`), `mcp_tool_call`, `web_search`, `todo_list`, `error` (`message`);
  `{"type":"turn.completed","usage":{...}}`, `{"type":"turn.failed","error":{"message"}}`, `{"type":"error","message"}`.
  Itens `error` com "Under-development features enabled" são aviso, não erro.
- A resposta final é o último `agent_message` completado.
- Retomar: `codex exec resume <thread_id> -` (mesmas flags).
- Auth: `codex login status` imprime "Logged in using ChatGPT" | "Logged in using an API key" | "Not logged in" (sai com 1).
  Login: `codex login` (navegador) ou `codex login --device-auth`. Logout: `codex logout`.
  Chave: variável `OPENAI_API_KEY` no ambiente do processo.
- Modelos: `~/.codex/models_cache.json` tem `{"models":[{"slug": "..."}]}` com o que a conta aceita
  (nesta máquina: `gpt-6-luna`, `gpt-5.6-terra`, `gpt-5.6-luna`...). O `model` do `~/.codex/config.toml`
  pode apontar pra um modelo que a conta do ChatGPT não aceita: aí o `turn.failed` diz
  "model is not supported when using Codex with a ChatGPT account" e a interface sugere trocar o modelo.
- Instalação: `npm install -g @openai/codex` ou `brew install codex`.

### Antigravity CLI (`agy`)

```
agy --input-format stream-json --output-format stream-json --mode <modo> [--model <id>] [--conversation <id>]
```

- O prompt vai pelo **stdin**, como uma linha NDJSON, e depois o stdin fecha:
  `{"event":"user","message":{"content":"<prompt>"}}` (`content` aceita string ou
  `[{"type":"text","text":"..."}]`). Verificado nesta máquina (`tests/fixtures/agy-stdin.jsonl`).
  Com `--input-format stream-json` qualquer `-p` é descartado. A forma `agy -p "<prompt>"` também
  existe, mas `-p` solto engole a flag seguinte como prompt; só usar com o prompt curto e por último.
- Permissões: `edicoes` → `--mode accept-edits` (aprova criar e editar arquivos no workspace; comando
  de terminal que exigiria aprovação é negado de leve: a execução continua, sai com 0 e o aviso vai
  pro stderr); `tudo` → `--dangerously-skip-permissions`. Leitura só: `--mode plan`.
- Eventos: `{"event":"init","conversation_id","init":{"model","cwd","tools":[...],"permission_mode"}}`,
  `{"event":"step_update","step_update":{"conversation_id","step_index","state":"ACTIVE"|"DONE","step_type":"user_input"|"agent_response"|"tool"|"checkpoint","text_delta"?,"tool_name"?,"tool_info"?:{"name","parameters","output"?,"error"?:{"type","message"}},"usage"?,"duration_seconds"?,"subagent_info"?}}`,
  `{"event":"result","result":{"conversation_id","status":"SUCCESS"|"ERROR"|"CANCELED"|"INTERRUPTED"|"INVALID","response","error"?,"duration_seconds","num_turns","usage"}}`.
  `agent_response` chega em deltas (`text_delta`) com o mesmo `step_index`; juntar. Ferramentas de
  escrita têm `tool_name` como `write_to_file`, `replace_file_content`, `multi_replace_file_content`
  (o parâmetro do caminho vem em `tool_info.parameters` com nomes como `TargetFile`/`Path`; usar o
  primeiro valor que pareça caminho). Diagnósticos vão pro stderr; stdout é só o NDJSON.
- Retomar: `--conversation <conversation_id>` ou `--continue`. `--print-timeout` padrão 0 (sem limite).
- Auth: não há subcomando de login nem de status. O login acontece no navegador ao abrir o `agy`
  interativo (a extensão abre um terminal com `agy` e explica). Headless usa a credencial guardada no
  keyring do sistema; sem login, o CLI sai com erro "authentication required" em vez de travar.
  Pra checar: `agy models` lista `id<TAB>rótulo` quando logado; sem login a saída contém
  "not logged into Antigravity"/"authentication required". Conta ativa: `~/.gemini/google_accounts.json`
  → `active` (um e-mail; mostrar, nunca logar). Logout só pelo comando `/logout` dentro do `agy`
  interativo. Alternativa sem conta: `"modelProvider": "gemini"` em
  `~/.gemini/antigravity-cli/settings.json` + `GEMINI_API_KEY`; a extensão não mexe nisso, só documenta.
- Modelos: `agy models` (nesta máquina: `gemini-4-argon-{low,medium,high}`, `gemini-3.8-flash-*`,
  `claude-opus-5-5-*`, `claude-sonnet-5-5-*`, `gpt-oss-120b-medium`).
- Instalação: o instalador em antigravity.google (o binário cai em `~/.local/bin/agy`).

### Achar o binário

O VS Code aberto pelo Dock do macOS tem um PATH curto. Ordem: `mazyos.caminhos.<id>` nas
configurações → `PATH` do processo → pastas conhecidas (`~/.local/bin`, `/opt/homebrew/bin`,
`/usr/local/bin`, `~/.claude/local`, `~/.npm-global/bin`, `~/.volta/bin`, `~/.bun/bin`,
`~/.nvm/versions/node/*/bin`, no Windows `%APPDATA%\npm` e `%LOCALAPPDATA%\Programs`) → por
último, um shell de login **não interativo** com timeout de 3 s (`zsh -lc 'whence -p claude'`,
`bash -lc 'type -P claude'`; nunca `-i`, porque o `.zshrc` do usuário pode ter aliases como
`alias claude='claude --dangerously-skip-permissions'`). No Windows, binários do npm são `.cmd`:
rodar via `cmd /c`.

Detecção e auth rodam em paralelo no `activate` e de novo em `recarregar`; cada chamada tem
timeout (5 s detecção, 15 s `agy models`) e cache de 60 s.

## Composição do pedido (`nucleo/pedido.ts`)

O prompt é o mesmo pros três agentes. Estrutura, em Markdown:

```
# MazyOS

<regras do sistema, enxutas: porte de ../hooks/sistema.ts sem as partes que falam de /mazyos:<skill>>
Responda em português do Brasil. Trabalhe só dentro da pasta <raiz>. Entregáveis vão em saidas/
(ou onde a skill mandar). No fim, resuma o que fez e liste os arquivos criados ou alterados com o caminho.

## Memória do negócio
### _memoria/empresa.md
<conteúdo, só se preenchido>
### _memoria/preferencias.md ...
### _memoria/estrategia.md ...
### identidade/design-guide.md ... (sempre que preenchido; é curto)

## Skill: <nome>
<corpo da SKILL.md sem o frontmatter, com substituições>

## Pedido
<texto do usuário>
```

Substituições no corpo da skill: `${CLAUDE_PLUGIN_ROOT}` → caminho absoluto de `vscode/mazyos`;
`${CLAUDE_SKILL_DIR}` → `vscode/mazyos/skills/<nome>`; `/mazyos:<outra-skill>` → "a skill
<outra-skill> do MazyOS" (os CLIs não têm o plugin carregado). Sem skill (pedido livre), a
seção "Skill" não entra e a lista de skills disponíveis entra em uma linha, pra o agente
poder sugerir uma.

## Catálogo (`nucleo/catalogo.ts`)

Lê `vscode/mazyos/skills/*/SKILL.md`, pega `name` e `description` do frontmatter e junta com
metadados fixos. Grupos e modos de partida (ajuste se a SKILL.md disser outra coisa):

| Grupo | Skills (modo) |
| --- | --- |
| `dia-a-dia` | instalar (conversa), abrir (tarefa), atualizar (conversa), salvar (tarefa), mapear-rotinas (conversa), novo-projeto (conversa) |
| `conteudo` | carrossel, aprovar-post, publicar-tema, seo, email-profissional, responder-avaliacoes (todas tarefa) |
| `ads` | anuncio-google, relatorio-ads (tarefa) |
| `prospeccao` | prospecta-maps (conversa) |
| `producao` | analisar-dados (tarefa), criacao-canonica-de-skills (conversa) |

## Interface

Duas webviews com o mesmo bundle (`dist/webview.js` + `dist/webview.css`), diferenciadas por
`window.mazyos.view`:

- **Painel** (barra lateral, view `mazyos.painel`): estado do negócio, agente e conta, campo
  de pedido, skills por grupo, execuções recentes.
- **Console do Mazy** (`WebviewPanel`, `ViewColumn.Beside`, `retainContextWhenHidden`): a
  execução em andamento, com a linha do tempo de eventos, a resposta final em Markdown e as
  ações (copiar, salvar em `saidas/`, abrir arquivo, continuar a conversa).

O host guarda o estado e manda fotos completas (`{ tipo: 'estado' }`) sempre que algo muda,
mais eventos incrementais durante uma execução. A interface é burra de propósito: desenha o
que recebe e manda intenções.

CSP: `default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${cspSource}; img-src ${cspSource} data: https:`.
Fontes e imagens entram por `webview.asWebviewUri`. Links externos vão por `{ tipo: 'abrirExterno' }`.

## Comandos e integração com o editor

- `mazyos.abrirPainel`, `mazyos.pedir` (foca o campo de pedido; sem painel visível, abre um
  `InputBox`), `mazyos.rodarSkill` (QuickPick das skills), `mazyos.instalar`, `mazyos.recarregar`,
  `mazyos.abrirMemoria`, `mazyos.escolherAgente` (QuickPick), `mazyos.entrar`, `mazyos.definirChave`
  (InputBox com `password: true`), `mazyos.abrirConsole`, `mazyos.cancelar`.
- Barra de status (à esquerda): `$(rocket) MazyOS · <nome> · foco: <foco>`; sem workspace
  instalado, `$(rocket) MazyOS`; clique abre o painel. Durante uma execução vira
  `$(sync~spin) Mazy · <skill ou "pedido">` e o clique abre o console.
- Watchers: `_memoria/**/*.md`, `identidade/design-guide.md`, `CLAUDE.md` → relê e manda estado.
- `onStartupFinished` ativa; sem pasta aberta, o painel mostra o estado "sem pasta".

## Decisões tomadas na implementação

- `salvar` ficou em modo `tarefa`: ela pede uma confirmação só, não entrevista. Em modo `tarefa` o
  prompt manda o agente fazer a pergunta no fim e parar; o usuário responde pelo "continuar" do console.
- Cada continuação é uma `Execucao` nova, com o mesmo agente e a `sessao` da anterior. Sem sessão,
  o pedido e a resposta anteriores entram no prompt.
- Codex: todo `item.type: 'error'` vira `aviso`, menos o erro de modelo, que vira o `fim`. Erro de
  topo com "Reconnecting" é aviso. As flags do `exec` vão antes de `resume` (o subcomando rejeita `-s` e `-C`).
- Antigravity: `CANCELED` e `INTERRUPTED` viram `cancelado`; "instalar" abre antigravity.google no
  navegador. Claude: texto de subagente (`parent_tool_use_id`) não entra no texto principal.
- `rodar` põe a pasta do binário na frente do PATH do processo: sem isso um CLI instalado pelo npm
  não acha o `node` quando o editor foi aberto pelo Dock.
- Com chave guardada no `SecretStorage`, `auth` mostra `{ conectado, metodo: 'chave' }`.
- O prompt interativo vai num arquivo em `globalStorage/pedidos/`, apagado depois de 24 h.
- A interface manda `{ tipo: 'abrirPastaDoNegocio' }` na tela sem pasta; o host abre o seletor de pastas do editor.
- O catálogo tem uma `descricao` própria por skill, em segunda pessoa, no lugar da descrição do
  frontmatter (que foi escrita pro agente, não pra quem usa).
- Testado de verdade: Claude Code, Codex e Antigravity rodaram um pedido curto cada um pela extensão,
  com retomada de sessão; e o fluxo completo (painel → console → resposta) foi conferido no editor.
  Nada foi testado no Windows.

## Verificação

```
npm run build          # preparar + esbuild
npm run tipos          # tsc nos dois tsconfig
npm test               # vitest
npm run empacotar      # .vsix (precisa de media/icone.png)
code --extensionDevelopmentPath=$PWD   # testar ao vivo
```

Antes de dar a extensão por pronta: `npm run verificar` verde, `.vsix` gerado, e um teste
real em `code --extensionDevelopmentPath` com um workspace de exemplo
(`templates/workspace` copiado pra uma pasta e preenchido).
