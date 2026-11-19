# MEDEIROS SYSTEM

Camada de integração própria para coordenação de agentes, fluxos de entrega e
ponte de runtime, com 31 especialidades preservadas de fontes de engenharia e
negócio. Nenhum conteúdo de cliente é distribuído neste repositório.

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

## Fontes

As fontes de engenharia são expxdev e nove repositórios oficiais de
bittencourtthulio. A fonte de negócio é mazzeoia/MazyOS, revisão
`d2b65b392f1ee230afb088d155fc734def5f105d`. Bibliotecas locais de marketing,
revisão, vendas, conteúdo, identidade e engenharia reversa complementam as
especialidades. O nome do produto não altera autoria nem direitos das fontes.
