---
name: intel-postiz-engineering
titulo: Postiz: Regras de Engenharia para Agentes
description: Convenções do monorepo Postiz para agentes: arquitetura em camadas, pnpm, Prisma, hooks SWR, workflows versionados e PRs com QA obrigatório.
categoria: Engenharia de Software / Convenções de Código / Governança de PR
palavras-chave: postiz, agendamento, publicação, publicacao, multicanal, prisma, dto, controller, service, repository, pnpm, swr
---

# Postiz: Regras de Engenharia para Agentes

## Parâmetros de pensamento

- Use apenas pnpm; nunca instale componentes de npmjs — escreva componentes nativos.
- Siga DTO → Controller → Service → Repository sem atalhos; lógica de servidor em `libs/server`.
- Antes de componentes, leia `colors.scss`, `global.scss` e `tailwind.config.js`; `--color-custom*` está obsoleto.
- Use SWR via hook `useFetch`; um `useSWR` por hook, sem `eslint-disable` em rules-of-hooks.
- Nunca SQL cru — sempre Prisma; trate mudanças de esquema com migração e compatibilidade.
- Não altere workflows nem parâmetros de activities já em `origin/main`; crie nova versão e atualize todos os chamadores.
- Mantenha código genérico: estenda a interface do provider, nunca coloque `if (facebookProvider)` em arquivo genérico.
- Antes de mexer em `select` ou formato de retorno compartilhado, faça grep de todos os consumidores (frontend, API pública, MCP/agente, orchestrator, webhooks).
- Trate exposição de campo e mudança de significado persistido como decisão: pergunte antes e inspecione linhas existentes.
- Nunca retorne linha crua de modelos com credenciais; use `select` mínimo. Código de webhook não deve lançar exceção — capture e registre.

## Fluxo de trabalho

1. Entender o mapa do monorepo (backend/orchestrator/frontend/libraries) e ler `node_modules/next/dist/docs/` antes do frontend.
2. Localizar padrão similar e imitá-lo nas camadas corretas.
3. Verificar compatibilidade — consumidores, migrações, versionamento de workflows, dados persistidos.
4. Rodar lint apenas na raiz com pnpm.
5. Pedir a outro agente que compare o código novo com o existente para detectar padrões estranhos.
6. Escrever o PR no template com `# What kind of change...?` detalhado e `# QA` com passos numerados em checkboxes.

## Entradas e saídas

- Entradas: `CLAUDE.md`/`AGENTS.md` da raiz e do frontend, `colors.scss`/`global.scss`/`tailwind.config.js`, DTOs e serviços existentes, `.github/PULL_REQUEST_TEMPLATE.md`, `.claude/settings.json`, código dos providers.
- Saídas: código nas camadas DTO→Repository, hooks SWR isolados, nova versão de workflow/activity, descrição de PR com tipo/área/mudança concreta e seção `# QA` numerada, plano de migração.

## Limites e ressalvas

- Licença AGPL-3.0; `CONTRIBUTING.md` afirma não aceitar PRs gerados principalmente por IA — agentes servem para entendimento/prototipação interna, não contribuição direta.
- Acesso a `.env` é negado por configuração.
- O Next.js local tem mudanças radicais: a doc em `node_modules/next/dist/docs/` é a fonte.
- É produção com muitos usuários: qualquer mudança pode exigir migração e aprovação de apps das plataformas (Meta/YouTube/TikTok podem levar semanas no self-hosted).
- Cloud e open-source têm os mesmos recursos centrais, mas infraestrutura, credenciais de analytics e chaves de IA são responsabilidade do self-hosted.

## Quando usar

- Implementar ou revisar mudanças no monorepo.
- Escrever PRs no padrão do projeto.
- Desenhar um harness de engenharia que imponha essas regras.

## Quando não usar

- Como guia de funcionalidades do produto.
- Para pular camadas arquiteturais ou alterar workflow em produção.
- Para expor credenciais ou enviar PRs automáticos ao projeto.

## Fontes de sustentação

- `CLAUDE.md`
- `README.md`
- `apps/frontend/AGENTS.md`
- `apps/sdk/README.md`
- `.claude/settings.json`
- `CONTRIBUTING.md`
