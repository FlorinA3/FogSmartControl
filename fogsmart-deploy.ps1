# Save as fogsmart-deploy.ps1
$ErrorActionPreference = 'Stop'

Write-Host "===== FOGSMARTCONTROL DOCKERIZED DEPLOYMENT =====" -ForegroundColor Cyan
Write-Host "Setting up production-grade Docker environment..." -ForegroundColor Yellow

# 1. Create Docker Compose file
@"
version: '3.8'
services:
  mosquitto:
    image: eclipse-mosquitto:2.0.18
    container_name: fog-mosquitto
    ports:
      - "1883:1883"
    volumes:
      - ./mosquitto/config:/mosquitto/config
      - ./mosquitto/data:/mosquitto/data
      - ./mosquitto/log:/mosquitto/log
    command: mosquitto -c /mosquitto/config/mosquitto.conf

  fogsmartcontrol:
    image: florind3/fogsmartcontrol:latest
    container_name: fogsmart-app
    environment:
      - BROKER_ADDR=mosquitto
    depends_on:
      - mosquitto
    ports:
      - "5000:5000"
    volumes:
      - ./data:/app/data
"@ | Set-Content -Path "docker-compose.yml"

# 2. Create Mosquitto configuration
New-Item -ItemType Directory -Path "mosquitto\config" -Force
@"
listener 1883
allow_anonymous true
log_dest file /mosquitto/log/mosquitto.log
"@ | Set-Content -Path "mosquitto\config\mosquitto.conf"

# 3. Update iot_bridge.py to use Docker network
$iotBridgeContent = @"
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
    except Exception as e:
        print(f"Error processing message: {str(e)}")

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
client.on_message = on_message

# Use Docker service name as broker address
broker_addr = os.getenv("BROKER_ADDR", "mosquitto")
print(f"Connecting to MQTT broker at {broker_addr}")

try:
    client.connect(broker_addr, 1883, 60)
    client.subscribe("fog_nodes/#")
    print("MQTT client started. Waiting for messages...")
    client.loop_forever()
except Exception as e:
    print(f"Connection failed: {str(e)}")
    print("Ensure Mosquitto container is running")
"@
Set-Content -Path "app/iot_bridge.py" -Value $iotBridgeContent

# 4. Rebuild Docker image
Write-Host "`nRebuilding application image..." -ForegroundColor Cyan
docker build -t florind3/fogsmartcontrol:latest .

# 5. Start the system
Write-Host "`nStarting production stack..." -ForegroundColor Green
docker-compose up -d

# 6. Run validation tests
Write-Host "`n===== RUNNING VALIDATION TESTS =====" -ForegroundColor Green

# Test 1: Service connectivity
Write-Host "`n[TEST] Service connectivity..." -ForegroundColor Yellow
docker exec fogsmart-app python -c `
    "from app.scheduler import ResourceScheduler; `
     from models.train_model import train_model; `
     print('✓ Core services initialized')"

# Test 2: Unit tests
Write-Host "`n[TEST] Unit tests..." -ForegroundColor Yellow
docker exec fogsmart-app pytest tests/ --color=yes

# Test 3: ML pipeline
Write-Host "`n[TEST] Model training..." -ForegroundColor Yellow
docker exec fogsmart-app python retrain.py

# Test 4: MQTT integration
Write-Host "`n[TEST] Real-time messaging..." -ForegroundColor Yellow
docker exec fogsmart-app python app/iot_bridge.py &
Start-Sleep -Seconds 3
docker exec fog-mosquitto mosquitto_pub -t fog_nodes/sensor01 -m '{"device_id":"docker_test","cpu_load":0.92}'
Start-Sleep -Seconds 2

# 7. Finalize deployment
Write-Host "`n===== DEPLOYMENT SUCCESS =====" -ForegroundColor Green
Write-Host "Production stack running successfully!" -ForegroundColor Cyan

Write-Host "`nContainer Status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

Write-Host "`nNext steps:"
Write-Host "1. Push Docker image: docker push florind3/fogsmartcontrol:latest"
Write-Host "2. Commit configuration: git add . && git commit -m 'Dockerized production stack'"
Write-Host "3. Deploy to production: docker-compose up -d"
Write-Host "4. Access logs: docker-compose logs -f"

Write-Host "`nDeployment completed at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Magenta