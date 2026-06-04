param(
  [switch]$ResetData,
  [switch]$NoBuild,
  [int]$WebHostPort = 3028
)

$ErrorActionPreference = "Stop"

$composeFile = Join-Path $PSScriptRoot "docker-compose.local.yml"

function Invoke-Compose {
  param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Arguments
  )

  $env:WEB_HOST_PORT = "$WebHostPort"
  & docker compose -f $composeFile @Arguments
}

function Wait-ForHttpOk {
  param(
    [string]$Name,
    [string]$Url,
    [int]$TimeoutSeconds = 300
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
        Write-Host "[ready] $Name -> $Url"
        return
      }
    } catch {
      Start-Sleep -Seconds 2
    }
  }

  throw "Timed out waiting for $Name at $Url"
}

if ($ResetData) {
  Write-Host "Stopping existing local stack and removing volumes..."
  Invoke-Compose down -v --remove-orphans
}

$upArgs = @("up", "-d")
if (-not $NoBuild) {
  $upArgs += "--build"
}

Write-Host "Starting local NeuroLoom development stack..."
Invoke-Compose @upArgs

Wait-ForHttpOk -Name "web" -Url "http://127.0.0.1:$WebHostPort/health"
Wait-ForHttpOk -Name "core" -Url "http://127.0.0.1:4028/health"
Wait-ForHttpOk -Name "account-api" -Url "http://127.0.0.1:4128/health"

Write-Host ""
Write-Host "Local development stack is ready."
Write-Host "Web:            http://127.0.0.1:$WebHostPort"
Write-Host "Core API:       http://127.0.0.1:4028/health"
Write-Host "Account API:    http://127.0.0.1:4128/health"
Write-Host "MinIO Console:  http://127.0.0.1:9001"
Write-Host ""
Write-Host "Local dev login is enabled on /login through the Local Dev button."
