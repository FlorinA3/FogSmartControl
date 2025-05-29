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

broker_addr = os.getenv("BROKER_ADDR", "localhost")
print(f"Connecting to MQTT broker at {broker_addr}")
client.connect(broker_addr, 1883, 60)
client.subscribe("fog_nodes/#")
print("MQTT client started. Waiting for messages...")
client.loop_forever()
