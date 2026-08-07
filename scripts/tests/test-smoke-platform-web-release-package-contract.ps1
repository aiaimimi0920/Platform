[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")).Path
$scriptPath = Join-Path $repoRoot "scripts\smoke-platform-web-release-package.ps1"
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

Assert-True (Test-Path -LiteralPath $scriptPath -PathType Leaf) "Missing Platform Web release runtime smoke script: $scriptPath"

$script = Get-Content -Raw -LiteralPath $scriptPath
Assert-Contains $script "[Parameter(Mandatory = `$true)]" "Smoke script must require an explicit release package directory."
Assert-Contains $script "[string]`$PackageDir" "Smoke script must accept -PackageDir."
Assert-Contains $script "[int]`$Port = 0" "Smoke script must support dynamic loopback port allocation by default."
Assert-Contains $script "[switch]`$KeepArtifacts" "Smoke script must support keeping extracted artifacts for debugging."
Assert-Contains $script "[switch]`$SkipInstall" "Smoke script must support skipping dependency installation for already-prepared extracts."
Assert-Contains $script "verify-platform-web-release-package.ps1" "Smoke script must validate the release package before extraction."
Assert-Contains $script "function Expand-ZipPackage" "Smoke script must extract the zip into an isolated runtime directory."
Assert-Contains $script "ExtractToDirectory" "Smoke script must use the faster .NET zip extraction path for large Next release archives."
Assert-Contains $script "npm ci --omit=dev" "Smoke script must install production dependencies from the extracted package by default."
Assert-Contains $script "npm run start --workspace web" "Smoke script must start the extracted Next workspace."
Assert-Contains $script "/ready" "Smoke script must probe the lightweight Platform Web readiness route."
Assert-Contains $script "Stop-SpawnedProcessTree" "Smoke script must clean up only the process tree it spawned."
Assert-Contains $script "Test-PortAvailable" "Smoke script must reject or allocate ports before starting Next."
Assert-Contains $script "smokeEvidence" "Smoke script must write JSON evidence for the runtime smoke."
Assert-Contains $script "evidenceLogsDir" "Smoke script must persist runtime logs beside the JSON evidence."
Assert-Contains $script "Copy-SmokeLogsToEvidence" "Smoke script must copy temp install/start logs before deleting extracted artifacts."

$readme = Get-Content -Raw -LiteralPath $readmePath
$standard = Get-Content -Raw -LiteralPath $standardPath
$expectedCommand = ".\scripts\smoke-platform-web-release-package.ps1 -PackageDir .\release\Platform\<versionId>"
Assert-Contains $readme $expectedCommand "README must document the Platform Web release runtime smoke command."
Assert-Contains $standard $expectedCommand "Release artifact standard must document the Platform Web release runtime smoke command."

Write-Host "Platform Web release runtime smoke contract passed."
