$url = 'https://store.steampowered.com/api/appdetails?appids=1281590&l=french&cc=FR'
$enc = [Uri]::EscapeDataString($url)
$res = Invoke-RestMethod -Uri "https://corsproxy.org/?$enc"
$app = $res.'1281590'.data
Write-Host "Name: $($app.name)"
Write-Host "Short desc: $($app.short_description.Substring(0, 80))"
Write-Host "Movies count: $($app.movies.Count)"
if ($app.movies) {
    Write-Host "First movie name: $($app.movies[0].name)"
    Write-Host "First movie mp4: $($app.movies[0].mp4.max)"
    Write-Host "First movie webm: $($app.movies[0].webm.max)"
}
