# scripts/server.ps1 - Serveur HTTP statique léger en PowerShell pour CrackUZU
param([int]$Port = 5500)

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)

try {
  $listener.Start()
  Write-Host "==========================================" -ForegroundColor Green
  Write-Host "  🎮 Serveur CrackUZU démarré avec succès !" -ForegroundColor Green
  Write-Host "  URL locale : $prefix" -ForegroundColor Cyan
  Write-Host "  Racine : $root" -ForegroundColor Gray
  Write-Host "  Appuyez sur Ctrl+C pour arrêter." -ForegroundColor Gray
  Write-Host "==========================================" -ForegroundColor Green

  # Ouvre le navigateur automatiquement
  Start-Process $prefix

  $mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
    ".woff" = "font/woff"
    ".woff2"= "font/woff2"
  }

  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    $urlPath = $request.Url.LocalPath.TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($urlPath)) { $urlPath = "index.html" }
    $filePath = Join-Path $root ($urlPath.Replace('/', '\'))

    # CORS
    $response.Headers.Add("Access-Control-Allow-Origin", "*")
    $response.Headers.Add("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")

    if (Test-Path $filePath -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
      $mime = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }
      $response.ContentType = $mime
      
      $bytes = [System.IO.File]::ReadAllBytes($filePath)
      $response.ContentLength64 = $bytes.Length
      $response.StatusCode = 200
      $response.OutputStream.Write($bytes, 0, $bytes.Length)
      Write-Host "200 OK: $urlPath ($($bytes.Length) bytes)" -ForegroundColor DarkGreen
    } else {
      $response.StatusCode = 404
      $notFoundBytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $urlPath")
      $response.ContentLength64 = $notFoundBytes.Length
      $response.OutputStream.Write($notFoundBytes, 0, $notFoundBytes.Length)
      Write-Host "404 Not Found: $urlPath" -ForegroundColor Red
    }
    $response.OutputStream.Close()
  }
} catch {
  Write-Host "Erreur du serveur : $_" -ForegroundColor Red
} finally {
  $listener.Stop()
}
