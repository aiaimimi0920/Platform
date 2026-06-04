param(
  [Parameter(Mandatory = $true)]
  [string]$DialogId,
  [Parameter(Mandatory = $true)]
  [string]$TaskLabel,
  [Parameter(Mandatory = $true)]
  [string]$ImplementationLine,
  [int]$LeaseSeconds = 1800,
  [string]$StatePath,
  [string]$WorkingDirectory,
  [switch]$FailIfBusy,
  [switch]$KeepClaim,
  [switch]$AsJson,
  [Parameter(Mandatory = $true)]
  [string[]]$CommandArgs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "heavy-task-common.ps1")

if ($CommandArgs.Count -eq 0) {
  throw "CommandArgs is required."
}

$claimScript = Join-Path $PSScriptRoot "claim-heavy-task.ps1"
$releaseScript = Join-Path $PSScriptRoot "release-heavy-task.ps1"

$claimArgs = @(
  '-ExecutionPolicy', 'Bypass',
  '-File', $claimScript,
  '-DialogId', $DialogId,
  '-TaskLabel', $TaskLabel,
  '-ImplementationLine', $ImplementationLine,
  '-LeaseSeconds', $LeaseSeconds
)
if (-not [string]::IsNullOrWhiteSpace($StatePath)) {
  $claimArgs += @('-StatePath', $StatePath)
}
if ($FailIfBusy) {
  $claimArgs += '-FailIfBusy'
}

$claimOutput = & powershell.exe @claimArgs
$claimExitCode = $LASTEXITCODE
if ($claimOutput) {
  $claimOutput | Write-Output
}
if ($claimExitCode -ne 0) {
  exit $claimExitCode
}

$originalLocation = Get-Location
$commandExitCode = 0

try {
  if (-not [string]::IsNullOrWhiteSpace($WorkingDirectory)) {
    Set-Location -LiteralPath $WorkingDirectory
  }

  $commandName = $CommandArgs[0]
  $commandTail = @()
  if ($CommandArgs.Count -gt 1) {
    $commandTail = $CommandArgs[1..($CommandArgs.Count - 1)]
  }

  & $commandName @commandTail
  $commandExitCode = $LASTEXITCODE
} finally {
  Set-Location -LiteralPath $originalLocation

  if (-not $KeepClaim) {
    $releaseArgs = @(
      '-ExecutionPolicy', 'Bypass',
      '-File', $releaseScript,
      '-DialogId', $DialogId
    )
    if (-not [string]::IsNullOrWhiteSpace($StatePath)) {
      $releaseArgs += @('-StatePath', $StatePath)
    }
    $releaseOutput = & powershell.exe @releaseArgs
    if ($releaseOutput) {
      $releaseOutput | Write-Output
    }
  }
}

if ($AsJson) {
  $payload = [ordered]@{
    dialogId = $DialogId
    taskLabel = $TaskLabel
    implementationLine = $ImplementationLine
    commandArgs = $CommandArgs
    commandExitCode = $commandExitCode
  }
  $payload | ConvertTo-Json -Depth 10
}

exit $commandExitCode
