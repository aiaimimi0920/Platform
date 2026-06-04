[CmdletBinding()]
param(
    [string]$DashscopeApiKey = "",
    [string]$CodingPlanApiKey = "",
    [string]$Root = "",
    [string]$CredentialName = "manual-live",
    [switch]$Force
)

$ErrorActionPreference = "Stop"

function Resolve-NonEmptyValue {
    param(
        [string[]]$Candidates
    )
    foreach ($candidate in $Candidates) {
        $value = [string]$candidate
        if (-not [string]::IsNullOrWhiteSpace($value)) {
            return $value.Trim()
        }
    }
    return ""
}

function New-CredentialPayload {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ApiKey,
        [Parameter(Mandatory = $true)]
        [string]$CredentialMaterialKey,
        [Parameter(Mandatory = $true)]
        [string]$AccountName
    )
    return [ordered]@{
        apiKey                = $ApiKey
        credentialMaterialKey = $CredentialMaterialKey
        accountName           = $AccountName
    }
}

function Write-CredentialFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [hashtable]$Payload
    )

    $directory = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $directory)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }
    if ((Test-Path -LiteralPath $Path) -and -not $Force.IsPresent) {
        throw "Credential file already exists: $Path. Re-run with -Force to overwrite."
    }
    $json = $Payload | ConvertTo-Json -Depth 6 -Compress
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $json, $utf8NoBom)
}

function Get-CodingPlanDedicatedKeyWarning {
    param(
        [string]$ApiKey
    )
    $value = [string]$ApiKey
    if ([string]::IsNullOrWhiteSpace($value)) {
        return ""
    }
    $normalized = $value.Trim()
    if ($normalized.StartsWith("sk-sp-")) {
        return ""
    }
    if ($normalized.StartsWith("sk-")) {
        return "Coding Plan official keys are currently documented as dedicated `sk-sp-...` keys. The supplied key looks like a generic `sk-...` key and may still be rejected by coding.dashscope.aliyuncs.com."
    }
    return "Coding Plan official keys are currently documented as dedicated `sk-sp-...` keys. The supplied key does not look like that dedicated key shape and may still be rejected by coding.dashscope.aliyuncs.com."
}

$effectiveRoot = Resolve-NonEmptyValue @(
    $Root,
    (Join-Path $env:USERPROFILE ".neuro")
)
if ([string]::IsNullOrWhiteSpace($effectiveRoot)) {
    throw "Could not resolve target root for Qwen credential files."
}

$effectiveDashscopeApiKey = Resolve-NonEmptyValue @(
    $DashscopeApiKey,
    $env:GATEWAY_QWEN_DASHSCOPE_API_KEY,
    $env:QWEN_DASHSCOPE_API_KEY
)
$effectiveCodingPlanApiKey = Resolve-NonEmptyValue @(
    $CodingPlanApiKey,
    $env:GATEWAY_QWEN_CODING_PLAN_API_KEY,
    $env:QWEN_CODING_PLAN_API_KEY
)

if ([string]::IsNullOrWhiteSpace($effectiveDashscopeApiKey) -and [string]::IsNullOrWhiteSpace($effectiveCodingPlanApiKey)) {
    throw "No Qwen official API key material was provided. Set args or env vars first."
}

$codingPlanDedicatedKeyWarning = Get-CodingPlanDedicatedKeyWarning -ApiKey $effectiveCodingPlanApiKey
if (-not [string]::IsNullOrWhiteSpace($codingPlanDedicatedKeyWarning)) {
    Write-Warning $codingPlanDedicatedKeyWarning
}

$written = New-Object System.Collections.Generic.List[string]

if (-not [string]::IsNullOrWhiteSpace($effectiveDashscopeApiKey)) {
    $dashscopePath = Join-Path $effectiveRoot "qwen-platform\\qwen-dashscope-openai\\api-key\\$CredentialName.json"
    Write-CredentialFile -Path $dashscopePath -Payload (New-CredentialPayload -ApiKey $effectiveDashscopeApiKey -CredentialMaterialKey "qwen-official:dashscope" -AccountName "dashscope")
    $written.Add($dashscopePath)
}

if (-not [string]::IsNullOrWhiteSpace($effectiveCodingPlanApiKey)) {
    $codingOpenAiPath = Join-Path $effectiveRoot "qwen-platform\\qwen-coding-plan-openai\\api-key\\$CredentialName.json"
    Write-CredentialFile -Path $codingOpenAiPath -Payload (New-CredentialPayload -ApiKey $effectiveCodingPlanApiKey -CredentialMaterialKey "qwen-official:coding-plan" -AccountName "coding-plan")
    $written.Add($codingOpenAiPath)

    $codingAnthropicPath = Join-Path $effectiveRoot "qwen-platform\\qwen-coding-plan-anthropic\\api-key\\$CredentialName.json"
    Write-CredentialFile -Path $codingAnthropicPath -Payload (New-CredentialPayload -ApiKey $effectiveCodingPlanApiKey -CredentialMaterialKey "qwen-official:coding-plan" -AccountName "coding-plan")
    $written.Add($codingAnthropicPath)
}

Write-Host "Wrote Qwen official credential files:" -ForegroundColor Green
foreach ($path in $written) {
    Write-Host " - $path"
}
