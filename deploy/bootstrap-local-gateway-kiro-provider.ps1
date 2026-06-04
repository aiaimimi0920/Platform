param(
  [Parameter(Mandatory = $false)]
  [string]$Label = "Local Kiro Provider",
  [Parameter(Mandatory = $false)]
  [string]$Alias = "kiro-claude-sonnet-4-6",
  [Parameter(Mandatory = $false)]
  [string]$DefaultModel = "claude-sonnet-4.6",
  [Parameter(Mandatory = $false)]
  [string]$BaseUrl = "https://q.us-east-1.amazonaws.com",
  [Parameter(Mandatory = $false)]
  [string]$ResponsesPath = "/generateAssistantResponse",
  [Parameter(Mandatory = $false)]
  [string]$AccessToken = "",
  [Parameter(Mandatory = $false)]
  [string]$RefreshToken = "",
  [ValidateSet("social", "idc")]
  [string]$AuthMethod = "social",
  [string]$AuthRegion = "us-east-1",
  [string]$ApiRegion = "us-east-1",
  [string]$ClientId = "",
  [string]$ClientSecret = "",
  [string]$MachineId = "",
  [string]$ProfileArn = "",
  [string]$KiroVersion = "0.11.107",
  [string]$SystemVersion = "win32#10.0.22631",
  [string]$NodeVersion = "22.22.0",
  [string]$KeepaliveServiceUrl = "http://gateway:4200",
  [string]$KeepaliveEnsurePath = "/v1/internal/credentials/ensure",
  [int]$KeepaliveTimeoutSecs = 20,
  [int]$RefreshBeforeSecs = 300,
  [string]$SourceNotes = "bootstrap-local-gateway-kiro-provider.ps1",
  [string]$GatewayBaseUrl = "http://127.0.0.1:4226",
  [string]$ManagementToken = "local-internal-token",
  [string]$AccountApiBaseUrl = "",
  [string]$OperatorUserId = "02a2ad31-80a0-458d-a9d4-68cca97d6275",
  [string]$OperatorProviderUserId = "local-dev-account",
  [string]$InternalApiToken = "local-internal-token"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $RefreshToken.Trim() -and -not $AccessToken.Trim()) {
  throw "At least one of -RefreshToken or -AccessToken must be provided."
}

if ($AuthMethod -eq "idc") {
  if (-not $ClientId.Trim()) {
    throw "-ClientId is required when -AuthMethod idc."
  }
  if (-not $ClientSecret.Trim()) {
    throw "-ClientSecret is required when -AuthMethod idc."
  }
}

if (-not $Alias.Trim() -and $DefaultModel.Trim()) {
  $Alias = $DefaultModel.Trim()
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

$providerAccountsResponse = Invoke-RestMethod `
  -Method Get `
  -Uri "$gatewayRoot/v1/internal/gateway/provider-accounts" `
  -Headers $commonHeaders

$existingProvider = @($providerAccountsResponse.providerAccounts | Where-Object { $_.label -eq $Label }) | Select-Object -First 1

$extraBody = [ordered]@{}
if ($RefreshToken.Trim()) {
  $extraBody.kiroRefreshToken = $RefreshToken.Trim()
}
if ($AuthMethod.Trim()) {
  $extraBody.kiroAuthMethod = $AuthMethod.Trim()
}
if ($AuthRegion.Trim()) {
  $extraBody.kiroAuthRegion = $AuthRegion.Trim()
}
if ($ApiRegion.Trim()) {
  $extraBody.kiroApiRegion = $ApiRegion.Trim()
}
if ($ClientId.Trim()) {
  $extraBody.kiroClientId = $ClientId.Trim()
}
if ($ClientSecret.Trim()) {
  $extraBody.kiroClientSecret = $ClientSecret.Trim()
}
if ($MachineId.Trim()) {
  $extraBody.kiroMachineId = $MachineId.Trim()
}
if ($ProfileArn.Trim()) {
  $extraBody.kiroProfileArn = $ProfileArn.Trim()
  $extraBody.profileArn = $ProfileArn.Trim()
}
if ($KiroVersion.Trim()) {
  $extraBody.kiroVersion = $KiroVersion.Trim()
}
if ($SystemVersion.Trim()) {
  $extraBody.kiroSystemVersion = $SystemVersion.Trim()
}
if ($NodeVersion.Trim()) {
  $extraBody.kiroNodeVersion = $NodeVersion.Trim()
}

$providerBodyObject = [ordered]@{
  label = $Label
  adapter = "kiro_compatible"
  protocolFamily = "kiro"
  status = "active"
  sourceKind = "official_vendor_api"
  sourceNotes = if ($SourceNotes.Trim()) { $SourceNotes.Trim() } else { $null }
  executionMode = "direct_http"
  payload = [ordered]@{
    adapter = "kiro_compatible"
    baseUrl = $BaseUrl.TrimEnd("/")
    accountLabel = $Label
    apiKey = if ($AccessToken.Trim()) { $AccessToken.Trim() } else { "" }
    defaultModel = if ($DefaultModel.Trim()) { $DefaultModel.Trim() } else { $null }
    responsesPath = if ($ResponsesPath.Trim()) { $ResponsesPath.Trim() } else { $null }
    sessionAuth = @{
      transport = "bearer"
      headerName = "authorization"
    }
    keepalive = @{
      serviceUrl = $KeepaliveServiceUrl.TrimEnd("/")
      ensurePath = if ($KeepaliveEnsurePath.Trim()) { $KeepaliveEnsurePath.Trim() } else { $null }
      authToken = if ($InternalApiToken.Trim()) { $InternalApiToken.Trim() } else { $null }
      timeoutSecs = $KeepaliveTimeoutSecs
      refreshBeforeSecs = $RefreshBeforeSecs
    }
    extraBody = if ($extraBody.Count -gt 0) { $extraBody } else { $null }
  }
}

$providerBody = $providerBodyObject | ConvertTo-Json -Depth 10

if ($existingProvider) {
  $providerResponse = Invoke-RestMethod `
    -Method Post `
    -Uri "$gatewayRoot/v1/internal/gateway/provider-accounts/$($existingProvider.id)" `
    -Headers $commonHeaders `
    -Body $providerBody
  $providerAccount = $providerResponse.providerAccount
  $providerAction = "updated"
}
else {
  $providerResponse = Invoke-RestMethod `
    -Method Post `
    -Uri "$gatewayRoot/v1/internal/gateway/provider-accounts" `
    -Headers $commonHeaders `
    -Body $providerBody
  $providerAccount = $providerResponse.providerAccount
  $providerAction = "created"
}

$modelAlias = $null
if ($Alias.Trim()) {
  $modelAliasesResponse = Invoke-RestMethod `
    -Method Get `
    -Uri "$gatewayRoot/v1/internal/gateway/model-aliases" `
    -Headers $commonHeaders
  $existingAlias = @($modelAliasesResponse.modelAliases | Where-Object { $_.alias -eq $Alias }) | Select-Object -First 1
  $aliasBodyObject = @{
    projectId = $null
    alias = $Alias.Trim()
    providerAccountId = $providerAccount.id
    upstreamModel = if ($DefaultModel.Trim()) { $DefaultModel.Trim() } else { $null }
    priority = 100
    weight = 1
    enabled = $true
  }
  $aliasBody = $aliasBodyObject | ConvertTo-Json -Depth 8

  if ($existingAlias) {
    $aliasResponse = Invoke-RestMethod `
      -Method Post `
      -Uri "$gatewayRoot/v1/internal/gateway/model-aliases/$($existingAlias.id)" `
      -Headers $commonHeaders `
      -Body $aliasBody
    $modelAlias = $aliasResponse.modelAlias
  }
  else {
    $aliasResponse = Invoke-RestMethod `
      -Method Post `
      -Uri "$gatewayRoot/v1/internal/gateway/model-aliases" `
      -Headers $commonHeaders `
      -Body $aliasBody
    $modelAlias = $aliasResponse.modelAlias
  }
}

Write-Output "PROVIDER_ACTION=$providerAction"
Write-Output "PROVIDER_ACCOUNT_ID=$($providerAccount.id)"
Write-Output "PROVIDER_LABEL=$($providerAccount.label)"
Write-Output "PROTOCOL_FAMILY=kiro"
Write-Output "ADAPTER=kiro_compatible"
Write-Output "DEFAULT_MODEL=$DefaultModel"
Write-Output "KEEPALIVE_SERVICE_URL=$KeepaliveServiceUrl"
Write-Output "MODEL_ALIAS_ID=$(if ($modelAlias) { $modelAlias.id } else { '' })"
Write-Output "MODEL_ALIAS=$(if ($modelAlias) { $modelAlias.alias } else { '' })"
