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
- **Disponibiliza 31 especialidades**: 9 da suíte Expx (buildx, designx, legadox,
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
  originais; Codex/Orca lê os adaptadores e a ponte de execução. Hooks, painel e
  mod TypeScript do plugin original são documentados como fonte, não executados.

## Instalação em qualquer computador

Requisito: Node.js 18 ou superior. Não é necessário instalar dependências do
código de terceiros em `vendor/`; ele é preservado como fonte e referência.

```bash
git clone git@github.com:devmedeiros2025/medeirosios.git
cd medeirosios
node scripts/ecosystem.mjs doctor
node --test tests/*.test.mjs
```

O comando `doctor` valida a presença dos manifestos, os hashes de proveniência,
as fontes das especialidades, os adaptadores em `.agents/skills/` e os commits e
licenças registrados em `sources.lock.json`.

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
