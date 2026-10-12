param(
    [ValidateSet('aws','pulumi')][string]$Tool,
    [string[]]$Arguments = @(),
    [switch]$Initialize,
    [switch]$RefreshImageTag
)

$ErrorActionPreference = 'Stop'
$project = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$repo = (Resolve-Path (Join-Path $project '../..')).Path
$keys = @(
    'AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','AWS_SESSION_TOKEN','AWS_REGION',
    'AWS_DEFAULT_REGION','AWS_PROFILE','AWS_CA_BUNDLE','AWS_EC2_METADATA_DISABLED',
    'PULUMI_CONFIG_PASSPHRASE','PULUMI_HOME','NODE_EXTRA_CA_CERTS'
)
$saved = @{}
$originalLocation = Get-Location

function Set-PulumiConfigIfMissing([string]$Key, [string]$Value) {
    & $script:PulumiCli config get $Key --stack production --non-interactive 1>$null 2>$null
    if ($LASTEXITCODE -ne 0) {
        & $script:PulumiCli config set $Key $Value --stack production --non-interactive
        if ($LASTEXITCODE -ne 0) { throw "Pulumi configuration failed for $Key." }
    }
}

try {
    foreach ($key in $keys) {
        $saved[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
        Remove-Item -LiteralPath "Env:$key" -ErrorAction SilentlyContinue
    }
    $credentialFile = Join-Path $repo '.env.aws'
    if (-not (Test-Path -LiteralPath $credentialFile)) { throw 'Missing .env.aws.' }
    foreach ($line in [IO.File]::ReadAllLines($credentialFile)) {
        if ($line -match '^\s*(#|$)') { continue }
        if ($line -notmatch '^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$') {
            throw 'Invalid credential file format.'
        }
        $key = $Matches[1]
        $value = $Matches[2]
        if ($key -notin $keys[0..5]) { continue }
        if ($value.Length -ge 2 -and (
            ($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'"))
        )) { $value = $value.Substring(1, $value.Length - 2) }
        if ($value) { [Environment]::SetEnvironmentVariable($key, $value, 'Process') }
    }
    if (-not $env:AWS_ACCESS_KEY_ID -or -not $env:AWS_SECRET_ACCESS_KEY) {
        throw 'Missing AWS credentials.'
    }
    $env:AWS_REGION = 'us-east-1'
    $env:AWS_DEFAULT_REGION = 'us-east-1'
    $env:AWS_EC2_METADATA_DISABLED = 'true'

    $rawFolder = Join-Path $project 'evidence/raw'
    $null = New-Item -ItemType Directory -Path $rawFolder -Force
    $bundle = Join-Path $rawFolder 'windows-trust.pem'
    if (-not (Test-Path -LiteralPath $bundle)) {
        $pem = foreach ($cert in (Get-ChildItem Cert:\CurrentUser\Root, Cert:\LocalMachine\Root, Cert:\CurrentUser\CA, Cert:\LocalMachine\CA | Sort-Object Thumbprint -Unique)) {
            "-----BEGIN CERTIFICATE-----`n" +
            [Convert]::ToBase64String($cert.RawData, [Base64FormattingOptions]::InsertLineBreaks) +
            "`n-----END CERTIFICATE-----"
        }
        $pem -join "`n" | Set-Content -LiteralPath $bundle -Encoding ascii
    }
    $env:AWS_CA_BUNDLE = $bundle
    $env:NODE_EXTRA_CA_CERTS = $bundle
    Set-Location -LiteralPath $project

    if ($Tool -eq 'aws') {
        & aws @Arguments --region us-east-1 --no-cli-pager
        if ($LASTEXITCODE -ne 0) { throw 'AWS operation failed; credentials were not printed.' }
        return
    }

    $script:PulumiCli = 'C:\Program Files (x86)\Pulumi\pulumi.exe'
    if (-not (Test-Path -LiteralPath $script:PulumiCli)) {
        $script:PulumiCli = (Get-Command pulumi -ErrorAction Stop).Source
    }
    $local = Join-Path $project '.pulumi'
    $null = New-Item -ItemType Directory -Path $local -Force
    $env:PULUMI_HOME = Join-Path $local 'home'
    $passFile = Join-Path $local 'passphrase.dpapi'
    if (-not (Test-Path -LiteralPath $passFile)) {
        $bytes = New-Object byte[] 48
        [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
        ConvertTo-SecureString ([Convert]::ToBase64String($bytes)) -AsPlainText -Force |
            ConvertFrom-SecureString | Set-Content -LiteralPath $passFile
    }
    $secure = (Get-Content -LiteralPath $passFile -Raw).Trim() | ConvertTo-SecureString
    $env:PULUMI_CONFIG_PASSPHRASE = [Net.NetworkCredential]::new('', $secure).Password
    $state = Join-Path $local 'state'
    $null = New-Item -ItemType Directory -Path $state -Force
    & $script:PulumiCli login ([Uri]::new($state + '\').AbsoluteUri) --non-interactive 1>$null
    if ($LASTEXITCODE -ne 0) { throw 'Pulumi backend login failed.' }

    if ($Initialize) {
        & $script:PulumiCli stack select production --non-interactive 2>$null
        if ($LASTEXITCODE -ne 0) {
            & $script:PulumiCli stack init production --secrets-provider passphrase --non-interactive
        }
        if ($LASTEXITCODE -ne 0) { throw 'Pulumi stack initialization failed.' }
        $identityJson = & aws sts get-caller-identity --output json --region us-east-1 --no-cli-pager
        if ($LASTEXITCODE -ne 0) { throw 'AWS identity verification failed.' }
        $identity = ($identityJson -join "`n") | ConvertFrom-Json
        if ($identity.Account -ne '948218213320' -or $identity.Arn -match ':root$') {
            throw 'Unexpected AWS account or root credentials. Deployment stopped.'
        }
        Set-PulumiConfigIfMissing 'aws:region' 'us-east-1'
        Set-PulumiConfigIfMissing 'expectedAccount' $identity.Account
        Set-PulumiConfigIfMissing 'environment' 'production'
        Set-PulumiConfigIfMissing 'cpu' '512'
        Set-PulumiConfigIfMissing 'memory' '1024'
        Set-PulumiConfigIfMissing 'desiredCount' '2'
        Set-PulumiConfigIfMissing 'monthlyBudgetUsd' '150'
        Set-PulumiConfigIfMissing 'databaseVersion' '18.6'
        Set-PulumiConfigIfMissing 'deploymentId' (Get-Date -Format 'yyyyMMddHHmmss')
        Set-PulumiConfigIfMissing 'imageTag' ('release-' + (Get-Date -Format 'yyyyMMddHHmmss'))
    }
    if ($RefreshImageTag) {
        & $script:PulumiCli config set imageTag ('release-' + (Get-Date -Format 'yyyyMMddHHmmss')) --stack production --non-interactive
        if ($LASTEXITCODE -ne 0) { throw 'Image tag refresh failed.' }
    }
    if ($Arguments.Count -gt 0) {
        & $script:PulumiCli @Arguments --stack production
        if ($LASTEXITCODE -ne 0) { throw 'Pulumi operation did not complete successfully.' }
    }
} finally {
    Set-Location $originalLocation
    foreach ($key in $saved.Keys) {
        if ($null -eq $saved[$key]) { Remove-Item -LiteralPath "Env:$key" -ErrorAction SilentlyContinue }
        else { [Environment]::SetEnvironmentVariable($key, $saved[$key], 'Process') }
    }
}
