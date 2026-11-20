---
name: intel-video-programavel-remotion
titulo: Vídeo programável e editável com Remotion
description: Cria, edita e renderiza vídeos em React com composições determinísticas, timeline editável no Studio e exportação por CLI.
categoria: Criação de vídeo / engenharia frontend
palavras-chave: remotion, react, framecurrent, usecurrentframe, usevideo, interpolate, composition, studio, tsx, fps, video programavel
---

# Vídeo programável e editável com Remotion

## Parâmetros de pensamento

- Trate vídeo como código: componentes React, frames e props serializáveis.
- Abra o Studio assim que o projeto rodar e mantenha-o ativo para preview e direção do usuário.
- Renderize somente quando o usuário pedir explicitamente o MP4, a imagem ou a timeline.
- Anime com `useCurrentFrame()` e `interpolate()`; nunca com `transition`/`animation` CSS ou classes Tailwind de animação.
- Obtenha `fps` de `useVideoConfig()` e mantenha expressões de tempo no próprio JSX.
- Deixe `interpolate()` inline no `style` e prefira `scale`, `translate` e `rotate` a `transform`.
- Defina as unidades de edição antes da hierarquia de markup; mantenha valores inline por instância.
- Projete para vídeo, não para web: área segura generosa e textos grandes o suficiente.
- Coloque assets em `public/` e referencie com `staticFile()`; use os componentes de mídia do ecossistema Remotion.
- Pesquise a documentação atual em vez de confiar em memória de API, e preserve mudanças feitas pelo usuário fora da conversa.

## Fluxo de trabalho

1. Inspecionar a pasta atual, incluindo arquivos ocultos; scaffold com `npx create-video@latest --yes --blank --no-tailwind .` ou em subpasta.
2. Iniciar o Studio (`npx remotion studio` ou `npx remotion studio --no-open`) e abrir/verificar a URL impressa.
3. Registrar `<Composition>`/`Still` com `id`, `width`, `height`, `fps`, `durationInFrames` e `defaultProps` inline; organizar com `<Folder>`.
4. Escrever markup editável (`Interactive.*`, schemas, mídia, efeitos, legendas) com tempo em frames.
5. Validar no preview do Studio, incluindo a composição específica em `/[composition-id]`, e ajustar.
6. Renderizar com `npx remotion render <comp-id> out/video.mp4`, passando `--props` quando necessário; exportar OTIO apenas se pedido.

## Entradas e saídas

- Entradas: props JSON (`defaultProps`, `--props`), arquivos em `public/`, dados `Caption[]` (`text`, `startMs`, `endMs`, `timestampMs`, `confidence`), `composition-id`, dimensões, fps e duração em frames.
- Saídas: MP4, PNG/stills, sequência `element-04.png`/`element-30.png`, timeline OpenTimelineIO e código TSX editável.

## Limites e ressalvas

- Animações CSS e classes Tailwind de animação não renderizam corretamente; devem ser refatoradas para frames.
- Use o navegador empacotado pelo Remotion; não defina `--browser-executable`, `browserExecutable` ou `chromeMode` sem pedido explícito.
- Sempre passe o ID da composição: sem ele há picker interativo ou falha em terminal não interativo.
- Empresas podem precisar de licença (`--license-key`); renders de teste podem usar `--is-production=false`; `--license-key` vazio é inválido.
- Edição no Studio depende de valores inline e de nós JSX próprios; código gerado por loop ou props derivadas não fica editável.
- No monorepo do projeto use `bunx` (não `npx`); em projetos de usuário os skills documentam `npx`.

## Quando usar

- Vídeos programáticos, bibliotecas de motion e renderização em lote.
- Integrações SaaS, legendas, mapas animados e exportação editável.

## Quando não usar

- Pedido de "um vídeo pronto sobre este tema" com busca de material e narração automática — use a inteligência de vídeo curto.
- Quando não há Node disponível.
- Para sobrescrever código alterado pelo usuário sem confirmar.

## Fontes de sustentação

- `packages/skills/skills/remotion-best-practices/SKILL.md`
- `packages/skills/skills/remotion-create/SKILL.md`
- `packages/skills/skills/remotion-create/video-layout.md`
- `packages/skills/skills/remotion-markup/SKILL.md`
- `packages/skills/skills/remotion-render/SKILL.md`
- `packages/skills/skills/remotion-interactivity/SKILL.md`
