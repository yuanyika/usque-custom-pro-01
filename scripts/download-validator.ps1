$ErrorActionPreference = 'Stop'
$taskValidationDir = Join-Path $PSScriptRoot '..\artifacts\validator'
New-Item -ItemType Directory -Path $taskValidationDir -Force | Out-Null
$taskArchive = Join-Path $taskValidationDir 'mihomo.zip'
Invoke-WebRequest -Uri 'https://github.com/MetaCubeX/mihomo/releases/download/v1.19.32/mihomo-windows-amd64-compatible-v1.19.32.zip' -OutFile $taskArchive
Expand-Archive -LiteralPath $taskArchive -DestinationPath $taskValidationDir -Force
Get-ChildItem -LiteralPath $taskValidationDir -Filter '*.exe' | Select-Object Name
