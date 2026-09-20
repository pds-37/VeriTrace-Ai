import os

# Try to import YOLO, but don't crash if it's not installed yet (so the backend can still start without it)
try:
    from ultralytics import YOLO
    AI_AVAILABLE = True
except ImportError:
    AI_AVAILABLE = False

class FieldTestPredictor:
    def __init__(self):
        # We look for the trained 'best.pt' file in the same directory as this script
        self.model_path = os.path.join(os.path.dirname(__file__), "best.pt")
        self.model = None

    def load_model(self):
        if not AI_AVAILABLE:
            print("WARNING: 'ultralytics' library is not installed. AI predictions disabled.")
            return False
            
        if not os.path.exists(self.model_path):
            print(f"WARNING: AI Model weights not found at {self.model_path}.")
            print("Please run train.py in Google Colab and paste best.pt here.")
            return False
            
        try:
            self.model = YOLO(self.model_path)
            print("Successfully loaded AI Model!")
            return True
        except Exception as e:
            print(f"Error loading AI model: {e}")
            return False

    def predict(self, image_path: str):
        """
        Takes an image path, runs it through the trained YOLOv8 model, 
        and returns the results (positive/negative/invalid).
        """
        if self.model is None:
            # Try to load it if not loaded
            if not self.load_model():
                return {"status": "error", "message": "Model not loaded. Using fallback heuristics."}

        try:
            # Run inference
            results = self.model(image_path)
            
            # Extract highest confidence prediction
            if len(results) > 0 and len(results[0].boxes) > 0:
                # Get the class ID of the most confident detection
                box = results[0].boxes[0]
                class_id = int(box.cls[0].item())
                confidence = float(box.conf[0].item())
                
                # Map class ID to string name
                class_name = self.model.names[class_id]
                
                return {
                    "status": "success",
                    "prediction": class_name,
                    "confidence": round(confidence * 100, 2),
                    "ai_verified": True
                }
            else:
                return {
                    "status": "success", 
                    "prediction": "No Cassette Detected", 
                    "confidence": 0,
                    "ai_verified": False
                }
                
        except Exception as e:
            return {"status": "error", "message": str(e)}

# Create a singleton instance to be used by the FastAPI routes
predictor = FieldTestPredictor()
