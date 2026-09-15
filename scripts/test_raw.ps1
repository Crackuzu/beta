$raw = (Invoke-WebRequest -Uri 'https://corsproxy.org/?https%3A%2F%2Fstore.steampowered.com%2Fapi%2Fappdetails%3Fappids%3D1281590%26l%3Dfrench%26cc%3DFR' -UseBasicParsing).Content
Write-Host "Raw content length: $($raw.Length)"
Write-Host "Prefix: $($raw.Substring(0, [Math]::Min(300, $raw.Length)))"
