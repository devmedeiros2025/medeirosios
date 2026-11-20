---
name: intel-comfyui-grafos-geracao
titulo: Grafos de geração local com ComfyUI
description: Motor modular de grafos de nós para gerar e editar imagens, vídeo, áudio e 3D com modelos abertos, localmente.
categoria: Geração multimodal / orquestração de inferência local
palavras-chave: comfyui, grafo, nos, no, semente, imagem, video, png, latent, checkpoint, inferencia local, amostrador
---

# Grafos de geração local com ComfyUI

## Parâmetros de pensamento

- Decompor a tarefa em nós reutilizáveis (loader → encode → latent → sampler → decode → save) e subgrafos.
- Fixar a semente e registrar `cfg`, `steps`, `sampler`, `scheduler` e `denoise` para reproduzir cada saída.
- Exportar o grafo como JSON da API (`File → Export (API)`) antes de automatizar.
- Endereçar entradas por `class_type` + `inputs`, com arestas em pares `["id", índice]`.
- Reutilizar nós nativos e esquemas V3; criar um nó novo só se nenhum existente atender.
- Passar valores do usuário sem rejeitá-los por faixas recomendadas; validar apenas fronteiras de arquivo.
- Manter o núcleo offline com `--offline` ou `--disable-partner-nodes` quando não houver autorização.
- Tratar dtype, device, VRAM e offload como correção; escolher kernels otimizados antes de escrever matemática própria.
- Medir allocations, transferências, pico de memória e gerações curtas/longas antes de otimizar.
- Usar `.safetensors` nas pastas padrão e converter localmente layouts de checkpoint incompatíveis.

## Fluxo de trabalho

1. Instalar via Desktop (recomendado), build portátil/CLI ou manual com Python 3.13 e PyTorch atualizado (`cu130+` em Nvidia 20+).
2. Colocar checkpoints em `models/checkpoints`, VAE em `models/vae` e demais componentes em suas pastas.
3. Montar o grafo visual, ajustar prompts positivo/negativo, semente e parâmetros do amostrador.
4. Exportar o JSON da API e alterar `inputs` por script (ex.: `prompt["6"]["inputs"]["text"]`).
5. Enfileirar com `POST http://127.0.0.1:8188/prompt`, acompanhar o progresso e coletar arquivos por `filename_prefix`.
6. Arrastar a mídia gerada de volta ao canvas para recuperar workflow e sementes; versionar o JSON.

## Entradas e saídas

- Entradas: grafo JSON; `ckpt_name`; textos `CLIPTextEncode`; `width`, `height`, `batch_size`; `cfg`, `steps`, `seed`, `sampler_name`, `scheduler`, `denoise`; LoRAs/ControlNets; mídia de referência; flags de startup.
- Saídas: PNG 16 bits, EXR 32 bits, AVIF 10 bits, vídeo/áudio/3D, workflow JSON com metadados, fila e histórico do servidor local/WebSocket.

## Limites e ressalvas

- Baixa VRAM (4 GB) + 8 GB RAM é suportada via streaming de pesos, com dependência forte do hardware.
- `torch` 2.7 é o mínimo; versões com mais de 6 meses devem ser atualizadas; Python 3.14 tem ressalvas em alguns nós customizados.
- O núcleo não faz requisições de internet; downloads de modelos só ocorrem mediante autorização explícita.
- Valores fora da faixa recomendada são aceitos e podem degradar a qualidade — não espere erro automático.
- Nós de modelos fechados exigem chave de API em `extra_data`.

## Quando usar

- Pipelines reprodutíveis de imagem, vídeo, áudio e 3D.
- Automação por API com parâmetros registrados.
- Experimentação local com modelos abertos.

## Quando não usar

- Ajuste casual de uma única imagem sem necessidade de controle de grafo.
- Renderização de HTML para vídeo — use a inteligência de vídeo determinístico.
- Ausência de hardware para o modelo.

## Fontes de sustentação

- `README.md`
- `AGENTS.md`
- `QUANTIZATION.md`
- `script_examples/basic_api_example.py`
- `script_examples/websockets_api_example.py`
- `docs/installation.md`
