import numpy as np
from .fog_node import FogNode
from .task import Task

def generate_initial_population(population_size, num_tasks, num_nodes):
    """Generate initial random population of solutions."""
    return np.random.randint(0, num_nodes, (population_size, num_tasks))

def calculate_fitness(chromosome, fog_nodes, tasks):
    """Calculate fitness of a solution (lower is better)."""
    # Reset all nodes to full capacity
    for node in fog_nodes:
        node.available_cpu = node.cpu_capacity
        node.available_memory = node.memory_capacity
        node.available_storage = node.storage_capacity
        node.available_bandwidth = node.bandwidth_capacity
        node.assigned_tasks = []
    
    total_delay = 0
    penalty = 0
    
    # Process each task assignment
    for task_idx, node_idx in enumerate(chromosome):
        node = fog_nodes[node_idx]
        task = tasks[task_idx]
        
        # Calculate transmission delay (simple Euclidean distance)
        distance = np.linalg.norm(np.array(node.location) - np.array(task.location))
        transmission_delay = distance / 100  # Simplified model
        
        # Calculate processing delay
        processing_delay = task.duration / node.cpu_capacity
        
        # Add to total delay
        total_delay += transmission_delay + processing_delay
        
        # Try to allocate resources
        if not node.allocate_resources(task):
            penalty += 1000000  # Large penalty for invalid allocation
    
    return total_delay + penalty

def selection(population, fitness, num_parents):
    """Select top-performing parents for reproduction."""
    # Select parents with lowest fitness (minimize delay + penalty)
    sorted_indices = np.argsort(fitness)
    return population[sorted_indices[:num_parents]]

def crossover(parents, offspring_size):
    """Create offspring through crossover of parent chromosomes."""
    offspring = np.empty(offspring_size)
    crossover_point = offspring_size[1] // 2
    
    for k in range(offspring_size[0]):
        parent1_idx = k % parents.shape[0]
        parent2_idx = (k + 1) % parents.shape[0]
        
        # First half from parent1, second half from parent2
        offspring[k, 0:crossover_point] = parents[parent1_idx, 0:crossover_point]
        offspring[k, crossover_point:] = parents[parent2_idx, crossover_point:]
    
    return offspring

def mutation(offspring, mutation_rate, num_nodes):
    """Apply random mutations to offspring."""
    for idx in range(offspring.shape[0]):
        if np.random.random() < mutation_rate:
            # Randomly change one task assignment
            task_idx = np.random.randint(0, offspring.shape[1])
            offspring[idx, task_idx] = np.random.randint(0, num_nodes)
    return offspring
