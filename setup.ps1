# FogSmartControl Setup Script
# Save this as setup.ps1 and run it

# ===== CONFIGURATION =====
$DOCKER_USERNAME = "florind3"
$MQTT_BROKER = "localhost"  # Use localhost for testing
$TRAINING_DATA = "data/sensor_data.csv"  # Verify this path

# ===== CREATE MISSING FILES =====
# Create Dockerfile if missing
if (-not (Test-Path "Dockerfile")) {
    @"
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["python", "app/main.py"]
"@ | Set-Content -Path "Dockerfile"
}

# Create requirements.txt if missing
if (-not (Test-Path "requirements.txt")) {
    @"
mlflow
paho-mqtt
pandas
scikit-learn
pytest
"@ | Set-Content -Path "requirements.txt"
}

# Create data directory if missing
if (-not (Test-Path "data")) {
    New-Item -ItemType Directory -Path "data" -Force
}

# ===== PHASE 1: STABILIZE & SECURE =====

# 1. CI/CD Pipeline
Write-Host "Setting up CI/CD pipeline..."
if (-not (Test-Path ".github/workflows")) {
    New-Item -ItemType Directory -Path ".github/workflows" -Force
}

@"
name: Python CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - name: Set up Python 3.10
      uses: actions/setup-python@v4
      with: 
        python-version: "3.10"
    - name: Install dependencies
      run: pip install -r requirements.txt
    - name: Run tests
      run: pytest tests/
"@ | Set-Content -Path ".github/workflows/python-ci.yml"

# 2. Security Setup
Write-Host "Configuring security settings..."
@"
BROKER_ADDR=$MQTT_BROKER
TRAINING_DATA=$TRAINING_DATA
DB_HOST=your_database_host
DB_PASSWORD=your_secure_password
API_KEY=your_api_key
"@ | Set-Content -Path ".env"

Add-Content -Path ".gitignore" -Value ".env"

# Update Docker security
Write-Host "Updating Docker security..."
$dockerContent = Get-Content -Path "Dockerfile" -Raw
$newDockerContent = $dockerContent -replace '(RUN pip install -r requirements.txt)', "`$1`nRUN useradd -m appuser && chown -R appuser /app`nUSER appuser"
Set-Content -Path "Dockerfile" -Value $newDockerContent

# 3. Add integration test
Write-Host "Adding integration tests..."
if (-not (Test-Path "tests")) {
    New-Item -ItemType Directory -Path "tests" -Force
}

@"
import pytest
from app.scheduler import ResourceScheduler

def test_fog_node_communication():
    scheduler = ResourceScheduler()
    test_data = {"device_id": "sensor-01", "cpu_load": 0.75}
    response = scheduler.process_task(test_data)
    assert "status" in response
"@ | Set-Content -Path "tests/test_integration.py"

# ===== PHASE 2: SCALE & OPTIMIZE =====

# 4. Kubernetes deployment
Write-Host "Setting up Kubernetes deployment..."
@"
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fogsmartcontrol
spec:
  replicas: 3
  selector:
    matchLabels:
      app: fsc
  template:
    metadata:
      labels:
        app: fsc
    spec:
      containers:
      - name: main
        image: $DOCKER_USERNAME/fogsmartcontrol:latest
        envFrom:
          - secretRef:
              name: fsc-secrets
        ports:
        - containerPort: 5000
"@ | Set-Content -Path "deployment.yaml"

# 5. MLOps setup
Write-Host "Configuring ML retraining pipeline..."
@"
import mlflow
import pandas as pd
import os
try:
    from models.train_model import train_model
except ImportError:
    # Fallback for initial setup
    def train_model(data, model_type, test_size):
        print("Training placeholder model")
        return "mock_model"

if __name__ == "__main__":
    data_path = os.getenv("TRAINING_DATA", "$TRAINING_DATA")
    print(f"Loading training data from: {data_path}")
    
    # Create dummy data if needed
    if not os.path.exists(data_path):
        print("Creating sample data...")
        pd.DataFrame({
            'feature1': [1, 2, 3],
            'feature2': [4, 5, 6],
            'target': [0, 1, 0]
        }).to_csv(data_path, index=False)
    
    data = pd.read_csv(data_path)
    
    with mlflow.start_run():
        model = train_model(
            data,
            model_type="random_forest",
            test_size=0.2
        )
        mlflow.sklearn.log_model(model, "resource_allocation_model")
        print("✅ Model retrained and logged to MLflow")
"@ | Set-Content -Path "retrain.py"

# ===== PHASE 3: EXTEND FEATURES =====

# 6. MQTT Integration
Write-Host "Adding MQTT support..."
if (-not (Test-Path "app")) {
    New-Item -ItemType Directory -Path "app" -Force
}

@"
import os
import json
import paho.mqtt.client as mqtt

class ResourceScheduler:
    def process_task(self, payload):
        print(f"Processing task: {payload}")
        return {"status": "SCHEDULED"}

scheduler = ResourceScheduler()

def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode())
        print(f"Received from {msg.topic}: {payload}")
        response = scheduler.process_task(payload)
        print(f"Response: {response}")
    except Exception as e:
        print(f"Error processing message: {str(e)}")

client = mqtt.Client()
client.on_message = on_message

broker_addr = os.getenv("BROKER_ADDR", "$MQTT_BROKER")
print(f"Connecting to MQTT broker at {broker_addr}")
client.connect(broker_addr, 1883, 60)
client.subscribe("fog_nodes/#")
print("MQTT client started. Waiting for messages...")
client.loop_forever()
"@ | Set-Content -Path "app/iot_bridge.py"

# ===== COMPLETION =====
Write-Host "`nSETUP COMPLETE!" -ForegroundColor Green
Write-Host "=============================================="
Write-Host "Next steps:"
Write-Host "1. Edit .env file with actual values"
Write-Host "2. Run: docker build -t $DOCKER_USERNAME/fogsmartcontrol ."
Write-Host "3. Test MQTT: docker run -it --rm -e BROKER_ADDR=localhost $DOCKER_USERNAME/fogsmartcontrol python app/iot_bridge.py"
Write-Host "4. In another terminal: mosquitto_pub -t fog_nodes/sensor01 -m '{\"device_id\":\"test01\",\"cpu_load\":0.8}'"
Write-Host "=============================================="

# Install Mosquitto if needed
if (-not (Get-Command mosquitto_pub -ErrorAction SilentlyContinue)) {
    Write-Host "`nInstalling Mosquitto for Windows..." -ForegroundColor Yellow
    winget install --id EclipseFoundation.Mosquitto -e --accept-package-agreements --accept-source-agreements
}