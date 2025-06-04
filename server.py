from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from detect import load_model, detect_tumor
import base64
from PIL import Image
import io

app = Flask(__name__)
CORS(app)

# Initialize the model
model = load_model()

@app.route('/api/detect', methods=['POST'])
def detect():
    try:
        # Get image data from request
        data = request.json
        if not data or 'image' not in data:
            return jsonify({'error': 'No image data provided'}), 400

        # Decode base64 image
        image_data = data['image'].split(',')[1] if ',' in data['image'] else data['image']
        image_bytes = base64.b64decode(image_data)
        
        # Convert to PIL Image
        image = Image.open(io.BytesIO(image_bytes))
        
        # Save temporarily
        temp_path = 'temp_image.jpg'
        image.save(temp_path)
        
        # Perform detection
        result = detect_tumor(temp_path, model)
        
        # Clean up
        os.remove(temp_path)
        
        return jsonify(result)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000) 