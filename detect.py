from ultralytics import YOLO
import sys
import json
import base64
from PIL import Image
import io
import os

def load_model():
    # Load the YOLO model
    model_path = 'models/brain_tumor.pt'
    
    # Create models directory if it doesn't exist
    os.makedirs('models', exist_ok=True)
    
    # Download the model if it doesn't exist
    if not os.path.exists(model_path):
        print("Downloading brain tumor detection model...")
        model = YOLO('yolov8n.pt')  # Start with base model
        # TODO: Fine-tune the model on brain tumor dataset
        model.save(model_path)
    else:
        model = YOLO(model_path)
    
    return model

def detect_tumor(image_path, model):
    # Load and process the image
    results = model(image_path)
    
    # Process results
    detections = []
    for result in results:
        boxes = result.boxes
        for box in boxes:
            confidence = float(box.conf[0])
            class_id = int(box.cls[0])
            class_name = result.names[class_id]
            
            if class_name == 'tumor':  # Adjust based on your model's class names
                detections.append({
                    'confidence': confidence,
                    'class': class_name,
                    'bbox': box.xyxy[0].tolist()
                })
    
    return {
        'has_tumor': len(detections) > 0,
        'detections': detections,
        'confidence': max([d['confidence'] for d in detections], default=0)
    }

def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No image path provided'}))
        return
    
    image_path = sys.argv[1]
    try:
        model = load_model()
        result = detect_tumor(image_path, model)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({'error': str(e)}))

if __name__ == '__main__':
    main()
