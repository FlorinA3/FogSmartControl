"""
FogSmartControl - Main Entry Point
"""
import yaml
from src.simulation import run_simulation

def main():
    # Load configuration
    with open("config.yaml", "r") as f:
        config = yaml.safe_load(f)
    
    print("Starting FogSmartControl simulation...")
    run_simulation(config)
    print("Simulation completed successfully!")

if __name__ == "__main__":
    main()