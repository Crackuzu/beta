$u = "https://store.steampowered.com/api/appdetails?appids=1281590&l=french&cc=FR"
try {
    $r = Invoke-RestMethod -Uri "https://api.allorigins.win/raw?url=$([Uri]::EscapeDataString($u))" -TimeoutSec 10
    $data = $r.'1281590'.data
    Write-Host "allorigins raw appdetails: SUCCESS - Name: $($data.name)"
} catch {
    Write-Host "allorigins raw appdetails err: $($_.Exception.Message)"
}
