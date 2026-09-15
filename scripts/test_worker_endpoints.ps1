$endpoints = @(
    '/',
    '/api',
    '/api/proxy',
    '/proxy',
    '/api/remove-request',
    '/api/requests',
    '/api/save-game'
)

foreach ($ep in $endpoints) {
    try {
        $res = Invoke-WebRequest -Uri "https://crackuzu-api.crackuzu.workers.dev$ep" -Method GET -UseBasicParsing -TimeoutSec 4
        Write-Host "$ep -> Status $($res.StatusCode)"
    } catch {
        Write-Host "$ep -> $($_.Exception.Message)"
    }
}
