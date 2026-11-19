# MEDEIROS SYSTEM

Núcleo de coordenação, fluxos e ponte de runtime. As especialidades e suas fontes
de engenharia e negócio ficam preservadas em `vendor/`, com autoria e licenças.

## Leitura obrigatória antes de coordenar

1. `docs/FLUXOS.md` — etapas, responsáveis e critérios de aceite.
2. `docs/ROTEAMENTO.md` — índice das 31 especialidades e adaptadores.
3. `docs/PONTE-DE-EXECUCAO.md` — combinação dos métodos e resolução de fontes.
4. `docs/COMPATIBILIDADE.md` — limites reais de cada runtime.
5. `docs/ESCOPO-E-ORIGENS.md` — proveniência e escopo do produto.

## Regras

- O núcleo guarda métodos e templates; cada projeto guarda briefing, memória,
  identidade, artefatos e progresso. Nunca copie memória entre projetos.
- `N` agentes inclui o orquestrador. Com menos de três, declare a ausência de
  revisão independente quando o mesmo agente implementar e revisar.
- Nenhum agente é marcado como iniciado até a ferramenta real retornar seu ID.
  Um plano criado não prova execução, aprovação ou resultado.
- Publicação, envio de mensagens e mudanças externas somente com autorização
  explícita. A existência de uma skill de publicação não autoriza seu uso.
- Defina o que conta como entrega aceita antes de começar: teste de
  comportamento, revisão visual, métrica calculada ou pacote validado.
- Este núcleo não contém contextos, saídas, arquivos, vídeos ou criativos de
  clientes. Cada projeto permanece isolado no seu próprio diretório.

## Comandos

```bash
node scripts/ecosystem.mjs doctor
node scripts/ecosystem.mjs new --name NOME
node scripts/ecosystem.mjs attach --project PASTA
node scripts/ecosystem.mjs bootstrap --project PASTA
node scripts/ecosystem.mjs plan --project PASTA --agents N --task PEDIDO
```

## Verificação

- `node --test tests/*.test.mjs` — suíte do núcleo.
- `node scripts/ecosystem.mjs doctor` — integridade de fontes, hashes e adaptadores.
