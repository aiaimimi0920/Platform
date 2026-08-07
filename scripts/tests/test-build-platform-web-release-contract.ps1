[CmdletBinding()]
param(
    [switch]$DryRunOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")).Path
$scriptPath = Join-Path $repoRoot "scripts\build-platform-web-release.ps1"
$versionId = "20260608-120000-deadbeef"
$stubVersionId = "platform-web-contract-stub"
$sourceDateEpoch = "1780876800"
$releaseRoot = [System.IO.Path]::GetFullPath((Join-Path $repoRoot "release"))
$destination = [System.IO.Path]::GetFullPath((Join-Path $releaseRoot "Platform\$versionId"))
$stubDestination = [System.IO.Path]::GetFullPath((Join-Path $releaseRoot "Platform\$stubVersionId"))
$destinationExistedBefore = Test-Path -LiteralPath $destination
$stubDestinationExistedBefore = Test-Path -LiteralPath $stubDestination

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

Assert-True (Test-Path -LiteralPath $scriptPath -PathType Leaf) "Missing Platform Web release build script: $scriptPath"

$output = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $scriptPath -DryRun -VersionId $versionId -NoZip 2>&1
$exitCode = $LASTEXITCODE
Assert-Equal 0 $exitCode "Dry-run command failed. Output: $($output -join [Environment]::NewLine)"

$plan = ($output -join [Environment]::NewLine) | ConvertFrom-Json

Assert-Equal 1 $plan.schemaVersion "Unexpected dry-run schema version."
Assert-Equal "dry-run" $plan.mode "Unexpected dry-run mode."
Assert-Equal "Platform" $plan.app "Unexpected app archive name."
Assert-Equal "web" $plan.component "Unexpected Platform component name."
Assert-Equal $versionId $plan.versionId "Dry-run did not preserve explicit version id."
Assert-Equal $releaseRoot $plan.releaseRoot "Release root must be the current Platform repository release directory."
Assert-Equal $destination $plan.destination "Platform release destination must be release\\Platform\\<versionId>."
Assert-Equal (Join-Path $destination "web") $plan.webDestination "Platform Web payload must live under release\\Platform\\<versionId>\\web."

$commands = @($plan.commands | ForEach-Object { [string]$_.display })
Assert-True (($commands -join "`n").Contains("npm run build --workspace @neuro/contracts")) "Dry-run must build the shared contracts workspace before packaging dist output."
Assert-True (($commands -join "`n").Contains("npm run build --workspace web")) "Dry-run must build the Platform Web workspace."
Assert-Equal "npm run build --workspace @neuro/contracts,npm run build --workspace web" ($commands -join ",") "Platform Web release build commands must run contracts before web."

$commandLogs = @($plan.commands | ForEach-Object { [string]$_.logRelativePath })
Assert-Equal "logs\platform-contracts-build.log,logs\platform-web-build.log" ($commandLogs -join ",") "Each Platform Web release command must have a stable, unique build log path."

$copyRoots = @($plan.copyRoots | ForEach-Object { [string]$_.destinationRelativePath })
Assert-True ($copyRoots -contains "web\src") "Dry-run must copy Platform Web source into web\\src."
Assert-True ($copyRoots -contains "web\public") "Dry-run must copy Platform Web public assets."
Assert-True ($copyRoots -contains "web\.next\server") "Dry-run must copy the production Next server output."
Assert-True ($copyRoots -contains "web\.next\static") "Dry-run must copy the production Next static output."

$copyFiles = @($plan.copyFiles | ForEach-Object { [string]$_.destinationRelativePath })
Assert-True ($copyFiles -contains "packages\contracts\package.json") "Dry-run must copy @neuro/contracts package metadata next to dist output."
Assert-True ($copyFiles -notcontains "web\.next\trace") "Release plan must not copy the non-deterministic Next build trace."

$excluded = @($plan.excludedRelativePaths | ForEach-Object { [string]$_ })
Assert-True ($excluded -contains "web\node_modules") "Release plan must exclude web node_modules."
Assert-True ($excluded -contains "web\.next\cache") "Release plan must exclude the Next build cache."
Assert-True ($excluded -contains "web\.next\dev") "Release plan must exclude Next dev artifacts."
Assert-True ($excluded -contains "web\.next\diagnostics") "Release plan must exclude Next diagnostics artifacts."
Assert-True ($excluded -contains "web\.next\trace") "Release plan must exclude the non-deterministic Next build trace."

Assert-Equal $destinationExistedBefore (Test-Path -LiteralPath $destination) "Dry-run must not create or remove the Platform version directory."

if ($DryRunOnly) {
    Write-Host "Platform Web release dry-run contract passed."
    return
}

if ($stubDestinationExistedBefore) {
    throw "Contract stub destination already exists and would be destructive: $stubDestination"
}

$stubBin = Join-Path $env:TEMP ("neuro-platform-web-release-stub-" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $stubBin -Force | Out-Null
$stubNpm = Join-Path $stubBin "npm.cmd"
$stubScript = @"
@echo off
echo [stub npm] %*
exit /b 0
"@
[System.IO.File]::WriteAllText($stubNpm, $stubScript, [System.Text.ASCIIEncoding]::new())

$previousPath = $env:PATH
try {
    $env:PATH = "$stubBin;$previousPath"
    $buildOutput = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $scriptPath -VersionId $stubVersionId -SourceDateEpoch $sourceDateEpoch -Force 2>&1
    $buildExitCode = $LASTEXITCODE
    Assert-Equal 0 $buildExitCode "Stubbed build command failed. Output: $($buildOutput -join [Environment]::NewLine)"

    Assert-True (Test-Path -LiteralPath (Join-Path $stubDestination "web\src\app") -PathType Container) "Build mode must copy directory contents for web\\src, not create an empty destination."
    Assert-True (Test-Path -LiteralPath (Join-Path $stubDestination "web\public") -PathType Container) "Build mode must copy directory contents for web\\public."
    Assert-True (Test-Path -LiteralPath (Join-Path $stubDestination "web\.next\server") -PathType Container) "Build mode must copy Next server output contents."
    Assert-True (Test-Path -LiteralPath (Join-Path $stubDestination "web\.next\static") -PathType Container) "Build mode must copy Next static output contents."
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $stubDestination "web\.next\trace"))) "Build mode must not copy the non-deterministic Next build trace."
    Assert-True (Test-Path -LiteralPath (Join-Path $stubDestination "packages\contracts\dist") -PathType Container) "Build mode must copy shared contract dist contents."
    Assert-True (Test-Path -LiteralPath (Join-Path $stubDestination "packages\contracts\package.json") -PathType Leaf) "Build mode must copy @neuro/contracts package metadata."

    $manifest = Get-Content -LiteralPath (Join-Path $stubDestination "manifest.json") -Raw | ConvertFrom-Json
    Assert-Equal 2 $manifest.schemaVersion "Build manifest must use the relocatable schema."
    Assert-Equal ([long]$sourceDateEpoch) ([long]$manifest.sourceDateEpoch) "Build manifest must record the reproducible source timestamp."
    Assert-Equal "." $manifest.packageRoot "Build manifest package root must be package-relative."
    Assert-Equal "web" $manifest.webDestination "Build manifest web destination must be package-relative."
    Assert-True ($manifest.PSObject.Properties.Name -notcontains "repoRoot") "Build manifest must not disclose the source repository path."
    Assert-True ($manifest.PSObject.Properties.Name -notcontains "releaseRoot") "Build manifest must not bind the package to its original release root."
    Assert-True ($manifest.PSObject.Properties.Name -notcontains "destination") "Build manifest must not bind the package to its original destination."
    Assert-True (@($manifest.commands | ForEach-Object { [string]$_.workingDirectory }) -notcontains $repoRoot) "Build manifest command provenance must not contain absolute repository paths."
    Assert-True (@($manifest.copyRoots | Where-Object { [System.IO.Path]::IsPathRooted([string]$_.source) }).Count -eq 0) "Build manifest copy provenance must use repository-relative paths."
    Assert-True (-not (Get-Content -Raw -LiteralPath (Join-Path $stubDestination "BUILD_INFO.txt")).Contains($repoRoot)) "Build info must not disclose the source repository path."
    $buildLogs = @($manifest.buildLogs | ForEach-Object { [string]$_.path })
    Assert-Equal "logs\platform-contracts-build.log,logs\platform-web-build.log" ($buildLogs -join ",") "Build manifest must keep both build logs."
    foreach ($buildLog in $buildLogs) {
        Assert-True (-not (Get-Content -Raw -LiteralPath (Join-Path $stubDestination $buildLog)).Contains($repoRoot)) "Build logs must not disclose the source repository path."
    }

    $zipPath = Join-Path $stubDestination "packages\Platform-$stubVersionId-web-next.zip"
    $zipShaPath = "$zipPath.sha256"
    Assert-True (Test-Path -LiteralPath $zipPath -PathType Leaf) "Build mode must create the Platform Web zip package."
    Assert-True ((Get-Item -LiteralPath $zipPath).Length -gt 0) "Platform Web zip package must not be empty."
    Assert-True (Test-Path -LiteralPath $zipShaPath -PathType Leaf) "Build mode must create the Platform Web zip checksum."
    Assert-True (Test-Path -LiteralPath (Join-Path $stubDestination "checksums.sha256") -PathType Leaf) "Build mode must create the full release checksum list."

    Add-Type -AssemblyName System.IO.Compression.FileSystem | Out-Null
    $zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $zipPath))
    try {
        $entryNames = @($zip.Entries | ForEach-Object { $_.FullName })
        Assert-True ($entryNames -contains "web/src/app/ready/route.ts") "Platform Web zip must contain the readiness route used by release runtime smoke."
        Assert-True ($entryNames -contains "web/src/app/dashboard/page.tsx") "Platform Web zip must contain web source payload entries."
        Assert-True ($entryNames -contains "packages/contracts/package.json") "Platform Web zip must contain @neuro/contracts package metadata."
        Assert-True ($entryNames -notcontains "web/.next/trace") "Platform Web zip must not contain the non-deterministic Next build trace."
        [string[]]$expectedEntryNames = @($entryNames)
        [System.Array]::Sort($expectedEntryNames, [System.StringComparer]::Ordinal)
        Assert-Equal ($expectedEntryNames -join "`n") ($entryNames -join "`n") "Platform Web zip entries must use deterministic ordinal path order."
        Assert-Equal 1 @($zip.Entries | ForEach-Object { $_.LastWriteTime.UtcDateTime.Ticks } | Sort-Object -Unique).Count "Platform Web zip entries must share one reproducible timestamp."
    } finally {
        $zip.Dispose()
    }

    $firstZipHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash
    $firstManifestHash = (Get-FileHash -LiteralPath (Join-Path $stubDestination "manifest.json") -Algorithm SHA256).Hash
    $firstChecksumsHash = (Get-FileHash -LiteralPath (Join-Path $stubDestination "checksums.sha256") -Algorithm SHA256).Hash

    $secondBuildOutput = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $scriptPath -VersionId $stubVersionId -SourceDateEpoch $sourceDateEpoch -Force 2>&1
    $secondBuildExitCode = $LASTEXITCODE
    Assert-Equal 0 $secondBuildExitCode "Second reproducibility build failed. Output: $($secondBuildOutput -join [Environment]::NewLine)"
    Assert-Equal $firstZipHash (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash "Identical inputs must produce an identical Platform Web zip."
    Assert-Equal $firstManifestHash (Get-FileHash -LiteralPath (Join-Path $stubDestination "manifest.json") -Algorithm SHA256).Hash "Identical inputs must produce an identical manifest."
    Assert-Equal $firstChecksumsHash (Get-FileHash -LiteralPath (Join-Path $stubDestination "checksums.sha256") -Algorithm SHA256).Hash "Identical inputs must produce an identical release checksum list."
} finally {
    $env:PATH = $previousPath
    if (Test-Path -LiteralPath $stubBin) {
        Remove-Item -LiteralPath $stubBin -Recurse -Force
    }
    if ((-not $stubDestinationExistedBefore) -and (Test-Path -LiteralPath $stubDestination)) {
        Remove-Item -LiteralPath $stubDestination -Recurse -Force
    }
}

Write-Host "Platform Web release dry-run contract passed."
