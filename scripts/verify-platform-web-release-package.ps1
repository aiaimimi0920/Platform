[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$PackageDir
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$packagePath = (Resolve-Path -LiteralPath $PackageDir).Path

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

function Assert-SafeRelativePath {
    param(
        [string]$RelativePath,
        [string]$FieldName,
        [switch]$AllowCurrentDirectory
    )

    $isCurrentDirectory = $RelativePath -eq "."
    if (
        [string]::IsNullOrWhiteSpace($RelativePath) -or
        [System.IO.Path]::IsPathRooted($RelativePath) -or
        $RelativePath -match "(^|[\\/])\.\.([\\/]|$)" -or
        ($isCurrentDirectory -and (-not $AllowCurrentDirectory))
    ) {
        throw "Manifest $FieldName must be a safe package-relative path. Actual=[$RelativePath]"
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

function Assert-PackagePath {
    param(
        [string]$RelativePath,
        [string]$Kind = "Any"
    )

    $path = Join-Path $packagePath $RelativePath
    switch ($Kind) {
        "Leaf" {
            Assert-True (Test-Path -LiteralPath $path -PathType Leaf) "Package file missing: $RelativePath"
        }
        "Container" {
            Assert-True (Test-Path -LiteralPath $path -PathType Container) "Package directory missing: $RelativePath"
        }
        default {
            Assert-True (Test-Path -LiteralPath $path) "Package path missing: $RelativePath"
        }
    }
}

function Test-HashRecord {
    param(
        [string]$RelativePath,
        [string]$ExpectedSha256
    )

    Assert-SafeRelativePath -RelativePath $RelativePath -FieldName "hash record path"
    $path = Join-Path $packagePath $RelativePath
    Assert-True (Test-Path -LiteralPath $path -PathType Leaf) "Package file missing: $RelativePath"
    $actual = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
    Assert-Equal $ExpectedSha256.ToLowerInvariant() $actual "SHA256 mismatch for $RelativePath."
}

function Assert-ZipEntry {
    param(
        [System.IO.Compression.ZipArchive]$Zip,
        [string]$EntryName
    )

    $match = $Zip.Entries | Where-Object { $_.FullName -eq $EntryName } | Select-Object -First 1
    Assert-True ($null -ne $match) "Zip package missing entry: $EntryName"
}

$manifestPath = Join-Path $packagePath "manifest.json"
$checksumsPath = Join-Path $packagePath "checksums.sha256"

Assert-True (Test-Path -LiteralPath $manifestPath -PathType Leaf) "Missing manifest.json in Platform Web package directory."
Assert-True (Test-Path -LiteralPath $checksumsPath -PathType Leaf) "Missing checksums.sha256 in Platform Web package directory."

$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
Assert-Equal 2 $manifest.schemaVersion "Manifest schemaVersion must be 2."
Assert-Equal "Platform" $manifest.app "Manifest app must be Platform."
Assert-Equal "web" $manifest.component "Manifest component must be web."
Assert-Equal "release" $manifest.profile "Manifest profile must be release."
Assert-Equal "web-next" $manifest.target "Manifest target must be web-next."

$manifestPackageRoot = [string]$manifest.packageRoot
$manifestWebDestination = [string]$manifest.webDestination
Assert-SafeRelativePath -RelativePath $manifestPackageRoot -FieldName "packageRoot" -AllowCurrentDirectory
Assert-SafeRelativePath -RelativePath $manifestWebDestination -FieldName "webDestination"
Assert-Equal "." $manifestPackageRoot "Manifest packageRoot must identify the package directory."
Assert-Equal "web" $manifestWebDestination "Manifest webDestination must identify the package-relative web directory."

$commands = @($manifest.commands | ForEach-Object { [string]$_.display })
Assert-Equal "npm run build --workspace @neuro/contracts,npm run build --workspace web" ($commands -join ",") "Manifest must record contracts-before-web build order."

$commandLogs = @($manifest.commands | ForEach-Object { [string]$_.logRelativePath })
Assert-Equal "logs\platform-contracts-build.log,logs\platform-web-build.log" ($commandLogs -join ",") "Manifest must record both Platform Web build logs."

foreach ($command in @($manifest.commands)) {
    Assert-SafeRelativePath -RelativePath ([string]$command.workingDirectory) -FieldName "commands.workingDirectory" -AllowCurrentDirectory
}
foreach ($copyRoot in @($manifest.copyRoots)) {
    Assert-SafeRelativePath -RelativePath ([string]$copyRoot.source) -FieldName "copyRoots.source"
}

Assert-PackagePath -RelativePath "web" -Kind "Container"
Assert-PackagePath -RelativePath "web\src" -Kind "Container"
Assert-PackagePath -RelativePath "web\src\app\ready\route.ts" -Kind "Leaf"
Assert-PackagePath -RelativePath "web\src\app\dashboard\page.tsx" -Kind "Leaf"
Assert-PackagePath -RelativePath "web\public" -Kind "Container"
Assert-PackagePath -RelativePath "web\data" -Kind "Container"
Assert-PackagePath -RelativePath "web\.next\BUILD_ID" -Kind "Leaf"
Assert-PackagePath -RelativePath "web\.next\server" -Kind "Container"
Assert-PackagePath -RelativePath "web\.next\static" -Kind "Container"
Assert-PackagePath -RelativePath "packages\contracts\package.json" -Kind "Leaf"
Assert-PackagePath -RelativePath "packages\contracts\dist" -Kind "Container"
Assert-PackagePath -RelativePath "package.json" -Kind "Leaf"
Assert-PackagePath -RelativePath "package-lock.json" -Kind "Leaf"
Assert-PackagePath -RelativePath "tsconfig.base.json" -Kind "Leaf"
Assert-PackagePath -RelativePath "BUILD_INFO.txt" -Kind "Leaf"
Assert-PackagePath -RelativePath "logs\platform-contracts-build.log" -Kind "Leaf"
Assert-PackagePath -RelativePath "logs\platform-web-build.log" -Kind "Leaf"

foreach ($excludedRelativePath in @(
    "web\node_modules",
    "web\.next\cache",
    "web\.next\dev",
    "web\.next\diagnostics",
    "web\.next\types",
    "web\.next\turbopack",
    "node_modules",
    ".runtime",
    ".tmp"
)) {
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $packagePath $excludedRelativePath))) "Platform Web package contains excluded path: $excludedRelativePath"
}

foreach ($fileRecord in @($manifest.copyFiles)) {
    Test-HashRecord -RelativePath ([string]$fileRecord.path) -ExpectedSha256 ([string]$fileRecord.sha256)
}

if ($manifest.buildInfo) {
    Test-HashRecord -RelativePath ([string]$manifest.buildInfo.path) -ExpectedSha256 ([string]$manifest.buildInfo.sha256)
}

foreach ($log in @($manifest.buildLogs)) {
    Test-HashRecord -RelativePath ([string]$log.path) -ExpectedSha256 ([string]$log.sha256)
}

$zipRecords = @($manifest.artifacts | Where-Object { [string]$_.kind -eq "zip" })
Assert-True ($zipRecords.Count -eq 1) "Manifest must include exactly one Platform Web zip artifact."
$zipRecord = $zipRecords[0]
$zipRelative = [string]$zipRecord.path
Test-HashRecord -RelativePath $zipRelative -ExpectedSha256 ([string]$zipRecord.sha256)

$zipPath = Join-Path $packagePath $zipRelative
$zipShaPath = "$zipPath.sha256"
Assert-True (Test-Path -LiteralPath $zipShaPath -PathType Leaf) "Missing .zip.sha256 sidecar for $zipRelative."
$sidecarParts = ((Get-Content -Raw -LiteralPath $zipShaPath).Trim() -split "\s+", 2)
Assert-True ($sidecarParts.Count -eq 2) "Invalid zip SHA256 sidecar format for $zipRelative."
$expectedZipSha = $sidecarParts[0].Trim().ToLowerInvariant()
Assert-True ($expectedZipSha -match "^[0-9a-f]{64}$") "Zip SHA256 sidecar must contain a 64-character hexadecimal hash for $zipRelative."
$sidecarFileName = $sidecarParts[1].Trim().TrimStart("*")
Assert-Equal ([System.IO.Path]::GetFileName($zipPath)) $sidecarFileName "Zip SHA256 sidecar must name the matching zip artifact."
$actualZipSha = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
Assert-Equal $expectedZipSha $actualZipSha "Zip sidecar SHA256 mismatch for $zipRelative."
$zipSidecarRelative = Get-RelativePath -BasePath $packagePath -Path $zipShaPath
$zipSidecarRecords = @($manifest.artifacts | Where-Object { [string]$_.kind -eq "zip-sha256" })
Assert-True ($zipSidecarRecords.Count -eq 1) "Manifest must include exactly one Platform Web zip SHA256 sidecar artifact."
Assert-Equal $zipSidecarRelative ([string]$zipSidecarRecords[0].path) "Manifest zip SHA256 sidecar path must match the zip sidecar file."
Test-HashRecord -RelativePath $zipSidecarRelative -ExpectedSha256 ([string]$zipSidecarRecords[0].sha256)

Add-Type -AssemblyName System.IO.Compression.FileSystem | Out-Null
$zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
try {
    Assert-ZipEntry -Zip $zip -EntryName "web/src/app/ready/route.ts"
    Assert-ZipEntry -Zip $zip -EntryName "web/src/app/dashboard/page.tsx"
    Assert-ZipEntry -Zip $zip -EntryName "web/.next/BUILD_ID"
    Assert-ZipEntry -Zip $zip -EntryName "packages/contracts/package.json"
    Assert-ZipEntry -Zip $zip -EntryName "packages/contracts/dist/index.js"
    Assert-ZipEntry -Zip $zip -EntryName "package.json"
    Assert-ZipEntry -Zip $zip -EntryName "BUILD_INFO.txt"
} finally {
    $zip.Dispose()
}

$checksumEntries = [System.Collections.Generic.Dictionary[string, string]]::new([System.StringComparer]::OrdinalIgnoreCase)
Get-Content -LiteralPath $checksumsPath | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | ForEach-Object {
    $parts = $_ -split "\s+", 2
    if ($parts.Count -ne 2) {
        throw "Invalid checksums.sha256 line: $_"
    }
    $hash = $parts[0].Trim().ToLowerInvariant()
    $relative = $parts[1].Trim().TrimStart("*")
    if ($hash -notmatch "^[0-9a-f]{64}$") {
        throw "Invalid SHA256 hash in checksums.sha256 line: $_"
    }
    if ([string]::IsNullOrWhiteSpace($relative) -or [System.IO.Path]::IsPathRooted($relative) -or $relative -match "(^|[\\/])\.\.([\\/]|$)") {
        throw "Invalid relative path in checksums.sha256 line: $_"
    }
    if ($checksumEntries.ContainsKey($relative)) {
        throw "Duplicate checksums.sha256 entry: $relative"
    }
    $checksumEntries.Add($relative, $hash)
}

$checksumsFullPath = [System.IO.Path]::GetFullPath($checksumsPath)
$files = Get-ChildItem -LiteralPath $packagePath -Recurse -File |
    Where-Object {
        -not [string]::Equals(
            [System.IO.Path]::GetFullPath($_.FullName),
            $checksumsFullPath,
            [System.StringComparison]::OrdinalIgnoreCase
        )
    } |
    Sort-Object FullName

$fileRelativePaths = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
foreach ($file in $files) {
    $relative = Get-RelativePath -BasePath $packagePath -Path $file.FullName
    $fileRelativePaths.Add($relative) | Out-Null
    Assert-True $checksumEntries.ContainsKey($relative) "checksums.sha256 missing entry for $relative."
    $actual = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    Assert-Equal $checksumEntries[$relative] $actual "checksums.sha256 mismatch for $relative."
}

foreach ($relative in $checksumEntries.Keys) {
    Assert-True $fileRelativePaths.Contains($relative) "checksums.sha256 contains an extra entry: $relative"
}
Assert-Equal $fileRelativePaths.Count $checksumEntries.Count "checksums.sha256 must contain exactly one entry for every package file."

[ordered]@{
    status = "passed"
    packageDir = $packagePath
    versionId = [string]$manifest.versionId
    target = [string]$manifest.target
    webDestination = [string]$manifest.webDestination
    zipArtifacts = @($zipRecords | ForEach-Object { $_.path })
    checksumEntries = $checksumEntries.Count
} | ConvertTo-Json -Depth 6
