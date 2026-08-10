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
  [switch]$HeavyTaskFailIfBusy,
  [int]$AllocationLockTimeoutSeconds = 120,
  [int]$PreviewReadyTimeoutSeconds = 180
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$composeFile = Join-Path $PSScriptRoot "docker-compose.local.yml"
$claimHeavyScript = Join-Path $PSScriptRoot "claim-heavy-task.ps1"
$releaseHeavyScript = Join-Path $PSScriptRoot "release-heavy-task.ps1"
$powerShellExecutable = (Get-Process -Id $PID).Path
$previewAllocationMutexName = "Local\NeuroPlatformWebPreviewAllocation"
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
    } catch {}
    Start-Sleep -Seconds 2
  }

  throw "Timed out waiting for $Name at $Url"
}

function Wait-ForPreviewReady {
  param(
    [string]$BaseUrl,
    [int]$TimeoutSeconds
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $readyResponse = Invoke-WebRequest -Uri "$BaseUrl/ready" -UseBasicParsing -TimeoutSec 5
      $providers = Invoke-RestMethod -Uri "$BaseUrl/api/auth/providers" -TimeoutSec 5
      if (
        $readyResponse.StatusCode -ge 200 -and
        $readyResponse.StatusCode -lt 300 -and
        $providers.PSObject.Properties.Name -contains "local-dev"
      ) {
        return
      }
    } catch {}
    Start-Sleep -Seconds 2
  }

  throw "Timed out waiting for preview readiness and the Local Dev auth provider at $BaseUrl"
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

function Enter-PreviewAllocationLock {
  param(
    [string]$Name,
    [int]$TimeoutSeconds
  )

  $mutex = New-Object System.Threading.Mutex($false, $Name)
  $lockTaken = $false
  try {
    try {
      $lockTaken = $mutex.WaitOne([TimeSpan]::FromSeconds($TimeoutSeconds))
    } catch [System.Threading.AbandonedMutexException] {
      $lockTaken = $true
    }

    if (-not $lockTaken) {
      throw "Timed out waiting for the Platform preview allocation lock."
    }

    return $mutex
  } catch {
    if (-not $lockTaken) {
      $mutex.Dispose()
    }
    throw
  }
}

function Exit-PreviewAllocationLock {
  param([System.Threading.Mutex]$Mutex)

  try {
    $Mutex.ReleaseMutex()
  } finally {
    $Mutex.Dispose()
  }
}

function Invoke-HeavyTaskClaimIfNeeded {
  if ([string]::IsNullOrWhiteSpace($HeavyTaskDialogId)) {
    return
  }

  $args = @(
    '-NoProfile',
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
  $output = & $powerShellExecutable @args
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
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', $releaseHeavyScript,
    '-DialogId', $HeavyTaskDialogId
  )
  if (-not [string]::IsNullOrWhiteSpace($HeavyTaskStatePath)) {
    $args += @('-StatePath', $HeavyTaskStatePath)
  }
  $output = & $powerShellExecutable @args
  $exitCode = $LASTEXITCODE
  if ($output) {
    $output | Write-Output
  }
  if ($exitCode -ne 0) {
    throw "Heavy task release failed with exit code $exitCode"
  }
}

$envFile = $null
$containerName = $null
$containerStarted = $false
$previewReady = $false
$allocationMutex = $null
$operationError = $null

Invoke-HeavyTaskClaimIfNeeded
try {
  $null = Ensure-PreviewDependencies -ComposePath $composeFile -Services $previewDependencyServices

  $allocationMutex = Enter-PreviewAllocationLock `
    -Name $previewAllocationMutexName `
    -TimeoutSeconds $AllocationLockTimeoutSeconds
  try {
    $port = Get-NextPreviewPort -BasePort $StartPort -Increment $Step -Prefix $ContainerPrefix
    $containerName = "$ContainerPrefix-$port"
    $envFile = Join-Path $env:TEMP "$containerName.env"

    @"
NODE_ENV=development
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
      "dev",
      "--",
      "--hostname",
      "0.0.0.0"
    )

    $containerId = & docker @runArgs
    if ($LASTEXITCODE -ne 0) {
      throw "Failed to start preview container."
    }
    $containerStarted = $true
  } finally {
    if ($allocationMutex) {
      $mutexToRelease = $allocationMutex
      $allocationMutex = $null
      Exit-PreviewAllocationLock -Mutex $mutexToRelease
    }
  }

  Remove-Item -LiteralPath $envFile -Force

  Wait-ForPreviewReady `
    -BaseUrl "http://127.0.0.1:$port" `
    -TimeoutSeconds $PreviewReadyTimeoutSeconds
  $previewReady = $true

  Write-Output "PORT=$port"
  Write-Output "URL=http://localhost:$port"
  Write-Output "CONTAINER=$containerName"
  Write-Output "CONTAINER_ID=$containerId"
} catch {
  $operationError = $_
  throw
} finally {
  try {
    if ($allocationMutex) {
      $mutexToRelease = $allocationMutex
      $allocationMutex = $null
      Exit-PreviewAllocationLock -Mutex $mutexToRelease
    }
    if ($envFile -and (Test-Path -LiteralPath $envFile)) {
      Remove-Item -LiteralPath $envFile -Force -ErrorAction SilentlyContinue
      if (Test-Path -LiteralPath $envFile) {
        Write-Warning "Failed to remove temporary preview environment file: $envFile"
      }
    }
    if ($containerStarted -and -not $previewReady) {
      & docker rm -f $containerName | Out-Null
      if ($LASTEXITCODE -ne 0) {
        Write-Warning "Failed to remove unhealthy preview container: $containerName"
      }
    }
  } finally {
    try {
      Invoke-HeavyTaskReleaseIfNeeded
    } catch {
      if ($operationError) {
        Write-Warning "Preview failed and heavy-task release also failed: $($_.Exception.Message)"
      } else {
        throw
      }
    }
  }
}
