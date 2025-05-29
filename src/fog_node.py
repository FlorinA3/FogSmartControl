import numpy as np

class FogNode:
    """Represents a fog computing node with resource constraints."""
    def __init__(self, node_id, cpu_capacity, memory_capacity, storage_capacity, bandwidth_capacity, location):
        self.node_id = node_id
        self.cpu_capacity = cpu_capacity
        self.memory_capacity = memory_capacity
        self.storage_capacity = storage_capacity
        self.bandwidth_capacity = bandwidth_capacity
        self.location = location
        
        # Available resources (initialize to full capacity)
        self.available_cpu = cpu_capacity
        self.available_memory = memory_capacity
        self.available_storage = storage_capacity
        self.available_bandwidth = bandwidth_capacity
        self.assigned_tasks = []  # List to keep track of assigned tasks

    def allocate_resources(self, task):
        """Allocate resources for a task if available."""
        if (self.available_cpu >= task.cpu_cores and
            self.available_memory >= task.memory and
            self.available_storage >= task.storage and
            self.available_bandwidth >= task.bandwidth):
            
            self.available_cpu -= task.cpu_cores
            self.available_memory -= task.memory
            self.available_storage -= task.storage
            self.available_bandwidth -= task.bandwidth
            self.assigned_tasks.append(task.task_id)
            return True
        return False

def generate_fog_nodes(num_nodes, area_size):
    """Generate fog nodes with random capabilities and locations."""
    nodes = []
    for i in range(num_nodes):
        location = np.random.uniform(0, area_size, 2)
        cpu_capacity = np.random.uniform(4, 8)  # 4-8 CPU cores
        memory_capacity = np.random.uniform(8, 16)  # 8-16 GB RAM
        storage_capacity = np.random.uniform(100, 500)  # 100-500 GB storage
        bandwidth_capacity = np.random.uniform(100, 1000)  # 100-1000 Mbps
        nodes.append(FogNode(i, cpu_capacity, memory_capacity, 
                          storage_capacity, bandwidth_capacity, location))
    return nodes
