# Evidência — instalador Windows e credenciais próprias

Data: 2026-11-20

## Objetivo

Distribuir o MEDEIROS SYSTEM como um `.exe` Windows que qualquer pessoa instala
e usa sem depender da conta do autor, com uma tela para cada pessoa informar suas
próprias credenciais de IA.

## O que foi implementado

- `scripts/lib/credenciais.mjs`: grava chaves em `~/.medeiros-system/keys/`,
  chama `openmausbot engine set ... --key-file ...` e nunca devolve a chave.
- `scripts/ui/server.mjs`: tela **Suas credenciais** e rotas `GET`, `POST` e
  `DELETE /api/credenciais`.
- `scripts/instalar-mcp.mjs`: com `OPENMAUSBOT_CLI`, registra o node e o CLI
  embutidos com caminho absoluto; sem a variável, mantém o CLI global.
- `scripts/build-instalador.mjs`: monta o payload (node + núcleo + MausBot),
  recusa arquivos que pareçam credenciais, compila o launcher e anexa o payload.
- `scripts/instalador/Program.cs`: extrai, grava versão, registra MCP, cria atalho
  e abre o painel.
- `scripts/validar-instalador.mjs`: validação ponta a ponta em pasta temporária.

Stitch do Google não estava disponível neste ambiente (sem CLI e sem MCP ativo),
então a tela foi construída localmente no estilo visual Stitch/Material: índigo
`#4f46e5`, superfícies claras, cartões e tipografia de sistema.

## Comandos executados e resultados

### Suíte de testes

```
node --test tests/*.test.mjs
tests 54 · pass 54 · fail 0
```

### Gate do núcleo no pacote extraído

```
node scripts/ecosystem.mjs doctor
{ "ok": true, "importedFiles": 1727, "upstreamRepositories": 11,
  "specialties": 31, "errors": [] }
```

### Build do instalador

```
node scripts/build-instalador.mjs
{
  "ok": true,
  "tamanho": 98619651,
  "payload": 98609907,
  "arquivos": 4630,
  "sha256": "8aa14d2abe2ee2e32d30735d0f2926388f6d793ca3758d5ebbb585fdc62e5c45"
}
```

### Validação ponta a ponta

```
node scripts/validar-instalador.mjs
{
  "ok": true,
  "etapas": ["extracao", "versao", "mcp"],
  "doctor": { "ok": true, "importedFiles": 1727,
              "upstreamRepositories": 11, "specialties": 31 },
  "cliBundlado": true,
  "painel": true,
  "credenciais": { "salvou": true, "segredoNaoExposto": true, "caminhoArquivo": true }
}
```

A validação confirmou também que:

- o MCP registrado aponta para o node e o `cli.js` extraídos;
- o CLI embutido executa `help` com sucesso;
- a tela do painel contém o campo de senha e o texto **Credenciais**;
- a chave fictícia não aparece na resposta de salvamento, no status nem nos
  argumentos passados ao CLI.

## Correções de portabilidade encontradas no caminho

- `core.autocrlf=true` no Windows convertia os adaptadores para CRLF e o `doctor`
  os rejeitava. Agora a verificação normaliza line endings.
- Sem git, o `doctor` usava um fallback que não reconhecia `.gitignore` aninhado.
  Agora `ignoradoSemGit` cobre esse caso.

## Limites

- Nenhum `runtimeId` foi inventado e nenhuma delegação real via `codex exec` foi
  concluída nesta rodada: o limite externo do provedor bloqueou o smoke test.
- O `.exe` fica em `dist/` e não é versionado.
- Publicação depende de autorização explícita; os commits locais estão na branch
  `main`, à frente do remoto.
