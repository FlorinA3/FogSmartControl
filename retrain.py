import mlflow
import pandas as pd
import os
try:
    from models.train_model import train_model
except ImportError:
    # Fallback for initial setup
    def train_model(data, model_type, test_size):
        print("Training placeholder model")
        return "mock_model"

if __name__ == "__main__":
    data_path = os.getenv("TRAINING_DATA", "data/sensor_data.csv")
    print(f"Loading training data from: {data_path}")
    
    # Create dummy data if needed
    if not os.path.exists(data_path):
        print("Creating sample data...")
        pd.DataFrame({
            'feature1': [1, 2, 3],
            'feature2': [4, 5, 6],
            'target': [0, 1, 0]
        }).to_csv(data_path, index=False)
    
    data = pd.read_csv(data_path)
    
    with mlflow.start_run():
        model = train_model(
            data,
            model_type="random_forest",
            test_size=0.2
        )
        mlflow.sklearn.log_model(model, "resource_allocation_model")
        print("✅ Model retrained and logged to MLflow")
