$instances = @(
    "https://invidious.projectsegfau.lt",
    "https://invidious.protokolla.fi",
    "https://yewtu.be"
)

foreach ($inst in $instances) {
    try {
        $res = Invoke-RestMethod -Uri "$inst/api/v1/search?q=Elden+Ring+launch+trailer&type=video" -TimeoutSec 6 -Headers @{'User-Agent'='Mozilla/5.0'}
        Write-Host "$inst -> Found $($res.Count) items."
        if ($res.Count -gt 0) {
            Write-Host "  First videoId: $($res[0].videoId)"
            Write-Host "  Title: $($res[0].title)"
        }
    } catch {
        Write-Host "$inst -> ERR: $($_.Exception.Message)"
    }
}
