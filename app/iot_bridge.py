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
