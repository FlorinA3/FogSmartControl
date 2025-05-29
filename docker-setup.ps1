# Save this as docker-login.ps1
$dockerUser = "florind3"
$dockerPass = "V8)7i%)NzFZU&H4"

# Login to Docker
Write-Host "Logging into Docker Hub..." -ForegroundColor Cyan
echo $dockerPass | docker login -u $dockerUser --password-stdin

# Build Docker image
Write-Host "Building Docker image..." -ForegroundColor Cyan
docker build -t ${dockerUser}/fogsmartcontrol:latest .

# Test MQTT integration
Write-Host "`nStarting MQTT Test..." -ForegroundColor Yellow
Write-Host "Open a NEW PowerShell window and run:" -ForegroundColor Yellow
Write-Host "docker run -it --rm -e BROKER_ADDR=localhost ${dockerUser}/fogsmartcontrol python app/iot_bridge.py"

# Install Mosquitto if needed
if (-not (Get-Command mosquitto_pub -ErrorAction SilentlyContinue)) {
    Write-Host "`nInstalling Mosquitto..." -ForegroundColor Cyan
    winget install --id EclipseFoundation.Mosquitto -e --accept-package-agreements --accept-source-agreements
}

Write-Host "`nIn THIS window, run after the other window is ready:" -ForegroundColor Yellow
Write-Host "mosquitto_pub -t fog_nodes/sensor01 -m '\{\""device_id\"":\""test01\"",\""cpu_load\"":0.8\}'"

Write-Host "`nSETUP COMPLETE!`n" -ForegroundColor Green