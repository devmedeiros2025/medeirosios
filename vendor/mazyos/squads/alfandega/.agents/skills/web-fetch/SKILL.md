---
name: web-fetch
description: Busca e leitura de páginas, CSS, JavaScript e endpoints para revisar landing pages e automações da squad Alfandega. Use ao precisar abrir uma URL de entrega, descobrir assets, ler o código de um botão/formulário ou testar um webhook.
---

# Web fetch — Alfandega

Use esta skill para acessar a entrega real por URL: landing page, arquivo CSS/JS, endpoint ou webhook.

## Como acessar

1. Tente primeiro a ferramenta nativa de fetch (`webfetch` no OpenCode; busca/navegador no Codex).
2. Se o fetch falhar ou precisar de status HTTP e headers, use `curl -L -sS -o - -w "\nHTTP %{http_code}\n" <url>` via shell.
3. Para descobrir assets, siga a Fase 0 de `agents/avaliador-lp.md`: tente os paths de CSS e JS listados, registre o que retornou 200 e o que retornou 404.
4. Leia o código CSS/JS encontrado. Não conclua comportamento só pelo HTML estático.

## Regras

- Fetch é estático: não executa JavaScript. Contador animado, carrossel, modal ou slider que aparece em estado inicial (ex.: `0`) não é bug por causa disso — avalie pela lógica do código.
- Não afirme que "viu na tela" ou que testou visualmente. Diga o que o código e o HTML mostram.
- Se um asset retornar 404 em todos os paths, registre os caminhos tentados e peça o path correto ao executor — nunca à Carol.
- Nunca peça screenshot ou verificação manual para Carol. Se for um ajuste exclusivamente visual (Tipo B), sinalize isso no formato do prompt da Vera Nunes.
- Em automações, não dispare um webhook de produção sem autorização explícita. Prefira teste em endpoint de homologação ou inspeção da configuração.

## Saída

Inclua na análise:

```markdown
### Evidências de acesso
- URL: [url] — HTTP [status]
- Arquivos encontrados: [lista]
- Arquivos 404: [lista]
```
