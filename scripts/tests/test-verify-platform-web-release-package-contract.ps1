[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")).Path
$scriptPath = Join-Path $repoRoot "scripts\verify-platform-web-release-package.ps1"
$readmePath = Join-Path $repoRoot "README.md"
$standardPath = Join-Path $repoRoot "docs\40-engineering\platform-release-artifact-standard.md"

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

function Assert-Contains {
    param(
        [string]$Haystack,
        [string]$Needle,
        [string]$Message
    )

    if (-not $Haystack.Contains($Needle)) {
        throw "$Message Missing=[$Needle]"
    }
}

function Write-Text {
    param(
        [string]$Path,
        [string]$Text
    )

    $parent = Split-Path -Parent $Path
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
    [System.IO.File]::WriteAllText($Path, $Text, [System.Text.UTF8Encoding]::new($false))
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

function New-HashRecord {
    param(
        [string]$BasePath,
        [string]$Path,
        [string]$Kind
    )

    $item = Get-Item -LiteralPath $Path
    return [ordered]@{
        kind = $Kind
        name = $item.Name
        path = Get-RelativePath -BasePath $BasePath -Path $Path
        bytes = $item.Length
        sha256 = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
    }
}

function Write-Checksums {
    param([string]$PackageDir)

    $checksumPath = Join-Path $PackageDir "checksums.sha256"
    $lines = @()
    $files = Get-ChildItem -LiteralPath $PackageDir -Recurse -File |
        Where-Object { $_.FullName -ne $checksumPath } |
        Sort-Object FullName

    foreach ($file in $files) {
        $relative = Get-RelativePath -BasePath $PackageDir -Path $file.FullName
        $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        $lines += "$hash  $relative"
    }

    [System.IO.File]::WriteAllText($checksumPath, (($lines -join "`r`n") + "`r`n"), [System.Text.ASCIIEncoding]::new())
}

function New-Zip {
    param(
        [string]$PackageDir,
        [string]$ZipPath
    )

    Add-Type -AssemblyName System.IO.Compression | Out-Null
    Add-Type -AssemblyName System.IO.Compression.FileSystem | Out-Null
    if (Test-Path -LiteralPath $ZipPath) {
        Remove-Item -LiteralPath $ZipPath -Force
    }

    $stream = [System.IO.File]::Open($ZipPath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
    try {
        $archive = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Create, $false)
        try {
            foreach ($relative in @(
                "web\src\app\ready\route.ts",
                "web\src\app\dashboard\page.tsx",
                "web\.next\BUILD_ID",
                "web\.next\server\app\dashboard\page.js",
                "web\.next\static\chunks\app.js",
                "packages\contracts\package.json",
                "packages\contracts\dist\index.js",
                "package.json",
                "package-lock.json",
                "tsconfig.base.json",
                "BUILD_INFO.txt"
            )) {
                $source = Join-Path $PackageDir $relative
                $entry = $relative.Replace("\", "/")
                [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                    $archive,
                    $source,
                    $entry,
                    [System.IO.Compression.CompressionLevel]::Optimal
                ) | Out-Null
            }
        } finally {
            $archive.Dispose()
        }
    } finally {
        $stream.Dispose()
    }
}

Assert-True (Test-Path -LiteralPath $scriptPath -PathType Leaf) "Missing Platform Web release package verifier: $scriptPath"

$script = Get-Content -Raw -LiteralPath $scriptPath
Assert-Contains $script "[string]`$PackageDir" "Verifier must accept a release package directory."
Assert-Contains $script "manifest.json" "Verifier must inspect manifest.json."
Assert-Contains $script "webDestination" "Verifier must validate Platform Web payload location."
Assert-Contains $script "packageRoot" "Verifier must validate the relocatable package root."
Assert-Contains $script "checksums.sha256" "Verifier must validate full release checksums."
Assert-Contains $script ".zip.sha256" "Verifier must validate zip sidecar hashes."
Assert-Contains $script "web\node_modules" "Verifier must reject node_modules in the web payload."
Assert-Contains $script "web\.next\cache" "Verifier must reject Next cache output."
Assert-Contains $script "web\src\app\ready\route.ts" "Verifier must require the Platform Web readiness route used by release runtime smoke."
Assert-Contains $script "packages\contracts\package.json" "Verifier must require @neuro/contracts package metadata."
Assert-Contains $script "web/src/app/ready/route.ts" "Verifier must validate the readiness route inside the zip."
Assert-Contains $script "packages/contracts/package.json" "Verifier must validate @neuro/contracts metadata inside the zip."
Assert-Contains $script "Duplicate checksums.sha256 entry" "Verifier must reject duplicate checksum entries."
Assert-Contains $script "checksums.sha256 must contain exactly one entry" "Verifier must reject extra checksum entries."
Assert-Contains $script "sidecarFileName" "Verifier must bind the zip sidecar to its zip filename."

$tempRoot = Join-Path $env:TEMP ("neuro-platform-web-verify-contract-" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
try {
    $packageDir = Join-Path $tempRoot "Platform\fixture-platform-web"
    New-Item -ItemType Directory -Path $packageDir -Force | Out-Null

    Write-Text -Path (Join-Path $packageDir "web\src\app\dashboard\page.tsx") -Text "export default function Dashboard() { return null; }`n"
    Write-Text -Path (Join-Path $packageDir "web\src\app\ready\route.ts") -Text "export async function GET() { return Response.json({ ok: true, ready: true, service: 'web' }); }`n"
    Write-Text -Path (Join-Path $packageDir "web\public\favicon.ico") -Text "ico`n"
    Write-Text -Path (Join-Path $packageDir "web\data\seed.json") -Text "{}"
    Write-Text -Path (Join-Path $packageDir "web\.next\BUILD_ID") -Text "fixture-build`n"
    Write-Text -Path (Join-Path $packageDir "web\.next\server\app\dashboard\page.js") -Text "module.exports = {};`n"
    Write-Text -Path (Join-Path $packageDir "web\.next\static\chunks\app.js") -Text "console.log('fixture');`n"
    Write-Text -Path (Join-Path $packageDir "packages\contracts\package.json") -Text "{`"name`":`"@neuro/contracts`",`"main`":`"./dist/index.js`"}`n"
    Write-Text -Path (Join-Path $packageDir "packages\contracts\dist\index.js") -Text "exports.ok = true;`n"
    Write-Text -Path (Join-Path $packageDir "package.json") -Text "{`"name`":`"neuroloom-platform`"}`n"
    Write-Text -Path (Join-Path $packageDir "package-lock.json") -Text "{`"lockfileVersion`":3}`n"
    Write-Text -Path (Join-Path $packageDir "tsconfig.base.json") -Text "{}`n"
    Write-Text -Path (Join-Path $packageDir "BUILD_INFO.txt") -Text "Neuro Platform Web release artifact`n"
    Write-Text -Path (Join-Path $packageDir "logs\platform-contracts-build.log") -Text "Exit code: 0`n"
    Write-Text -Path (Join-Path $packageDir "logs\platform-web-build.log") -Text "Exit code: 0`n"

    $zipPath = Join-Path $packageDir "packages\Platform-fixture-platform-web-web-next.zip"
    New-Zip -PackageDir $packageDir -ZipPath $zipPath
    $zipHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
    [System.IO.File]::WriteAllText("$zipPath.sha256", "$zipHash  Platform-fixture-platform-web-web-next.zip`r`n", [System.Text.ASCIIEncoding]::new())

    $manifest = [ordered]@{
        schemaVersion = 2
        app = "Platform"
        component = "web"
        versionId = "fixture-platform-web"
        profile = "release"
        target = "web-next"
        packageRoot = "."
        webDestination = "web"
        commands = @(
            [ordered]@{ display = "npm run build --workspace @neuro/contracts"; workingDirectory = "."; logRelativePath = "logs\platform-contracts-build.log" },
            [ordered]@{ display = "npm run build --workspace web"; workingDirectory = "."; logRelativePath = "logs\platform-web-build.log" }
        )
        copyRoots = @(
            [ordered]@{ source = "web\src"; destinationRelativePath = "web\src" },
            [ordered]@{ source = "web\public"; destinationRelativePath = "web\public" },
            [ordered]@{ source = "web\data"; destinationRelativePath = "web\data" },
            [ordered]@{ source = "web\.next\server"; destinationRelativePath = "web\.next\server" },
            [ordered]@{ source = "web\.next\static"; destinationRelativePath = "web\.next\static" },
            [ordered]@{ source = "packages\contracts\dist"; destinationRelativePath = "packages\contracts\dist" }
        )
        copyFiles = @(
            New-HashRecord -BasePath $packageDir -Path (Join-Path $packageDir "package.json") -Kind "workspace-package-json"
            New-HashRecord -BasePath $packageDir -Path (Join-Path $packageDir "package-lock.json") -Kind "workspace-lockfile"
            New-HashRecord -BasePath $packageDir -Path (Join-Path $packageDir "tsconfig.base.json") -Kind "workspace-config"
            New-HashRecord -BasePath $packageDir -Path (Join-Path $packageDir "packages\contracts\package.json") -Kind "workspace-package-json"
            New-HashRecord -BasePath $packageDir -Path (Join-Path $packageDir "web\.next\BUILD_ID") -Kind "next-build-file"
        )
        buildInfo = New-HashRecord -BasePath $packageDir -Path (Join-Path $packageDir "BUILD_INFO.txt") -Kind "build-info"
        buildLogs = @(
            New-HashRecord -BasePath $packageDir -Path (Join-Path $packageDir "logs\platform-contracts-build.log") -Kind "build-log"
            New-HashRecord -BasePath $packageDir -Path (Join-Path $packageDir "logs\platform-web-build.log") -Kind "build-log"
        )
        artifacts = @(
            New-HashRecord -BasePath $packageDir -Path $zipPath -Kind "zip"
            New-HashRecord -BasePath $packageDir -Path "$zipPath.sha256" -Kind "zip-sha256"
        )
        excludedRelativePaths = @(
            "web\node_modules",
            "web\.next\cache",
            "web\.next\dev",
            "web\.next\diagnostics",
            "web\.next\types",
            "web\.next\turbopack",
            "node_modules",
            ".runtime",
            ".tmp"
        )
        checksums = "checksums.sha256"
    }
    Write-Text -Path (Join-Path $packageDir "manifest.json") -Text (($manifest | ConvertTo-Json -Depth 12) + "`n")
    Write-Checksums -PackageDir $packageDir

    $output = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $scriptPath -PackageDir $packageDir 2>&1
    $exitCode = $LASTEXITCODE
    Assert-Equal 0 $exitCode "Verifier failed against fixture package. Output: $($output -join [Environment]::NewLine)"
    $result = ($output -join [Environment]::NewLine) | ConvertFrom-Json
    Assert-Equal "passed" $result.status "Verifier must emit passed status for a valid fixture."
    Assert-Equal "fixture-platform-web" $result.versionId "Verifier must preserve the manifest version id."
    Assert-Equal "web-next" $result.target "Verifier must preserve the Platform Web target."

    $relocatedPackageDir = Join-Path $tempRoot "relocated\renamed-platform-package"
    New-Item -ItemType Directory -Path (Split-Path -Parent $relocatedPackageDir) -Force | Out-Null
    Copy-Item -LiteralPath $packageDir -Destination $relocatedPackageDir -Recurse -Force
    $relocatedOutput = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $scriptPath -PackageDir $relocatedPackageDir 2>&1
    $relocatedExitCode = $LASTEXITCODE
    Assert-Equal 0 $relocatedExitCode "Verifier must accept a package moved after build. Output: $($relocatedOutput -join [Environment]::NewLine)"
    $relocatedResult = ($relocatedOutput -join [Environment]::NewLine) | ConvertFrom-Json
    Assert-Equal "passed" $relocatedResult.status "Relocated package verification must emit passed status."

    $unsafeManifestPath = Join-Path $relocatedPackageDir "manifest.json"
    $unsafeManifest = Get-Content -Raw -LiteralPath $unsafeManifestPath | ConvertFrom-Json
    $unsafeManifest.webDestination = [System.IO.Path]::GetFullPath((Join-Path $relocatedPackageDir "web"))
    Write-Text -Path $unsafeManifestPath -Text (($unsafeManifest | ConvertTo-Json -Depth 12) + [Environment]::NewLine)
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        $unsafeOutput = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $scriptPath -PackageDir $relocatedPackageDir 2>&1
        $unsafeExitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    Assert-True ($unsafeExitCode -ne 0) "Verifier must reject an absolute webDestination."
    Assert-Contains ($unsafeOutput -join [Environment]::NewLine) "safe package-relative path" "Verifier failure must explain unsafe manifest paths."

    $unsafeManifest.webDestination = "web"
    $unsafeManifest.copyFiles[0].path = "..\outside-package.json"
    Write-Text -Path $unsafeManifestPath -Text (($unsafeManifest | ConvertTo-Json -Depth 12) + [Environment]::NewLine)
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        $escapedPathOutput = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $scriptPath -PackageDir $relocatedPackageDir 2>&1
        $escapedPathExitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    Assert-True ($escapedPathExitCode -ne 0) "Verifier must reject hash records that escape the package directory."
    Assert-Contains ($escapedPathOutput -join [Environment]::NewLine) "safe package-relative path" "Verifier failure must explain escaped hash record paths."

    New-Item -ItemType Directory -Path (Join-Path $packageDir "web\node_modules") -Force | Out-Null
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        $badOutput = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $scriptPath -PackageDir $packageDir 2>&1
        $badExitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    Assert-True ($badExitCode -ne 0) "Verifier must fail when excluded web node_modules exists."
    Assert-Contains ($badOutput -join [Environment]::NewLine) "excluded path" "Verifier failure must explain excluded path violations."

    Remove-Item -LiteralPath (Join-Path $packageDir "web\node_modules") -Recurse -Force
    $checksumLines = Get-Content -LiteralPath (Join-Path $packageDir "checksums.sha256")
    $firstChecksum = [string]$checksumLines[0]
    $firstHash = ($firstChecksum -split "\s+", 2)[0]
    [System.IO.File]::AppendAllText(
        (Join-Path $packageDir "checksums.sha256"),
        "$firstHash  unexpected.txt`r`n",
        [System.Text.ASCIIEncoding]::new()
    )
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        $extraOutput = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $scriptPath -PackageDir $packageDir 2>&1
        $extraExitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    Assert-True ($extraExitCode -ne 0) "Verifier must fail when checksums.sha256 contains an extra entry."
    Assert-Contains ($extraOutput -join [Environment]::NewLine) "extra entry" "Verifier failure must explain extra checksum entries."
} finally {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
}

$readme = Get-Content -Raw -LiteralPath $readmePath
Assert-Contains $readme "scripts\verify-platform-web-release-package.ps1 -PackageDir" "README must document the Platform Web release package verifier."

$standard = Get-Content -Raw -LiteralPath $standardPath
Assert-Contains $standard "verify-platform-web-release-package.ps1" "Release standard must document the Platform Web verifier."

Write-Host "Platform Web release package verifier contract passed."
$global:LASTEXITCODE = 0
