[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$PackageDir,

    [int]$Port = 0,

    [switch]$KeepArtifacts,

    [switch]$SkipInstall,

    [int]$StartupTimeoutSeconds = 90,

    [string]$EvidencePath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$verifyScript = Join-Path $PSScriptRoot "verify-platform-web-release-package.ps1"

function Write-TextUtf8NoBom {
    param(
        [string]$Path,
        [string]$Value
    )

    $parent = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    [System.IO.File]::WriteAllText($Path, $Value, [System.Text.UTF8Encoding]::new($false))
}

function Assert-True {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if (-not $Condition) {
        throw $Message
    }
}

function Test-PortAvailable {
    param([int]$Port)

    if ($Port -le 0 -or $Port -gt 65535) {
        return $false
    }

    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"), $Port)
    try {
        $listener.Start()
        return $true
    } catch {
        return $false
    } finally {
        $listener.Stop()
    }
}

function Get-FreePort {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"), 0)
    $listener.Start()
    try {
        return [int]$listener.LocalEndpoint.Port
    } finally {
        $listener.Stop()
    }
}

function Invoke-LoggedCommand {
    param(
        [string]$Display,
        [string]$Executable,
        [string[]]$Arguments,
        [string]$WorkingDirectory,
        [string]$LogPath
    )

    $header = @(
        "Command: $Display"
        "Executable: $Executable"
        "Arguments: $($Arguments -join ' ')"
        "Working directory: $WorkingDirectory"
        "Started at: $(Get-Date -Format o)"
        ""
    ) -join [Environment]::NewLine
    Write-TextUtf8NoBom -Path $LogPath -Value $header

    $quotedArguments = @($Arguments | ForEach-Object {
        $value = [string]$_
        if ($value -match '[\s"]') {
            '"' + ($value -replace '"', '\"') + '"'
        } else {
            $value
        }
    })

    $processInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $processInfo.FileName = $Executable
    $processInfo.Arguments = $quotedArguments -join " "
    $processInfo.WorkingDirectory = $WorkingDirectory
    $processInfo.RedirectStandardOutput = $true
    $processInfo.RedirectStandardError = $true
    $processInfo.UseShellExecute = $false
    $processInfo.CreateNoWindow = $true
    $processInfo.Environment["NEXT_TELEMETRY_DISABLED"] = "1"

    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $processInfo
    [void]$process.Start()
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()

    $footer = @(
        ""
        "STDOUT:"
        $stdout
        ""
        "STDERR:"
        $stderr
        ""
        "Finished at: $(Get-Date -Format o)"
        "Exit code: $($process.ExitCode)"
        ""
    ) -join [Environment]::NewLine
    [System.IO.File]::AppendAllText($LogPath, $footer, [System.Text.UTF8Encoding]::new($false))

    if ($process.ExitCode -ne 0) {
        throw "Command failed: $Display ExitCode=$($process.ExitCode) Log=$LogPath"
    }
}

function Start-LoggedProcess {
    param(
        [string]$CommandLine,
        [string]$WorkingDirectory,
        [string]$StdoutLog,
        [string]$StderrLog
    )

    Write-TextUtf8NoBom -Path $StdoutLog -Value "Command: $CommandLine`r`nWorking directory: $WorkingDirectory`r`nStarted at: $(Get-Date -Format o)`r`n`r`n"
    Write-TextUtf8NoBom -Path $StderrLog -Value "Command: $CommandLine`r`nWorking directory: $WorkingDirectory`r`nStarted at: $(Get-Date -Format o)`r`n`r`n"

    $oldNodeEnv = [Environment]::GetEnvironmentVariable("NODE_ENV", "Process")
    $oldTelemetry = [Environment]::GetEnvironmentVariable("NEXT_TELEMETRY_DISABLED", "Process")
    [Environment]::SetEnvironmentVariable("NODE_ENV", "production", "Process")
    [Environment]::SetEnvironmentVariable("NEXT_TELEMETRY_DISABLED", "1", "Process")
    try {
        return Start-Process `
            -FilePath "cmd.exe" `
            -ArgumentList @("/d", "/c", $CommandLine) `
            -WorkingDirectory $WorkingDirectory `
            -RedirectStandardOutput $StdoutLog `
            -RedirectStandardError $StderrLog `
            -WindowStyle Hidden `
            -PassThru
    } finally {
        [Environment]::SetEnvironmentVariable("NODE_ENV", $oldNodeEnv, "Process")
        [Environment]::SetEnvironmentVariable("NEXT_TELEMETRY_DISABLED", $oldTelemetry, "Process")
    }
}

function Expand-ZipPackage {
    param(
        [string]$ZipPath,
        [string]$DestinationPath
    )

    # Do not use Expand-Archive for the main path: large Next archives can be
    # slow enough on Windows PowerShell to exceed smoke-test timeouts.
    Add-Type -AssemblyName System.IO.Compression.FileSystem | Out-Null
    [System.IO.Compression.ZipFile]::ExtractToDirectory($ZipPath, $DestinationPath)
}

function Get-EvidenceLogsDir {
    param([string]$EvidencePath)

    if ([string]::IsNullOrWhiteSpace($EvidencePath)) {
        return ""
    }

    $parent = Split-Path -Parent $EvidencePath
    $stem = [System.IO.Path]::GetFileNameWithoutExtension($EvidencePath)
    return [System.IO.Path]::GetFullPath((Join-Path $parent "$stem-logs"))
}

function Copy-SmokeLogsToEvidence {
    param(
        [string]$LogsDir,
        [string]$EvidenceLogsDir
    )

    if ([string]::IsNullOrWhiteSpace($LogsDir) -or [string]::IsNullOrWhiteSpace($EvidenceLogsDir)) {
        return
    }
    if (-not (Test-Path -LiteralPath $LogsDir -PathType Container)) {
        return
    }

    New-Item -ItemType Directory -Path $EvidenceLogsDir -Force | Out-Null
    Get-ChildItem -LiteralPath $LogsDir -File -Force | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $EvidenceLogsDir $_.Name) -Force
    }
}

function Stop-SpawnedProcessTree {
    param([System.Diagnostics.Process]$Process)

    if ($null -eq $Process) {
        return
    }

    try {
        if ($Process.HasExited) {
            return
        }
    } catch {
        return
    }

    try {
        & taskkill.exe /PID $Process.Id /T /F 2>$null | Out-Null
    } catch {
        Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
    }
}

function Invoke-ReadyProbe {
    param([string]$Uri)

    $started = Get-Date
    try {
        $response = Invoke-WebRequest -Uri $Uri -Method Get -TimeoutSec 5 -UseBasicParsing
        $body = [string]$response.Content
        $json = $null
        try {
            $json = $body | ConvertFrom-Json
        } catch {
            $json = $null
        }

        return [ordered]@{
            ok = $true
            uri = $Uri
            statusCode = [int]$response.StatusCode
            elapsedMs = [int]((Get-Date) - $started).TotalMilliseconds
            body = $body
            json = $json
        }
    } catch {
        $statusCode = $null
        if ($null -ne $_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }

        return [ordered]@{
            ok = $false
            uri = $Uri
            statusCode = $statusCode
            elapsedMs = [int]((Get-Date) - $started).TotalMilliseconds
            error = $_.Exception.Message
        }
    }
}

function Wait-ForReady {
    param(
        [System.Diagnostics.Process]$Process,
        [string]$ReadyUri,
        [int]$TimeoutSeconds,
        [string]$StdoutLog,
        [string]$StderrLog
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $lastProbe = $null
    do {
        if ($null -ne $Process -and $Process.HasExited) {
            throw "Next start process exited before readiness probe passed. ExitCode=$($Process.ExitCode) Stdout=$StdoutLog Stderr=$StderrLog"
        }

        $lastProbe = Invoke-ReadyProbe -Uri $ReadyUri
        if ($lastProbe.ok -and $lastProbe.statusCode -eq 200 -and $null -ne $lastProbe.json) {
            if ($lastProbe.json.ok -eq $true -and $lastProbe.json.ready -eq $true -and [string]$lastProbe.json.service -eq "web") {
                return $lastProbe
            }
        }

        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $deadline)

    $probeText = if ($null -eq $lastProbe) { "<no probe>" } else { $lastProbe | ConvertTo-Json -Depth 8 -Compress }
    throw "Timed out waiting for Platform Web readiness at $ReadyUri. LastProbe=$probeText Stdout=$StdoutLog Stderr=$StderrLog"
}

$packagePath = ""
$manifest = $null
$versionId = ""
$zipRelativePath = ""
$zipPath = ""
$extractDir = ""
$smokeRoot = ""
$logsDir = ""
$installLog = ""
$stdoutLog = ""
$stderrLog = ""
$evidenceLogsDir = ""
$readyUri = ""
$selectedPort = $Port
$verifierResult = $null
$readyProbe = $null
$startProcess = $null
$smokeEvidence = $null
$status = "failed"
$errorMessage = $null

try {
    Assert-True (Test-Path -LiteralPath $verifyScript -PathType Leaf) "Missing verifier script: $verifyScript"
    $packagePath = (Resolve-Path -LiteralPath $PackageDir).Path
    Assert-True (Test-Path -LiteralPath $packagePath -PathType Container) "PackageDir must be a directory: $packagePath"

    $verifierOutput = & $verifyScript -PackageDir $packagePath 2>&1
    $verifierText = ($verifierOutput | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
    $verifierResult = $verifierText | ConvertFrom-Json
    Assert-True ([string]$verifierResult.status -eq "passed") "Package verifier did not return passed status."

    $manifestPath = Join-Path $packagePath "manifest.json"
    $manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
    $versionId = [string]$manifest.versionId
    Assert-True (-not [string]::IsNullOrWhiteSpace($versionId)) "manifest.json must contain versionId."

    if ([string]::IsNullOrWhiteSpace($EvidencePath)) {
        $safeVersion = $versionId -replace "[^A-Za-z0-9._-]", "_"
        $EvidencePath = Join-Path $repoRoot "output\smoke\Platform-$safeVersion-web-next-smoke-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
    } else {
        $EvidencePath = [System.IO.Path]::GetFullPath($EvidencePath)
    }
    $evidenceLogsDir = Get-EvidenceLogsDir -EvidencePath $EvidencePath

    $zipRecords = @($manifest.artifacts | Where-Object { [string]$_.kind -eq "zip" })
    Assert-True ($zipRecords.Count -eq 1) "Expected exactly one Platform Web zip artifact in manifest.json."
    $zipRelativePath = [string]$zipRecords[0].path
    $zipPath = Join-Path $packagePath $zipRelativePath
    Assert-True (Test-Path -LiteralPath $zipPath -PathType Leaf) "Missing zip artifact: $zipRelativePath"

    if ($selectedPort -eq 0) {
        $selectedPort = Get-FreePort
    }
    Assert-True (Test-PortAvailable -Port $selectedPort) "Loopback port is not available: $selectedPort"

    $smokeRoot = [System.IO.Path]::GetFullPath((Join-Path ([System.IO.Path]::GetTempPath()) "neuro-platform-web-release-smoke"))
    $extractDir = Join-Path $smokeRoot ("$versionId-" + [System.Guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $extractDir -Force | Out-Null
    $logsDir = Join-Path $extractDir ".smoke-logs"
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null

    Expand-ZipPackage -ZipPath $zipPath -DestinationPath $extractDir

    Assert-True (Test-Path -LiteralPath (Join-Path $extractDir "package.json") -PathType Leaf) "Extracted package missing package.json."
    Assert-True (Test-Path -LiteralPath (Join-Path $extractDir "web\.next\BUILD_ID") -PathType Leaf) "Extracted package missing web\\.next\\BUILD_ID."
    Assert-True (Test-Path -LiteralPath (Join-Path $extractDir "web\src\app\ready\route.ts") -PathType Leaf) "Extracted package missing /ready route source."

    $installLog = Join-Path $logsDir "npm-ci.log"
    if (-not $SkipInstall) {
        Invoke-LoggedCommand `
            -Display "npm ci --omit=dev" `
            -Executable "cmd.exe" `
            -Arguments @("/d", "/c", "npm ci --omit=dev") `
            -WorkingDirectory $extractDir `
            -LogPath $installLog
    }

    $stdoutLog = Join-Path $logsDir "next-start.stdout.log"
    $stderrLog = Join-Path $logsDir "next-start.stderr.log"
    $readyUri = "http://127.0.0.1:$selectedPort/ready"
    $startCommand = "npm run start --workspace web -- --hostname 127.0.0.1 --port $selectedPort"
    $startProcess = Start-LoggedProcess `
        -CommandLine $startCommand `
        -WorkingDirectory $extractDir `
        -StdoutLog $stdoutLog `
        -StderrLog $stderrLog

    $readyProbe = Wait-ForReady `
        -Process $startProcess `
        -ReadyUri $readyUri `
        -TimeoutSeconds $StartupTimeoutSeconds `
        -StdoutLog $stdoutLog `
        -StderrLog $stderrLog

    $status = "passed"
    $smokeEvidence = [ordered]@{
        status = $status
        packageDir = $packagePath
        versionId = $versionId
        target = [string]$manifest.target
        zipArtifact = $zipRelativePath
        extractDir = $extractDir
        keptArtifacts = [bool]$KeepArtifacts
        port = $selectedPort
        verifier = $verifierResult
        tempLogsDir = $logsDir
        evidenceLogsDir = $evidenceLogsDir
        install = [ordered]@{
            skipped = [bool]$SkipInstall
            log = if ([string]::IsNullOrWhiteSpace($evidenceLogsDir)) { $installLog } else { Join-Path $evidenceLogsDir "npm-ci.log" }
            tempLog = $installLog
            command = if ($SkipInstall) { "" } else { "npm ci --omit=dev" }
        }
        runtime = [ordered]@{
            command = $startCommand
            processId = $startProcess.Id
            stdoutLog = if ([string]::IsNullOrWhiteSpace($evidenceLogsDir)) { $stdoutLog } else { Join-Path $evidenceLogsDir "next-start.stdout.log" }
            stderrLog = if ([string]::IsNullOrWhiteSpace($evidenceLogsDir)) { $stderrLog } else { Join-Path $evidenceLogsDir "next-start.stderr.log" }
            tempStdoutLog = $stdoutLog
            tempStderrLog = $stderrLog
            readyUri = $readyUri
            readyProbe = $readyProbe
        }
        smokeEvidence = $EvidencePath
    }
} catch {
    $errorMessage = $_.Exception.Message
    $smokeEvidence = [ordered]@{
        status = "failed"
        packageDir = $packagePath
        versionId = $versionId
        zipArtifact = $zipRelativePath
        extractDir = $extractDir
        keptArtifacts = [bool]$KeepArtifacts
        port = $selectedPort
        verifier = $verifierResult
        readyUri = $readyUri
        tempLogsDir = $logsDir
        evidenceLogsDir = $evidenceLogsDir
        installLog = $installLog
        stdoutLog = $stdoutLog
        stderrLog = $stderrLog
        error = $errorMessage
        smokeEvidence = $EvidencePath
    }
    throw
} finally {
    Stop-SpawnedProcessTree -Process $startProcess

    Copy-SmokeLogsToEvidence -LogsDir $logsDir -EvidenceLogsDir $evidenceLogsDir

    if ($null -ne $smokeEvidence -and -not [string]::IsNullOrWhiteSpace($EvidencePath)) {
        Write-TextUtf8NoBom -Path $EvidencePath -Value (($smokeEvidence | ConvertTo-Json -Depth 16) + [Environment]::NewLine)
    }

    if (-not $KeepArtifacts -and -not [string]::IsNullOrWhiteSpace($extractDir) -and (Test-Path -LiteralPath $extractDir)) {
        $fullSmokeRoot = [System.IO.Path]::GetFullPath($smokeRoot).TrimEnd("\", "/") + [System.IO.Path]::DirectorySeparatorChar
        $fullExtractDir = [System.IO.Path]::GetFullPath($extractDir)
        if ($fullExtractDir.StartsWith($fullSmokeRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
            Remove-Item -LiteralPath $extractDir -Recurse -Force
        }
    }
}

if ($status -eq "passed") {
    $smokeEvidence | ConvertTo-Json -Depth 16
}
