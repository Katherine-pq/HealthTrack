param([Parameter(Mandatory)][string]$Url)

$ErrorActionPreference = 'Stop'
$base = $Url.TrimEnd('/')
$cookieFile = [IO.Path]::GetTempFileName()

function Invoke-PublicApi {
    param(
        [Parameter(Mandatory)][string]$Path,
        [string]$Method = 'GET',
        [string]$Body,
        [int]$ExpectedStatus = 200
    )
    $responseFile = [IO.Path]::GetTempFileName()
    try {
        $arguments = @(
            '--silent', '--show-error', '--max-time', '30',
            '--request', $Method,
            '--output', $responseFile,
            '--write-out', '%{http_code}',
            '--cookie', $cookieFile,
            '--cookie-jar', $cookieFile,
            '--header', "Origin: $base",
            '--header', 'Content-Type: application/json'
        )
        if ($PSBoundParameters.ContainsKey('Body')) { $arguments += @('--data-raw', $Body) }
        $arguments += "$base$Path"
        $curlExit = 1
        for ($attempt = 1; $attempt -le 5; $attempt++) {
            $statusText = & curl.exe @arguments
            $curlExit = $LASTEXITCODE
            if ($curlExit -eq 0) { break }
            if ($attempt -lt 5) { Start-Sleep -Seconds 2 }
        }
        if ($curlExit -ne 0) { throw "HTTPS request failed for $Path after five attempts." }
        $status = [int]$statusText
        $payload = Get-Content -LiteralPath $responseFile -Raw
        if ($status -ne $ExpectedStatus) {
            throw "Unexpected HTTP status for ${Path}: expected $ExpectedStatus, received $status."
        }
        if ([string]::IsNullOrWhiteSpace($payload)) { return $null }
        return $payload | ConvertFrom-Json
    } finally {
        Remove-Item -LiteralPath $responseFile -Force -ErrorAction SilentlyContinue
    }
}

try {
    $health = Invoke-PublicApi -Path '/health'
    $ready = Invoke-PublicApi -Path '/ready'
    if ($health.status -ne 'ok' -or $ready.status -ne 'ready') {
        throw 'Public health validation failed.'
    }

    $email = "qa-$([guid]::NewGuid().ToString('N').Substring(0, 12))@example.com"
    $credentials = @{
        name = 'Prueba publica automatizada'
        email = $email
        password = 'PruebaSalud2026!'
    }
    $credentialsJson = $credentials | ConvertTo-Json -Compress
    $registered = Invoke-PublicApi -Path '/api/auth/register' -Method POST -Body $credentialsJson -ExpectedStatus 201
    if ($registered.email -ne $email) { throw 'Public registration validation failed.' }
    Invoke-PublicApi -Path '/api/auth/login' -Method POST -Body $credentialsJson | Out-Null
    $me = Invoke-PublicApi -Path '/api/auth/me'
    if ($me.email -ne $email) { throw 'Public session validation failed.' }

    $deviceBody = @{ name = 'Pulsera de prueba publica'; brand = 'Demo'; model = 'FitBand' } | ConvertTo-Json -Compress
    $device = Invoke-PublicApi -Path '/api/device' -Method POST -Body $deviceBody -ExpectedStatus 201
    if ($device.source -ne 'simulated') { throw 'Public device creation validation failed.' }
    $sync = Invoke-PublicApi -Path '/api/device/sync' -Method POST -Body '{}'
    $dashboard = Invoke-PublicApi -Path '/api/dashboard'
    if ($sync.created -ne 7 -or $dashboard.metrics.Count -ne 7) {
        throw 'Public synchronization and dashboard validation failed.'
    }
    Invoke-PublicApi -Path '/api/auth/logout' -Method POST -Body '{}' -ExpectedStatus 204 | Out-Null
    Write-Host "Public validation passed: $base"
} finally {
    Remove-Item -LiteralPath $cookieFile -Force -ErrorAction SilentlyContinue
}
