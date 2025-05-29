import numpy as np

class Task:
    """Represents a computational task with resource requirements."""
    def __init__(self, task_id, cpu_cores, memory, storage, bandwidth, location, duration):
        self.task_id = task_id
        self.cpu_cores = cpu_cores
        self.memory = memory
        self.storage = storage
        self.bandwidth = bandwidth
        self.location = location
        self.duration = duration

def generate_tasks(num_tasks, area_size):
    """Generate tasks with random resource requirements and locations."""
    tasks = []
    for i in range(num_tasks):
        location = np.random.uniform(0, area_size, 2)
        cpu_cores = np.random.uniform(0.5, 2)  # 0.5-2 CPU cores
        memory = np.random.uniform(1, 4)  # 1-4 GB RAM
        storage = np.random.uniform(10, 50)  # 10-50 GB storage
        bandwidth = np.random.uniform(10, 100)  # 10-100 Mbps
        duration = np.random.uniform(1, 10)  # 1-10 seconds
        tasks.append(Task(i, cpu_cores, memory, storage, bandwidth, location, duration))
    return tasks
