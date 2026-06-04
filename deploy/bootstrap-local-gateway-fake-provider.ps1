param(
  [string]$Alias = "ui-test-model",
  [string]$DefaultModel = "ui-test-model",
  [string]$Label = "Local Fake UI Provider",
  [string]$BaseUrl = "http://local-fake-provider.invalid",
  [string]$GatewayBaseUrl = "http://127.0.0.1:4226",
  [string]$ManagementToken = "local-internal-token",
  [string]$AccountApiBaseUrl = "",
  [string]$OperatorUserId = "02a2ad31-80a0-458d-a9d4-68cca97d6275",
  [string]$OperatorProviderUserId = "local-dev-account",
  [string]$InternalApiToken = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

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

$providerAccountsResponse = Invoke-RestMethod `
  -Method Get `
  -Uri "$gatewayRoot/v1/internal/gateway/provider-accounts" `
  -Headers $commonHeaders

$providerAccount = @($providerAccountsResponse.providerAccounts | Where-Object { $_.label -eq $Label }) | Select-Object -First 1

if (-not $providerAccount) {
  $providerPayload = @{
    label = $Label
    adapter = "custom_http"
    protocolFamily = "openai"
    status = "active"
    sourceKind = "aggregator_api"
    aggregatorApiMode = "hosted_compute"
    executionMode = "direct_http"
    payload = @{
      adapter = "custom_http"
      provider = "local-fake"
      baseUrl = $BaseUrl
      accountLabel = $Label
      authHeaderName = "Authorization"
      authToken = "Bearer local-fake-token"
      defaultModel = $DefaultModel
    }
  } | ConvertTo-Json -Depth 8

  $providerCreateResponse = Invoke-RestMethod `
    -Method Post `
    -Uri "$gatewayRoot/v1/internal/gateway/provider-accounts" `
    -Headers $commonHeaders `
    -Body $providerPayload

  $providerAccount = $providerCreateResponse.providerAccount
}

$modelAliasesResponse = Invoke-RestMethod `
  -Method Get `
  -Uri "$gatewayRoot/v1/internal/gateway/model-aliases" `
  -Headers $commonHeaders
$modelAlias = @($modelAliasesResponse.modelAliases | Where-Object { $_.alias -eq $Alias }) | Select-Object -First 1

if (-not $modelAlias) {
  $aliasPayload = @{
    projectId = $null
    alias = $Alias
    providerAccountId = $providerAccount.id
    upstreamModel = $DefaultModel
    priority = 100
    weight = 1
    enabled = $true
  } | ConvertTo-Json -Depth 6

  $aliasCreateResponse = Invoke-RestMethod `
    -Method Post `
    -Uri "$gatewayRoot/v1/internal/gateway/model-aliases" `
    -Headers $commonHeaders `
    -Body $aliasPayload

  $modelAlias = $aliasCreateResponse.modelAlias
}

Write-Output "PROVIDER_ACCOUNT_ID=$($providerAccount.id)"
Write-Output "PROVIDER_LABEL=$($providerAccount.label)"
Write-Output "MODEL_ALIAS_ID=$($modelAlias.id)"
Write-Output "MODEL_ALIAS=$($modelAlias.alias)"
Write-Output "DEFAULT_MODEL=$DefaultModel"
