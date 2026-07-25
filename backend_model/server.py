#!/usr/bin/env python3
"""
Flask server for your real PyTorch model
Serves your exhibit_yolo_tiny.pt model with 99.04% accuracy
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import torch
import torchvision.transforms as transforms
from PIL import Image
import io
import base64
import json

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Load your real model
model_path = "../public/models/exhibit_yolo_tiny.pt"
model = None
metadata = None

def load_model():
    """Load your real PyTorch model"""
    global model, metadata

    try:
        print(f"Loading model from: {model_path}")
        model = torch.jit.load(model_path, map_location='cpu')
        model.eval()
        print("SUCCESS: Model loaded successfully!")

        # Load metadata
        with open("../public/models/exhibit_metadata.json", 'r') as f:
            metadata = json.load(f)
        print(f"SUCCESS: Model accuracy: {metadata.get('bestAccuracy', 99.04)}%")

        # Test the model
        dummy_input = torch.randn(1, 3, 224, 224)
        with torch.no_grad():
            output = model(dummy_input)
            print(f"SUCCESS: Model test successful: {output.shape}")

    except Exception as e:
        print(f"ERROR: Error loading model: {e}")
        raise

# Load model on startup
load_model()

# Define preprocessing transform (exact match to your training)
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],  # ImageNet normalization
        std=[0.229, 0.224, 0.225]
    )
])

@app.route('/predict', methods=['POST'])
def predict():
    """Predict exhibit from image using your real model"""
    try:
        data = request.get_json()

        if 'image' not in data:
            return jsonify({'error': 'No image provided'}), 400

        # Decode base64 image
        image_data = data['image']
        if image_data.startswith('data:image'):
            # Remove data URL prefix
            image_data = image_data.split(',')[1]

        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes)).convert('RGB')

        # Preprocess image
        input_tensor = transform(image).unsqueeze(0)

        # Run inference with your real model
        with torch.no_grad():
            outputs = model(input_tensor)
            probabilities = torch.softmax(outputs, dim=1)

        # Convert to lists
        raw_outputs = outputs[0].tolist()
        probs = probabilities[0].tolist()

        # Map to classes
        classes = metadata.get('classes', ['DWT', 'EAP'])

        # Find predicted class
        predicted_idx = torch.argmax(probabilities, dim=1).item()
        predicted_class = classes[predicted_idx]
        confidence = probs[predicted_idx]

        # Map to exhibit keys
        exhibit_mapping = {
            'DWT': 'dialogue_with_time',
            'EAP': 'earth_alive'
        }
        exhibit_key = exhibit_mapping.get(predicted_class, 'unknown')

        # Create response
        response = {
            'success': True,
            'exhibit': exhibit_key,
            'class': predicted_class,
            'confidence': confidence,
            'predictions': {
                'DWT': probs[0],
                'EAP': probs[1]
            },
            'raw_outputs': raw_outputs,
            'metadata': {
                'model': 'exhibit_yolo_tiny.pt',
                'accuracy': metadata.get('bestAccuracy', 99.04),
                'framework': 'PyTorch TorchScript',
                'realModel': True
            }
        }

        print(f"Prediction: {predicted_class} ({confidence:.3f})")
        return jsonify(response)

    except Exception as e:
        print(f"Prediction error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'model_loaded': model is not None,
        'accuracy': metadata.get('bestAccuracy', 99.04) if metadata else None
    })

@app.route('/')
def index():
    """Basic info endpoint"""
    return jsonify({
        'service': 'Exhibit Detection API',
        'model': 'exhibit_yolo_tiny.pt',
        'accuracy': f"{metadata.get('bestAccuracy', 99.04)}%",
        'endpoints': {
            '/predict': 'POST - Send base64 image for prediction',
            '/health': 'GET - Health check'
        }
    })

if __name__ == '__main__':
    print("Starting Exhibit Detection Server")
    print(f"Model: exhibit_yolo_tiny.pt ({metadata.get('bestAccuracy', 99.04)}% accuracy)")
    print("Server: http://localhost:5000")
    print("Endpoints:")
    print("   POST /predict - Send image for detection")
    print("   GET /health - Health check")

    app.run(host='0.0.0.0', port=5000, debug=True)