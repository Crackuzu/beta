$raw = (Invoke-WebRequest -Uri "https://invidious.projectsegfau.lt/api/v1/search?q=Elden+Ring+launch+trailer&type=video" -TimeoutSec 6 -Headers @{'User-Agent'='Mozilla/5.0'} -UseBasicParsing).Content
Write-Host "Length: $($raw.Length)"
Write-Host "Prefix: $($raw.Substring(0, [Math]::Min(500, $raw.Length)))"
