import numpy as np
from .fog_node import generate_fog_nodes
from .task import generate_tasks
from .genetic_algorithm import (
    generate_initial_population,
    calculate_fitness,
    selection,
    crossover,
    mutation
)

def run_simulation(config):
    """Run the fog computing simulation with genetic algorithm optimization."""
    # Set random seed for reproducibility
    np.random.seed(config["simulation"]["seed"])
    
    # Initialize fog nodes and tasks
    fog_nodes = generate_fog_nodes(
        config["simulation"]["num_fog_nodes"],
        config["simulation"]["area_size"]
    )
    tasks = generate_tasks(
        config["simulation"]["num_tasks"],
        config["simulation"]["area_size"]
    )
    
    # Genetic Algorithm parameters
    population_size = config["genetic_algorithm"]["population_size"]
    num_generations = config["genetic_algorithm"]["generations"]
    mutation_rate = config["genetic_algorithm"]["mutation_rate"]
    num_parents = config["genetic_algorithm"]["num_parents"]
    
    # Generate initial population
    population = generate_initial_population(
        population_size,
        len(tasks),
        len(fog_nodes)
    )
    
    # Run genetic algorithm
    for generation in range(num_generations):
        # Calculate fitness for all chromosomes
        fitness = np.array([calculate_fitness(chromosome, fog_nodes, tasks) 
                          for chromosome in population])
        
        # Select parents
        parents = selection(population, fitness, num_parents)
        
        # Create offspring
        offspring = crossover(
            parents,
            (population_size - num_parents, len(tasks))
        )
        
        # Mutate offspring
        offspring = mutation(offspring, mutation_rate, len(fog_nodes))
        
        # Create new population
        population = np.vstack((parents, offspring))
        
        # Find best solution
        best_fitness_idx = np.argmin(fitness)
        best_chromosome = population[best_fitness_idx]
        
        print(f"Generation {generation+1}/{num_generations}: Best Fitness = {fitness[best_fitness_idx]:.2f}")
    
    # Final evaluation
    best_fitness = calculate_fitness(best_chromosome, fog_nodes, tasks)
    print("\n=== Final Result ===")
    print(f"Best Chromosome: {best_chromosome}")
    print(f"Best Fitness: {best_fitness:.2f}")
    
    # Show task assignments
    print("\nTask Assignments:")
    for task_idx, node_idx in enumerate(best_chromosome):
        print(f"Task {task_idx} -> Fog Node {node_idx}")
    
    # Show node utilization
    print("\nNode Utilization:")
    for node in fog_nodes:
        cpu_util = 100 * (1 - node.available_cpu / node.cpu_capacity)
        mem_util = 100 * (1 - node.available_memory / node.memory_capacity)
        print(f"Node {node.node_id}: CPU {cpu_util:.1f}%, Memory {mem_util:.1f}%, Tasks: {len(node.assigned_tasks)}")
