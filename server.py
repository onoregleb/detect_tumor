from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from detect import load_model, detect_tumor
import base64
from PIL import Image
import io
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Initialize the model
try:
    model = load_model()
    logger.info("Model loaded successfully")
except Exception as e:
    logger.error(f"Failed to load model: {str(e)}")
    model = None

@app.route('/api/health', methods=['GET'])
def health_check():
    if model is None:
        return jsonify({'status': 'unhealthy', 'error': 'Model not loaded'}), 500
    return jsonify({'status': 'healthy'}), 200

@app.route('/api/detect', methods=['POST'])
def detect():
    try:
        # Get image data from request
        data = request.json
        if not data or 'image' not in data:
            return jsonify({'error': 'No image data provided'}), 400

        # Decode base64 image
        try:
            image_data = data['image'].split(',')[1] if ',' in data['image'] else data['image']
            image_bytes = base64.b64decode(image_data)
        except Exception as e:
            logger.error(f"Failed to decode base64 image: {str(e)}")
            return jsonify({'error': 'Invalid image data format'}), 400
        
        # Convert to PIL Image
        try:
            image = Image.open(io.BytesIO(image_bytes))
            if image.mode not in ['RGB', 'L']:
                image = image.convert('RGB')
        except Exception as e:
            logger.error(f"Failed to process image: {str(e)}")
            return jsonify({'error': 'Invalid image format'}), 400
        
        # Save temporarily
        temp_path = 'temp_image.jpg'
        try:
            image.save(temp_path, 'JPEG')
        except Exception as e:
            logger.error(f"Failed to save temporary image: {str(e)}")
            return jsonify({'error': 'Failed to process image'}), 500
        
        # Perform detection
        try:
            if model is None:
                raise Exception("Model not loaded")
            result = detect_tumor(temp_path, model)
        except Exception as e:
            logger.error(f"Detection failed: {str(e)}")
            return jsonify({'error': f'Detection failed: {str(e)}'}), 500
        finally:
            # Clean up
            try:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
            except Exception as e:
                logger.warning(f"Failed to remove temporary file: {str(e)}")
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"Unexpected error in detect endpoint: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000) 