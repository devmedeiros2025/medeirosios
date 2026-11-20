$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$servidor = Join-Path $repo 'scripts\mcp\server.mjs'
$node = (Get-Command node -ErrorAction Stop).Source

[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)

& $node $servidor
