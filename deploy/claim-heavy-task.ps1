param(
  [Parameter(Mandatory = $true)]
  [string]$DialogId,
  [Parameter(Mandatory = $true)]
  [string]$TaskLabel,
  [Parameter(Mandatory = $true)]
  [string]$ImplementationLine,
  [int]$LeaseSeconds = 1800,
  [string]$StatePath,
  [switch]$ForceTakeover,
  [switch]$FailIfBusy,
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

  if ($ownerInfo.HasOwner -and [string]$ownerInfo.DialogId -eq $DialogId) {
    $state["heavyTaskOwner"] = Renew-OwnerRecord `
      -ExistingOwner $state["heavyTaskOwner"] `
      -TaskLabel $TaskLabel `
      -ImplementationLine $ImplementationLine `
      -LeaseSeconds $LeaseSeconds
    Remove-WaitingDialog -State $state -DialogId $DialogId
    Write-HeavyTaskState -StatePath $paths.StatePath -State $state

    $result = [ordered]@{
      state_path = $paths.StatePath
      status = "heavy_active"
      granted = $true
      message = "claim_renewed"
      owner_dialog_id = $DialogId
      owner_task_label = $TaskLabel
      implementation_line = $ImplementationLine
      owner_expires_at = $state["heavyTaskOwner"]["expiresAt"]
      waiting_count = @($state["waitingDialogs"]).Count
    }

    Write-HeavyTaskOutput -Payload $result -AsJson:$AsJson
    exit 0
  }

  if (-not $ownerInfo.HasOwner -or $ownerInfo.IsAvailable -or $ForceTakeover) {
    $state["heavyTaskOwner"] = New-OwnerRecord `
      -DialogId $DialogId `
      -TaskLabel $TaskLabel `
      -ImplementationLine $ImplementationLine `
      -LeaseSeconds $LeaseSeconds
    Remove-WaitingDialog -State $state -DialogId $DialogId
    Write-HeavyTaskState -StatePath $paths.StatePath -State $state

    $message = if ($ForceTakeover -and $ownerInfo.HasOwner -and -not $ownerInfo.IsAvailable) {
      "claim_forced_takeover"
    } elseif ($ownerInfo.HasOwner -and $ownerInfo.IsAvailable) {
      "claim_replaced_expired_owner"
    } else {
      "claim_granted"
    }

    $result = [ordered]@{
      state_path = $paths.StatePath
      status = "heavy_active"
      granted = $true
      message = $message
      owner_dialog_id = $DialogId
      owner_task_label = $TaskLabel
      implementation_line = $ImplementationLine
      owner_expires_at = $state["heavyTaskOwner"]["expiresAt"]
      waiting_count = @($state["waitingDialogs"]).Count
    }

    Write-HeavyTaskOutput -Payload $result -AsJson:$AsJson
    exit 0
  }

  Set-WaitingDialog -State $state -DialogId $DialogId -TaskLabel $TaskLabel -ImplementationLine $ImplementationLine
  Write-HeavyTaskState -StatePath $paths.StatePath -State $state

  $busy = [ordered]@{
    state_path = $paths.StatePath
    status = "polling_wait"
    granted = $false
    message = "heavy_task_busy"
    owner_dialog_id = $ownerInfo.DialogId
    owner_task_label = $ownerInfo.TaskLabel
    implementation_line = $ownerInfo.ImplementationLine
    owner_expires_at = $ownerInfo.ExpiresAt
    waiting_count = @($state["waitingDialogs"]).Count
  }

  Write-HeavyTaskOutput -Payload $busy -AsJson:$AsJson
  if ($FailIfBusy) {
    exit 2
  }
  exit 0
} finally {
  Release-HeavyTaskLock -LockStream $lockStream
}
