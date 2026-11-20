---
name: intel-hyperframes-video-html
titulo: Vídeo determinístico a partir de HTML
description: Transforma HTML, CSS, mídia e animações buscáveis em MP4 determinístico com Chrome headless e FFmpeg.
categoria: Renderização de vídeo / motion design para agentes
palavras-chave: hyperframes, html, css, mp4, determinístico, spec, timeline, snapshot, render, chrome, composicao, specs
---

# Vídeo determinístico a partir de HTML

## Parâmetros de pensamento

- Ler a skill `/hyperframes` antes de qualquer pedido de criar, editar ou renderizar vídeo.
- Buscar no registro (~450 blocos) antes de escrever à mão qualquer efeito, transição ou gráfico nomeado.
- Escrever `SPEC.md` trocando adjetivos por números: resolução, fps, frames, hex, px, durações e eases.
- Fixar a base em 1920×1080 a 30 fps e declarar `data-composition-id`, `data-start` e `data-duration` no elemento raiz.
- Marcar elementos temporizados com `class="clip"`, `id` estável e registrar `window.__timelines["id"]` pausado.
- Fazer cada quadro depender só do tempo da linha: banir `Date.now()`, `Math.random()` sem semente, timers e fetch.
- Usar `fromTo` e animar filhos; nunca aplicar tween de `display`, `visibility` ou `autoAlpha` no próprio `.clip`.
- Casar eixo, direção e velocidade nas emendas; registrar vetores em `ledger.json` e validar com o `seam-gate`.
- Rodar `lint`, `check --json` e `snapshot`; só renderizar depois do preview aprovado.
- Dimensionar a leitura: texto com pelo menos 28 px em 1080, herói ocupando ≥40% do quadro e novidade a cada 2–4 s.

## Fluxo de trabalho

1. `npx hyperframes init <dir> --skip-skills` (Node.js 22+ e FFmpeg); para um site como assunto, `capture <url>`.
2. Planejar: escrever a história em palavras e o `SPEC.md`; escolher a referência conforme o tipo de vídeo.
3. Instalar blocos com `catalog --query` / `add`; montar `index.html`, cenas em `compositions/` e mídia em `assets/`.
4. Validar: `lint` → `check --json` → `snapshot` em pontos médios de cada cena; corrigir erros com linha `Fix:` e avaliar avisos.
5. Usar `preview --background` e aguardar aprovação; então `render --quality draft|looks|delivery -o out.mp4` e conferir duração com `ffprobe`.

## Entradas e saídas

- Entradas: `index.html`, `compositions/*.html` (conteúdo dentro de `<template>`), `assets/`, variáveis `data-var-*`, `SPEC.md`, `ledger.json`, JSON de `timeline`/`check`, arquivos `FRAME.md`/`DESIGN.md`.
- Saídas: MP4 local, em contêiner Docker, em nuvem ou via Lambda; PNGs de snapshot em `.hyperframes/artifacts/snapshots/`; `REVIEW.md`; recibos de edição da timeline; links de `share`.

## Limites e ressalvas

- Exige Node.js 22+ e FFmpeg; um clone completo usa Git LFS com cerca de 240 MB de vídeos de regressão.
- Relógio, aleatoriedade não semeada e chamadas de rede no tempo de render quebram a determinística.
- `reverse-any-video` e `style-sampling` são recursos Pro; `/slideshow` produz um deck navegável, não um MP4.
- Executar `npx skills add ... --all` dentro do checkout pode apagar alterações não commitadas em `skills/`.
- Fontes apenas instaladas localmente, sem arquivo no projeto, podem falhar em render na nuvem; use `@font-face` apontando para `assets/fonts/`.
- Alterar o primeiro ou o último segundo de uma cena reabre a auditoria da emenda correspondente.

## Quando usar

- Vídeos de produto, explainers, gráficos, legendas e overlays.
- Variações em lote por variáveis e renderização determinística em CI.

## Quando não usar

- Quando o usuário exigir explicitamente outro framework.
- Timeline visual proprietária externa ou gravação simples de tela.

## Fontes de sustentação

- `README.md`
- `skills/hyperframes/SKILL.md`
- `skills/hyperframes/references/format.md`
- `skills/hyperframes/references/spec.md`
- `skills/hyperframes-cli/SKILL.md`
- `.claude/skills/motion-doctrine/SKILL.md`
