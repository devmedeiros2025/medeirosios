# google-ads-criacao-mentoria-v2 (versão de teste)

Cópia do squad `google-ads-criacao-mentoria` com as melhorias do teste de 27 e 28/10/2026 (aluno armadilha, produto fictício). **O original não foi alterado.** A cópia tem `code` e `name` próprios (`google-ads-criacao-mentoria-v2`), então pode ficar ao lado do original sem colidir.

**Base:** versão 1.7.2 do original. **Versão desta cópia:** 1.8.0-teste (05/11/2026).
Se o original for atualizado pelo marketplace, esta cópia continua na base 1.7.2. As mudanças abaixo podem ser reaplicadas numa base nova.

## O que mudou

| # | Melhoria (do teste) | Onde | O que foi feito |
|---|---|---|---|
| 1 | GTM faz coisas sozinho (tag base AW, 6 detecções automáticas, coleta de e-mail/telefone/endereço, vínculo pré-marcado a cada publicação) | `tracking-setup.md` seção 3.2 (nova), seção 4, alertas | Passo obrigatório antes de publicar o contêiner: avisar sobre a tag base, desligar detecção e coleta automáticas, "Não adicionar vínculo", testar de novo |
| 2 | Assistente de conversão mudou; "Não usar valor" não existe mais | `tracking-setup.md` seção 3.1; `squad.yaml` `conversao.contagem` e `nao_se_aplica_b2b` | Roteiro novo, conferido em 27/10/2026: "Nova conversão", desmarcar "Chamadas", "Manualmente com código", renomear o nome pré-preenchido, valor simbólico R$ 1 |
| 3 | Inventariar antes de criar | `squad.yaml` `leis_de_ouro.inventario_antes_de_criar` (nova); `tracking-setup.md` seção 0.1 (nova); `campaign-builder.md` 4a | Listar ações de conversão, meta padrão, contêineres e rascunhos antes de criar. Inclui onde fica a meta personalizada |
| 4 | Ativos de terceiros no login (perfil de pagamento, GA4 de outra empresa) e botões automáticos | `squad.yaml` `leis_de_ouro.ativos_de_terceiros_e_botoes_automaticos` (nova); `campaign-strategist.md` 1.1; `campaign-builder.md`; `post-launch-guide.md` | Print de Faturamento e pergunta explícita; nunca clicar em "Vincular", "Configurar no Google Tag Manager", "Aplicar tudo" sem decisão |
| 5 | Mentor inventou o caminho de menu da moeda | `squad.yaml` `como_criar_conta_google_ads` item 4; `campaign-strategist.md` 1.1; `post-launch-guide.md` | Proibido citar caminho de memória: conferir "R$" por print |
| 6 | "No máximo 15 leads" (CPA alvo é teto, então é o mínimo) | `squad.yaml` `estrategia_de_lance.conta_de_viabilidade` (nova); strategist, keyword-analyst e post-launch | Conta única de viabilidade com origem de cada número e checagem do sentido da desigualdade |
| 7 | Recusou concorrente e "IA" sem citar regra (a regra não existia) | `squad.yaml` `leis_de_ouro.conteudo_proibido_no_anuncio` (nova, itens P1 a P7); `ad-copywriter.md` | Lista explícita, com a política do Google correspondente; recusa sempre cita o item |
| 8 | Portão da LP antes do Step 4 | `tracking-setup.md` seção 0 (nova); `post-launch-guide.md` | Bloqueante: formulário entrega o lead e não há texto de teste na página |
| 9 | Confusão entre "disparou" e "contou" | `tracking-setup.md` seção 5.1 (nova); `squad.yaml` `rastreamento_antes_de_ativar`; `post-launch-guide.md` | Três níveis: disparou, recebeu, contou. Ativação exige os dois primeiros |
| 10 | Tela diferente do roteiro | `squad.yaml` `leis_de_ouro.tela_diferente_do_roteiro` (nova); `campaign-builder.md`; `protocolo_contexto.checklist_verificacao_operador` | Parar, pedir print, não supor; no modo manual tudo é confirmado por print, não por "feito" |
| 11 | Mentor citou a memória pessoal do operador como regra | `squad.yaml` `leis_de_ouro.isolamento_de_contexto` (nova); `campaign-strategist.md` 0.01 | Só cita o squad e o que o mentorado disse ou mostrou |
| 12 | Datar as telas do roteiro | `leis_de_ouro.tela_diferente_do_roteiro` item 4 | Toda tela com data de conferência; mais de 60 dias = aviso e print a cada bloco |

Mudanças de operação:

| Item | Antes | Agora |
|---|---|---|
| Checagem de marketplace (passo 0.0) | `expxagents update` no início | Removida, porque apontaria para o **original** e poderia sobrescrever arquivos |
| Caminhos de output e memória | `squads/google-ads-criacao-mentoria/...` | `squads/google-ads-criacao-mentoria-v2/...`, para não misturar com o original |
| Tendência de volume e CPC | Sem regra específica | Só com coluna e meses do CSV; sem conferir, "tendência: a validar" (`keyword-analyst.md`) |
| Ordem do GTM | Implícita | Snippet só vai para a LP depois que o contêiner é montado no Step 4 |
| Perguntas ao mentorado | Texto, no formato "A) B) Recomendo A" | Modais (AskUserQuestion), como no `meta-ads-criacao-mentoria-v2`, adaptados ao Google: `leis_de_ouro.interacao_por_perguntas` e `banco_de_perguntas` (37 perguntas em 6 etapas, mais a aprovação padrão). Cada agente tem um bloco "Interação com o mentorado (v2)" apontando para as perguntas da sua etapa. O texto "A) B)" ficou só como plano B |

## O que NÃO foi verificado

- Se o Google aplica o valor padrão da ação quando a tag envia `value=0`. Está marcado no squad como ponto a confirmar.
- As telas descritas na seção 3.2 e na 3.1 foram vistas numa única conta de teste, em 27/10/2026. Outra conta pode mostrar diferente; por isso o protocolo de print.
- Os Steps 5 a 7 do original nunca foram testados de ponta a ponta. As mudanças nesses steps vêm do que o teste mostrou nos Steps 1 a 4.

## Como testar

1. Rodar a v2 como mentorado novo, com produto fictício, de preferência na conta sandbox, cobrindo também os Steps 5 a 7 (campanha criada **pausada**).
2. Reaproveitar a tabela de 24 armadilhas do teste anterior e preencher o veredito.
3. Repetir pelo menos uma rodada com Sonnet.
4. Se a v2 passar, aplicar as mudanças no original ou substituir. Se perder em algum ponto, descartar o que não funcionou.
