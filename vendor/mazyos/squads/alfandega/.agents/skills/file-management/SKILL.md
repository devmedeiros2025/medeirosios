---
name: file-management
description: Leitura e escrita segura dos arquivos da squad Alfandega — carregar memória da squad e contexto isolado de cliente, criar pastas de cliente e gravar saídas de revisão. Use quando a tarefa envolver abrir context.md, memories.md, briefing, CSS/JS local ou salvar veredito em output/.
---

# File management — Alfandega

Use esta skill sempre que precisar localizar, ler ou gravar arquivos para a revisão.

## Antes de revisar

1. Leia `_memory/memories.md` por inteiro.
2. Identifique o cliente da tarefa e leia **somente** `_memory/clientes/<cliente>/context.md`.
3. Se o cliente não tiver pasta, crie `_memory/clientes/<slug>/context.md` usando um slug em minúsculas com hífens (ex.: `diamante-sistemas`). Preencha apenas com o que estiver na tarefa ou em fontes do próprio cliente.

## Regras

- Nunca copie informação de um cliente para a pasta de outro.
- Nunca sobrescreva `squad.yaml`, `squad-party.csv` ou os prompts de `agents/` durante uma revisão.
- Para gravar saídas, use `output/<versao>/step-XX-<nome>.md`, seguindo o padrão de `output/v1`, `output/v2`, `output/v3`.
- Preserve UTF-8 e acentuação. Não reescreva arquivos inteiros quando basta uma edição pontual.
- Antes de pedir um caminho ao executor, procure o arquivo com `glob`/`grep` nos diretórios prováveis.
- Se o arquivo realmente não existir, registre o caminho tentado e peça o caminho correto ao executor — nunca à Carol.

## Onde fica cada coisa

| Conteúdo | Caminho |
|---|---|
| Regras e aprendizados da squad | `_memory/memories.md` |
| Contexto de cliente | `_memory/clientes/<cliente>/context.md` |
| Prompts dos agentes | `agents/*.md` |
| Metadados do pipeline | `squad.yaml` |
| Saídas de revisão | `output/<versao>/` |
