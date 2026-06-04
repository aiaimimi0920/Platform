param(
  [Parameter(Mandatory = $false)]
  [string]$Label = "Local FreeBuff Provider",
  [Parameter(Mandatory = $false)]
  [string]$CredentialLabel = "Local FreeBuff Credential",
  [Parameter(Mandatory = $false)]
  [string]$Alias = "freebuff-glm-5-1",
  [Parameter(Mandatory = $false)]
  [string]$DefaultModel = "z-ai/glm-5.1",
  [Parameter(Mandatory = $false)]
  [string]$BaseUrl = "https://www.codebuff.com",
  [Parameter(Mandatory = $false)]
  [string]$ChatCompletionsPath = "/api/v1/chat/completions",
  [Parameter(Mandatory = $false)]
  [string]$AgentRunsPath = "/api/v1/agent-runs",
  [Parameter(Mandatory = $false)]
  [string]$SessionPath = "/api/v1/freebuff/session",
  [Parameter(Mandatory = $false)]
  [string]$AuthToken = "",
  [Parameter(Mandatory = $false)]
  [string]$AgentId = "",
  [Parameter(Mandatory = $false)]
  [string]$ModelAgentMapJson = "",
  [Parameter(Mandatory = $false)]
  [int]$RunRotationSecs = 21600,
  [Parameter(Mandatory = $false)]
  [int]$SessionPollIntervalMs = 1000,
  [Parameter(Mandatory = $false)]
  [int]$SessionPollTimeoutMs = 15000,
  [Parameter(Mandatory = $false)]
  [string]$CostMode = "free",
  [Parameter(Mandatory = $false)]
  [string]$UserAgent = "ai-sdk/openai-compatible/1.0.25/codebuff",
  [Parameter(Mandatory = $false)]
  [string]$SourceNotes = "bootstrap-local-gateway-freebuff-provider.ps1",
  [Parameter(Mandatory = $false)]
  [string]$GatewayBaseUrl = "http://127.0.0.1:4226",
  [Parameter(Mandatory = $false)]
  [string]$ManagementToken = "local-internal-token"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $AuthToken.Trim()) {
  throw "-AuthToken is required."
}

if (-not $AgentId.Trim() -and -not $ModelAgentMapJson.Trim()) {
  throw "Either -AgentId or -ModelAgentMapJson must be provided."
}

if (-not $CredentialLabel.Trim()) {
  $CredentialLabel = "$($Label.Trim()) Credential"
}

if (-not $Alias.Trim() -and $DefaultModel.Trim()) {
  $Alias = $DefaultModel.Trim()
}

$gatewayRoot = $GatewayBaseUrl.TrimEnd("/")
$commonHeaders = @{
  "content-type" = "application/json"
}

if ($ManagementToken.Trim()) {
  $commonHeaders["x-management-token"] = $ManagementToken.Trim()
}

function Invoke-JsonGet {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Uri
  )

  return Invoke-RestMethod -Method Get -Uri $Uri -Headers $commonHeaders
}

function Invoke-JsonPost {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Uri,
    [Parameter(Mandatory = $true)]
    [object]$BodyObject
  )

  $json = $BodyObject | ConvertTo-Json -Depth 20 -Compress
  return Invoke-RestMethod -Method Post -Uri $Uri -Headers $commonHeaders -Body $json
}

function Invoke-JsonPut {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Uri,
    [Parameter(Mandatory = $true)]
    [object]$BodyObject
  )

  $json = $BodyObject | ConvertTo-Json -Depth 20 -Compress
  return Invoke-RestMethod -Method Put -Uri $Uri -Headers $commonHeaders -Body $json
}

function New-SourcePathSegment {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Value
  )

  $normalized = ($Value.Trim().ToLowerInvariant() -replace "[^a-z0-9._-]", "-").Trim("-")
  if (-not $normalized) {
    return "freebuff-credential"
  }
  return $normalized
}

$providerAccounts = (Invoke-JsonGet "$gatewayRoot/v1/internal/gateway/provider-accounts").providerAccounts
$existingProvider = @($providerAccounts | Where-Object { $_.label -eq $Label.Trim() }) | Select-Object -First 1

$extraBody = [ordered]@{
  freebuffAgentRunsPath = $AgentRunsPath.Trim()
  freebuffSessionPath = $SessionPath.Trim()
  freebuffRunRotationSecs = [Math]::Max($RunRotationSecs, 60)
  freebuffSessionPollIntervalMs = [Math]::Max($SessionPollIntervalMs, 250)
  freebuffSessionPollTimeoutMs = [Math]::Max($SessionPollTimeoutMs, [Math]::Max($SessionPollIntervalMs, 250))
  freebuffCostMode = $CostMode.Trim()
  freebuffUserAgent = $UserAgent.Trim()
}

if ($AgentId.Trim()) {
  $extraBody.freebuffAgentId = $AgentId.Trim()
}

if ($ModelAgentMapJson.Trim()) {
  try {
    $modelAgentMap = $ModelAgentMapJson | ConvertFrom-Json
  }
  catch {
    throw "Failed to parse -ModelAgentMapJson as JSON: $($_.Exception.Message)"
  }
  $extraBody.freebuffModelAgentMap = $modelAgentMap
}

$providerBody = [ordered]@{
  label = $Label.Trim()
  serviceProviderKey = "freebuff"
  serviceProviderLabel = "FreeBuff"
  adapter = "freebuff_compatible"
  protocolFamily = "freebuff"
  status = "active"
  sourceKind = "web_reverse_api"
  webReverseAccessMode = "direct_http_replay"
  sourceNotes = if ($SourceNotes.Trim()) { $SourceNotes.Trim() } else { $null }
  executionMode = "direct_http"
  payload = [ordered]@{
    adapter = "freebuff_compatible"
    baseUrl = $BaseUrl.TrimEnd("/")
    apiKey = ""
    accountLabel = $Label.Trim()
    defaultModel = if ($DefaultModel.Trim()) { $DefaultModel.Trim() } else { $null }
    chatCompletionsPath = if ($ChatCompletionsPath.Trim()) { $ChatCompletionsPath.Trim() } else { $null }
    extraBody = $extraBody
  }
}

if ($existingProvider) {
  $providerAccount = (Invoke-JsonPost "$gatewayRoot/v1/internal/gateway/provider-accounts/$($existingProvider.id)" $providerBody).providerAccount
  $providerAction = "updated"
}
else {
  $providerAccount = (Invoke-JsonPost "$gatewayRoot/v1/internal/gateway/provider-accounts" $providerBody).providerAccount
  $providerAction = "created"
}

$credentialList = (Invoke-JsonGet "$gatewayRoot/v1/internal/gateway/provider-accounts/$($providerAccount.id)/credentials?maskSecrets=false").credentials
$existingCredential = @($credentialList | Where-Object { $_.label -eq $CredentialLabel.Trim() }) | Select-Object -First 1
$sourcePath = "manual/freebuff/$([string](New-SourcePathSegment -Value $CredentialLabel)).json"

$credentialBody = [ordered]@{
  label = $CredentialLabel.Trim()
  status = "active"
  payload = [ordered]@{
    apiKey = $AuthToken.Trim()
  }
  sourceKind = "manual"
  sourcePath = $sourcePath
}

if ($existingCredential) {
  $providerCredential = (Invoke-JsonPut "$gatewayRoot/v1/internal/gateway/provider-credentials/$($existingCredential.id)" $credentialBody).providerCredential
  $credentialAction = "updated"
}
else {
  $providerCredential = (Invoke-JsonPost "$gatewayRoot/v1/internal/gateway/provider-accounts/$($providerAccount.id)/credentials" $credentialBody).providerCredential
  $credentialAction = "created"
}

$modelAlias = $null
if ($Alias.Trim()) {
  $modelAliases = (Invoke-JsonGet "$gatewayRoot/v1/internal/gateway/model-aliases").modelAliases
  $existingAlias = @($modelAliases | Where-Object { $_.alias -eq $Alias.Trim() }) | Select-Object -First 1

  $aliasBody = [ordered]@{
    projectId = $null
    scopeType = "global"
    alias = $Alias.Trim()
    providerAccountId = $providerAccount.id
    upstreamModel = if ($DefaultModel.Trim()) { $DefaultModel.Trim() } else { $null }
    priority = 100
    weight = 1
    enabled = $true
  }

  if ($existingAlias) {
    $modelAlias = (Invoke-JsonPost "$gatewayRoot/v1/internal/gateway/model-aliases/$($existingAlias.id)" $aliasBody).modelAlias
    $aliasAction = "updated"
  }
  else {
    $modelAlias = (Invoke-JsonPost "$gatewayRoot/v1/internal/gateway/model-aliases" $aliasBody).modelAlias
    $aliasAction = "created"
  }
}
else {
  $aliasAction = "skipped"
}

Write-Output "PROVIDER_ACTION=$providerAction"
Write-Output "PROVIDER_ACCOUNT_ID=$($providerAccount.id)"
Write-Output "PROVIDER_LABEL=$($providerAccount.label)"
Write-Output "CREDENTIAL_ACTION=$credentialAction"
Write-Output "PROVIDER_CREDENTIAL_ID=$($providerCredential.id)"
Write-Output "PROVIDER_CREDENTIAL_LABEL=$($providerCredential.label)"
Write-Output "PROTOCOL_FAMILY=freebuff"
Write-Output "ADAPTER=freebuff_compatible"
Write-Output "BASE_URL=$($BaseUrl.TrimEnd('/'))"
Write-Output "DEFAULT_MODEL=$DefaultModel"
Write-Output "MODEL_ALIAS_ACTION=$aliasAction"
Write-Output "MODEL_ALIAS_ID=$(if ($modelAlias) { $modelAlias.id } else { '' })"
Write-Output "MODEL_ALIAS=$(if ($modelAlias) { $modelAlias.alias } else { '' })"
