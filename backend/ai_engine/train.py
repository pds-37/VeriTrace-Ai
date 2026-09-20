import os
from ultralytics import YOLO

def train_model():
    print("Initializing YOLOv8 training pipeline...")
    
    # Load a pre-trained YOLOv8 nano model (fastest, optimized for mobile/web backends)
    model = YOLO("yolov8n.pt")
    
    # NOTE: You will need to download your dataset from Roboflow in 'YOLOv8' format.
    # Replace 'data.yaml' with the actual path to your downloaded dataset's data.yaml file.
    dataset_yaml_path = "data.yaml"
    
    if not os.path.exists(dataset_yaml_path):
        print(f"ERROR: Could not find '{dataset_yaml_path}'.")
        print("Please download your dataset from Roboflow and extract it here first.")
        return

    print("Starting training...")
    # Train the model for 50 epochs
    # imgsz=640 is standard for YOLOv8. 
    # device=0 uses the GPU. If you don't have a GPU, remove 'device=0' or run this in Google Colab.
    results = model.train(
        data=dataset_yaml_path,
        epochs=50,
        imgsz=640,
        batch=16,
        device=0, 
        project="field_test_ai",
        name="run_1"
    )
    
    print("Training complete! The best model weights are saved at: field_test_ai/run_1/weights/best.pt")

if __name__ == "__main__":
    train_model()
