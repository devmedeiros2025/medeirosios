# MazyOS no VS Code e no Antigravity

> O sistema operacional do seu negócio, dentro do editor. A memória da sua empresa, a sua identidade visual e as 17 skills do MazyOS rodando com o agente que você já paga: Claude, GPT ou Antigravity.

Você abre a pasta do seu negócio, pede "um carrossel sobre a promoção de sexta" e o agente entrega no seu tom, com a sua cara, sabendo o que a sua empresa faz. Sem repetir contexto, sem colar briefing, sem sair do editor.

## Como funciona

O MazyOS guarda o que importa sobre o seu negócio em arquivos simples (`_memoria/empresa.md`, `_memoria/preferencias.md`, `_memoria/estrategia.md`, `identidade/design-guide.md`). A extensão lê esses arquivos, monta o pedido com a skill certa e manda pro agente que você escolheu. O agente trabalha na sua pasta e a extensão mostra tudo acontecendo no console do Mazy: cada arquivo que ele lê, cada coisa que ele cria, e a resposta final pronta pra copiar ou salvar.

Os três agentes entram pela conta deles, do jeito oficial de cada fabricante:

| Agente | O que roda | Conta | Como entrar |
| --- | --- | --- | --- |
| Claude | Claude Code | Claude Pro, Max ou Team, ou chave da API da Anthropic | botão **Entrar** no painel (abre o `claude auth login`) |
| GPT | Codex | ChatGPT Plus, Pro ou Business, ou chave da API da OpenAI | botão **Entrar** (abre o `codex login`, que leva pro navegador) |
| Antigravity | Antigravity CLI | Conta Google, com a cota do Antigravity (Gemini, Claude e GPT-OSS) | botão **Entrar** (abre o `agy`, que faz o login no navegador) |

A extensão não guarda senha nem token de ninguém. Se você preferir chave de API em vez de login, ela fica no cofre do próprio editor e só é entregue ao agente na hora de rodar.

## Instalar

1. Instale o CLI do agente que você vai usar, se ainda não tem: [Claude Code](https://claude.ai/code), [Codex](https://github.com/openai/codex) ou [Antigravity](https://antigravity.google). Pode ter os três e trocar quando quiser.
2. Instale a extensão. Enquanto ela não está no marketplace, é pelo arquivo `.vsix`:

```
code --install-extension mazyos-0.1.0.vsix
```

No Antigravity IDE, o comando é `antigravity-ide --install-extension mazyos-0.1.0.vsix`, ou pelo menu de extensões, "Install from VSIX".

3. Clique no ícone do MazyOS na barra lateral. O painel mostra quem está conectado.

## Usar

- **Ligar o MazyOS numa pasta**: abra a pasta do negócio e clique em "Ligar o MazyOS nesta pasta". Abre uma conversa de 10 perguntas no terminal e, no fim, a memória está criada.
- **Pedir**: escreva no campo do painel (ou `Cmd+Alt+M` / `Ctrl+Alt+M`) e manda. O console abre do lado mostrando o trabalho.
- **Skills**: clique numa skill pra pedir com ela (carrossel, SEO, anúncio do Google, e-mail, avaliações...). As que conversam com você (instalar, novo projeto, mapear rotinas, prospecção) abrem o agente num terminal.
- **Continuar**: no console, dá pra continuar a conversa na mesma sessão do agente.
- **Trocar de agente ou de modelo**: no seletor do painel. A escolha vale pra todas as pastas, a não ser que você mude só nesta.

## O que o agente pode fazer sem perguntar

Por padrão, ele lê e edita arquivos dentro da pasta aberta e nada além disso (configuração `mazyos.permissoes` em `edicoes`). Se você quiser que ele também rode comandos sem confirmar, mude pra `tudo`. Isso vale só pro console; no terminal, quem decide é você, na hora.

## Configurações

| Configuração | O que faz |
| --- | --- |
| `mazyos.agente` | `claude`, `codex` ou `antigravity` |
| `mazyos.modelos` | modelo por agente, pelo id que o CLI aceita (em branco usa o padrão) |
| `mazyos.permissoes` | `edicoes` (padrão) ou `tudo` |
| `mazyos.abrirConsoleAoRodar` | abre o console quando uma skill começa |
| `mazyos.linhaDeStatus` | mostra o negócio e o foco na barra de status |
| `mazyos.caminhos` | caminho completo de cada CLI, se não estiver no PATH |

## Comandos

Todos começam com "MazyOS:" na paleta de comandos: abrir o painel, pedir algo ao Mazy, rodar uma skill, ligar o MazyOS nesta pasta, recarregar a memória, abrir os arquivos de memória, escolher o agente, entrar numa conta, guardar uma chave de API, abrir o console, cancelar a execução.

## Perguntas que sempre aparecem

**Preciso do plugin do MazyOS no Claude Code?** Não. A extensão já traz as skills e os templates dentro dela. Se você também usa o plugin no terminal, os dois leem a mesma pasta e a mesma memória.

**Funciona no Antigravity IDE? E no Cursor?** Sim. Os dois são baseados no VS Code e aceitam a mesma extensão.

**Onde ficam os meus dados?** Na sua pasta, em arquivos de texto. A extensão não manda nada pra lugar nenhum: quem fala com a IA é o CLI do agente, com a sua conta.

**Quanto custa?** A extensão é parte do MazyOS. O uso da IA sai do plano que você já tem no agente escolhido, ou da chave de API, se usar uma.

## Pra quem quer mexer no código

```
cd vscode
npm install
npm run build        # copia as skills do plugin e monta os bundles
npm run verificar    # tipos + testes
npm run empacotar    # gera o .vsix
code --extensionDevelopmentPath=$PWD   # abre um VS Code com a extensão em desenvolvimento
```

A arquitetura está em [ARQUITETURA.md](ARQUITETURA.md). As skills e os templates vêm da raiz do repositório, copiados pra `vscode/mazyos/` no build: a fonte da verdade é o plugin.
