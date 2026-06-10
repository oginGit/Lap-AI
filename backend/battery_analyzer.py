"""
battery_analyzer.py - ML-driven Battery Health & RUL Prediction
Implements data preprocessing, feature extraction, training, and evaluation.
Uses a Gradient Boosting Regressor for high-accuracy RUL/SOH prediction.
"""

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib
import os

class BatteryMLSystem:
    def __init__(self, model_path="battery_model.pkl"):
        self.model_path = model_path
        self.model = None
        self.scaler = StandardScaler()
        
    def generate_synthetic_data(self, samples=1000):
        """
        Generates synthetic battery degradation data for training.
        Features: Voltage, Current, Temperature, Cycle Count, Internal Resistance
        Targets: SOH (0-100), RUL (Cycles Remaining)
        """
        np.random.seed(42)
        
        # Features
        cycles = np.random.randint(0, 1200, samples)
        temp = 25 + (cycles * 0.01) + np.random.normal(0, 2, samples)
        voltage = 12.6 - (cycles * 0.001) + np.random.normal(0, 0.05, samples)
        internal_resistance = 0.05 + (cycles * 0.0001) + np.random.normal(0, 0.002, samples)
        
        # Targets
        # SOH degradation: nonlinear exponential decay
        soh = 100 * np.exp(-cycles / 5000) + np.random.normal(0, 0.5, samples)
        soh = np.clip(soh, 0, 100)
        
        # RUL: cycles remaining until SOH reaches 70% (approx 1000 cycles)
        rul = np.maximum(0, 1000 - cycles)
        
        df = pd.DataFrame({
            'cycles': cycles,
            'temp': temp,
            'voltage': voltage,
            'internal_resistance': internal_resistance,
            'soh': soh,
            'rul': rul
        })
        return df

    def train(self, df=None):
        """Preprocesses data and trains the Gradient Boosting model."""
        if df is None:
            df = self.generate_synthetic_data()
            
        X = df[['cycles', 'temp', 'voltage', 'internal_resistance']]
        y_soh = df['soh']
        y_rul = df['rul']
        
        # We'll train a multi-output model or two separate ones. Let's do RUL for now.
        X_train, X_test, y_train, y_test = train_test_split(X, y_rul, test_size=0.2, random_state=42)
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Model: Gradient Boosting for robustness against overfitting
        self.model = GradientBoostingRegressor(
            n_estimators=100, 
            learning_rate=0.1, 
            max_depth=4, 
            random_state=42,
            loss='squared_error'
        )
        
        self.model.fit(X_train_scaled, y_train)
        
        # Evaluation
        predictions = self.model.predict(X_test_scaled)
        mae = mean_absolute_error(y_test, predictions)
        rmse = np.sqrt(mean_squared_error(y_test, predictions))
        r2 = r2_score(y_test, predictions)
        
        print(f"Model Training Complete.")
        print(f"MAE: {mae:.2f}")
        print(f"RMSE: {rmse:.2f}")
        print(f"R2 Score: {r2:.4f}")
        
        return {"mae": mae, "rmse": rmse, "r2": r2}

    def predict(self, current_metrics):
        """
        Predicts RUL based on current hardware metrics.
        Input: [cycles, temp, voltage, internal_resistance]
        """
        if self.model is None:
            self.train() # Auto-train if no model
            
        # Reshape for prediction
        features = np.array(current_metrics).reshape(1, -1)
        features_scaled = self.scaler.transform(features)
        
        prediction = self.model.predict(features_scaled)[0]
        return max(0, float(prediction))

# Initialize the system
if __name__ == "__main__":
    analyzer = BatteryMLSystem()
    analyzer.train()
