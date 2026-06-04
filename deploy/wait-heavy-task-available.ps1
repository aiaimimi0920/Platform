param(
  [string]$StatePath,
  [int]$TimeoutSeconds = 1800,
  [int]$PollSeconds = 30,
  [string]$PreferredDialogId,
  [switch]$AsJson
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "heavy-task-common.ps1")

$paths = Resolve-HeavyTaskPaths -StatePath $StatePath
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)

while ((Get-Date) -lt $deadline) {
  $lockStream = Acquire-HeavyTaskLock -LockPath $paths.LockPath
  try {
    $state = Read-HeavyTaskState -StatePath $paths.StatePath
    $ownerInfo = Get-OwnerSnapshot -Owner $state["heavyTaskOwner"]

    $available = $ownerInfo.IsAvailable
    $sameOwner = $false
    if (-not [string]::IsNullOrWhiteSpace($PreferredDialogId) -and $ownerInfo.HasOwner) {
      $sameOwner = ([string]$ownerInfo.DialogId -eq $PreferredDialogId)
    }

    $result = [ordered]@{
      state_path = $paths.StatePath
      status = $ownerInfo.Status
      heavy_available = $available
      owner_dialog_id = $ownerInfo.DialogId
      owner_task_label = $ownerInfo.TaskLabel
      implementation_line = $ownerInfo.ImplementationLine
      owner_expires_at = $ownerInfo.ExpiresAt
      matched_preferred_dialog = $sameOwner
      poll_seconds = $PollSeconds
    }

    if ($available -or $sameOwner) {
      $result["message"] = "heavy_task_available"
      Write-HeavyTaskOutput -Payload $result -AsJson:$AsJson
      exit 0
    }
  } finally {
    Release-HeavyTaskLock -LockStream $lockStream
  }

  Start-Sleep -Seconds $PollSeconds
}

$timeoutResult = [ordered]@{
  state_path = $paths.StatePath
  status = "timeout"
  heavy_available = $false
  message = "wait_timeout"
  timeout_seconds = $TimeoutSeconds
  poll_seconds = $PollSeconds
}
Write-HeavyTaskOutput -Payload $timeoutResult -AsJson:$AsJson
exit 4
