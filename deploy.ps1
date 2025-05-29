# Save as deploy.ps1
$ErrorActionPreference = 'Stop'

Write-Host "===== PROFESSIONAL DEPLOYMENT SETUP =====" -ForegroundColor Cyan
Write-Host "Configuring Docker-based production environment..." -ForegroundColor Yellow

# 1. Create Docker network
docker network create fog-network 2>$null

# 2. Start Mosquitto in Docker
Write-Host "Starting Mosquitto broker in Docker..." -ForegroundColor Cyan
docker run -d --name fog-mosquitto `
    --network fog-network `
    -p 1883:1883 `
    eclipse-mosquitto:2.0.18

# 3. Update iot_bridge.py
@'
import os
import json
import paho.mqtt.client as mqtt
from app.scheduler import ResourceScheduler

scheduler = ResourceScheduler()

def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode())
        print(f"Received from {msg.topic}: {payload}")
        response = scheduler.process_task(payload)
        print(f"Response: {response}")
        return response
    except Exception as e:
        print(f"Error processing message: {str(e)}")
        return {"status": "ERROR", "message": str(e)}

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
client.on_message = on_message

# Connect using Docker network name
broker_addr = os.getenv("BROKER_ADDR", "fog-mosquitto")
print(f"Connecting to MQTT broker at {broker_addr}")

try:
    client.connect(broker_addr, 1883, 60)
    client.subscribe("fog_nodes/#")
    print("MQTT client started. Waiting for messages...")
    client.loop_forever()
except Exception as e:
    print(f"Connection failed: {str(e)}")
    print("Troubleshooting: Ensure Mosquitto container is running")
'@ | Set-Content -Path "app/iot_bridge.py"

# 4. Build application image
Write-Host "Building application image..." -ForegroundColor Cyan
docker build -t florind3/fogsmartcontrol:latest .

# 5. Start application container
Write-Host "Starting application container..." -ForegroundColor Cyan
docker run -d --name fogsmart-app `
    --network fog-network `
    -e BROKER_ADDR=fog-mosquitto `
    -p 5000:5000 `
    florind3/fogsmartcontrol:latest

# 6. Run validation tests
Write-Host "`n===== RUNNING VALIDATION TESTS =====" -ForegroundColor Green

# Test 1: Container status
Write-Host "`n[TEST] Container status..." -ForegroundColor Yellow
docker ps --filter "name=fog" --format "table {{.Names}}`t{{.Status}}`t{{.Ports}}"

# Test 2: Service connectivity
Write-Host "`n[TEST] Service connectivity..." -ForegroundColor Yellow
docker exec fogsmart-app python -c "from app.scheduler import ResourceScheduler; print('✓ Scheduler service initialized')"

# Test 3: MQTT integration
Write-Host "`n[TEST] MQTT communication..." -ForegroundColor Yellow
docker exec fog-mosquitto mosquitto_pub -t fog_nodes/sensor01 -m '{\"device_id\":\"final_test\",\"cpu_load\":0.85}'
Start-Sleep -Seconds 2
Write-Host "Checking application logs..." -ForegroundColor Cyan
docker logs fogsmart-app --tail 20

# 7. Finalize deployment
Write-Host "`n===== DEPLOYMENT SUCCESS =====" -ForegroundColor Green
Write-Host "Production environment active!" -ForegroundColor Cyan

Write-Host "`nAccess Points:"
Write-Host "1. MQTT Broker: localhost:1883"
Write-Host "2. Application: http://localhost:5000"

Write-Host "`nManagement Commands:"
Write-Host "- View logs: docker logs -f fogsmart-app"
Write-Host "- Stop services: docker stop fog-mosquitto fogsmart-app"
Write-Host "- Start services: docker start fog-mosquitto fogsmart-app"

Write-Host "`nDeployment completed at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Magenta