# MEDEIROS SYSTEM

Camada de integração própria para coordenação de agentes, fluxos de entrega e
ponte de runtime, com 31 especialidades preservadas de fontes de engenharia e
negócio. Nenhum conteúdo de cliente é distribuído neste repositório.

## O que este repositório faz

- **Coordena equipes de agentes** com papéis explícitos (orquestrador, executor e
  revisor), registra a equipe em `.mazyos/runs` e nunca inventa IDs de agentes
  iniciados — nenhum é marcado como iniciado até a ferramenta real retornar o ID.
- **Executa sete fluxos de entrega**: `sistema`, `lancamento`, `manutencao`,
  `conteudo`, `comercial`, `analise` e `geral`. Cada etapa tem responsável,
  dependências, especialidades, critério de aceite e evidências.
- **Disponibiliza 31 especialidades**: 9 da suíte de engenharia (buildx, designx, legadox,
  memox, mergex, prodx, runx, sprintx, stackx), 17 especialidades de negócio e 5
  bibliotecas locais (marketing, revisão, vendas, conteúdo e engenharia reversa).
  Cada uma tem um adaptador em `.agents/skills/` que aponta para a fonte real.
- **Instala a ponte em projetos** com `attach`, `new` e `bootstrap`. O `attach`
  preserva regras locais, cria backup e é idempotente; o `bootstrap` copia apenas
  arquivos ausentes e nunca sobrescreve memória existente.
- **Valida a própria integridade** com `doctor`: presença dos manifestos, hashes
  SHA-256 de proveniência, links dos adaptadores, commits e licenças das fontes.
- **Mantém limites explícitos**: com menos de três agentes, a revisão independente
  é declarada como ausente. Publicações, envio de mensagens e mudanças externas
  exigem autorização explícita — a existência de uma skill não autoriza seu uso.
- **Funciona em múltiplos runtimes**: Claude Code e OpenCode usam as fontes
  originais; o Codex lê os adaptadores e a ponte de execução. Hooks, painel e
  mod TypeScript do plugin original são documentados como fonte, não executados.

## Instalação em qualquer computador (passo a passo)

### 1. Pré-requisitos

- Git e Node.js 18 ou superior (`node --version`).
- Uma ferramenta de IA que leia arquivos do projeto. O núcleo foi pensado para
  Claude Code, OpenCode e Codex, mas funciona como contrato em texto:
  qualquer agente que leia `AGENTS.md` pode seguir o método.
- Não é preciso `npm install`: `vendor/` é fonte preservada, não dependência
  instalável. Um módulo opcional citado por `buildx` não foi instalado —
  use o fallback documentado na própria skill.

### 2. Baixar o núcleo

```bash
git clone git@github.com:devmedeiros2025/medeirosios.git
cd medeirosios
```

Se preferir HTTPS: `git clone https://github.com/devmedeiros2025/medeirosios.git`.

### 3. Validar a instalação

```bash
node scripts/ecosystem.mjs doctor
node --test tests/*.test.mjs
```

O `doctor` deve responder `"ok": true`, com `upstreamRepositories: 11`,
`specialties: 31`, `importedFiles: 1727` e `errors: []`. Os 15 testes devem
passar. Se algo falhar, não avance: algum arquivo de fonte ou adaptador está
divergente do manifesto.

### 4. Ligar o núcleo ao seu projeto

Escolha uma das duas formas:

```bash
# Projeto que já existe — instala a ponte sem apagar regras locais
node scripts/ecosystem.mjs attach --project /caminho/do/projeto

# Projeto novo, criado dentro do núcleo
node scripts/ecosystem.mjs new --name nome-do-projeto
```

O `attach` grava no projeto:

- bloco `<!-- MAZYOS-EXPX:BEGIN -->` em `AGENTS.md` e `CLAUDE.md` — as regras
  locais são preservadas e recebem backup em `.mazyos/backups/`;
- `.agents/skills/mazyos-ecosystem/SKILL.md`, a skill de coordenação;
- `.mazyos/ecosystem.json`, com o caminho relativo para o núcleo.

O `bootstrap` copia somente arquivos ausentes do esqueleto de workspace
(`_memoria/`, `dados/`, `identidade/`, `marketing/`, `saidas/`, `scripts/`) e
nunca sobrescreve memória existente. O comando `new` já faz `attach` + `bootstrap`.

### 5. Disponibilizar as especialidades na sua IA

As 31 especialidades ficam no núcleo, em `.agents/skills/<id>/SKILL.md`, e são
indexadas por `catalog.json` e `docs/ROTEAMENTO.md`. Cada adaptador aponta para
a fonte preservada em `vendor/`.

- **Claude Code / OpenCode**: as skills originais estão em `vendor/` no formato
  `.claude/skills/` e `.opencode/skills/`. Use o runtime original para os
  comandos de barra e slash commands; os adaptadores em `.agents/skills/` são a
  ponte de leitura para outros runtimes.
- **Codex e outras IAs**: abra uma **nova sessão** dentro do projeto e peça
  explicitamente: `Leia AGENTS.md e docs/ROTEAMENTO.md antes de começar`. Depois
  solicite a leitura do adaptador da especialidade desejada. Não há carregamento
  automático nem permissões globais alteradas.
- **Qualquer outro agente**: trate `AGENTS.md` como contrato e `docs/FLUXOS.md`
  como sequência de trabalho. A delegação real depende da ferramenta disponível.

### 6. Começar a usar

Descreva a tarefa na IA. O orquestrador escolhe um dos sete fluxos (`sistema`,
`lancamento`, `manutencao`, `conteudo`, `comercial`, `analise`, `geral`) e carrega
somente as especialidades pertinentes. Para registrar a equipe sem iniciar
agentes:

```bash
node scripts/ecosystem.mjs plan --project /caminho/do/projeto --agents 3 --task "Descreva a entrega"
```

Regras que valem na prática:

- `N` agentes inclui o orquestrador. Com menos de três, a revisão independente é
  declarada ausente quando o mesmo agente implementa e revisa.
- Nenhum agente é marcado como iniciado até a ferramenta real retornar seu ID.
- Publicar, enviar mensagens ou mudar algo externo exige autorização explícita.
- Defina antes o que conta como entrega aceita: teste de comportamento, revisão
  visual, métrica calculada ou pacote validado.

### 7. Conferir e resolver problemas

```bash
# no núcleo
node scripts/ecosystem.mjs doctor

# no projeto
cat .mazyos/ecosystem.json
ls .agents/skills/mazyos-ecosystem/
```

Problemas comuns:

- `doctor` com erro de hash: restaure o arquivo original de `vendor/`; o hash
  registrado em `provenance.json` não confere mais com o conteúdo.
- A IA não encontrou as instruções: abra nova sessão no projeto e peça a leitura
  de `AGENTS.md`.
- `attach` recusou por skill local: resolva o conflito antes de repetir; nada foi
  modificado.

## Estrutura

| Caminho | Conteúdo |
| --- | --- |
| `AGENTS.md` / `CLAUDE.md` | contrato compartilhado do núcleo |
| `docs/` | escopo, compatibilidade, fluxos, ponte e catálogo |
| `knowledge/` | contexto de negócio e práticas reutilizáveis, sem dados de clientes |
| `scripts/` | attach, bootstrap, new, plan e doctor |
| `tests/` | suíte de integração do núcleo |
| `.agents/skills/` | adaptadores para as 31 especialidades |
| `catalog.json` | índice técnico de especialidades, fontes e origens |
| `provenance.json` | hashes SHA-256 das fontes importadas |
| `sources.lock.json` | repositórios de origem, commits e status de licença |
| `vendor/` | fontes de terceiros preservadas, com autoria e licenças |
| `upstream/` | clone de consulta de uma das fontes |

## Uso

Aponte o núcleo para um projeto com `attach` ou crie um projeto isolado com
`new`. `bootstrap` copia somente arquivos ausentes do esqueleto de workspace e
nunca sobrescreve memória existente. `plan` registra a equipe e o fluxo sem
iniciar agentes. A delegação real depende da ferramenta disponível no runtime.
