# Test why allorigins or other proxies fail and test others
$u = "https://steamcommunity.com/actions/SearchApps/elden"
try {
    $r = Invoke-RestMethod -Uri "https://api.allorigins.win/raw?url=$([Uri]::EscapeDataString($u))" -TimeoutSec 10 -UseBasicParsing
    Write-Host "allorigins raw: $($r.Count) items found"
} catch {
    Write-Host "allorigins raw err: $($_.Exception.Message)"
}

try {
    $r = Invoke-RestMethod -Uri "https://api.codetabs.com/v1/proxy?quest=$([Uri]::EscapeDataString($u))" -TimeoutSec 10 -UseBasicParsing
    Write-Host "codetabs: $($r.Count) items found"
} catch {
    Write-Host "codetabs err: $($_.Exception.Message)"
}

# Test corsproxy.io without encode or with clean url
try {
    $r = Invoke-RestMethod -Uri "https://corsproxy.io/?$u" -TimeoutSec 5 -Headers @{ "Referer" = "https://localhost" }
    Write-Host "corsproxy.io with referer: SUCCESS"
} catch {
    Write-Host "corsproxy.io err: $($_.Exception.Message)"
}
