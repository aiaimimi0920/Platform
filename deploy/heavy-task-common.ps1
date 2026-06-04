function Resolve-HeavyTaskPaths {
  param(
    [string]$StatePath
  )

  $repoRoot = Split-Path -Parent $PSScriptRoot
  $runtimeDir = Join-Path $repoRoot ".runtime"
  if ([string]::IsNullOrWhiteSpace($StatePath)) {
    $StatePath = Join-Path $runtimeDir "ai-heavy-task-declaration.json"
  }

  $lockPath = "$StatePath.lock"
  return [ordered]@{
    RepoRoot = $repoRoot
    RuntimeDir = $runtimeDir
    StatePath = $StatePath
    LockPath = $lockPath
  }
}

function Ensure-ParentDirectory {
  param(
    [string]$Path
  )

  $parent = Split-Path -Parent $Path
  if (-not [string]::IsNullOrWhiteSpace($parent) -and -not (Test-Path -LiteralPath $parent)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
  }
}

function Write-Utf8NoBom {
  param(
    [string]$Path,
    [string]$Content
  )

  Ensure-ParentDirectory -Path $Path
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Acquire-HeavyTaskLock {
  param(
    [string]$LockPath,
    [int]$TimeoutSeconds = 30,
    [int]$PollMilliseconds = 250
  )

  Ensure-ParentDirectory -Path $LockPath
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      return [System.IO.File]::Open(
        $LockPath,
        [System.IO.FileMode]::OpenOrCreate,
        [System.IO.FileAccess]::ReadWrite,
        [System.IO.FileShare]::None
      )
    } catch [System.IO.IOException] {
      Start-Sleep -Milliseconds $PollMilliseconds
    }
  }

  throw "Timed out waiting for heavy task lock: $LockPath"
}

function Release-HeavyTaskLock {
  param(
    $LockStream
  )

  if ($null -ne $LockStream) {
    $LockStream.Dispose()
  }
}

function ConvertTo-PlainData {
  param(
    $Value
  )

  if ($null -eq $Value) {
    return $null
  }

  if ($Value -is [System.Collections.IDictionary]) {
    $map = [ordered]@{}
    foreach ($key in $Value.Keys) {
      $map[[string]$key] = ConvertTo-PlainData -Value $Value[$key]
    }
    return $map
  }

  if ($Value -is [pscustomobject]) {
    $map = [ordered]@{}
    foreach ($property in $Value.PSObject.Properties) {
      $map[$property.Name] = ConvertTo-PlainData -Value $property.Value
    }
    return $map
  }

  if (($Value -is [System.Collections.IEnumerable]) -and -not ($Value -is [string])) {
    $items = New-Object System.Collections.Generic.List[object]
    foreach ($item in $Value) {
      [void]$items.Add((ConvertTo-PlainData -Value $item))
    }
    return ,($items.ToArray())
  }

  return $Value
}

function New-EmptyHeavyTaskState {
  return [ordered]@{
    version = 1
    updatedAt = $null
    heavyTaskOwner = $null
    waitingDialogs = @()
  }
}

function Normalize-HeavyTaskState {
  param(
    $State
  )

  if ($null -eq $State) {
    $State = New-EmptyHeavyTaskState
  }

  if (-not ($State -is [System.Collections.IDictionary])) {
    $State = ConvertTo-PlainData -Value $State
  }

  if (-not $State.Contains("version")) {
    $State["version"] = 1
  }
  if (-not $State.Contains("updatedAt")) {
    $State["updatedAt"] = $null
  }
  if (-not $State.Contains("heavyTaskOwner")) {
    $State["heavyTaskOwner"] = $null
  }
  if (-not $State.Contains("waitingDialogs") -or $null -eq $State["waitingDialogs"]) {
    $State["waitingDialogs"] = @()
  } elseif (-not ($State["waitingDialogs"] -is [System.Array])) {
    $State["waitingDialogs"] = @($State["waitingDialogs"])
  }

  return $State
}

function Read-HeavyTaskState {
  param(
    [string]$StatePath
  )

  if (-not (Test-Path -LiteralPath $StatePath)) {
    return (New-EmptyHeavyTaskState)
  }

  $raw = Get-Content -LiteralPath $StatePath -Raw -ErrorAction Stop
  if ([string]::IsNullOrWhiteSpace($raw)) {
    return (New-EmptyHeavyTaskState)
  }

  $parsed = $raw | ConvertFrom-Json -ErrorAction Stop
  return (Normalize-HeavyTaskState -State (ConvertTo-PlainData -Value $parsed))
}

function Write-HeavyTaskState {
  param(
    [string]$StatePath,
    $State
  )

  $normalized = Normalize-HeavyTaskState -State $State
  $normalized["updatedAt"] = (Get-Date).ToString("o")
  $json = $normalized | ConvertTo-Json -Depth 10
  Write-Utf8NoBom -Path $StatePath -Content $json
}

function Get-OwnerSnapshot {
  param(
    $Owner
  )

  if ($null -eq $Owner) {
    return [ordered]@{
      HasOwner = $false
      Status = "available"
      IsAvailable = $true
      DialogId = $null
      TaskLabel = $null
      ImplementationLine = $null
      ExpiresAt = $null
    }
  }

  $now = [System.DateTimeOffset]::Now
  $startedAt = $null
  $expiresAt = $null

  if ($Owner.Contains("startedAt") -and -not [string]::IsNullOrWhiteSpace([string]$Owner["startedAt"])) {
    try {
      $startedAt = [System.DateTimeOffset]::Parse([string]$Owner["startedAt"])
    } catch {
      $startedAt = $null
    }
  }

  if ($Owner.Contains("expiresAt") -and -not [string]::IsNullOrWhiteSpace([string]$Owner["expiresAt"])) {
    try {
      $expiresAt = [System.DateTimeOffset]::Parse([string]$Owner["expiresAt"])
    } catch {
      $expiresAt = $null
    }
  }

  if ($null -eq $expiresAt -and $null -ne $startedAt -and $Owner.Contains("leaseSeconds")) {
    $leaseSeconds = 0
    [void][int]::TryParse([string]$Owner["leaseSeconds"], [ref]$leaseSeconds)
    if ($leaseSeconds -gt 0) {
      $expiresAt = $startedAt.AddSeconds($leaseSeconds)
    }
  }

  $isExpired = $false
  if ($null -ne $expiresAt) {
    $isExpired = $expiresAt -le $now
  }

  return [ordered]@{
    HasOwner = $true
    Status = $(if ($isExpired) { "expired" } else { "heavy_active" })
    IsAvailable = $isExpired
    DialogId = $Owner["dialogId"]
    TaskLabel = $Owner["taskLabel"]
    ImplementationLine = $Owner["implementationLine"]
    ExpiresAt = $(if ($null -ne $expiresAt) { $expiresAt.ToString("o") } else { $null })
  }
}

function Remove-WaitingDialog {
  param(
    $State,
    [string]$DialogId
  )

  $waiting = @()
  foreach ($entry in @($State["waitingDialogs"])) {
    if ($null -eq $entry) {
      continue
    }
    if ([string]$entry["dialogId"] -ne $DialogId) {
      $waiting += ,$entry
    }
  }
  $State["waitingDialogs"] = $waiting
}

function Set-WaitingDialog {
  param(
    $State,
    [string]$DialogId,
    [string]$TaskLabel,
    [string]$ImplementationLine
  )

  Remove-WaitingDialog -State $State -DialogId $DialogId

  $entry = [ordered]@{
    dialogId = $DialogId
    taskLabel = $TaskLabel
    implementationLine = $ImplementationLine
    requestedHeavy = $true
    status = "polling_wait"
    lastRequestedAt = (Get-Date).ToString("o")
  }

  $State["waitingDialogs"] = @($State["waitingDialogs"]) + ,$entry
}

function New-OwnerRecord {
  param(
    [string]$DialogId,
    [string]$TaskLabel,
    [string]$ImplementationLine,
    [int]$LeaseSeconds
  )

  $now = [System.DateTimeOffset]::Now
  return [ordered]@{
    dialogId = $DialogId
    taskLabel = $TaskLabel
    implementationLine = $ImplementationLine
    startedAt = $now.ToString("o")
    expiresAt = $now.AddSeconds($LeaseSeconds).ToString("o")
    leaseSeconds = $LeaseSeconds
    status = "heavy_active"
  }
}

function Renew-OwnerRecord {
  param(
    $ExistingOwner,
    [string]$TaskLabel,
    [string]$ImplementationLine,
    [int]$LeaseSeconds
  )

  $now = [System.DateTimeOffset]::Now
  if (-not $ExistingOwner.Contains("startedAt") -or [string]::IsNullOrWhiteSpace([string]$ExistingOwner["startedAt"])) {
    $ExistingOwner["startedAt"] = $now.ToString("o")
  }

  $ExistingOwner["taskLabel"] = $TaskLabel
  $ExistingOwner["implementationLine"] = $ImplementationLine
  $ExistingOwner["leaseSeconds"] = $LeaseSeconds
  $ExistingOwner["expiresAt"] = $now.AddSeconds($LeaseSeconds).ToString("o")
  $ExistingOwner["status"] = "heavy_active"
  $ExistingOwner["renewedAt"] = $now.ToString("o")
  return $ExistingOwner
}

function Convert-OutputValue {
  param(
    $Value
  )

  if ($null -eq $Value) {
    return ""
  }

  if ($Value -is [bool]) {
    return $Value.ToString().ToLowerInvariant()
  }

  if ($Value -is [datetime] -or $Value -is [System.DateTimeOffset]) {
    return $Value.ToString("o")
  }

  if ($Value -is [System.Collections.IDictionary] -or $Value -is [pscustomobject]) {
    return (($Value | ConvertTo-Json -Compress -Depth 10) -replace "`r?`n", "")
  }

  if (($Value -is [System.Collections.IEnumerable]) -and -not ($Value -is [string])) {
    return (($Value | ConvertTo-Json -Compress -Depth 10) -replace "`r?`n", "")
  }

  return [string]$Value
}

function Write-HeavyTaskOutput {
  param(
    $Payload,
    [switch]$AsJson
  )

  if ($AsJson) {
    $Payload | ConvertTo-Json -Depth 10
    return
  }

  foreach ($key in $Payload.Keys) {
    Write-Output ("{0}={1}" -f $key.ToUpperInvariant(), (Convert-OutputValue -Value $Payload[$key]))
  }
}
