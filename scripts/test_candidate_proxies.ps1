$steamApp = "https://store.steampowered.com/api/appdetails?appids=1281590&l=french&cc=FR"
$steamSearch = "https://steamcommunity.com/actions/SearchApps/Elden"

$proxyCandidates = @(
    @{ Name = "allorigins-raw"; Url = { param($u) "https://api.allorigins.win/raw?url=$([Uri]::EscapeDataString($u))" }; Type = "direct" },
    @{ Name = "allorigins-get"; Url = { param($u) "https://api.allorigins.win/get?url=$([Uri]::EscapeDataString($u))" }; Type = "json-contents" },
    @{ Name = "codetabs"; Url = { param($u) "https://api.codetabs.com/v1/proxy?quest=$([Uri]::EscapeDataString($u))" }; Type = "direct" },
    @{ Name = "cors-proxy-ninja"; Url = { param($u) "https://corsproxy.io/?url=$([Uri]::EscapeDataString($u))" }; Type = "direct" },
    @{ Name = "cors-anywhere-az"; Url = { param($u) "https://cors-anywhere-7a0z.onrender.com/$u" }; Type = "direct" },
    @{ Name = "just-cors"; Url = { param($u) "https://just-cors.com/proxy?url=$([Uri]::EscapeDataString($u))" }; Type = "direct" },
    @{ Name = "corsproxy-biz"; Url = { param($u) "https://corsproxy.biz/?$([Uri]::EscapeDataString($u))" }; Type = "direct" },
    @{ Name = "cors.eu.org"; Url = { param($u) "https://cors.eu.org/$u" }; Type = "direct" },
    @{ Name = "thingproxy-free"; Url = { param($u) "https://thingproxy.freeboard.io/fetch/$u" }; Type = "direct" },
    @{ Name = "cors-bnd"; Url = { param($u) "https://cors.bridged.cc/$u" }; Type = "direct" }
)

Write-Host "=== TESTING STEAM SEARCH ==="
foreach ($p in $proxyCandidates) {
    $testUrl = & $p.Url $steamSearch
    try {
        $res = Invoke-RestMethod -Uri $testUrl -TimeoutSec 5 -Headers @{ "User-Agent" = "Mozilla/5.0" }
        if ($res -and ($res.Count -gt 0 -or $res.contents)) {
            Write-Host "$($p.Name) : SUCCESS! (Found results)"
        } else {
            Write-Host "$($p.Name) : Response received but empty"
        }
    } catch {
        Write-Host "$($p.Name) : FAILED ($($_.Exception.Message))"
    }
}

Write-Host "`n=== TESTING YOUTUBE TRAILER SOURCES ==="
# Test YouTube search directly or through Invidious / Piped / Scraping
$invidious = @(
    "https://invidious.projectsegfau.lt",
    "https://inv.nadeko.net",
    "https://invidious.nerdvpn.de",
    "https://invidious.jing.rocks",
    "https://inv.zzls.xyz",
    "https://invidious.private.coffee",
    "https://iv.ggtyler.dev",
    "https://invidious.protokolla.fi",
    "https://yewtu.be",
    "https://pipedapi.kavin.rocks",
    "https://pipedapi.tokhmi.xyz",
    "https://api.piped.privacydev.net"
)

foreach ($inst in $invidious) {
    try {
        $url = if ($inst -like "*piped*") { "$inst/search?q=Elden+Ring+trailer&filter=videos" } else { "$inst/api/v1/search?q=Elden+Ring+trailer&type=video" }
        $res = Invoke-RestMethod -Uri $url -TimeoutSec 4 -Headers @{ "User-Agent" = "Mozilla/5.0" }
        Write-Host "$inst : SUCCESS"
    } catch {
        Write-Host "$inst : FAILED ($($_.Exception.Message))"
    }
}
