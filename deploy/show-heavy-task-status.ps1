param(
  [string]$StatePath,
  [switch]$AsJson
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "heavy-task-common.ps1")

$paths = Resolve-HeavyTaskPaths -StatePath $StatePath
$lockStream = Acquire-HeavyTaskLock -LockPath $paths.LockPath

try {
  $state = Read-HeavyTaskState -StatePath $paths.StatePath
  $ownerInfo = Get-OwnerSnapshot -Owner $state["heavyTaskOwner"]
  $waitingDialogs = @($state["waitingDialogs"])

  $result = [ordered]@{
    state_path = $paths.StatePath
    status = $ownerInfo.Status
    heavy_available = $ownerInfo.IsAvailable
    owner_dialog_id = $ownerInfo.DialogId
    owner_task_label = $ownerInfo.TaskLabel
    implementation_line = $ownerInfo.ImplementationLine
    owner_expires_at = $ownerInfo.ExpiresAt
    waiting_count = $waitingDialogs.Count
    waiting_dialog_ids = @($waitingDialogs | ForEach-Object { $_["dialogId"] })
    waiting_dialogs = $waitingDialogs
  }

  Write-HeavyTaskOutput -Payload $result -AsJson:$AsJson
  exit 0
} finally {
  Release-HeavyTaskLock -LockStream $lockStream
}
