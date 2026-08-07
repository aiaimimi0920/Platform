[CmdletBinding()]
param(
    [string]$VersionId = "",
    [switch]$Force,
    [switch]$NoZip,
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$platformRoot = $repoRoot
$webRoot = [System.IO.Path]::GetFullPath((Join-Path $platformRoot "web"))
$releaseRoot = [System.IO.Path]::GetFullPath((Join-Path $repoRoot "release"))
$targetName = "web-next"

function Join-RepoPath {
    param([string]$RelativePath)
    return [System.IO.Path]::GetFullPath((Join-Path $repoRoot $RelativePath))
}

function Write-TextUtf8NoBom {
    param(
        [string]$Path,
        [string]$Value
    )

    $encoding = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText($Path, $Value, $encoding)
}

function Write-TextAscii {
    param(
        [string]$Path,
        [string]$Value
    )

    $encoding = [System.Text.ASCIIEncoding]::new()
    [System.IO.File]::WriteAllText($Path, $Value, $encoding)
}

function Get-GitText {
    param([string[]]$Arguments)

    try {
        $output = & git -C $repoRoot @Arguments 2>$null
        if ($LASTEXITCODE -eq 0) {
            return (($output | ForEach-Object { $_.ToString() }) -join "`n").Trim()
        }
    } catch {
        return ""
    }

    return ""
}

function Get-GitDirty {
    try {
        $output = & git -C $repoRoot status --porcelain 2>$null
        if ($LASTEXITCODE -ne 0) {
            return $null
        }

        $lines = @($output | Where-Object { -not [string]::IsNullOrWhiteSpace($_.ToString()) })
        return ($lines.Count -gt 0)
    } catch {
        return $null
    }
}

function Resolve-VersionId {
    param([string]$ExplicitVersionId)

    $value = $ExplicitVersionId
    if ([string]::IsNullOrWhiteSpace($value)) {
        $shortSha = Get-GitText -Arguments @("rev-parse", "--short=8", "HEAD")
        if ([string]::IsNullOrWhiteSpace($shortSha)) {
            $shortSha = "nogit"
        }

        $value = "$(Get-Date -Format "yyyyMMdd-HHmmss")-$shortSha"
    }

    if ($value -notmatch "^[A-Za-z0-9._-]+$") {
        throw "Invalid VersionId '$value'. Use only letters, numbers, dot, underscore, and dash."
    }

    return $value
}

function New-CommandSpec {
    param(
        [string]$Executable,
        [string[]]$Arguments,
        [string]$WorkingDirectory,
        [string]$Display,
        [string]$LogRelativePath
    )

    return [ordered]@{
        executable = $Executable
        arguments = @($Arguments)
        workingDirectory = [System.IO.Path]::GetFullPath($WorkingDirectory)
        display = $Display
        logRelativePath = $LogRelativePath
    }
}

function New-CopyRootSpec {
    param(
        [string]$Source,
        [string]$DestinationRelativePath,
        [string]$Kind
    )

    return [ordered]@{
        source = [System.IO.Path]::GetFullPath($Source)
        destinationRelativePath = $DestinationRelativePath
        kind = $Kind
    }
}

function New-CopyFileSpec {
    param(
        [string]$Source,
        [string]$DestinationRelativePath,
        [string]$Kind
    )

    return [ordered]@{
        source = [System.IO.Path]::GetFullPath($Source)
        destinationRelativePath = $DestinationRelativePath
        kind = $Kind
    }
}

function Get-RelativePath {
    param(
        [string]$BasePath,
        [string]$Path
    )

    $baseFull = [System.IO.Path]::GetFullPath($BasePath).TrimEnd("\", "/") + [System.IO.Path]::DirectorySeparatorChar
    $pathFull = [System.IO.Path]::GetFullPath($Path)
    $baseUri = [System.Uri]::new($baseFull)
    $pathUri = [System.Uri]::new($pathFull)
    return [System.Uri]::UnescapeDataString($baseUri.MakeRelativeUri($pathUri).ToString()).Replace("/", "\")
}

function Get-RepoRelativePath {
    param([string]$Path)

    $repoFullPath = [System.IO.Path]::GetFullPath($repoRoot).TrimEnd("\", "/")
    $sourceFullPath = [System.IO.Path]::GetFullPath($Path).TrimEnd("\", "/")
    if ([string]::Equals($repoFullPath, $sourceFullPath, [System.StringComparison]::OrdinalIgnoreCase)) {
        return "."
    }

    $relativePath = Get-RelativePath -BasePath $repoFullPath -Path $sourceFullPath
    if ([System.IO.Path]::IsPathRooted($relativePath) -or $relativePath -match "(^|[\\/])\.\.([\\/]|$)") {
        throw "Release provenance path is outside the Platform repository: $Path"
    }

    return $relativePath
}

function Assert-UnderReleaseRoot {
    param([string]$Path)

    $fullRoot = [System.IO.Path]::GetFullPath($releaseRoot).TrimEnd("\", "/")
    $fullPath = [System.IO.Path]::GetFullPath($Path)
    $rootWithSlash = $fullRoot + [System.IO.Path]::DirectorySeparatorChar

    if (($fullPath -ne $fullRoot) -and (-not $fullPath.StartsWith($rootWithSlash, [System.StringComparison]::OrdinalIgnoreCase))) {
        throw "Refusing to touch path outside release root: $fullPath"
    }
}

function Initialize-Destination {
    param([string]$Destination)

    Assert-UnderReleaseRoot -Path $Destination

    if (Test-Path -LiteralPath $Destination) {
        if (-not $Force) {
            throw "Release destination already exists: $Destination. Pass -Force to replace it."
        }

        Remove-Item -LiteralPath $Destination -Recurse -Force
    }

    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $Destination "logs") -Force | Out-Null
    if (-not $NoZip) {
        New-Item -ItemType Directory -Path (Join-Path $Destination "packages") -Force | Out-Null
    }
}

function Invoke-BuildCommand {
    param(
        [System.Collections.Specialized.OrderedDictionary]$Command,
        [string]$LogPath
    )

    $display = [string]$Command["display"]
    $workingDirectory = [string]$Command["workingDirectory"]
    $executable = [string]$Command["executable"]
    $arguments = @($Command["arguments"])

    $header = @(
        "Command: $display"
        "Executable: $executable"
        "Arguments: $($arguments -join ' ')"
        "Working directory: $(Get-RepoRelativePath -Path $workingDirectory)"
        "Started at: $(Get-Date -Format o)"
        ""
    ) -join [Environment]::NewLine
    Write-TextUtf8NoBom -Path $LogPath -Value $header

    Push-Location -LiteralPath $workingDirectory
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        $output = & $executable @arguments 2>&1
        $exitCode = $LASTEXITCODE
    } catch {
        $output = @($_.Exception.ToString())
        $exitCode = 1
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
        Pop-Location
    }

    $lines = @($output | ForEach-Object { $_.ToString() })
    $footer = @(
        ""
        "Finished at: $(Get-Date -Format o)"
        "Exit code: $exitCode"
    ) -join [Environment]::NewLine
    $existing = [System.IO.File]::ReadAllText($LogPath)
    Write-TextUtf8NoBom -Path $LogPath -Value ($existing + ($lines -join [Environment]::NewLine) + [Environment]::NewLine + $footer + [Environment]::NewLine)

    if ($exitCode -ne 0) {
        throw "Build command failed for '$display' with exit code $exitCode. See log: $LogPath"
    }
}

function New-FileRecord {
    param(
        [string]$BasePath,
        [string]$Path,
        [string]$Kind
    )

    $item = Get-Item -LiteralPath $Path
    $hash = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()

    return [ordered]@{
        kind = $Kind
        name = $item.Name
        path = Get-RelativePath -BasePath $BasePath -Path $Path
        bytes = $item.Length
        sha256 = $hash
    }
}

function Copy-DirectorySnapshot {
    param(
        [string]$Source,
        [string]$DestinationRoot,
        [string]$DestinationRelativePath
    )

    if (-not (Test-Path -LiteralPath $Source -PathType Container)) {
        throw "Expected release directory is missing: $Source"
    }

    $destination = Join-Path $DestinationRoot $DestinationRelativePath
    Assert-UnderReleaseRoot -Path $destination
    New-Item -ItemType Directory -Path $destination -Force | Out-Null

    $items = Get-ChildItem -LiteralPath $Source -Force
    foreach ($item in $items) {
        Copy-Item -LiteralPath $item.FullName -Destination $destination -Recurse -Force
    }
}

function Copy-ReleaseFile {
    param(
        [string]$Source,
        [string]$DestinationRoot,
        [string]$DestinationRelativePath
    )

    if (-not (Test-Path -LiteralPath $Source -PathType Leaf)) {
        throw "Expected release file is missing: $Source"
    }

    $destination = Join-Path $DestinationRoot $DestinationRelativePath
    Assert-UnderReleaseRoot -Path $destination
    $destinationParent = Split-Path -Parent $destination
    New-Item -ItemType Directory -Path $destinationParent -Force | Out-Null
    Copy-Item -LiteralPath $Source -Destination $destination -Force
}

function Write-Checksums {
    param([string]$Destination)

    $checksumPath = Join-Path $Destination "checksums.sha256"
    Assert-UnderReleaseRoot -Path $checksumPath

    $files = Get-ChildItem -LiteralPath $Destination -Recurse -File |
        Where-Object { $_.FullName -ne $checksumPath } |
        Sort-Object FullName

    $lines = @()
    foreach ($file in $files) {
        $relative = Get-RelativePath -BasePath $Destination -Path $file.FullName
        $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        $lines += "$hash  $relative"
    }

    Write-TextAscii -Path $checksumPath -Value (($lines -join "`r`n") + "`r`n")
}

function New-ZipPackage {
    param(
        [string]$VersionIdValue,
        [string]$Destination,
        [string[]]$PayloadRelativePaths
    )

    $packageDir = Join-Path $Destination "packages"
    New-Item -ItemType Directory -Path $packageDir -Force | Out-Null
    $zipPath = Join-Path $packageDir "Platform-$VersionIdValue-web-next.zip"
    $zipShaPath = "$zipPath.sha256"

    Assert-UnderReleaseRoot -Path $zipPath
    Assert-UnderReleaseRoot -Path $zipShaPath

    $tempRoot = [System.IO.Path]::GetFullPath((Join-Path ([System.IO.Path]::GetTempPath()) "neuro-platform-web-release-packaging"))
    $stagingRoot = [System.IO.Path]::GetFullPath((Join-Path $tempRoot ([System.Guid]::NewGuid().ToString("N"))))
    New-Item -ItemType Directory -Path $stagingRoot -Force | Out-Null

    try {
        foreach ($relative in $PayloadRelativePaths) {
            $source = Join-Path $Destination $relative
            $target = Join-Path $stagingRoot $relative
            $targetParent = Split-Path -Parent $target
            New-Item -ItemType Directory -Path $targetParent -Force | Out-Null
            Copy-Item -LiteralPath $source -Destination $target -Recurse -Force
        }

        if (Test-Path -LiteralPath $zipPath) {
            Remove-Item -LiteralPath $zipPath -Force
        }
        if (Test-Path -LiteralPath $zipShaPath) {
            Remove-Item -LiteralPath $zipShaPath -Force
        }

        Add-Type -AssemblyName System.IO.Compression | Out-Null
        Add-Type -AssemblyName System.IO.Compression.FileSystem | Out-Null

        $zipStream = [System.IO.File]::Open($zipPath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
        try {
            $archive = [System.IO.Compression.ZipArchive]::new($zipStream, [System.IO.Compression.ZipArchiveMode]::Create, $false)
            try {
                $stagingFiles = Get-ChildItem -LiteralPath $stagingRoot -Recurse -File -Force | Sort-Object FullName
                foreach ($file in $stagingFiles) {
                    $entryName = (Get-RelativePath -BasePath $stagingRoot -Path $file.FullName).Replace("\", "/")
                    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                        $archive,
                        $file.FullName,
                        $entryName,
                        [System.IO.Compression.CompressionLevel]::Optimal
                    ) | Out-Null
                }
            } finally {
                $archive.Dispose()
            }
        } finally {
            $zipStream.Dispose()
        }

        $hash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
        $zipName = Split-Path -Leaf $zipPath
        Write-TextAscii -Path $zipShaPath -Value "$hash  $zipName`r`n"

        return @(
            (New-FileRecord -BasePath $Destination -Path $zipPath -Kind "zip"),
            (New-FileRecord -BasePath $Destination -Path $zipShaPath -Kind "zip-sha256")
        )
    } finally {
        $fullTempRoot = [System.IO.Path]::GetFullPath($tempRoot).TrimEnd("\", "/") + [System.IO.Path]::DirectorySeparatorChar
        $fullStagingRoot = [System.IO.Path]::GetFullPath($stagingRoot)
        if ($fullStagingRoot.StartsWith($fullTempRoot, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $stagingRoot)) {
            Remove-Item -LiteralPath $stagingRoot -Recurse -Force
        }
    }
}

function Get-PlatformWebReleaseSpec {
    return [ordered]@{
        app = "Platform"
        component = "web"
        sourceProject = "web"
        commands = @(
            New-CommandSpec `
                -Executable "cmd.exe" `
                -Arguments @("/d", "/c", "npm run build --workspace @neuro/contracts") `
                -WorkingDirectory $platformRoot `
                -Display "npm run build --workspace @neuro/contracts" `
                -LogRelativePath "logs\platform-contracts-build.log"
            New-CommandSpec `
                -Executable "cmd.exe" `
                -Arguments @("/d", "/c", "npm run build --workspace web") `
                -WorkingDirectory $platformRoot `
                -Display "npm run build --workspace web" `
                -LogRelativePath "logs\platform-web-build.log"
        )
        copyRoots = @(
            New-CopyRootSpec -Source (Join-RepoPath "web\src") -DestinationRelativePath "web\src" -Kind "source-dir"
            New-CopyRootSpec -Source (Join-RepoPath "web\public") -DestinationRelativePath "web\public" -Kind "public-dir"
            New-CopyRootSpec -Source (Join-RepoPath "web\data") -DestinationRelativePath "web\data" -Kind "data-dir"
            New-CopyRootSpec -Source (Join-RepoPath "web\.next\server") -DestinationRelativePath "web\.next\server" -Kind "next-server-dir"
            New-CopyRootSpec -Source (Join-RepoPath "web\.next\static") -DestinationRelativePath "web\.next\static" -Kind "next-static-dir"
            New-CopyRootSpec -Source (Join-RepoPath "packages\contracts\dist") -DestinationRelativePath "packages\contracts\dist" -Kind "workspace-package-dist"
        )
        copyFiles = @(
            New-CopyFileSpec -Source (Join-RepoPath "package.json") -DestinationRelativePath "package.json" -Kind "workspace-package-json"
            New-CopyFileSpec -Source (Join-RepoPath "package-lock.json") -DestinationRelativePath "package-lock.json" -Kind "workspace-lockfile"
            New-CopyFileSpec -Source (Join-RepoPath "tsconfig.base.json") -DestinationRelativePath "tsconfig.base.json" -Kind "workspace-config"
            New-CopyFileSpec -Source (Join-RepoPath "packages\contracts\package.json") -DestinationRelativePath "packages\contracts\package.json" -Kind "workspace-package-json"
            New-CopyFileSpec -Source (Join-RepoPath "web\package.json") -DestinationRelativePath "web\package.json" -Kind "web-package-json"
            New-CopyFileSpec -Source (Join-RepoPath "web\next.config.ts") -DestinationRelativePath "web\next.config.ts" -Kind "web-config"
            New-CopyFileSpec -Source (Join-RepoPath "web\tsconfig.json") -DestinationRelativePath "web\tsconfig.json" -Kind "web-config"
            New-CopyFileSpec -Source (Join-RepoPath "web\next-env.d.ts") -DestinationRelativePath "web\next-env.d.ts" -Kind "web-config"
            New-CopyFileSpec -Source (Join-RepoPath "web\.env.example") -DestinationRelativePath "web\.env.example" -Kind "web-env-example"
            New-CopyFileSpec -Source (Join-RepoPath "web\.next\BUILD_ID") -DestinationRelativePath "web\.next\BUILD_ID" -Kind "next-build-file"
            New-CopyFileSpec -Source (Join-RepoPath "web\.next\app-path-routes-manifest.json") -DestinationRelativePath "web\.next\app-path-routes-manifest.json" -Kind "next-manifest"
            New-CopyFileSpec -Source (Join-RepoPath "web\.next\build-manifest.json") -DestinationRelativePath "web\.next\build-manifest.json" -Kind "next-manifest"
            New-CopyFileSpec -Source (Join-RepoPath "web\.next\fallback-build-manifest.json") -DestinationRelativePath "web\.next\fallback-build-manifest.json" -Kind "next-manifest"
            New-CopyFileSpec -Source (Join-RepoPath "web\.next\images-manifest.json") -DestinationRelativePath "web\.next\images-manifest.json" -Kind "next-manifest"
            New-CopyFileSpec -Source (Join-RepoPath "web\.next\next-minimal-server.js.nft.json") -DestinationRelativePath "web\.next\next-minimal-server.js.nft.json" -Kind "next-manifest"
            New-CopyFileSpec -Source (Join-RepoPath "web\.next\next-server.js.nft.json") -DestinationRelativePath "web\.next\next-server.js.nft.json" -Kind "next-manifest"
            New-CopyFileSpec -Source (Join-RepoPath "web\.next\package.json") -DestinationRelativePath "web\.next\package.json" -Kind "next-manifest"
            New-CopyFileSpec -Source (Join-RepoPath "web\.next\prerender-manifest.json") -DestinationRelativePath "web\.next\prerender-manifest.json" -Kind "next-manifest"
            New-CopyFileSpec -Source (Join-RepoPath "web\.next\required-server-files.js") -DestinationRelativePath "web\.next\required-server-files.js" -Kind "next-manifest"
            New-CopyFileSpec -Source (Join-RepoPath "web\.next\required-server-files.json") -DestinationRelativePath "web\.next\required-server-files.json" -Kind "next-manifest"
            New-CopyFileSpec -Source (Join-RepoPath "web\.next\routes-manifest.json") -DestinationRelativePath "web\.next\routes-manifest.json" -Kind "next-manifest"
            New-CopyFileSpec -Source (Join-RepoPath "web\.next\trace") -DestinationRelativePath "web\.next\trace" -Kind "next-trace"
        )
        excludedRelativePaths = @(
            "web\node_modules",
            "web\.next\cache",
            "web\.next\dev",
            "web\.next\diagnostics",
            "web\.next\types",
            "web\.next\turbopack",
            "web\.next\trace-build",
            "node_modules",
            ".runtime",
            ".tmp"
        )
    }
}

function Build-DryRunPlan {
    param(
        [System.Collections.Specialized.OrderedDictionary]$Spec,
        [string]$VersionIdValue
    )

    $destination = [System.IO.Path]::GetFullPath((Join-Path $releaseRoot "Platform\$VersionIdValue"))

    return [ordered]@{
        schemaVersion = 1
        mode = "dry-run"
        app = $Spec["app"]
        component = $Spec["component"]
        sourceProject = $Spec["sourceProject"]
        versionId = $VersionIdValue
        releaseRoot = $releaseRoot
        target = $targetName
        destination = $destination
        webDestination = [System.IO.Path]::GetFullPath((Join-Path $destination "web"))
        commands = @($Spec["commands"] | ForEach-Object {
            [ordered]@{
                display = $_["display"]
                workingDirectory = $_["workingDirectory"]
                logRelativePath = $_["logRelativePath"]
            }
        })
        copyRoots = @($Spec["copyRoots"] | ForEach-Object {
            [ordered]@{
                source = $_["source"]
                destinationRelativePath = $_["destinationRelativePath"]
                kind = $_["kind"]
            }
        })
        copyFiles = @($Spec["copyFiles"] | ForEach-Object {
            [ordered]@{
                source = $_["source"]
                destinationRelativePath = $_["destinationRelativePath"]
                kind = $_["kind"]
            }
        })
        excludedRelativePaths = @($Spec["excludedRelativePaths"])
        zip = (-not $NoZip)
    }
}

function New-BuildInfoText {
    param(
        [string]$VersionIdValue,
        [string]$BuiltAt,
        [string]$GitHead,
        [object]$GitDirty,
        [object[]]$CommandRecords,
        [object[]]$CopyRootRecords,
        [object[]]$CopyFileRecords
    )

    $commandLines = @()
    foreach ($command in @($CommandRecords)) {
        $commandLines += "  - [$($command.workingDirectory)] $($command.display)"
    }

    $rootLines = @()
    foreach ($record in @($CopyRootRecords)) {
        $rootLines += "  - $($record.destinationRelativePath) from $($record.source)"
    }

    $fileLines = @()
    foreach ($record in @($CopyFileRecords)) {
        $fileLines += "  - $($record.path) ($($record.bytes) bytes, sha256=$($record.sha256))"
    }

    return @"
Neuro Platform Web release artifact

App: Platform
Component: web
Source project: web
VersionId: $VersionIdValue
Target: $targetName
Profile: release
Built at: $BuiltAt
Git HEAD: $GitHead
Git dirty: $GitDirty
Package root: .

Commands:
$($commandLines -join [Environment]::NewLine)

Copied directory roots:
$($rootLines -join [Environment]::NewLine)

Copied top-level/config files:
$($fileLines -join [Environment]::NewLine)

Policy:
  Platform Web is archived under release\Platform\<VersionId>\web.
  Runtime caches, node_modules, dev server output, diagnostics, and secrets stay outside the release archive.
"@
}

function Invoke-PlatformWebReleaseBuild {
    param(
        [System.Collections.Specialized.OrderedDictionary]$Spec,
        [string]$VersionIdValue,
        [string]$GitHead,
        [string]$GitShortSha,
        [object]$GitDirty
    )

    $builtAt = Get-Date -Format o
    $destination = [System.IO.Path]::GetFullPath((Join-Path $releaseRoot "Platform\$VersionIdValue"))
    Initialize-Destination -Destination $destination

    $commandRecords = @()
    $buildLogs = @()
    foreach ($command in @($Spec["commands"])) {
        $logPath = Join-Path $destination $command["logRelativePath"]
        Invoke-BuildCommand -Command $command -LogPath $logPath
        $commandRecords += [ordered]@{
            display = $command["display"]
            workingDirectory = Get-RepoRelativePath -Path ([string]$command["workingDirectory"])
            logRelativePath = $command["logRelativePath"]
        }
        $buildLogs += New-FileRecord -BasePath $destination -Path $logPath -Kind "build-log"
    }

    $copyRootRecords = @()
    foreach ($copyRoot in @($Spec["copyRoots"])) {
        Copy-DirectorySnapshot -Source $copyRoot["source"] -DestinationRoot $destination -DestinationRelativePath $copyRoot["destinationRelativePath"]
        $copyRootRecords += [ordered]@{
            kind = $copyRoot["kind"]
            source = Get-RepoRelativePath -Path ([string]$copyRoot["source"])
            destinationRelativePath = $copyRoot["destinationRelativePath"]
        }
    }

    $copyFileRecords = @()
    foreach ($copyFile in @($Spec["copyFiles"])) {
        Copy-ReleaseFile -Source $copyFile["source"] -DestinationRoot $destination -DestinationRelativePath $copyFile["destinationRelativePath"]
        $copiedPath = Join-Path $destination $copyFile["destinationRelativePath"]
        $copyFileRecords += New-FileRecord -BasePath $destination -Path $copiedPath -Kind $copyFile["kind"]
    }

    foreach ($excludedRelativePath in @($Spec["excludedRelativePaths"])) {
        $excludedPath = Join-Path $destination $excludedRelativePath
        if (Test-Path -LiteralPath $excludedPath) {
            throw "Release archive contains excluded path: $excludedRelativePath"
        }
    }

    $buildInfoPath = Join-Path $destination "BUILD_INFO.txt"
    $buildInfo = New-BuildInfoText `
        -VersionIdValue $VersionIdValue `
        -BuiltAt $builtAt `
        -GitHead $GitHead `
        -GitDirty $GitDirty `
        -CommandRecords $commandRecords `
        -CopyRootRecords $copyRootRecords `
        -CopyFileRecords $copyFileRecords
    Write-TextUtf8NoBom -Path $buildInfoPath -Value ($buildInfo + [Environment]::NewLine)
    $buildInfoRecord = New-FileRecord -BasePath $destination -Path $buildInfoPath -Kind "build-info"

    $artifactRecords = @()
    if (-not $NoZip) {
        $artifactRecords += New-ZipPackage -VersionIdValue $VersionIdValue -Destination $destination -PayloadRelativePaths @("web", "packages", "package.json", "package-lock.json", "tsconfig.base.json", "BUILD_INFO.txt")
    }

    $manifest = [ordered]@{
        schemaVersion = 2
        app = "Platform"
        component = "web"
        sourceProject = $Spec["sourceProject"]
        versionId = $VersionIdValue
        builtAt = $builtAt
        gitHead = $GitHead
        gitShortSha = $GitShortSha
        gitDirty = $GitDirty
        profile = "release"
        target = $targetName
        packageRoot = "."
        webDestination = "web"
        commands = $commandRecords
        copyRoots = $copyRootRecords
        copyFiles = $copyFileRecords
        excludedRelativePaths = @($Spec["excludedRelativePaths"])
        buildInfo = $buildInfoRecord
        buildLogs = $buildLogs
        artifacts = $artifactRecords
        checksums = "checksums.sha256"
    }

    $manifestPath = Join-Path $destination "manifest.json"
    Write-TextUtf8NoBom -Path $manifestPath -Value (($manifest | ConvertTo-Json -Depth 12) + [Environment]::NewLine)
    Write-Checksums -Destination $destination

    Write-Host "[release] Platform web artifacts ready: $destination"

    return [ordered]@{
        app = "Platform"
        component = "web"
        destination = $destination
        webDestination = [System.IO.Path]::GetFullPath((Join-Path $destination "web"))
        artifacts = $artifactRecords
        manifest = "manifest.json"
        checksums = "checksums.sha256"
    }
}

if (-not (Test-Path -LiteralPath $platformRoot -PathType Container)) {
    throw "Missing Platform workspace: $platformRoot"
}
if (-not (Test-Path -LiteralPath $webRoot -PathType Container)) {
    throw "Missing Platform Web workspace: $webRoot"
}

$spec = Get-PlatformWebReleaseSpec
$resolvedVersionId = Resolve-VersionId -ExplicitVersionId $VersionId

if ($DryRun) {
    $dryRunPlan = Build-DryRunPlan -Spec $spec -VersionIdValue $resolvedVersionId
    Write-Output ($dryRunPlan | ConvertTo-Json -Depth 12)
    return
}

$gitHead = Get-GitText -Arguments @("rev-parse", "HEAD")
if ([string]::IsNullOrWhiteSpace($gitHead)) {
    $gitHead = "unknown"
}

$gitShortSha = Get-GitText -Arguments @("rev-parse", "--short=8", "HEAD")
if ([string]::IsNullOrWhiteSpace($gitShortSha)) {
    $gitShortSha = "nogit"
}

$gitDirty = Get-GitDirty
New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null

$summary = Invoke-PlatformWebReleaseBuild `
    -Spec $spec `
    -VersionIdValue $resolvedVersionId `
    -GitHead $gitHead `
    -GitShortSha $gitShortSha `
    -GitDirty $gitDirty

[ordered]@{
    schemaVersion = 1
    mode = "build"
    versionId = $resolvedVersionId
    releaseRoot = $releaseRoot
    target = $targetName
    app = $summary
} | ConvertTo-Json -Depth 12
