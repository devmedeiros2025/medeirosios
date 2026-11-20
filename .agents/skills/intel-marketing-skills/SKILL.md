---
name: intel-marketing-skills
titulo: Biblioteca de Skills de Marketing para Agentes
description: Conjunto de skills Markdown que guiam agentes em CRO, copywriting, SEO, anúncios e analytics, com diagnóstico, evidência e acionabilidade.
categoria: Marketing / Growth Engineering / Autoragem de Skills
palavras-chave: marketingskills, copy, diagnóstico, diagnostico, portão, portao, perguntas, cro, seo, anuncios, analytics, need
---

# Biblioteca de Skills de Marketing para Agentes

## Parâmetros de pensamento

- Leia `.agents/product-marketing.md` antes de qualquer tarefa; pergunte apenas o que falta.
- Diagnostique a situação (A: vazio/genérico; B: voz real; C: edição puntual) e declare-a com evidência antes de escrever.
- Trate vocabulário, ênfase e recortes do input como escolhas do autor — preserve-os.
- Decomponha em unidades, gere 2–3 candidatos, corrija o pior e trave cada um.
- Aplique o portão de três perguntas: dá para imaginar? é falseável? um concorrente escreveria igual?
- Escreva só afirmações sustentáveis; recuse a não sustentada e nomeie a evidência que a destravaria (`[NEED: ...]`).
- Elimine "tells" de IA: sem "não é X, é Y", listas de negação, "o resultado?" ou travessões em copy curta.
- Racione o impacto: uma ou duas frases fortes por página; o resto fica simples e declarativo.
- Rotas por intenção: carregue o `references/` correspondente antes de recomendar em conta ao vivo.
- Rotule entradas ausentes como `MISSING` em vez de estimar; termine com fatos, hipóteses e dados faltantes.

## Fluxo de trabalho

1. Carregar contexto de produto e *Learnings*, checando versão uma vez por sessão.
2. Identificar a intenção e rotear para a skill/referência correta.
3. Fazer o diagnóstico e declará-lo com evidência.
4. Coletar só o que falta (metas, CPA/ROAS, audiência, tráfego).
5. Produzir a saída pelo protocolo (decompor, portão de três perguntas, anti-tells, marcações `[NEED]`).
6. Validar, versionar e registrar aprendizados com evidência e status.

## Entradas e saídas

- Entradas: `.agents/product-marketing.md`, brief de uma linha, rascunho/copy existente, URLs, dados de conta (CPA/ROAS, orçamento), amostra de escrita, prompts de intenção (direto/indireto/quase-erro).
- Saídas: documento de contexto versionado com changelog, copies por seção com anotações e alternativas, recomendações CRO (quick wins / alto impacto / testes), decisões de conta em fatos/hipóteses/MISSING, linhas de aprendizado com evidência e status.

## Limites e ressalvas

- `SKILL.md` ≤500 linhas; descrição ≤500 caracteres; pacote ~24.000 caracteres.
- Não inventa estatísticas, clientes ou resultados.
- Conselho simulado é persona — sem citações fabricadas nem endosso a empresas específicas.
- Skills são conteúdo: leitura de contas depende de ferramentas com credenciais escopadas e primeiro acesso somente leitura.
- Descrições só com sinônimos perdem perguntas de julgamento — exige avaliação de gatilho com conjunto reserva não lido.

## Quando usar

- Tarefas de marketing com agentes: copy, CRO, SEO/AEO, anúncios e analytics.
- Ideação e decisões que exigem diagnóstico e evidência.
- Montagem de um harness baseado em skills Markdown.

## Quando não usar

- Atuar em contas sem credenciais escopadas.
- Gerar números fictícios.
- Decidir sozinho mudanças de orçamento, lance ou pausa sem aprovação.
- Substituir pesquisa real de clientes.

## Fontes de sustentação

- `README.md`
- `AGENTS.md`
- `skills/product-marketing/SKILL.md`
- `skills/copywriting/SKILL.md`
- `skills/ads/SKILL.md`
- `evals/triggers/README.md`
