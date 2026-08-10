param(
  [int]$BasePort = 3028,
  [int]$Step = 2,
  [switch]$NoBuild,
  [int]$AllocationLockTimeoutSeconds = 120,
  [int]$WebReadyTimeoutSeconds = 300
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$composeFile = Join-Path $PSScriptRoot "docker-compose.local.yml"
$runtimeDir = Join-Path $repoRoot ".runtime"
$stateFile = Join-Path $runtimeDir "local-web-port.txt"
$previewAllocationMutexName = "Local\NeuroPlatformWebPreviewAllocation"

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

function Get-ComposeWebContainerId {
  param(
    [string]$ComposePath
  )

  try {
    $output = & docker compose -f $ComposePath ps -q web 2>$null
    if ($LASTEXITCODE -eq 0 -and $output) {
      return ([string]($output | Select-Object -First 1)).Trim()
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

function Write-PortStateAtomically {
  param(
    [string]$Path,
    [int]$Port
  )

  $operationId = [System.Guid]::NewGuid().ToString("N")
  $temporaryPath = "$Path.$operationId.tmp"
  $backupPath = "$Path.$operationId.bak"
  try {
    [System.IO.File]::WriteAllText(
      $temporaryPath,
      "$Port`r`n",
      [System.Text.Encoding]::ASCII
    )
    if ([System.IO.File]::Exists($Path)) {
      [System.IO.File]::Replace($temporaryPath, $Path, $backupPath)
    } else {
      [System.IO.File]::Move($temporaryPath, $Path)
    }
  } finally {
    if ([System.IO.File]::Exists($temporaryPath)) {
      [System.IO.File]::Delete($temporaryPath)
    }
    if ([System.IO.File]::Exists($backupPath)) {
      [System.IO.File]::Delete($backupPath)
    }
  }
}

if (-not (Test-Path -LiteralPath $runtimeDir)) {
  New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
}

$allocationMutex = $null
$upAttempted = $false
$webReady = $false
$previousWebContainerId = $null
$replacementWebContainerId = $null
$webHostPortExisted = Test-Path Env:WEB_HOST_PORT
$originalWebHostPort = $env:WEB_HOST_PORT
try {
  $allocationMutex = Enter-PreviewAllocationLock `
    -Name $previewAllocationMutexName `
    -TimeoutSeconds $AllocationLockTimeoutSeconds

  $previousWebContainerId = Get-ComposeWebContainerId -ComposePath $composeFile
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
  $upAttempted = $true
  & docker compose -f $composeFile up -d --no-deps --force-recreate web
  $upExitCode = $LASTEXITCODE
  $replacementWebContainerId = Get-ComposeWebContainerId -ComposePath $composeFile
  if ($upExitCode -ne 0) {
    throw "Failed to recreate web service."
  }
  if ([string]::IsNullOrWhiteSpace($replacementWebContainerId)) {
    throw "Compose did not expose the replacement Web container identity."
  }

  Wait-ForHttpOk -Name "web" -Url "http://127.0.0.1:$port/health" -TimeoutSeconds $WebReadyTimeoutSeconds
  $webReady = $true
  Write-PortStateAtomically -Path $stateFile -Port $port

  Write-Output "PORT=$port"
  Write-Output "URL=http://127.0.0.1:$port"
  Write-Output "STATE_FILE=$stateFile"
} catch {
  if ($upAttempted -and -not $webReady) {
    if ([string]::IsNullOrWhiteSpace($replacementWebContainerId)) {
      $replacementWebContainerId = Get-ComposeWebContainerId -ComposePath $composeFile
    }
    if (
      -not [string]::IsNullOrWhiteSpace($replacementWebContainerId) -and
      $replacementWebContainerId -ne $previousWebContainerId
    ) {
      & docker rm -f $replacementWebContainerId | Out-Null
      if ($LASTEXITCODE -ne 0) {
        Write-Warning "Failed to remove the unready replacement Web container: $replacementWebContainerId"
      }
    }
  }
  throw
} finally {
  try {
    if ($allocationMutex) {
      $mutexToRelease = $allocationMutex
      $allocationMutex = $null
      Exit-PreviewAllocationLock -Mutex $mutexToRelease
    }
  } finally {
    if ($webHostPortExisted) {
      $env:WEB_HOST_PORT = $originalWebHostPort
    } else {
      Remove-Item Env:\WEB_HOST_PORT -ErrorAction SilentlyContinue
    }
  }
}
