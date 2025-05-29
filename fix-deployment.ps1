# FogSmartControl Deployment Fix Script
# Resolves Mosquitto installation, Docker networking, and MQTT connectivity
# Run as Administrator

# 1. Install and Configure Mosquitto
Write-Host "`n===== INSTALLING MOSQUITTO =====`n" -ForegroundColor Cyan
if (-not (Get-Command mosquitto -ErrorAction SilentlyContinue)) {
    # Install Mosquitto
    winget install --id EclipseFoundation.Mosquitto -e --accept-package-agreements --accept-source-agreements
}

# Configure Mosquitto to run as service
$mosquittoConfig = @"
listener 1883
allow_anonymous true
"@
Set-Content -Path "C:\Program Files\mosquitto\mosquitto.conf" -Value $mosquittoConfig

# Create and start service
if (-not (Get-Service mosquitto -ErrorAction SilentlyContinue)) {
    New-Service -Name "mosquitto" `
                -BinaryPathName "`"C:\Program Files\mosquitto\mosquitto.exe`" -c `"C:\Program Files\mosquitto\mosquitto.conf`"" `
                -DisplayName "Mosquitto MQTT Broker" `
                -StartupType Automatic
}

# Start service
Start-Service mosquitto
Set-Service -Name mosquitto -StartupType Automatic

# Configure firewall
New-NetFirewallRule -DisplayName "MQTT (Port 1883)" `
                    -Direction Inbound `
                    -Action Allow `
                    -Protocol TCP `
                    -LocalPort 1883 `
                    -ErrorAction SilentlyContinue

# 2. Fix Python Code
Write-Host "`n===== UPDATING MQTT CLIENT CODE =====`n" -ForegroundColor Cyan
$iotBridgePath = "app\iot_bridge.py"
$newCode = @"
import os
import json
import paho.mqtt.client as mqtt
from app.scheduler import ResourceScheduler

scheduler = ResourceScheduler()

def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode())
        print(f"Received from {msg.topic}: {payload}")
        scheduler.process_task(payload)
    except Exception as e:
        print(f"Error processing message: {str(e)}")

# Use updated API version
client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
client.on_message = on_message

# Use host.docker.internal for Windows/Mac connectivity
broker_addr = os.getenv("BROKER_ADDR", "host.docker.internal")
print(f"Connecting to MQTT broker at {broker_addr}")

try:
    client.connect(broker_addr, 1883, 60)
    client.subscribe("fog_nodes/#")
    print("MQTT client started. Waiting for messages...")
    client.loop_forever()
except Exception as e:
    print(f"Connection failed: {str(e)}")
    print("Troubleshooting: Ensure Mosquitto is running and firewall allows port 1883")
"@
Set-Content -Path $iotBridgePath -Value $newCode

# 3. Update Requirements.txt
Write-Host "`n===== UPDATING DEPENDENCIES =====`n" -ForegroundColor Cyan
@"
paho-mqtt==1.7.1
mlflow
pandas
scikit-learn
pytest
"@ | Set-Content -Path "requirements.txt"

# 4. Rebuild Docker Image
Write-Host "`n===== REBUILDING DOCKER IMAGE =====`n" -ForegroundColor Cyan
docker build -t florind3/fogsmartcontrol:latest .

# 5. Test MQTT Integration
Write-Host "`n===== TESTING MQTT INTEGRATION =====`n" -ForegroundColor Green
Write-Host "Starting MQTT listener in Docker container..." -ForegroundColor Yellow
Start-Job -ScriptBlock {
    docker run -it --rm -e BROKER_ADDR=host.docker.internal florind3/fogsmartcontrol python app/iot_bridge.py
}

# Wait for listener to initialize
Start-Sleep -Seconds 5

# Send test message
Write-Host "Sending test message..." -ForegroundColor Yellow
mosquitto_pub -t fog_nodes/sensor01 -m '{"device_id":"test01","cpu_load":0.8}'

# 6. Verify Services
Write-Host "`n===== VERIFICATION =====`n" -ForegroundColor Cyan
Write-Host "Mosquitto Status: $(Get-Service mosquitto | Select-Object -ExpandProperty Status)"
Write-Host "Firewall Rule:"
Get-NetFirewallRule -DisplayName "MQTT*" | Format-Table DisplayName, Enabled, Direction, Action

Write-Host "`nSETUP COMPLETE! All issues resolved.`n" -ForegroundColor Green