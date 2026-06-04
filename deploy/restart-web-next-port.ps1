param(
  [int]$BasePort = 3028,
  [int]$Step = 2,
  [switch]$NoBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$composeFile = Join-Path $PSScriptRoot "docker-compose.local.yml"
$runtimeDir = Join-Path $repoRoot ".runtime"
$stateFile = Join-Path $runtimeDir "local-web-port.txt"

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

function Get-CurrentComposeWebPort {
  param(
    [string]$ComposePath
  )

  try {
    $output = & docker compose -f $ComposePath port web 3000 2>$null
    if ($LASTEXITCODE -eq 0 -and $output) {
      $line = ($output | Select-Object -First 1).Trim()
      if ($line -match ":(\d+)$") {
        return [int]$Matches[1]
      }
    }
  } catch {
    return $null
  }

  return $null
}

function Get-NextWebPort {
  param(
    [int]$InitialPort,
    [int]$Increment,
    [string]$ComposePath,
    [string]$StatePath
  )

  $seenPorts = @()

  if (Test-Path $StatePath) {
    $stateValue = (Get-Content -Path $StatePath -TotalCount 1 -ErrorAction SilentlyContinue | Select-Object -First 1)
    $parsed = 0
    if ([int]::TryParse([string]$stateValue, [ref]$parsed)) {
      $seenPorts += $parsed
    }
  }

  $currentPort = Get-CurrentComposeWebPort -ComposePath $ComposePath
  if ($currentPort) {
    $seenPorts += $currentPort
  }

  $candidate = if ($seenPorts.Count -gt 0) {
    (($seenPorts | Measure-Object -Maximum).Maximum) + $Increment
  } else {
    $InitialPort
  }

  if (($candidate % 2) -ne 0) {
    $candidate += 1
  }

  while (Get-NetTCPConnection -State Listen -LocalPort $candidate -ErrorAction SilentlyContinue) {
    $candidate += $Increment
  }

  return $candidate
}

if (-not (Test-Path $runtimeDir)) {
  New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
}

$port = Get-NextWebPort -InitialPort $BasePort -Increment $Step -ComposePath $composeFile -StatePath $stateFile
$env:WEB_HOST_PORT = "$port"

if (-not $NoBuild) {
  Write-Host "Building fresh web image for http://127.0.0.1:$port ..."
  & docker compose -f $composeFile build web
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to build web image."
  }
}

Write-Host "Recreating web service on http://127.0.0.1:$port ..."
& docker compose -f $composeFile up -d --no-deps --force-recreate web
if ($LASTEXITCODE -ne 0) {
  throw "Failed to recreate web service."
}

Wait-ForHttpOk -Name "web" -Url "http://127.0.0.1:$port/health"
Set-Content -Path $stateFile -Value "$port" -Encoding ascii

Write-Output "PORT=$port"
Write-Output "URL=http://127.0.0.1:$port"
Write-Output "STATE_FILE=$stateFile"
