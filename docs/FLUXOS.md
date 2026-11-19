# Fluxos de entrega

| Fluxo | Sequência |
| --- | --- |
| sistema | Escopo → arquitetura → construção → revisão → entrega |
| lancamento | Briefing → mensagem → página → campanha → revisão cruzada → entrega |
| manutencao | Diagnóstico → correção → revisão → aprendizado |
| conteudo | Briefing e identidade → produção → revisão → entrega |
| comercial | Qualificação → proposta → revisão → entrega |
| analise | Dados → análise → revisão → decisão |
| geral | Briefing → execução → revisão → entrega |

Cada etapa carrega responsáveis, dependências, especialidades, critério de aceite e evidências. O plano começa pendente; nenhum agente é marcado como iniciado até a ferramenta real retornar seu ID. A escolha automática é apenas sugestão; use --workflow para escolher explicitamente.

Exemplo: node scripts/ecosystem.mjs plan --project "C:/projeto" --agents 3 --workflow lancamento --task "Criar página e campanha da oferta"

O orquestrador deve decompor as etapas conforme o pedido e atualizar estado e PROGRESSO.md. Um plano criado não prova execução, aprovação nem resultado comercial.
