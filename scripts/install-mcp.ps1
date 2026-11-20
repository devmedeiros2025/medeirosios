$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$node = (Get-Command node -ErrorAction Stop).Source
& $node (Join-Path $repo 'scripts\instalar-mcp.mjs')
