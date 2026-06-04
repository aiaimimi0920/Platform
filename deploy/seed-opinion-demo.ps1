param(
  [string]$ContainerName = "deploy-postgres-1",
  [string]$Database = "neuroloom",
  [string]$User = "neuroloom"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$seedSql = Join-Path $scriptDir "seed-opinion-demo.sql"
if (-not (Test-Path -LiteralPath $seedSql)) {
  throw "Seed SQL file not found: $seedSql"
}

$tempPath = "/tmp/seed-opinion-demo.sql"

docker cp $seedSql "${ContainerName}:${tempPath}" | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "Failed to copy seed file into container."
}

docker exec $ContainerName psql -v ON_ERROR_STOP=1 -U $User -d $Database -f $tempPath
if ($LASTEXITCODE -ne 0) {
  throw "Failed to apply demo opinion seed."
}
