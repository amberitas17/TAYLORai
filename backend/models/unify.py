import os
import numpy as np
import cv2
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import io
import base64
import logging
import requests
import time
import psutil
import gc
from werkzeug.utils import secure_filename
from inference_sdk import InferenceHTTPClient
import tensorflow as tf
from tensorflow import keras
try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError as e:
    print(f"YOLO import failed: {e}")
    YOLO_AVAILABLE = False
import torch
import torch.nn.functional as F
from torchvision import transforms
from PIL import Image

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Global variables for models
emotion_model = None
age_gender_model = None
face_cascade = None
yolo_model = None
yolo_emotion_model = None
mobilenet_model = None
device = None

# Memory management constants - Optimized for deployment
MAX_MEMORY_MB = 1200  # 1.2GB limit for more aggressive memory management  
MEMORY_CHECK_INTERVAL = 10  # Check memory more frequently
request_counter = 0

def get_memory_usage():
    """Get current memory usage in MB"""
    process = psutil.Process(os.getpid())
    return process.memory_info().rss / 1024 / 1024

def log_memory_usage(context=""):
    """Log current memory usage"""
    memory_mb = get_memory_usage()
    logger.info(f"Memory usage {context}: {memory_mb:.1f}MB")
    return memory_mb

def unload_all_models():
    """Unload all models to free memory"""
    global emotion_model, yolo_emotion_model, age_gender_model, yolo_model, mobilenet_model
    
    try:
        if emotion_model is not None:
            del emotion_model
            emotion_model = None
            logger.info("Keras emotion model unloaded")
    except:
        pass
    
    try:
        if yolo_emotion_model is not None:
            del yolo_emotion_model
            yolo_emotion_model = None
            logger.info("YOLO emotion model unloaded")
    except:
        pass
    
    try:
        if age_gender_model is not None:
            del age_gender_model
            age_gender_model = None
            logger.info("Age gender model unloaded")
    except:
        pass
    
    try:
        if yolo_model is not None:
            del yolo_model
            yolo_model = None
            logger.info("YOLO exhibit model unloaded")
    except:
        pass
    
    try:
        if mobilenet_model is not None:
            del mobilenet_model
            mobilenet_model = None
            logger.info("MobileNet model unloaded")
    except:
        pass
    
    # Force garbage collection
    import gc
    for _ in range(3):
        gc.collect()

def emergency_cleanup():
    """Emergency memory cleanup when approaching limits"""
    logger.warning("Emergency memory cleanup initiated")
    
    # Force unload all models
    unload_all_models()
    
    # Clear TensorFlow session
    try:
        tf.keras.backend.clear_session()
    except:
        pass
    
    # Clear PyTorch cache
    try:
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except:
        pass
    
    # Aggressive garbage collection
    for i in range(10):
        gc.collect()
    
    memory_after = log_memory_usage("after emergency cleanup")
    return memory_after

# AssemblyAI configuration
ASSEMBLYAI_API_KEY = os.getenv("ASSEMBLYAI_API_KEY")
ASSEMBLYAI_BASE_URL = "https://api.assemblyai.com"

# Model configuration
GENDER_LABELS = ['Male', 'Female']
EMOTION_LABELS = ['Angry', 'Disgust', 'Fear', 'Happy', 'Neutral', 'Sad', 'Surprise']

# Exhibit labels (matches classes from LightViT model)
EXHIBIT_LABELS = {
    0: 'dialogue_with_time',
    1: 'earth_alive'
}

def _label_name(class_id):
    """Always use EXHIBIT_LABELS to ensure consistent key format."""
    result = EXHIBIT_LABELS.get(int(class_id), "unknown")
    logger.info(f"_label_name({class_id}) -> '{result}'")
    return result
def load_models():
    """Load all local models on startup"""
    global emotion_model, age_gender_model, face_cascade, yolo_model, mobilenet_model, device
    
    try:
        # Force CPU usage for local deployment
        device = torch.device('cpu')  # Always use CPU for local deployment
        logger.info(f"Using CPU for local deployment: {device}")
        
        # Validate API keys
        if not ASSEMBLYAI_API_KEY:
            logger.warning("ASSEMBLYAI_API_KEY not set - audio transcription will not work")
        
        # Load Haar cascade for face detection
        logger.info("Loading Haar cascade for face detection...")
        cascade_path = os.path.join('asset', 'haarcascade_frontalface_default.xml')
        if os.path.exists(cascade_path):
            face_cascade = cv2.CascadeClassifier(cascade_path)
            logger.info("Face detection cascade loaded successfully")
        else:
            logger.error(f"Haar cascade not found at {cascade_path}")
            
        # Load YOLO emotion model (FALLBACK)
        logger.info("Loading YOLO emotion model as fallback...")
        yolo_emotion_model_path = "best_retinaface_emotion_model_quantized.pt"
        if YOLO_AVAILABLE and os.path.exists(yolo_emotion_model_path):
            try:
                yolo_emotion_model = YOLO(yolo_emotion_model_path)
                logger.info("YOLO emotion model loaded successfully as FALLBACK")
            except Exception as e:
                logger.error(f"Failed to load YOLO emotion model: {e}")
                yolo_emotion_model = None
        else:
            if not YOLO_AVAILABLE:
                logger.warning("YOLO library not available for emotion detection")
            else:
                logger.warning(f"YOLO emotion model not found at {yolo_emotion_model_path}")
            yolo_emotion_model = None
        
        # Load local emotion model (PRIMARY)
        logger.info("Loading local emotion model as primary...")
        emotion_model_path = "Emotion_little_vgg.h5"
        if os.path.exists(emotion_model_path):
            try:
                # Try to load as complete model first
                emotion_model = keras.models.load_model(emotion_model_path)
                logger.info("Local emotion model loaded successfully as PRIMARY (complete model)")
            except ValueError as e:
                if "No model config found" in str(e):
                    logger.warning("Emotion_little_vgg.h5 contains weights only, need model architecture")
                    logger.info("Creating Little VGG architecture for emotion recognition...")

                    # Create a Little VGG architecture for emotion recognition (48x48x1 -> 7 classes)
                    emotion_model = keras.Sequential([
                        # Block 1
                        keras.layers.Conv2D(32, (3, 3), activation='relu', padding='same', input_shape=(48, 48, 1)),
                        keras.layers.Conv2D(32, (3, 3), activation='relu', padding='same'),
                        keras.layers.MaxPooling2D((2, 2), strides=(2, 2)),

                        # Block 2
                        keras.layers.Conv2D(64, (3, 3), activation='relu', padding='same'),
                        keras.layers.Conv2D(64, (3, 3), activation='relu', padding='same'),
                        keras.layers.MaxPooling2D((2, 2), strides=(2, 2)),

                        # Block 3
                        keras.layers.Conv2D(128, (3, 3), activation='relu', padding='same'),
                        keras.layers.Conv2D(128, (3, 3), activation='relu', padding='same'),
                        keras.layers.MaxPooling2D((2, 2), strides=(2, 2)),

                        # Block 4 (smaller for "little" VGG)
                        keras.layers.Conv2D(256, (3, 3), activation='relu', padding='same'),
                        keras.layers.Conv2D(256, (3, 3), activation='relu', padding='same'),
                        keras.layers.MaxPooling2D((2, 2), strides=(2, 2)),

                        # Classifier
                        keras.layers.Flatten(),
                        keras.layers.Dense(512, activation='relu'),
                        keras.layers.Dropout(0.5),
                        keras.layers.Dense(256, activation='relu'),
                        keras.layers.Dropout(0.5),
                        keras.layers.Dense(7, activation='softmax')  # 7 emotion classes
                    ])

                    try:
                        # Try to load weights into the architecture
                        emotion_model.load_weights(emotion_model_path)
                        logger.info("Local emotion model architecture created and weights loaded successfully as PRIMARY")
                    except Exception as weight_error:
                        logger.error(f"Failed to load weights into architecture: {weight_error}")
                        emotion_model = None
                else:
                    logger.error(f"Failed to load emotion model: {e}")
                    emotion_model = None
            except Exception as e:
                logger.error(f"Failed to load emotion model: {e}")
                emotion_model = None
        else:
            logger.warning(f"Emotion model not found at {emotion_model_path}")
            emotion_model = None
            
        # Load local age gender model
        logger.info("Loading local age gender model...")
        age_gender_model_path = os.path.join('asset', 'age_gender_model.h5')
        if os.path.exists(age_gender_model_path):
            age_gender_model = keras.models.load_model(age_gender_model_path)
            logger.info("Local age gender model loaded successfully")
        else:
            logger.error(f"Age gender model not found at {age_gender_model_path}")
            
        # Load MobileNet model for exhibit detection
        logger.info("Loading MobileNet model...")
        mobilenet_model_path = "best_model.pth"
        if False:  # Temporarily disabled due to architecture mismatch
            checkpoint = torch.load(mobilenet_model_path, map_location=device)
            logger.info(f"MobileNet checkpoint loaded, type: {type(checkpoint)}")
            
            if isinstance(checkpoint, dict):
                if 'model' in checkpoint:
                    mobilenet_model = checkpoint['model']
                elif 'model_state_dict' in checkpoint:
                    try:
                        import timm
                        num_classes = 2
                        mobilenet_model = timm.create_model('mobilenetv3_small_100', pretrained=False, num_classes=num_classes, in_chans=3)
                    except ImportError:
                        logger.warning("timm not available, falling back to torchvision MobileNetV3")
                        from torchvision.models import mobilenet_v3_small
                        num_classes = 2
                        mobilenet_model = mobilenet_v3_small(pretrained=False, num_classes=num_classes)
                    mobilenet_model.load_state_dict(checkpoint['model_state_dict'])
                elif 'state_dict' in checkpoint:
                    try:
                        import timm
                        num_classes = 2
                        mobilenet_model = timm.create_model('mobilenetv3_small_100', pretrained=False, num_classes=num_classes, in_chans=3)
                    except ImportError:
                        logger.warning("timm not available, falling back to torchvision MobileNetV3")
                        from torchvision.models import mobilenet_v3_small
                        num_classes = 2
                        mobilenet_model = mobilenet_v3_small(pretrained=False, num_classes=num_classes)
                    mobilenet_model.load_state_dict(checkpoint['state_dict'])
                else:
                    try:
                        import timm
                        num_classes = 2
                        mobilenet_model = timm.create_model('mobilenetv3_small_100', pretrained=False, num_classes=num_classes, in_chans=3)
                    except ImportError:
                        logger.warning("timm not available, falling back to torchvision MobileNetV3")
                        from torchvision.models import mobilenet_v3_small
                        num_classes = 2
                        mobilenet_model = mobilenet_v3_small(pretrained=False, num_classes=num_classes)
                    mobilenet_model.load_state_dict(checkpoint)
            else:
                mobilenet_model = checkpoint
            
            mobilenet_model = mobilenet_model.to(device)
            mobilenet_model.eval()
            logger.info("MobileNet model loaded successfully")
        else:
            logger.warning(f"MobileNet model not found at {mobilenet_model_path}")
            
        # Load YOLO model (PRIMARY MODEL)
        logger.info("Loading YOLO model as primary detection model...")
        yolo_model_path = "yolov8_model.pt"
        if YOLO_AVAILABLE and os.path.exists(yolo_model_path):
            try:
                yolo_model = YOLO(yolo_model_path)
                logger.info("YOLO model loaded successfully as PRIMARY model")
            except Exception as e:
                logger.error(f"Failed to load YOLO model: {e}")
                yolo_model = None
        else:
            if not YOLO_AVAILABLE:
                logger.warning("YOLO library not available - install ultralytics package")
            else:
                logger.warning(f"YOLO model not found at {yolo_model_path}")
            yolo_model = None
        
    except Exception as e:
        logger.error(f"Error loading models: {str(e)}")
        raise e

def decode_base64_image(base64_string):
    """Decode base64 image string to OpenCV format"""
    try:
        # Clean the base64 string
        if not base64_string:
            raise ValueError("Empty base64 string provided")
            
        # Remove data URL prefix if present
        if ',' in base64_string:
            base64_string = base64_string.split(',')[1]
        
        # Remove any whitespace and newlines
        base64_string = base64_string.strip().replace('\n', '').replace('\r', '')
        
        # Fix padding if necessary
        # Base64 strings should be divisible by 4
        missing_padding = len(base64_string) % 4
        if missing_padding:
            base64_string += '=' * (4 - missing_padding)
            
        # Validate base64 string contains only valid characters
        import string
        valid_chars = string.ascii_letters + string.digits + '+/='
        if not all(c in valid_chars for c in base64_string):
            raise ValueError("Invalid characters in base64 string")
        
        # Decode base64
        image_data = base64.b64decode(base64_string)
        
        # Validate decoded data
        if len(image_data) == 0:
            raise ValueError("Decoded image data is empty")
        
        # Convert to PIL Image
        pil_image = Image.open(io.BytesIO(image_data))
        
        # Validate image
        if pil_image.size[0] == 0 or pil_image.size[1] == 0:
            raise ValueError("Invalid image dimensions")
        
        # Convert to OpenCV format (BGR)
        opencv_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
        
        # Memory cleanup
        del image_data, pil_image
        import gc
        gc.collect()
        
        return opencv_image
    except Exception as e:
        logger.error(f"Error decoding base64 image: {str(e)}")
        logger.error(f"Base64 string length: {len(base64_string) if 'base64_string' in locals() else 'unknown'}")
        logger.error(f"Base64 string preview: {base64_string[:50] if 'base64_string' in locals() and len(base64_string) > 50 else 'N/A'}...")
        
        # Memory cleanup on error
        if 'image_data' in locals():
            del image_data
        if 'pil_image' in locals():
            del pil_image
        import gc
        gc.collect()
        
        raise e


# MobileNet Exhibit Detection Functions with memory cleanup
def preprocess_image_for_mobilenet(image, image_size=128):
    """Preprocess image for MobileNet model inference"""
    try:
        # Convert BGR (OpenCV) to RGB
        if len(image.shape) == 3 and image.shape[2] == 3:
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        else:
            image_rgb = image
            
        # Convert to PIL Image
        pil_image = Image.fromarray(image_rgb)
        
        # Define transforms for MobileNet (ImageNet preprocessing)
        transform = transforms.Compose([
            transforms.Resize((image_size, image_size)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
        
        # Apply transforms and add batch dimension
        tensor_image = transform(pil_image).unsqueeze(0)
        
        # ✅ CLEANUP INTERMEDIATE PROCESSING DATA
        logger.debug("🗑️ Clearing intermediate image preprocessing data...")
        del image_rgb, pil_image, transform
        import gc
        gc.collect()
        
        return tensor_image
        
    except Exception as e:
        logger.error(f"Error preprocessing image for MobileNet: {str(e)}")
        # ✅ CLEANUP ON ERROR
        if 'image_rgb' in locals():
            del image_rgb
        if 'pil_image' in locals():
            del pil_image
        if 'tensor_image' in locals():
            del tensor_image
        import gc
        gc.collect()
        return None

def detect_exhibit_mobilenet(image):
    """Detect exhibit using MobileNet model"""
    try:
        if mobilenet_model is None:
            logger.error("MobileNet model not loaded")
            return {'exhibit': 'unknown', 'confidence': 0.0, 'error': 'MobileNet model not loaded'}
        
        # Preprocess image
        processed_image = preprocess_image_for_mobilenet(image)
        if processed_image is None:
            return {'exhibit': 'unknown', 'confidence': 0.0, 'error': 'Image preprocessing failed'}
        
        # Move to device
        processed_image = processed_image.to(device)
        
        # Run inference
        with torch.no_grad():
            outputs = mobilenet_model(processed_image)
            
            # Apply softmax to get probabilities
            probs = F.softmax(outputs, dim=1)
            
            # Get top prediction
            confidence, predicted_class = torch.max(probs, 1)
            predicted_class = predicted_class.item()
            confidence = confidence.item()
            
            # Get exhibit name
            exhibit = _label_name(predicted_class)
            
            # Get top 5 predictions for debugging
            top5_probs, top5_classes = torch.topk(probs, min(5, len(EXHIBIT_LABELS)), dim=1)
            top5_predictions = []
            for i in range(len(top5_classes[0])):
                class_id = top5_classes[0][i].item()
                prob = top5_probs[0][i].item()
                top5_predictions.append({
                    'exhibit': _label_name(class_id),
                    'confidence': prob,
                    'class_id': class_id
                })
            
            logger.info(f"[MobileNet] exhibit={exhibit} conf={confidence:.3f} class_id={predicted_class}")
            top5_list = [(item['exhibit'], f"{item['confidence']:.3f}") for item in top5_predictions]
            logger.info(f"[MobileNet] Top predictions: {top5_list}")
            
            result = {
                'exhibit': exhibit,
                'confidence': confidence,
                'class_id': predicted_class,
                'all_detections': top5_predictions
            }
            
            # Memory cleanup
            del outputs, probs, top5_probs, top5_classes, processed_image
            import gc
            gc.collect()
            
            return result
            
    except Exception as e:
        logger.error(f"Error in MobileNet exhibit detection: {str(e)}")
        # Memory cleanup on error
        if 'processed_image' in locals():
            del processed_image
        if 'outputs' in locals():
            del outputs
        if 'probs' in locals():
            del probs
        import gc
        gc.collect()
        return {'exhibit': 'unknown', 'confidence': 0.0, 'error': str(e)}

# YOLO Exhibit Detection Functions with memory cleanup (fallback)
def detect_exhibit_yolo(image):
    """Detect exhibit using YOLO model (supports classification and detection)."""
    try:
        if yolo_model is None:
            logger.error("YOLO model not loaded")
            return {'exhibit': 'unknown', 'confidence': 0.0, 'error': 'YOLO model not loaded'}

        res = yolo_model.predict(image, verbose=False)[0]

        # ---- Classification path (YOLOv8-CLS) ----
        if hasattr(res, "probs") and res.probs is not None:
            probs = res.probs
            top1 = int(probs.top1)
            conf = float(probs.top1conf)
            topk = []
            for idx in probs.top5:
                idx = int(idx)
                topk.append({
                    'exhibit': _label_name(idx),
                    'confidence': float(probs.data[idx].item()),
                    'class_id': idx
                })
            exhibit = _label_name(top1)
            logger.info(f"[CLS] exhibit={exhibit} conf={conf:.3f} class_id={top1}")
            top5_list = [(item['exhibit'], f"{item['confidence']:.3f}") for item in topk]
            logger.info(f"[CLS] Top 5 predictions: {top5_list}")
            
            result = {'exhibit': exhibit, 'confidence': conf, 'class_id': top1, 'all_detections': topk}
            
            # Memory cleanup
            del res, probs
            import gc
            gc.collect()
            
            return result

        # ---- Detection path (YOLOv8 DET/SEG) ----
        if not getattr(res, "boxes", None) or len(res.boxes) == 0:
            # Memory cleanup for empty result
            del res
            import gc
            gc.collect()
            return {'exhibit': 'unknown', 'confidence': 0.0}

        confs = res.boxes.conf.cpu().numpy()
        clss = res.boxes.cls.cpu().numpy().astype(int)
        i = int(confs.argmax())
        exhibit = _label_name(int(clss[i]))
        conf = float(confs[i])

        logger.info(f"[DET] exhibit={exhibit} conf={conf:.3f} class_id={int(clss[i])}")
        all_detections_list = [(int(c), _label_name(int(c)), f"{cf:.3f}") for c, cf in zip(clss, confs)]
        logger.info(f"[DET] All detections: {all_detections_list}")
        
        result = {
            'exhibit': exhibit,
            'confidence': conf,
            'class_id': int(clss[i]),
            'all_detections': [
                {'exhibit': _label_name(int(c)), 'confidence': float(cf), 'class_id': int(c)}
                for c, cf in zip(clss, confs)
            ]
        }
        
        # Memory cleanup
        del res, confs, clss
        import gc
        gc.collect()
        
        return result

    except Exception as e:
        logger.error(f"Error in YOLO exhibit detection: {str(e)}")
        # Memory cleanup on error
        import gc
        gc.collect()
        return {'exhibit': 'unknown', 'confidence': 0.0, 'error': str(e)}

# Face Analysis Functions
def predict_age_gender_local(image_base64):
    """Predict age and gender using local age_gender_model.h5"""
    global age_gender_model, face_cascade
    
    try:
        if age_gender_model is None:
            logger.error("Age gender model not loaded")
            return {
                'age_group': "Adult",
                'estimated_age': 25,
                'confidence': 0.0,
                'gender': "Unknown",
                'gender_confidence': 0.0,
                'error': 'Age gender model not loaded'
            }
            
        if face_cascade is None:
            logger.error("Face cascade not loaded")
            return {
                'age_group': "Adult", 
                'estimated_age': 25,
                'confidence': 0.0,
                'gender': "Unknown",
                'gender_confidence': 0.0,
                'error': 'Face detection not available'
            }
            
        logger.info("Predicting age and gender with local model...")
        
        # Decode base64 image
        image = decode_base64_image(image_base64)
        if image is None:
            raise ValueError("Failed to decode base64 image")
            
        # Detect faces first
        faces = detect_faces(image)
        if len(faces) == 0:
            logger.warning("No faces detected for age/gender prediction")
            return {
                'age_group': "Adult",
                'estimated_age': 25,
                'confidence': 0.0,
                'gender': "Unknown", 
                'gender_confidence': 0.0,
                'error': 'No face detected in the image'
            }
            
        # Use the largest face for prediction
        largest_face = max(faces, key=lambda face: face[2] * face[3])
        x, y, w, h = largest_face
        
        logger.info(f"Using largest face for age/gender prediction: ({x}, {y}, {w}, {h})")
        
        # Extract and preprocess face region
        face_img = image[y:y+h, x:x+w]
        
        # Resize to expected input size (typically 224x224 or similar for age/gender models)
        face_resized = cv2.resize(face_img, (224, 224))
        
        # Normalize to [0,1] range
        face_normalized = face_resized.astype('float32') / 255.0
        
        # Add batch dimension
        face_batch = np.expand_dims(face_normalized, axis=0)
        
        # Make prediction
        predictions = age_gender_model.predict(face_batch, verbose=0)
        
        # Age/gender models typically output [age, gender] or separate outputs
        # Assuming the model outputs age as continuous value and gender as binary classification
        if isinstance(predictions, list) and len(predictions) == 2:
            # Separate age and gender outputs
            age_pred = predictions[0][0][0]  # Age prediction
            gender_pred = predictions[1][0]   # Gender prediction (probabilities)
        else:
            # Single output with age and gender combined
            age_pred = predictions[0][0]  # First output is age
            gender_pred = predictions[0][1:]  # Rest is gender
            
        # Process age prediction
        estimated_age = max(1, min(100, int(age_pred)))  # Clamp to reasonable range
        
        if estimated_age <= 18:
            age_group = "Child"
        elif estimated_age <= 60:
            age_group = "Adult" 
        else:
            age_group = "Adult"  # Keep as Adult for consistency
            
        # Process gender prediction
        if len(gender_pred) >= 2:
            gender_confidence = float(np.max(gender_pred))
            gender_idx = np.argmax(gender_pred)
            gender = GENDER_LABELS[gender_idx] if gender_idx < len(GENDER_LABELS) else "Unknown"
        else:
            # Binary gender prediction
            gender_confidence = float(gender_pred[0]) if len(gender_pred) > 0 else 0.5
            gender = "Female" if gender_confidence > 0.5 else "Male"
            if gender == "Female":
                gender_confidence = gender_confidence
            else:
                gender_confidence = 1.0 - gender_confidence
        
        age_confidence = min(1.0, max(0.1, gender_confidence))  # Use gender confidence as proxy for age confidence
        
        logger.info(f"Local age/gender prediction: Age={estimated_age} ({age_group}), Gender={gender} (conf={gender_confidence:.3f})")
        
        result = {
            'age_group': age_group,
            'estimated_age': estimated_age,
            'confidence': age_confidence,
            'gender': gender,
            'gender_confidence': gender_confidence,
            'raw_age': float(age_pred),
            'face_coordinates': largest_face.tolist()
        }
        
        # Memory cleanup
        del image, faces, face_img, face_resized, face_normalized, face_batch, predictions
        import gc
        gc.collect()
        
        return result
        
    except Exception as e:
        logger.error(f"Error in local age/gender prediction: {str(e)}")
        
        # Memory cleanup on error
        if 'image' in locals():
            del image
        if 'faces' in locals():
            del faces
        if 'face_img' in locals():
            del face_img
        if 'face_batch' in locals():
            del face_batch
        import gc
        gc.collect()
        
        return {
            'age_group': "Adult",
            'estimated_age': 25,
            'confidence': 0.5,
            'gender': "Unknown",
            'gender_confidence': 0.5,
            'error': str(e)
        }


def detect_faces(image):
    """Detect faces in the image using Haar cascade with memory cleanup"""
    try:
        if face_cascade is None:
            logger.error("Face cascade not loaded")
            return []
            
        # Convert to grayscale if needed
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
            
        # Detect faces - More sensitive parameters
        faces = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.05,    # Smaller scale factor for more detection
            minNeighbors=3,      # Lower neighbors for more sensitivity  
            minSize=(20, 20),    # Smaller minimum face size
            maxSize=(640, 640),  # Add maximum size limit
            flags=cv2.CASCADE_SCALE_IMAGE
        )
        
        # If no faces detected, try with even more sensitive parameters
        if len(faces) == 0:
            logger.info("No faces found with default parameters, trying more sensitive detection...")
            faces = face_cascade.detectMultiScale(
                gray,
                scaleFactor=1.03,    # Even smaller scale factor
                minNeighbors=2,      # Even lower neighbors
                minSize=(15, 15),    # Very small minimum face size
                maxSize=(800, 800),  # Larger maximum size
                flags=cv2.CASCADE_SCALE_IMAGE
            )
        
        logger.info(f"Detected {len(faces)} face(s) in the image")
        
        # Memory cleanup
        del gray
        import gc
        gc.collect()
        
        return faces
        
    except Exception as e:
        logger.error(f"Error detecting faces: {str(e)}")
        # Memory cleanup on error
        if 'gray' in locals():
            del gray
        import gc
        gc.collect()
        return []

def preprocess_image_for_emotion(image, face_coords=None):
    """Preprocess image for emotion model (48x48x1) with optional face cropping and memory cleanup"""
    try:
        # Convert to grayscale if needed
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
            
        # If face coordinates are provided, crop to the face region
        if face_coords is not None:
            x, y, w, h = face_coords
            gray = gray[y:y+h, x:x+w]
            
        # Resize to 48x48
        resized = cv2.resize(gray, (48, 48))
        
        # Normalize pixel values to [0, 1]
        normalized = resized.astype('float32') / 255.0
        
        # Add batch and channel dimensions
        processed = np.expand_dims(normalized, axis=[0, -1])
        
        # Memory cleanup
        del gray, resized, normalized
        import gc
        gc.collect()
        
        return processed
        
    except Exception as e:
        logger.error(f"Error preprocessing image for emotion: {str(e)}")
        # Memory cleanup on error
        if 'gray' in locals():
            del gray
        if 'resized' in locals():
            del resized
        if 'normalized' in locals():
            del normalized
        import gc
        gc.collect()
        return None

def predict_emotion_yolo(image_base64):
    """Predict emotion using YOLO emotion detection model"""
    global yolo_emotion_model
    
    try:
        if yolo_emotion_model is None:
            logger.error("YOLO emotion model not loaded")
            return {
                'predicted_emotion': 'Neutral',
                'confidence': 0.0,
                'all_emotions': {emotion: 0.14 for emotion in EMOTION_LABELS},
                'detections_count': 0,
                'error': 'YOLO emotion model not loaded'
            }
            
        logger.info("Predicting emotion with YOLO model...")
        
        # Decode base64 image
        image = decode_base64_image(image_base64)
        if image is None:
            raise ValueError("Failed to decode base64 image")
            
        # Run YOLO emotion detection
        results = yolo_emotion_model.predict(image, verbose=False)
        
        if not results or len(results) == 0:
            logger.warning("No emotion detections found")
            return {
                'predicted_emotion': 'Neutral',
                'confidence': 0.0,
                'all_emotions': {emotion: 0.14 for emotion in EMOTION_LABELS},
                'detections_count': 0,
                'error': 'No emotion detections found'
            }
        
        result = results[0]
        
        # Check if we have detection boxes (face detection + emotion classification)
        if hasattr(result, 'boxes') and result.boxes is not None and len(result.boxes) > 0:
            # Get the detection with highest confidence
            confidences = result.boxes.conf.cpu().numpy()
            classes = result.boxes.cls.cpu().numpy().astype(int)
            
            # Find best detection
            best_idx = np.argmax(confidences)
            predicted_class = int(classes[best_idx])
            confidence = float(confidences[best_idx])
            
            # Map class ID to emotion
            if predicted_class < len(EMOTION_LABELS):
                predicted_emotion = EMOTION_LABELS[predicted_class]
            else:
                predicted_emotion = 'Neutral'
                confidence = 0.0
            
            # Create all emotions dictionary
            all_emotions = {emotion: 0.0 for emotion in EMOTION_LABELS}
            for i, conf in enumerate(confidences):
                if i < len(EMOTION_LABELS):
                    all_emotions[EMOTION_LABELS[classes[i]]] = float(conf)
            
            # Ensure all emotions sum close to 1.0 or at least have some distribution
            total = sum(all_emotions.values())
            if total == 0:
                # Distribute equally if no emotions detected
                for emotion in all_emotions:
                    all_emotions[emotion] = 1.0 / len(EMOTION_LABELS)
            
            detections_count = len(result.boxes)
            
            # Get bounding box of best detection
            best_box = result.boxes.xyxy[best_idx].cpu().numpy()
            face_coordinates = [int(best_box[0]), int(best_box[1]), 
                              int(best_box[2] - best_box[0]), int(best_box[3] - best_box[1])]
            
        else:
            # No detections found
            logger.warning("YOLO emotion model found no face detections")
            return {
                'predicted_emotion': 'Neutral',
                'confidence': 0.0,
                'all_emotions': {emotion: 0.14 for emotion in EMOTION_LABELS},
                'detections_count': 0,
                'error': 'No face detected by YOLO emotion model'
            }
        
        logger.info(f"YOLO emotion prediction: {predicted_emotion} with confidence {confidence:.3f}")
        
        result_dict = {
            'predicted_emotion': predicted_emotion,
            'confidence': confidence,
            'all_emotions': all_emotions,
            'detections_count': detections_count,
            'face_coordinates': face_coordinates
        }
        
        # Memory cleanup
        del image, results, result
        import gc
        gc.collect()
        
        return result_dict
        
    except Exception as e:
        logger.error(f"Error in YOLO emotion prediction: {str(e)}")
        # Memory cleanup on error
        if 'image' in locals():
            del image
        if 'results' in locals():
            del results
        import gc
        gc.collect()
        return {
            'predicted_emotion': 'Neutral',
            'confidence': 0.0,
            'all_emotions': {emotion: 1.0/len(EMOTION_LABELS) for emotion in EMOTION_LABELS},
            'detections_count': 0,
            'error': str(e)
        }

def predict_emotion_local(image_base64):
    """Unified emotion prediction using Keras model.h5 as primary, YOLO as fallback"""
    global yolo_emotion_model, emotion_model

    # Try Keras model first (PRIMARY)
    if emotion_model is not None:
        logger.info("Attempting Keras emotion detection (PRIMARY)...")
        result = predict_emotion_local_keras(image_base64)
        if 'error' not in result:
            logger.info("Keras emotion detection successful")
            return result
        else:
            logger.warning(f"Keras emotion detection failed: {result.get('error', 'Unknown error')}, falling back to YOLO")

    # Fallback to YOLO model
    if yolo_emotion_model is not None:
        logger.info("Attempting YOLO emotion detection (FALLBACK)...")
        result = predict_emotion_yolo(image_base64)
        if 'error' not in result:
            logger.info("YOLO emotion detection successful")
            return result
        else:
            logger.error(f"YOLO emotion detection failed: {result.get('error', 'Unknown error')}")

    # If both models fail or are not loaded
    logger.error("No emotion detection models available or all failed")
    return {
        'predicted_emotion': 'Neutral',
        'confidence': 0.0,
        'all_emotions': {emotion: 1.0/len(EMOTION_LABELS) for emotion in EMOTION_LABELS},
        'detections_count': 0,
        'error': 'No emotion detection models available'
    }

def predict_emotion_local_keras(image_base64):
    """Predict emotion using local .h5 model with face detection (PRIMARY)"""
    global emotion_model, face_cascade
    
    try:
        if emotion_model is None:
            logger.error("Emotion model not loaded")
            return {
                'predicted_emotion': 'Neutral',
                'confidence': 0.0,
                'all_emotions': {emotion: 0.14 for emotion in EMOTION_LABELS},
                'detections_count': 0,
                'error': 'Emotion model not loaded'
            }
            
        if face_cascade is None:
            logger.error("Face cascade not loaded")
            return {
                'predicted_emotion': 'Neutral',
                'confidence': 0.0,
                'all_emotions': {emotion: 0.14 for emotion in EMOTION_LABELS},
                'detections_count': 0,
                'error': 'Face detection not available'
            }
            
        logger.info("Predicting emotion with local model and face detection...")
        
        # Decode base64 image
        image = decode_base64_image(image_base64)
        if image is None:
            raise ValueError("Failed to decode base64 image")
            
        # Detect faces first
        faces = detect_faces(image)
        if len(faces) == 0:
            logger.warning("No faces detected in the image")
            return {
                'predicted_emotion': 'Unknown',
                'confidence': 0.0,
                'all_emotions': {emotion: 0.0 for emotion in EMOTION_LABELS},
                'detections_count': 0,
                'error': 'No face detected in the image'
            }
            
        # Use the largest face for prediction
        largest_face = max(faces, key=lambda face: face[2] * face[3])
        x, y, w, h = largest_face
        
        logger.info(f"Using largest face at coordinates: ({x}, {y}, {w}, {h})")
        
        # Preprocess for emotion model with face cropping
        processed_image = preprocess_image_for_emotion(image, largest_face)
        if processed_image is None:
            raise ValueError("Failed to preprocess image")
            
        # Make prediction with Keras .h5 model
        logger.info("Running emotion model prediction with Keras .h5 model...")
        try:
            # Use Keras model (.h5)
            logger.info("Using local Keras .h5 emotion model...")
            predictions = emotion_model.predict(processed_image, verbose=0)
            logger.info(f"Keras raw predictions: {predictions[0]}")
            
            # Get predicted class and confidence
            predicted_class_idx = np.argmax(predictions[0])
            confidence = float(predictions[0][predicted_class_idx])
            predicted_emotion = EMOTION_LABELS[predicted_class_idx]
            
            # Create emotion probabilities dictionary
            all_emotions = {}
            for i, emotion in enumerate(EMOTION_LABELS):
                all_emotions[emotion] = float(predictions[0][i])
                
            logger.info(f"Local emotion prediction: {predicted_emotion} with confidence {confidence:.3f}")
            logger.info(f"All emotions: {all_emotions}")
            
            # Memory cleanup for emotion prediction
            del predictions, processed_image
            import gc
            gc.collect()
            
        except Exception as e:
            logger.error(f"Emotion model prediction failed: {str(e)}")
            # Memory cleanup on error
            if 'processed_image' in locals():
                del processed_image
            import gc
            gc.collect()
            # Fallback to neutral
            predicted_emotion = 'Neutral'
            confidence = 0.5
            all_emotions = {emotion: 1.0/len(EMOTION_LABELS) for emotion in EMOTION_LABELS}
        
        result = {
            'predicted_emotion': predicted_emotion,
            'confidence': confidence,
            'all_emotions': all_emotions,
            'detections_count': len(faces),
            'face_coordinates': largest_face.tolist()
        }
        
        return result
        
    except Exception as e:
        logger.error(f"Error in local emotion prediction: {str(e)}")
        return {
            'predicted_emotion': 'Neutral',
            'confidence': 0.5,
            'all_emotions': {emotion: 1.0/len(EMOTION_LABELS) for emotion in EMOTION_LABELS},
            'detections_count': 0,
            'error': str(e)
        }

# Audio Transcription Functions
def generate_keyword_response(transcript):
    """Generate response based on detected keywords in transcript"""
    
    # Convert to lowercase for keyword matching
    text = transcript.lower()
    
    # Define keyword patterns and responses
    keyword_responses = {
        'hello': "Hello",
        'hi': "Hello", 
        'good morning': "Good morning",
        'good afternoon': "Good afternoon",
        'opening hours': "What are the opening hours?",
        'hours': "What are the opening hours?",
        'food': "Where is the food court?",
        'eat': "Where is the food court?",
        'restaurant': "Where is the food court?",
        'kidsstop': "How do I get to KidsSTOP?",
        'children': "What activities are suitable for young children?",
        'kids': "What activities are suitable for young children?",
        'exhibition': "What exhibitions are currently showing?",
        'show': "What exhibitions are currently showing?",
        'park': "Where can I park?",
        'parking': "Where can I park?",
        'program': "Are there any special programs today?",
        'workshop': "Are there any educational workshops today?",
        'interactive': "Where can I find interactive science experiments?",
        'science': "Tell me about the interactive exhibits",
        'help': "How can I help you today?",
        'thank': "You're welcome!"
    }
    
    # Check for keyword matches
    for keyword, response in keyword_responses.items():
        if keyword in text:
            logger.info(f"Detected keyword '{keyword}' in transcript: '{transcript}'")
            return response
    
    # If no keywords detected, return random response
    random_responses = [
        "What are the opening hours?",
        "Where is the food court?", 
        "How do I get to KidsSTOP?",
        "What exhibitions are showing?",
        "Are there any special programs?",
        "Where can I park?",
        "What activities are for children?",
        "Tell me about the interactive exhibits"
    ]
    
    import random
    random_response = random.choice(random_responses)
    logger.info(f"No keywords detected in '{transcript}', using random response: '{random_response}'")
    return random_response

# API Endpoints
@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'models_loaded': {
            'yolo': yolo_model is not None,  # PRIMARY model
            'mobilenet': mobilenet_model is not None,  # FALLBACK model
            'emotion_model': emotion_model is not None,  # PRIMARY emotion model (model.h5)
            'yolo_emotion': yolo_emotion_model is not None,  # FALLBACK emotion model
            'assemblyai': True,
            'age_gender_model': age_gender_model is not None,
            'face_cascade': face_cascade is not None,
        },
        'primary_detection_model': 'YOLO' if yolo_model is not None else 'MobileNet' if mobilenet_model is not None else 'None',
        'device': str(device) if device else 'cpu'
    })

def detect_exhibit_unified(image):
    """Unified exhibit detection using YOLO as primary, MobileNet as fallback"""
    # Try YOLO first (PRIMARY MODEL)
    if yolo_model is not None:
        logger.info("Attempting YOLO exhibit detection (PRIMARY)...")
        result = detect_exhibit_yolo(image)
        if 'error' not in result:
            logger.info("YOLO detection successful")
            return result
        else:
            logger.warning(f"YOLO failed: {result.get('error', 'Unknown error')}, falling back to MobileNet")
    
    # Fallback to MobileNet
    if mobilenet_model is not None:
        logger.info("Attempting MobileNet exhibit detection (FALLBACK)...")
        result = detect_exhibit_mobilenet(image)
        if 'error' not in result:
            logger.info("MobileNet detection successful")
            return result
        else:
            logger.error(f"MobileNet failed: {result.get('error', 'Unknown error')}")
    
    # If both models fail or are not loaded
    logger.error("No exhibit detection models available or all failed")
    return {'exhibit': 'unknown', 'confidence': 0.0, 'error': 'No exhibit detection models available'}

@app.route('/detect_exhibit', methods=['POST'])
def detect_exhibit():
    """Detect exhibit using YOLO model (primary) with MobileNet fallback"""
    try:
        data = request.get_json()
        if not data or 'image' not in data:
            return jsonify({'error': 'No image provided'}), 400

        logger.info("🗑️ Starting exhibit detection - will clear image data after processing")
        
        # Decode base64 image
        image = decode_base64_image(data['image'])
        
        # Detect exhibit using unified approach
        result = detect_exhibit_unified(image)
        
        # ✅ EXPLICIT IMAGE DATA CLEANUP - Clear ALL image data after detection
        logger.info("🗑️ Clearing image data from backend after detection...")
        if 'image' in locals():
            logger.info(f"🗑️ Clearing decoded image data (shape: {image.shape if hasattr(image, 'shape') else 'unknown'})")
            del image
        if 'data' in locals() and 'image' in data:
            logger.info(f"🗑️ Clearing base64 image data (length: {len(data['image']) if data['image'] else 'unknown'})")
            data['image'] = None  # Clear the base64 string
            del data
        
        # Force aggressive garbage collection after image cleanup
        import gc
        for i in range(3):
            gc.collect()
        logger.info("🗑️ Image data cleanup completed in backend")
        
        if 'error' in result:
            return jsonify({'error': result['error']}), 500
            
        # Return in original format for compatibility
        return jsonify({'exhibit': result['exhibit']}), 200

    except Exception as e:
        logger.error(f"Error in detect_exhibit: {str(e)}")
        
        # ✅ CLEANUP ON ERROR - Clear any remaining image data
        if 'image' in locals():
            logger.info("🗑️ Emergency cleanup: clearing decoded image data")
            del image
        if 'data' in locals():
            logger.info("🗑️ Emergency cleanup: clearing request data")
            del data
        import gc
        gc.collect()
        
        return jsonify({'error': str(e)}), 500

@app.route('/detect_base64', methods=['POST'])
def detect_base64():
    """Legacy endpoint - same as detect_exhibit for backward compatibility"""
    return detect_exhibit()

@app.route('/predict/face_analysis', methods=['POST'])
def predict_face_analysis():
    """Predict age using Roboflow and emotion using local model"""
    global request_counter
    try:
        request_counter += 1
        initial_memory = log_memory_usage(f"start of request {request_counter}")
        
        # Check memory before processing
        if initial_memory > MAX_MEMORY_MB:
            logger.warning(f"Memory usage ({initial_memory:.1f}MB) exceeds limit ({MAX_MEMORY_MB}MB)")
            emergency_cleanup()
        
        logger.info("Received face analysis request")
        
        # Get image from request
        data = request.get_json()
        if not data or 'image' not in data:
            logger.error("No image provided in request")
            return jsonify({'error': 'No image provided'}), 400
        
        # Predict age and gender using local model
        age_prediction = predict_age_gender_local(data['image'])
        
        # Predict emotion using local model
        emotion_prediction = predict_emotion_local(data['image'])
        
        # Check if face detection failed
        if 'error' in emotion_prediction:
            logger.warning(f"Face verification failed: {emotion_prediction['error']}")
            return jsonify({
                'success': False,
                'error': emotion_prediction['error'],
                'message': 'No face detected in the image. Please ensure your face is clearly visible and try again.',
                'predictions': {
                    'age': {
                        'value': 25,
                        'group': 'Unknown',
                        'confidence': 0.0
                    },
                    'gender': {
                        'label': "Unknown",
                        'confidence': 0.0
                    },
                    'emotion': {
                        'label': 'Unknown',
                        'confidence': 0.0
                    },
                    'all_emotions': {emotion: 0.0 for emotion in EMOTION_LABELS},
                    'face_analysis': {
                        'detections_count': 0,
                        'face_coordinates': [],
                        'processed': False
                    }
                }
            }), 200
        
        result = {
            'success': True,
            'predictions': {
                'age': {
                    'value': age_prediction['estimated_age'],
                    'group': age_prediction['age_group'],
                    'confidence': age_prediction['confidence']
                },
                'gender': {
                    'label': age_prediction.get('gender', 'Unknown'),
                    'confidence': age_prediction.get('gender_confidence', 0.0)
                },
                'emotion': {
                    'label': emotion_prediction['predicted_emotion'],
                    'confidence': emotion_prediction['confidence']
                },
                'all_emotions': emotion_prediction['all_emotions'],
                'face_analysis': {
                    'detections_count': emotion_prediction['detections_count'],
                    'face_coordinates': emotion_prediction.get('face_coordinates', []),
                    'processed': True
                }
            }
        }
        
        logger.info(f"Face analysis completed: Age={age_prediction['estimated_age']} ({age_prediction['age_group']}), Emotion={emotion_prediction['predicted_emotion']}")
        
        # Additional cleanup for face analysis data
        if 'image_data' in locals():
            del image_data
        if 'image' in locals():
            del image
        if 'data' in locals():
            del data
        if 'age_prediction' in locals():
            del age_prediction
        if 'emotion_prediction' in locals():
            del emotion_prediction
        
        # Force garbage collection multiple times
        import gc
        for i in range(5):
            gc.collect()
        
        # Log memory after cleanup
        final_memory = log_memory_usage(f"end of request {request_counter}")
        
        return jsonify(result)
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        logger.error(f"Error in face analysis: {str(e)}")
        logger.error(f"Full error traceback:\n{error_details}")
        
        # Additional cleanup on error
        if 'image_data' in locals():
            del image_data
        if 'image' in locals():
            del image
        if 'data' in locals():
            del data
        if 'age_prediction' in locals():
            del age_prediction
        if 'emotion_prediction' in locals():
            del emotion_prediction
        
        # Force garbage collection on error
        import gc
        for i in range(5):
            gc.collect()
        
        log_memory_usage(f"error end of request {request_counter}")
        
        return jsonify({
            'success': False,
            'error': str(e),
            'details': 'Check Flask server logs for full error details'
        }), 500

@app.route('/predict/combined', methods=['POST'])
def predict_combined():
    """Legacy endpoint - same as predict_face_analysis for backward compatibility"""
    return predict_face_analysis()

@app.route('/transcribe', methods=['POST'])
def transcribe_audio():
    """Transcribe audio using AssemblyAI API"""
    try:
        logger.info("Received audio transcription request")
        
        # Check if audio file is in request
        if 'audio' not in request.files:
            logger.error("No audio file provided")
            return jsonify({'error': 'No audio file provided'}), 400
        
        audio_file = request.files['audio']
        
        if audio_file.filename == '':
            logger.error("No audio file selected")
            return jsonify({'error': 'No audio file selected'}), 400
        
        # Save audio file temporarily
        filename = secure_filename(audio_file.filename)
        temp_path = os.path.join('temp', filename)
        
        # Create temp directory if it doesn't exist
        os.makedirs('temp', exist_ok=True)
        
        audio_file.save(temp_path)
        logger.info(f"Audio file saved to: {temp_path}")
        
        # Upload audio file to AssemblyAI
        logger.info("Uploading audio to AssemblyAI...")
        
        headers = {
            "authorization": ASSEMBLYAI_API_KEY
        }
        
        # Upload the audio file
        with open(temp_path, "rb") as f:
            upload_response = requests.post(
                ASSEMBLYAI_BASE_URL + "/v2/upload",
                headers=headers,
                data=f
            )
        
        if upload_response.status_code != 200:
            logger.error(f"Failed to upload audio: {upload_response.text}")
            return jsonify({'error': 'Failed to upload audio to AssemblyAI'}), 500
        
        audio_url = upload_response.json()["upload_url"]
        logger.info(f"Audio uploaded successfully, URL: {audio_url}")
        
        # Submit transcription request
        data = {
            "audio_url": audio_url,
            "speech_model": "universal"
        }
        
        transcription_response = requests.post(
            ASSEMBLYAI_BASE_URL + "/v2/transcript",
            json=data,
            headers=headers
        )
        
        if transcription_response.status_code != 200:
            logger.error(f"Failed to submit transcription: {transcription_response.text}")
            return jsonify({'error': 'Failed to submit transcription to AssemblyAI'}), 500
        
        transcript_id = transcription_response.json()['id']
        logger.info(f"Transcription submitted, ID: {transcript_id}")
        
        # Poll for completion
        polling_endpoint = ASSEMBLYAI_BASE_URL + "/v2/transcript/" + transcript_id
        
        max_attempts = 60  # Maximum 3 minutes of polling
        attempts = 0
        
        while attempts < max_attempts:
            transcription_result = requests.get(polling_endpoint, headers=headers).json()
            
            if transcription_result['status'] == 'completed':
                transcript_text = transcription_result['text']
                logger.info(f"AssemblyAI transcription completed: '{transcript_text}'")
                
                # Generate response based on detected keywords
                response_text = generate_keyword_response(transcript_text)
                
                # Clean up temporary file
                try:
                    os.remove(temp_path)
                except Exception as e:
                    logger.warning(f"Failed to remove temp file: {e}")
                
                return jsonify({
                    'success': True,
                    'transcript': transcript_text,
                    'keyword_response': response_text,
                    'original_transcript': transcript_text
                })
                
            elif transcription_result['status'] == 'error':
                error_msg = transcription_result.get('error', 'Unknown error')
                logger.error(f"AssemblyAI transcription failed: {error_msg}")
                return jsonify({'error': f'Transcription failed: {error_msg}'}), 500
            
            else:
                logger.info(f"Transcription in progress... Status: {transcription_result['status']}")
                time.sleep(3)
                attempts += 1
        
        # If we reach here, polling timed out
        logger.error("Transcription polling timed out")
        return jsonify({'error': 'Transcription timed out'}), 500
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        logger.error(f"Error in audio transcription: {str(e)}")
        logger.error(f"Full error traceback:\n{error_details}")
        
        # Clean up temp file if it exists
        try:
            if 'temp_path' in locals():
                os.remove(temp_path)
        except:
            pass
        
        return jsonify({
            'success': False,
            'error': str(e),
            'details': 'Check Flask server logs for full error details'
        }), 500

@app.route('/analyze/complete', methods=['POST'])
def analyze_complete():
    """Complete analysis endpoint - combines exhibit detection and face analysis"""
    try:
        logger.info("Received complete analysis request")
        
        # Get image from request
        data = request.get_json()
        if not data or 'image' not in data:
            logger.error("No image provided in request")
            return jsonify({'error': 'No image provided'}), 400
        
        # Decode image once for all analyses
        image = decode_base64_image(data['image'])
        
        # Perform exhibit detection
        exhibit_result = detect_exhibit_unified(image)
        
        # Perform face analysis
        age_prediction = predict_age_gender_local(data['image'])
        emotion_prediction = predict_emotion_local(data['image'])
        
        # Combine results
        result = {
            'success': True,
            'exhibit_detection': {
                'exhibit': exhibit_result.get('exhibit', 'unknown'),
                'confidence': exhibit_result.get('confidence', 0.0),
                'all_detections': exhibit_result.get('all_detections', [])
            },
            'face_analysis': {
                'age': {
                    'value': age_prediction['estimated_age'],
                    'group': age_prediction['age_group'],
                    'confidence': age_prediction['confidence']
                },
                'emotion': {
                    'label': emotion_prediction.get('predicted_emotion', 'Unknown'),
                    'confidence': emotion_prediction.get('confidence', 0.0),
                    'all_emotions': emotion_prediction.get('all_emotions', {})
                },
                'face_detected': emotion_prediction.get('detections_count', 0) > 0
            }
        }
        
        logger.info(f"Complete analysis finished: Exhibit={exhibit_result.get('exhibit')}, Age={age_prediction['estimated_age']}, Emotion={emotion_prediction.get('predicted_emotion')}")
        return jsonify(result)
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        logger.error(f"Error in complete analysis: {str(e)}")
        logger.error(f"Full error traceback:\n{error_details}")
        return jsonify({
            'success': False,
            'error': str(e),
            'details': 'Check Flask server logs for full error details'
        }), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    # Load models on startup
    load_models()
    
    # Get port from environment variable for Render deployment
    port = int(os.getenv('PORT', 5002))
    debug_mode = os.getenv('FLASK_ENV', 'development') != 'production'
    
    # Run the Flask app
    logger.info(f"Starting unified Flask API server on http://0.0.0.0:{port}")
    app.run(host='0.0.0.0', port=port, debug=debug_mode)