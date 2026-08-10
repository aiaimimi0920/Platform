[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")).Path
$restartScript = Join-Path $repoRoot "deploy\restart-web-next-port.ps1"
$startScript = Join-Path $repoRoot "deploy\start-web-preview.ps1"
$testRoot = Join-Path $env:TEMP "platform-preview-contract-$([System.Guid]::NewGuid().ToString('N'))"
$fakeDockerScript = Join-Path $testRoot "fake-docker.ps1"
$fakeDockerCommand = Join-Path $testRoot "docker.cmd"

function Assert-True {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if (-not $Condition) {
        throw $Message
    }
}

function Assert-Equal {
    param(
        [object]$Expected,
        [object]$Actual,
        [string]$Message
    )

    if ($Expected -ne $Actual) {
        throw "$Message Expected=[$Expected] Actual=[$Actual]"
    }
}

function Invoke-RestartFailureCase {
    param(
        [bool]$ExposeReplacementContainer
    )

    Set-Content -LiteralPath $env:PREVIEW_CONTRACT_LOG_PATH -Value "" -Encoding ascii
    Set-Content -LiteralPath $env:PREVIEW_CONTRACT_PS_COUNT_PATH -Value "0" -Encoding ascii
    $env:PREVIEW_CONTRACT_EXPOSE_REPLACEMENT = if ($ExposeReplacementContainer) { "true" } else { "false" }
    $env:WEB_HOST_PORT = "preview-contract-sentinel"

    $failure = $null
    try {
        & $restartScript `
            -BasePort 45002 `
            -Step 2 `
            -NoBuild `
            -AllocationLockTimeoutSeconds 2 `
            -WebReadyTimeoutSeconds 0
    } catch {
        $failure = $_
    }

    Assert-True ($null -ne $failure) "Restart helper must fail when Compose up exits nonzero."
    Assert-True ($failure.Exception.Message -match "Failed to recreate web service") "Restart helper must preserve the Compose up failure. Actual=[$($failure.Exception.Message)]"
    Assert-Equal "preview-contract-sentinel" $env:WEB_HOST_PORT "Restart helper must restore WEB_HOST_PORT after failure."

    $calls = @(Get-Content -LiteralPath $env:PREVIEW_CONTRACT_LOG_PATH | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    Assert-True (-not ($calls | Where-Object { $_ -match "\bcompose\b.*\brm -sf web$" })) "Restart helper must not remove a service by Compose name after failure."
    if ($ExposeReplacementContainer) {
        Assert-True ($calls -contains "rm -f replacement-container-id") "Restart helper must remove the exact replacement container after a failed up."
        Assert-True (-not ($calls -contains "rm -f original-container-id")) "Restart helper must preserve the original container identity."
    } else {
        Assert-True (-not ($calls | Where-Object { $_ -match "^rm -f " })) "Restart helper must not remove the unchanged original container."
    }
}

$webHostPortExisted = Test-Path Env:WEB_HOST_PORT
$originalWebHostPort = $env:WEB_HOST_PORT
$originalPath = $env:PATH
try {
    New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
    $env:PREVIEW_CONTRACT_LOG_PATH = Join-Path $testRoot "docker.log"
    $env:PREVIEW_CONTRACT_PS_COUNT_PATH = Join-Path $testRoot "compose-ps-count.txt"

    @'
$commandLine = $args -join " "
Add-Content -LiteralPath $env:PREVIEW_CONTRACT_LOG_PATH -Value $commandLine -Encoding ascii

if ($commandLine -match "\bport web 3000$") {
    Write-Output "127.0.0.1:45000"
    exit 0
}

if ($commandLine -match "\bps -q web$") {
    $count = [int](Get-Content -LiteralPath $env:PREVIEW_CONTRACT_PS_COUNT_PATH -Raw)
    $count += 1
    Set-Content -LiteralPath $env:PREVIEW_CONTRACT_PS_COUNT_PATH -Value $count -Encoding ascii
    if ($env:PREVIEW_CONTRACT_EXPOSE_REPLACEMENT -eq "true" -and $count -gt 1) {
        Write-Output "replacement-container-id"
    } else {
        Write-Output "original-container-id"
    }
    exit 0
}

if ($commandLine -match "\bup -d --no-deps --force-recreate web$") {
    exit 17
}

exit 0
'@ | Set-Content -LiteralPath $fakeDockerScript -Encoding ascii

    @"
@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$fakeDockerScript" %*
exit /b %ERRORLEVEL%
"@ | Set-Content -LiteralPath $fakeDockerCommand -Encoding ascii

    $env:PATH = "$testRoot;$originalPath"
    Invoke-RestartFailureCase -ExposeReplacementContainer $false
    Invoke-RestartFailureCase -ExposeReplacementContainer $true

    $startContents = Get-Content -LiteralPath $startScript -Raw
    Assert-True (-not $startContents.Contains("& powershell.exe")) "Preview helper must invoke the current PowerShell host instead of hard-coding powershell.exe."
    Assert-True ($startContents.Contains('Heavy task release failed with exit code')) "Preview helper must fail observably when heavy-task release fails."
} finally {
    $env:PATH = $originalPath
    Remove-Item Env:\PREVIEW_CONTRACT_LOG_PATH -ErrorAction SilentlyContinue
    Remove-Item Env:\PREVIEW_CONTRACT_PS_COUNT_PATH -ErrorAction SilentlyContinue
    Remove-Item Env:\PREVIEW_CONTRACT_EXPOSE_REPLACEMENT -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
    if ($webHostPortExisted) {
        $env:WEB_HOST_PORT = $originalWebHostPort
    } else {
        Remove-Item Env:\WEB_HOST_PORT -ErrorAction SilentlyContinue
    }
}

Write-Host "Platform preview helper runtime contract passed."
