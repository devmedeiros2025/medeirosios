# Instalador Windows

## Objetivo

Um único `.exe` que qualquer pessoa baixa, executa e usa sem depender da conta de
quem publicou. Nenhuma credencial do autor é embutida no pacote.

## O que vai dentro

| Componente | Origem | Destino após instalação |
| --- | --- | --- |
| Node 24.13.1 | `node.exe` do sistema de build | `node/node.exe` |
| Núcleo MEDEIROS SYSTEM | repositório, sem `.git` nem `dist/` | `app/` |
| OpenMausBot 0.1.173 (Apache-2.0) | pacote npm instalado | `mausbot/` |

O builder `scripts/build-instalador.mjs` recusa o pacote se encontrar qualquer
arquivo que pareça credencial (`.env`, `.npmrc`, `.git-credentials`, `*.key`,
`*.pem`, `credentials.json`, `.ssh/`, `.medeiros-system/`).

## Como é montado

1. Os três componentes são copiados para um palco temporário.
2. O palco vira `payload.tar.gz` com o `tar.exe` do Windows.
3. `scripts/instalador/Program.cs` é compilado com o `csc.exe` do .NET Framework.
4. O payload é anexado ao executável, seguido de 8 bytes de tamanho e da assinatura
   `MSISTLR1`.

O launcher localiza o payload lendo o próprio arquivo — não precisa de arquivos
ao lado do `.exe`.

## O que a execução faz

1. Extrai o payload para `%LOCALAPPDATA%\MedeirosSystem` (ou
   `MEDEIROS_INSTALL_DIR`).
2. Grava `versao.txt`.
3. Registra o MCP em `~/.codex/config.toml`, `~/.config/opencode/opencode.json` e
   `~/.claude.json`, sempre com backup antes de alterar. O comando registrado é o
   node portátil chamando `mausbot/cli.js mcp`, com caminho absoluto.
4. Cria o atalho **Abrir painel** no menu Iniciar.
5. Inicia o painel em `127.0.0.1:8765` e abre o navegador.

Variáveis de ambiente para testes: `MEDEIROS_INSTALL_DIR`, `MEDEIROS_PAYLOAD`,
`MEDEIROS_NO_MCP`, `MEDEIROS_NO_SHORTCUT`, `MEDEIROS_NO_LAUNCH`.

## Credenciais da pessoa

A tela **Suas credenciais** do painel envia a chave por `POST /api/credenciais`.
O módulo `scripts/lib/credenciais.mjs`:

- grava a chave em `~/.medeiros-system/keys/<provedor>.key`;
- chama `openmausbot engine set <provedor> --key-file <arquivo>` — a chave nunca
  aparece nos argumentos;
- devolve apenas provedor, data e status da chamada, nunca a chave.

`GET /api/credenciais` devolve somente quais provedores estão configurados e
quando. Para remover: `DELETE /api/credenciais?provedor=claude`.

Provedores aceitos: `claude`, `openai`, `openrouter`, `openai-compatible`, `xai`,
`groq`, `greenference`, `modelgo`, `mistral`, `cerebras`.

## Como gerar e validar

```bash
node scripts/build-instalador.mjs
node scripts/validar-instalador.mjs
```

A validação instala em pasta temporária com `USERPROFILE` isolado, executa o
`doctor` do pacote, roda `cli.js help`, sobe o painel com o node portátil, salva
uma chave fictícia e confirma que ela não aparece em nenhuma resposta nem nos
argumentos do CLI.
