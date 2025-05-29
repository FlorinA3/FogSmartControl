from sklearn.ensemble import RandomForestClassifier
import pandas as pd

def train_model(data: pd.DataFrame, model_type="random_forest", test_size=0.2):
    # Your actual training logic here
    # Placeholder implementation
    model = RandomForestClassifier()
    X = data.drop("target", axis=1)
    y = data["target"]
    model.fit(X, y)
    return model
