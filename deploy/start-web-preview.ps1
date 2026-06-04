param(
  [int]$StartPort = 30000,
  [int]$Step = 2,
  [string]$ContainerPrefix = "deploy-web-preview",
  [string]$ImageName = "deploy-web",
  [string]$DockerNetwork = "deploy_default",
  [string]$HeavyTaskDialogId,
  [string]$HeavyTaskTaskLabel = "start web preview",
  [string]$HeavyTaskImplementationLine = "web/local_preview",
  [int]$HeavyTaskLeaseSeconds = 1800,
  [string]$HeavyTaskStatePath,
  [switch]$HeavyTaskFailIfBusy
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$composeFile = Join-Path $PSScriptRoot "docker-compose.local.yml"
$claimHeavyScript = Join-Path $PSScriptRoot "claim-heavy-task.ps1"
$releaseHeavyScript = Join-Path $PSScriptRoot "release-heavy-task.ps1"
$previewDependencyServices = @(
  "postgres",
  "valkey",
  "minio",
  "minio-init",
  "migrate",
  "account-migrate",
  "core",
  "account-api",
  "gateway",
  "account-worker"
)

function Wait-ForHttpOk {
  param(
    [string]$Name,
    [string]$Url,
    [int]$TimeoutSeconds = 180
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
        return
      }
    } catch {
      Start-Sleep -Seconds 2
    }
  }

  throw "Timed out waiting for $Name at $Url"
}

function Ensure-PreviewDependencies {
  param(
    [string]$ComposePath,
    [string[]]$Services
  )

  Write-Host "Ensuring preview dependencies are running..."
  & docker compose -f $ComposePath up -d --no-build @Services
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to start preview dependencies. Build the local stack images first, then retry."
  }

  Wait-ForHttpOk -Name "core" -Url "http://127.0.0.1:4028/health"
  Wait-ForHttpOk -Name "account-api" -Url "http://127.0.0.1:4128/health"
  Wait-ForHttpOk -Name "gateway" -Url "http://127.0.0.1:4226/healthz"
}

function Get-NextPreviewPort {
  param(
    [int]$BasePort,
    [int]$Increment,
    [string]$Prefix
  )

  $existingPorts = @()
  $containerNames = & docker ps -a --format "{{.Names}}"
  foreach ($name in $containerNames) {
    if ($name -match "^$([regex]::Escape($Prefix))-(\d+)$") {
      $existingPorts += [int]$Matches[1]
    }
  }

  $candidate = if ($existingPorts.Count -gt 0) {
    (($existingPorts | Measure-Object -Maximum).Maximum) + $Increment
  } else {
    $BasePort
  }

  if (($candidate % 2) -ne 0) {
    $candidate += 1
  }

  while (Get-NetTCPConnection -State Listen -LocalPort $candidate -ErrorAction SilentlyContinue) {
    $candidate += $Increment
  }

  return $candidate
}

function Invoke-HeavyTaskClaimIfNeeded {
  if ([string]::IsNullOrWhiteSpace($HeavyTaskDialogId)) {
    return
  }

  $args = @(
    '-ExecutionPolicy', 'Bypass',
    '-File', $claimHeavyScript,
    '-DialogId', $HeavyTaskDialogId,
    '-TaskLabel', $HeavyTaskTaskLabel,
    '-ImplementationLine', $HeavyTaskImplementationLine,
    '-LeaseSeconds', $HeavyTaskLeaseSeconds
  )
  if (-not [string]::IsNullOrWhiteSpace($HeavyTaskStatePath)) {
    $args += @('-StatePath', $HeavyTaskStatePath)
  }
  if ($HeavyTaskFailIfBusy) {
    $args += '-FailIfBusy'
  }
  $output = & powershell.exe @args
  $exitCode = $LASTEXITCODE
  if ($output) {
    $output | Write-Output
  }
  if ($exitCode -ne 0) {
    throw "Heavy task claim failed with exit code $exitCode"
  }
}

function Invoke-HeavyTaskReleaseIfNeeded {
  if ([string]::IsNullOrWhiteSpace($HeavyTaskDialogId)) {
    return
  }

  $args = @(
    '-ExecutionPolicy', 'Bypass',
    '-File', $releaseHeavyScript,
    '-DialogId', $HeavyTaskDialogId
  )
  if (-not [string]::IsNullOrWhiteSpace($HeavyTaskStatePath)) {
    $args += @('-StatePath', $HeavyTaskStatePath)
  }
  $output = & powershell.exe @args
  if ($output) {
    $output | Write-Output
  }
}

Invoke-HeavyTaskClaimIfNeeded
try {
  $null = Ensure-PreviewDependencies -ComposePath $composeFile -Services $previewDependencyServices

  $port = Get-NextPreviewPort -BasePort $StartPort -Increment $Step -Prefix $ContainerPrefix
  $containerName = "$ContainerPrefix-$port"
  $envFile = Join-Path $env:TEMP "$containerName.env"

  @"
NODE_ENV=production
PORT=3000
NEXTAUTH_URL=http://localhost:$port
NEXT_PUBLIC_APP_URL=http://localhost:$port
NEXTAUTH_SECRET=local-nextauth-secret
OAUTH_CLIENT_ID=local-client
OAUTH_CLIENT_SECRET=local-secret
ACCOUNT_INTERNAL_URL=http://account-api:4000
ACCOUNT_WORKER_INTERNAL_URL=http://account-worker:7303
AI_GATEWAY_INTERNAL_URL=http://gateway:4200
AI_GATEWAY_MANAGEMENT_TOKEN=local-internal-token
CORE_INTERNAL_URL=http://core:4000
INTERNAL_API_TOKEN=local-internal-token
DEV_AUTH_BYPASS_ENABLED=true
DEV_AUTH_BYPASS_NAME=Local Dev
DEV_AUTH_BYPASS_USERNAME=local-dev
DEV_AUTH_BYPASS_EMAIL=local-dev@example.test
DEV_AUTH_BYPASS_PROVIDER_USER_ID=local-dev-account
DEV_AUTH_BYPASS_TRUST_LEVEL=4
PLATFORM_OPERATOR_USER_IDS=local-operator,local-dev-account
ENABLE_FIGMA_CAPTURE=true
"@ | Set-Content -Path $envFile -Encoding ascii

  if (& docker ps -a --format "{{.Names}}" | Select-String -Pattern "^$([regex]::Escape($containerName))$" -Quiet) {
    & docker rm -f $containerName | Out-Null
  }

  $runArgs = @(
    "run",
    "-d",
    "--name", $containerName,
    "--network", $DockerNetwork,
    "-p", "${port}:3000",
    "--env-file", $envFile,
    $ImageName,
    "npm",
    "run",
    "start"
  )

  $containerId = & docker @runArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to start preview container."
  }

  Wait-ForHttpOk -Name "preview-web" -Url "http://127.0.0.1:$port"

  Write-Output "PORT=$port"
  Write-Output "URL=http://localhost:$port"
  Write-Output "CONTAINER=$containerName"
  Write-Output "CONTAINER_ID=$containerId"
} finally {
  Invoke-HeavyTaskReleaseIfNeeded
}
