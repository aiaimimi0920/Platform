param(
  [switch]$RemoveVolumes
)

$ErrorActionPreference = "Stop"
$composeFile = Join-Path $PSScriptRoot "docker-compose.local.yml"

$downArgs = @("down", "--remove-orphans")
if ($RemoveVolumes) {
  $downArgs += "-v"
}

& docker compose -f $composeFile @downArgs
