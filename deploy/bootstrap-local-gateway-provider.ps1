param(
  [Parameter(Mandatory = $true)]
  [string]$BaseUrl,
  [string]$DefaultModel = "",
  [string]$ApiKey,
  [string[]]$ApiKeys = @(),
  [string]$Alias,
  [string]$Label = "Local OpenAI Provider",
  [ValidateSet("official_model_api", "official_vendor_api", "aggregator_api", "web_reverse_api")]
  [string]$SourceKind = "aggregator_api",
  [ValidateSet("", "hosted_compute", "upstream_forward")]
  [string]$AggregatorApiMode = "hosted_compute",
  [ValidateSet("", "direct_http_replay", "browser_challenge")]
  [string]$WebReverseAccessMode = "",
  [ValidateSet("round-robin", "random")]
  [string]$KeySelectionStrategy = "round-robin",
  [string]$SourceNotes = "",
  [string]$GatewayBaseUrl = "http://127.0.0.1:4226",
  [string]$ManagementToken = "local-internal-token",
  [string]$AccountApiBaseUrl = "",
  [string]$OperatorUserId = "02a2ad31-80a0-458d-a9d4-68cca97d6275",
  [string]$OperatorProviderUserId = "local-dev-account",
  [string]$InternalApiToken = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $Alias.Trim() -and $DefaultModel.Trim()) {
  $Alias = $DefaultModel
}

$normalizedKeys = @()
if ($ApiKey) {
  $normalizedKeys += $ApiKey
}
if ($ApiKeys) {
  $normalizedKeys += $ApiKeys
}

$allApiKeys = @(
  $normalizedKeys |
    Where-Object { $_ -and $_.Trim() } |
    ForEach-Object { $_.Trim() } |
    Select-Object -Unique
)

if ($allApiKeys.Count -eq 0) {
  throw "At least one API key must be provided via -ApiKey or -ApiKeys."
}

$primaryApiKey = $allApiKeys[0]
$secondaryApiKeys = @()
if ($allApiKeys.Count -gt 1) {
  $secondaryApiKeys = @($allApiKeys | Select-Object -Skip 1)
}

$gatewayRoot = $(if ($GatewayBaseUrl.Trim()) { $GatewayBaseUrl } else { $AccountApiBaseUrl }).TrimEnd("/")
if (-not $gatewayRoot) {
  throw "Gateway base URL is required via -GatewayBaseUrl."
}

$commonHeaders = @{
  "content-type" = "application/json"
}

if ($ManagementToken.Trim()) {
  $commonHeaders["x-management-token"] = $ManagementToken.Trim()
}
if ($OperatorUserId.Trim()) {
  $commonHeaders["x-operator-user-id"] = $OperatorUserId.Trim()
  $commonHeaders["x-user-id"] = $OperatorUserId.Trim()
}
if ($OperatorProviderUserId.Trim()) {
  $commonHeaders["x-provider-user-id"] = $OperatorProviderUserId.Trim()
}
if ($InternalApiToken.Trim()) {
  $commonHeaders["x-internal-api-token"] = $InternalApiToken.Trim()
}

$providerPayload = @{
  label = $Label
  adapter = "openai_compatible"
  protocolFamily = "openai"
  status = "active"
  sourceKind = $SourceKind
  aggregatorApiMode = if ($SourceKind -eq "aggregator_api" -and $AggregatorApiMode) { $AggregatorApiMode } else { $null }
  webReverseAccessMode = if ($SourceKind -eq "web_reverse_api" -and $WebReverseAccessMode) { $WebReverseAccessMode } else { $null }
  sourceNotes = if ($SourceNotes.Trim()) { $SourceNotes.Trim() } else { $null }
  executionMode = "direct_http"
  payload = @{
    adapter = "openai_compatible"
    baseUrl = $BaseUrl.TrimEnd("/")
    accountLabel = $Label
    apiKey = $primaryApiKey
    apiKeys = if ($secondaryApiKeys.Count -gt 0) { $secondaryApiKeys } else { $null }
    keySelectionStrategy = if ($secondaryApiKeys.Count -gt 0) { $KeySelectionStrategy } else { $null }
    authMode = "bearer"
    defaultModel = if ($DefaultModel.Trim()) { $DefaultModel.Trim() } else { $null }
  }
} | ConvertTo-Json -Depth 8

$providerResponse = Invoke-RestMethod `
  -Method Post `
  -Uri "$gatewayRoot/v1/internal/gateway/provider-accounts" `
  -Headers $commonHeaders `
  -Body $providerPayload

$providerAccountId = $providerResponse.providerAccount.id
if (-not $providerAccountId) {
  throw "Provider account create returned no id."
}

Write-Output "PROVIDER_ACCOUNT_ID=$providerAccountId"

if ($DefaultModel.Trim()) {
  $aliasPayload = @{
    projectId = $null
    alias = $Alias
    providerAccountId = $providerAccountId
    upstreamModel = $DefaultModel.Trim()
    priority = 100
    weight = 1
    enabled = $true
  } | ConvertTo-Json -Depth 6

  $aliasResponse = Invoke-RestMethod `
    -Method Post `
    -Uri "$gatewayRoot/v1/internal/gateway/model-aliases" `
    -Headers $commonHeaders `
    -Body $aliasPayload

  Write-Output "MODEL_ALIAS_ID=$($aliasResponse.modelAlias.id)"
  Write-Output "MODEL_ALIAS=$($aliasResponse.modelAlias.alias)"
} else {
  Write-Output "MODEL_ALIAS_ID="
  Write-Output "MODEL_ALIAS="
}
