import mlflow
import pandas as pd
import os
from models.train_model import train_model

if __name__ == "__main__":
    # Load dataset from configured path
    data_path = os.getenv("TRAINING_DATA", "data/sensor_data.csv")
    
    # Create data directory if not exists
    os.makedirs(os.path.dirname(data_path), exist_ok=True)
    
    # Create sample data if file doesn't exist
    if not os.path.exists(data_path):
        print("Creating sample data...")
        sample_data = pd.DataFrame({
            'cpu_load': [0.1, 0.5, 0.9],
            'memory_usage': [30, 60, 90],
            'task_complexity': [1, 2, 3],
            'target': [0, 1, 2]
        })
        sample_data.to_csv(data_path, index=False)
    
    data = pd.read_csv(data_path)
    
    with mlflow.start_run():
        model = train_model(
            data,
            model_type="random_forest",
            test_size=0.2
        )
        mlflow.sklearn.log_model(model, "resource_allocation_model")
        print("? Model retrained and logged to MLflow")
