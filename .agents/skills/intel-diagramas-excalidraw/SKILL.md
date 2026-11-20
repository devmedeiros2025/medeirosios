---
name: intel-diagramas-excalidraw
titulo: Whiteboard de traço manual
description: Como o Excalidraw estrutura um whiteboard aberto: cena em JSON, exportação, colaboração e disciplina de monorepo React.
categoria: Design / Visualização / Frontend
palavras-chave: excalidraw, diagrama, whiteboard, svg, png, cena, serializeasjson, excalidrawlib, sketch, wireframe
---

# Whiteboard de traço manual

## Parâmetros de pensamento

- Trate o canvas como infinito e o traço como feito à mão; prefira legibilidade a precisão geométrica.
- Modele a cena como dados (`ExcalidrawElement[]` + `AppState`), nunca como pixels.
- Serialize com `serializeAsJSON`, removendo elementos excluídos e a maior parte de `AppState`.
- Importe com `loadFromBlob` ou `loadSceneOrLibraryFromBlob` e trate blob inválido como erro.
- Use utilitários puros e imutáveis: `const`, `readonly`, `?.` e `??`.
- Em código DOM, use `app.ownerDocument` / `app.ownerWindow`; sem `app`, derive do nó montado.
- Em código de matemática, carregue `packages/math/src/types.ts` no contexto e use o tipo `Point`.
- Escolha a camada certa do monorepo: biblioteca em `packages/*`, aplicação em `excalidraw-app/`, integrações em `examples/`.
- Rode `yarn test:update`, `yarn test:typecheck` e `yarn fix` antes de commitar; ofereça `yarn test:app`.
- Para traduções, trate o Crowdin como fonte da verdade e preserve `{{placeholders}}` e tags.

## Fluxo de trabalho

1. Decida a camada (biblioteca, app ou exemplo) e o artefato final.
2. Monte a cena com retângulos, círculos, losangos, setas, linhas e free-draw; vincule e rotule setas.
3. Persista/restaure pelo formato aberto `.excalidraw` via `serializeAsJSON` e `loadFromBlob`; distinga cena de biblioteca por `MIME_TYPES`.
4. Exporte para PNG, SVG ou área de transferência; para bibliotecas use `serializeLibraryAsJSON` e `useHandleLibrary` com o hash `#addLibrary`.
5. Valide com typecheck, snapshots e lint; para i18n siga `l10n_master` → upload no Crowdin → download → `git diff` → commit.
6. Publique mudanças de SDK no destino atual da documentação, não no site antigo.

## Entradas e saídas

- Entradas: `ExcalidrawElement[]`, `AppState`, `LibraryItems`, `Blob`, arquivos `.excalidraw` / `.excalidrawlib`, URL com `#addLibrary`, JSON de locale.
- Saídas: string JSON, PNG/SVG/clipboard, cena aplicada por `excalidrawAPI.updateScene`, biblioteca por `updateLibrary`, arquivos de tradução, comandos `yarn`.
- Parâmetros: `excalidrawAPI`, `localAppState`, `fileHandle`, `defaultStatus` (`published`/`unpublished`), `window.EXCALIDRAW_EXPORT_SOURCE`.

## Limites e ressalvas

- Os docs antigos em `dev-docs/` não são mais publicados; o endereço atual é `plus.excalidraw.com/docs/sdk`.
- Edições diretas em arquivos de locale são sobrescritas pelo Crowdin; tradução já aprovada exige nova aprovação.
- `-l` aceita um idioma por upload; `--preserve-hierarchy` é obrigatório.
- `loadFromBlob` e `loadSceneOrLibraryFromBlob` lançam exceção para dados inválidos.
- PWA, colaboração em tempo real e criptografia de ponta a ponta são recursos do app hospedado; o README os descreve como futuros plugins do pacote npm.

## Quando usar

- Esboços, wireframes e diagramas editáveis.
- Integração React e localização.

## Quando não usar

- Ferramenta de CAD de precisão ou layout automático de grafos complexos.
- Prometer no pacote npm recursos que hoje pertencem ao app.

## Fontes de sustentação

- `README.md`
- `CLAUDE.md`
- `AGENTS.md`
- `.github/copilot-instructions.md`
- `dev-docs/docs/@excalidraw/excalidraw/api/utils/utils-intro.md`
- `dev-docs/README.md`
