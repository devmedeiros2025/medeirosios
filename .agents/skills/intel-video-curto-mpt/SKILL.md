---
name: intel-video-curto-mpt
titulo: Geração automática de vídeo curto com MoneyPrinterTurbo
description: Transforma um tema ou roteiro em vídeo HD com roteiro, narração, imagens, legendas e música, via agente, WebUI, API ou CLI.
categoria: Criação de vídeo / automação de mídia
palavras-chave: moneyprinterturbo, mpt, reels, video curto, narração, naracao, legendas, musica, pexels, tts, tema, final-1
---

# Geração automática de vídeo curto com MoneyPrinterTurbo

## Parâmetros de pensamento

- Peça apenas as credenciais ausentes, inválidas ou rejeitadas — em uma única rodada.
- Não solicite confirmação para instalar, gerar, aguardar, usar padrões ou devolver o resultado.
- Execute o helper em primeiro plano com timeout mínimo de 20 minutos.
- Nunca faça polling com `sleep`, `echo`, `ps`, `ls` repetido ou `tail`; aguarde a sessão retomável.
- Nunca imprima chaves, tokens, o `config.toml` completo ou fragmentos com credenciais.
- Aplique os padrões documentados: um vídeo em chinês, `9:16`, Pexels, Edge TTS, legendas e música.
- Reutilize um `config.toml` existente sem exibir seu conteúdo.
- Só habilite flags de cobrança de provedores pagos após confirmação explícita do usuário.
- Use `uv`; não use Docker, Conda, pip do sistema ou virtualenv manual.
- Entregue o caminho absoluto do MP4 e um resumo curto — sem revalidar o arquivo.

## Fluxo de trabalho

1. Receber tema/roteiro e resolver `SKILL_DIR` (diretório do `SKILL.md` e do `mpt_agent.py`).
2. Rodar, com `workdir=SKILL_DIR`: `uv run --no-project --python 3.11 python mpt_agent.py --subject "<tema>"`.
3. Interpretar o resultado: código `0` → `MPT_RESULT`; código `10` → pedir só as variáveis `MPT_*` listadas; código `1` → reparar e tentar uma vez.
4. Se aparecer `*_CHARGE_CONFIRMATION_REQUIRED`, explicar a cobrança e repetir apenas com a flag autorizada.
5. Se a saída for truncada, ler uma única vez `~/MoneyPrinterTurbo/.agent-logs/moneyprinterturbo-video/latest-result.json` e aceitar `status=completed`.
6. Devolver o caminho de `final-1.mp4` e um resumo do que foi gerado.

## Entradas e saídas

- Entradas: tema, palavra-chave ou roteiro completo; variáveis `MPT_LLM_*`, `MPT_PEXELS_API_KEY` e afins; `config.toml` (TOML) com `video_source`, `video_clip_duration`, `video_clip_speed`, `subtitle_provider`, `voice_mode`, `bgm_volume`.
- Saídas: `final-1.mp4`, `storage/tasks/<task_id>/`, `run-<task_id>.log`, `latest-result.json`; formatos `9:16 (1080×1920)`, `16:9 (1920×1080)`, `1:1 (1080×1080)`.

## Limites e ressalvas

- O skill documentado cobre macOS e Windows, usa apenas `uv` e CLI; não inicia WebUI, API ou Docker e não roda múltiplos vídeos em paralelo.
- Provedores pagos (Seedance, WaveSpeed, OFox, Metaso, MuAPI, useapi, Infistar, Jalapeno) exigem confirmação explícita; nunca adicionar a flag silenciosamente.
- O fluxo de projeto local em `docs/video-projects.md` não faz chamadas de API, não publica, não gera TTS nem legendas palavra a palavra; exige FFmpeg/FFprobe com `libx264` e usa snapshots imutáveis com SHA-256.
- Arquivos em `.work` após queda de processo não são fontes confiáveis; render falho/cancelado exige `--retry`.
- Um `HEAD` bem-sucedido em endpoints de artefato informa tamanho/tipo, mas não garante decodificação nem estabilidade do arquivo.

## Quando usar

- Objetivo é um MP4 final a partir de um tema, com narração, legendas, material de estoque e trilha sonora.
- Reparo de gerações falhas.

## Quando não usar

- Timeline programática determinística ou ajustes finos de edição — use a inteligência de vídeo programável.
- Publicação automática sem autorização de cobrança.
- Quando não for possível solicitar credenciais faltantes.

## Fontes de sustentação

- `README-en.md`
- `docs/skill/SKILL.md`
- `config.example.toml`
- `docs/video-projects.md`
- `docs/artifact-metadata.md`
- `docs/loomloom/moneyprinterturbo-script-candidates.template.json`
