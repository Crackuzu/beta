$steamUrl = 'https://store.steampowered.com/api/appdetails?appids=1281590&l=french&cc=FR'
$encoded = [Uri]::EscapeDataString($steamUrl)

Write-Host "--- Testing Steam AppDetails ---"

# 1. CF Worker
try {
    $r = Invoke-RestMethod -Uri "https://crackuzu-api.crackuzu.workers.dev/api/proxy?url=$encoded" -TimeoutSec 6
    Write-Host "CF Worker: OK"
} catch {
    Write-Host "CF Worker FAILED: $($_.Exception.Message)"
}

# 2. corsproxy.io
try {
    $r = Invoke-RestMethod -Uri "https://corsproxy.io/?$encoded" -TimeoutSec 6
    Write-Host "corsproxy.io: OK"
} catch {
    Write-Host "corsproxy.io FAILED: $($_.Exception.Message)"
}

# 3. allorigins
try {
    $r = Invoke-RestMethod -Uri "https://api.allorigins.win/get?url=$encoded" -TimeoutSec 6
    Write-Host "allorigins: OK"
} catch {
    Write-Host "allorigins FAILED: $($_.Exception.Message)"
}

# 4. codetabs
try {
    $r = Invoke-RestMethod -Uri "https://api.codetabs.com/v1/proxy?quest=$encoded" -TimeoutSec 6
    Write-Host "codetabs: OK"
} catch {
    Write-Host "codetabs FAILED: $($_.Exception.Message)"
}

# 5. corsproxy.org
try {
    $r = Invoke-RestMethod -Uri "https://corsproxy.org/?$encoded" -TimeoutSec 6
    Write-Host "corsproxy.org: OK"
} catch {
    Write-Host "corsproxy.org FAILED: $($_.Exception.Message)"
}

# 6. cors.sh
try {
    $r = Invoke-RestMethod -Uri "https://proxy.cors.sh/$steamUrl" -TimeoutSec 6
    Write-Host "cors.sh: OK"
} catch {
    Write-Host "cors.sh FAILED: $($_.Exception.Message)"
}

# 7. thingproxy
try {
    $r = Invoke-RestMethod -Uri "https://thingproxy.freeboard.io/fetch/$steamUrl" -TimeoutSec 6
    Write-Host "thingproxy: OK"
} catch {
    Write-Host "thingproxy FAILED: $($_.Exception.Message)"
}

Write-Host "`n--- Testing Steam Search ---"
$searchUrl = "https://steamcommunity.com/actions/SearchApps/Elden"
$encSearch = [Uri]::EscapeDataString($searchUrl)
try {
    $r = Invoke-RestMethod -Uri "https://corsproxy.io/?$encSearch" -TimeoutSec 6
    Write-Host "corsproxy.io (Search): OK"
} catch {
    Write-Host "corsproxy.io (Search) FAILED: $($_.Exception.Message)"
}

Write-Host "`n--- Testing Invidious / YouTube API instances ---"
$invidious = @(
    'https://iv.datura.network',
    'https://iv.melmac.space',
    'https://iv.nboeck.de',
    'https://yt.artemislena.eu',
    'https://invidious.nerdvpn.de',
    'https://inv.tux.pizza',
    'https://invidious.drgns.space',
    'https://invidious.lunar.icu',
    'https://inv.nadeko.net',
    'https://yewtu.be'
)

foreach ($inst in $invidious) {
    try {
        $res = Invoke-RestMethod -Uri "$inst/api/v1/search?q=Elden+Ring+trailer&type=video" -TimeoutSec 5
        if ($res -and $res.Count -gt 0) {
            Write-Host "$inst : OK (found $($res.Count) videos, videoId: $($res[0].videoId))"
        } else {
            Write-Host "$inst : Empty response"
        }
    } catch {
        Write-Host "$inst : FAILED ($($_.Exception.Message))"
    }
}
