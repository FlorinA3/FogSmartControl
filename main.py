"""
FogSmartControl - Main Entry Point
"""
import yaml
from src.simulation import run_simulation
import sys
import os

def main():
    try:
        # Verify config file exists
        config_path = "config.yaml"
        if not os.path.exists(config_path):
            raise FileNotFoundError(f"'{config_path}' file not found in {os.getcwd()}!")
        
        print(f"Loading configuration from {os.path.abspath(config_path)}")
        with open(config_path, "r") as f:
            config = yaml.safe_load(f)
        
        # Debug: Show loaded configuration
        print("\nLoaded configuration:")
        print(yaml.dump(config))
        
        # Verify config structure
        required_keys = {
            "simulation": ["num_fog_nodes", "num_tasks", "area_size", "seed"],
            "genetic_algorithm": ["population_size", "generations", "mutation_rate", "num_parents"]
        }
        
        for section, keys in required_keys.items():
            if section not in config:
                raise KeyError(f"Missing '{section}' section in config.yaml")
            for key in keys:
                if key not in config[section]:
                    raise KeyError(f"Missing '{key}' in {section} section of config.yaml")
        
        print("\nConfiguration validated successfully!")
        print("Starting FogSmartControl simulation...")
        run_simulation(config)
        print("Simulation completed successfully!")
        
    except Exception as e:
        print(f"\nERROR: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
