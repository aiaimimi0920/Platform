param(
  [string]$DialogId,
  [string]$StatePath,
  [switch]$Force,
  [switch]$AsJson
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "heavy-task-common.ps1")

if (-not $Force -and [string]::IsNullOrWhiteSpace($DialogId)) {
  throw "DialogId is required unless -Force is provided."
}

$paths = Resolve-HeavyTaskPaths -StatePath $StatePath
$lockStream = Acquire-HeavyTaskLock -LockPath $paths.LockPath

try {
  $state = Read-HeavyTaskState -StatePath $paths.StatePath
  $ownerInfo = Get-OwnerSnapshot -Owner $state["heavyTaskOwner"]

  if (-not $ownerInfo.HasOwner) {
    if (-not [string]::IsNullOrWhiteSpace($DialogId)) {
      Remove-WaitingDialog -State $state -DialogId $DialogId
      Write-HeavyTaskState -StatePath $paths.StatePath -State $state
    }

    $result = [ordered]@{
      state_path = $paths.StatePath
      status = "available"
      released = $false
      message = "no_active_owner"
      waiting_count = @($state["waitingDialogs"]).Count
    }
    Write-HeavyTaskOutput -Payload $result -AsJson:$AsJson
    exit 0
  }

  $canRelease = $Force -or ([string]$ownerInfo.DialogId -eq $DialogId)
  if (-not $canRelease) {
    $result = [ordered]@{
      state_path = $paths.StatePath
      status = "heavy_active"
      released = $false
      message = "release_denied_not_owner"
      owner_dialog_id = $ownerInfo.DialogId
      owner_task_label = $ownerInfo.TaskLabel
      implementation_line = $ownerInfo.ImplementationLine
      owner_expires_at = $ownerInfo.ExpiresAt
      waiting_count = @($state["waitingDialogs"]).Count
    }
    Write-HeavyTaskOutput -Payload $result -AsJson:$AsJson
    exit 3
  }

  $releasedOwner = $state["heavyTaskOwner"]
  $state["heavyTaskOwner"] = $null
  if (-not [string]::IsNullOrWhiteSpace($DialogId)) {
    Remove-WaitingDialog -State $state -DialogId $DialogId
  }
  Write-HeavyTaskState -StatePath $paths.StatePath -State $state

  $result = [ordered]@{
    state_path = $paths.StatePath
    status = "available"
    released = $true
    message = $(if ($Force) { "release_forced" } else { "release_ok" })
    released_dialog_id = $releasedOwner["dialogId"]
    released_task_label = $releasedOwner["taskLabel"]
    implementation_line = $releasedOwner["implementationLine"]
    waiting_count = @($state["waitingDialogs"]).Count
  }
  Write-HeavyTaskOutput -Payload $result -AsJson:$AsJson
  exit 0
} finally {
  Release-HeavyTaskLock -LockStream $lockStream
}
