# Compatibilidade

O Expx original suporta Claude Code e OpenCode. Esta integração acrescenta adaptadores de leitura e coordenação para Codex no Orca.

- Skills e referências: preservadas nas fontes indicadas pelo catálogo.
- Comandos /expx e slash commands: usar no runtime original; no Codex ler a referência correspondente.
- Task, Agent e subagentes: mapear para a delegação disponível e registrar IDs reais.
- Hooks de TDD, escrita e bloqueio: arquivados, não ativados. Conferir os critérios sem alegar enforcement técnico.
- Revisores: papel sem escrita; isolamento depende do runtime.
- Artefatos Expx: preservar schemas e pastas docs e .expx no projeto quando seguir o método.
- Estado MEDEIROS SYSTEM: .mazyos/runs registra equipe; não substitui o schema Expx nem é automaticamente exibido pelo painel original.
- Links de referências: relativos ao SKILL original; caminhos de entregas: relativos ao projeto ativo.
- Preferências de autonomia já fornecidas valem sem repetir perguntas. Autonomia não amplia permissões externas.

As regras Expx originais ficam intactas e são aplicadas quando o método é escolhido, respeitando instruções superiores e exceções explícitas do usuário. Tarefas simples fora do método não precisam virar sprints.

modulex é uma dependência opcional referenciada por buildx, fora do catálogo oficial de nove skills do expxdev. Não foi instalado; usar o fallback documentado pelo buildx.

O Harvey foi incorporado como conhecimento comercial, não como serviço de envio. O CLI e o painel expxdev foram preservados como código, sem instalação de dependências, build ou inicialização.

O runtime do Orca precisa expor delegação para executar uma equipe real. O comando plan só prepara o registro. Após attach, abra uma nova sessão no projeto e peça a leitura de AGENTS.md se o cliente não o descobrir automaticamente. Nenhuma permissão global é alterada.


Para as 17 especialidades oficiais de negócio, consultar PONTE-DE-EXECUCAO.md. Hooks, mod e extensão originais foram preservados, mas não ativados no Orca. A memória é lida explicitamente pelo agente.
