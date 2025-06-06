import pytest
from app.scheduler import ResourceScheduler

def test_fog_node_communication():
    scheduler = ResourceScheduler()
    test_data = {"device_id": "sensor-01", "cpu_load": 0.75}
    response = scheduler.process_task(test_data)
    assert response["status"] == "SCHEDULED"
    assert "assigned_node" in response
