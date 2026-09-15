$r = Invoke-RestMethod -Uri 'https://store.steampowered.com/api/appdetails?appids=1245620&l=french&cc=FR' -TimeoutSec 5 -Headers @{'User-Agent'='Mozilla/5.0'}
$app = $r.'1245620'.data
Write-Host "Movies in Steam appdetails:"
if ($app.movies) {
    foreach ($m in $app.movies) {
        Write-Host "Movie: $($m.name) | MP4: $($m.mp4.max) | Highlight: $($m.highlight)"
    }
} else {
    Write-Host "No movies field"
}
