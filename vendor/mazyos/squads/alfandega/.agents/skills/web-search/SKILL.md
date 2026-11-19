---
name: web-search
description: Pesquisa na web para auditoria da squad Alfandega — políticas de Meta Ads, Google Ads e plataformas, concorrentes, referências visuais e dados de mercado. Use quando a revisão depender de informação externa atual ou de uma regra oficial da plataforma.
---

# Web search — Alfandega

Use esta skill quando a revisão exigir informação externa: política de anúncio, regra de plataforma, benchmark, concorrente ou referência visual.

## Como pesquisar

1. Formule uma consulta específica com o nome da plataforma e o termo exato (ex.: `Meta Ads política texto imagem 20%`).
2. Prefira fontes oficiais: central de ajuda da Meta, Google Ads Policy, documentação da ferramenta.
3. Confirme a data da informação. Política e interface de anúncio mudam com frequência.
4. Registre a conclusão com **URL + data de acesso**. Sem fonte, não afirme.

## Regras

- Não invente regra, limite, valor ou política. Se não encontrou fonte confiável, diga que não encontrou.
- Não use resultado de busca como prova de que a entrega está correta; use como referência para comparar.
- Em OpenCode, use a ferramenta `websearch`. No Codex, use a busca web nativa. Se a ferramenta não existir, use `curl` em uma fonte oficial.
- Quando a pergunta for sobre o cliente (e não sobre a plataforma), a fonte é `_memory/clientes/<cliente>/context.md`, não a web.

## Saída

Liste as fontes consultadas no fim da análise, no formato:

```markdown
### Fontes consultadas
- [Título](URL) — acessado em DD/MM/AAAA
```
