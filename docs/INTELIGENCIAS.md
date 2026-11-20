# Inteligências acopladas

O núcleo carrega oito inteligências operacionais extraídas de repositórios públicos.
Cada uma é um `.agents/skills/intel-*/SKILL.md` com parâmetros de pensamento, fluxo,
entradas/saídas, limites e fontes de sustentação. Os agentes leem o índice e o módulo
`scripts/intel.mjs`; nada é instalado dentro do repositório publicado.

## Índice

| ID | Título | Categoria | Uso típico |
| --- | --- | --- | --- |
| `intel-comfyui-grafos-geracao` | Grafos de geração local com ComfyUI | Geração multimodal | Imagem, vídeo, áudio e 3D com semente e parâmetros registrados |
| `intel-hyperframes-video-html` | Vídeo determinístico a partir de HTML | Renderização de vídeo | MP4 por `SPEC.md`, timeline e validação antes do render |
| `intel-video-curto-mpt` | Geração automática de vídeo curto | Automação de mídia | Reels com roteiro, narração, legendas e música |
| `intel-video-programavel-remotion` | Vídeo programável e editável | Engenharia frontend | React + frames, Studio e exportação por CLI |
| `intel-diagramas-excalidraw` | Whiteboard de traço manual | Design / Visualização | Cena em JSON, PNG/SVG e bibliotecas reutilizáveis |
| `intel-radar-opiniao-30-dias` | Radar de opinião em 30 dias | Pesquisa / Inteligência | Tendências com engajamento real e citações inline |
| `intel-marketing-skills` | Biblioteca de Skills de Marketing | Marketing / Growth | Diagnóstico A/B/C, portão de perguntas e anti-tells |
| `intel-postiz-engineering` | Regras de engenharia para agentes | Engenharia / Governança | DTO → Repository, Prisma, SWR, PR com `# QA` |

## Como os agentes consomem

1. `scripts/intel.mjs` expõe `listarInteligencias`, `carregarInteligencia` e `sugerirInteligencias`.
2. `scripts/orchestrator.mjs` sugere inteligências pela tarefa e grava os IDs no item da fila.
3. `scripts/codex-delegado.mjs` injeta os parâmetros de cada inteligência no prompt do agente.
4. `scripts/mcp/server.mjs` publica `listar_inteligencias` e `ler_inteligencia`.
5. `scripts/registry.mjs` inclui os IDs no inventário; `scripts/ui/server.mjs` mostra o painel.

O campo `inteligencias` no frontmatter de cada agente em `.agents/agents/` declara quais
inteligências aquele papel deve carregar antes de agir.

## Regras

- Nenhuma inteligência autoriza ação externa por si mesma. Publicação, envio e cobrança
  exigem pedido efetivo do usuário.
- Os parâmetros são instruções operacionais; se o repositório de origem divergir, a
  documentação original prevalece.
- Fontes de terceiros permanecem fora do repositório publicado. Aqui ficam apenas resumos
  acionáveis e a referência aos caminhos de sustentação.
