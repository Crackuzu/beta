# Install Git for Windows (silent)
$gitUrl = "https://github.com/git-for-windows/git/releases/download/v2.45.0.windows.1/Git-2.45.0-64-bit.exe"
$installerPath = "$env:TEMP\Git-Setup.exe"
Write-Host "Downloading Git installer..."
Invoke-WebRequest -Uri $gitUrl -OutFile $installerPath
Write-Host "Running installer (silent)..."
Start-Process -FilePath $installerPath -ArgumentList "/VERYSILENT" -Wait
Write-Host "Cleaning up installer..."
Remove-Item $installerPath -Force
Write-Host "Git installation completed."
