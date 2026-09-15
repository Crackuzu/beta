$r = Invoke-RestMethod -Uri 'https://store.steampowered.com/api/appdetails?appids=1281590&l=french&cc=FR' -TimeoutSec 5 -Headers @{'User-Agent'='Mozilla/5.0'}
$app = $r.'1281590'
Write-Host "Success: $($app.success)"
Write-Host "Name: $($app.data.name)"
Write-Host "Steam Search:"
$s = Invoke-RestMethod -Uri 'https://steamcommunity.com/actions/SearchApps/Elden' -TimeoutSec 5 -Headers @{'User-Agent'='Mozilla/5.0'}
Write-Host "Search count: $($s.Count) items. First: $($s[0].name)"
