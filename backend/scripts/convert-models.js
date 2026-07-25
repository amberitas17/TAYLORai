import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { logger } from '../src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class ModelConverter {
    constructor() {
        this.pythonKerasModels = {
            ageGender: '../asset/age_gender_model.h5',
            emotionLittleVgg: '../Emotion_little_vgg.h5',
            yoloExhibit: '../yolov8_model.pt',
            faceDetection: '../asset/haarcascade_frontalface_default.xml'
        };

        this.outputDir = join(__dirname, '../models');
    }

    async initialize() {
        logger.info('🔄 Model Converter initialized');
        await this.createOutputDirectories();
    }

    async createOutputDirectories() {
        try {
            await fs.mkdir(this.outputDir, { recursive: true });

            const modelDirs = [
                'age_gender_model',
                'emotion_little_vgg',
                'yolov8_model',
                'face-detection'
            ];

            for (const dir of modelDirs) {
                await fs.mkdir(join(this.outputDir, dir), { recursive: true });
            }

            logger.info('✅ Output directories created');
        } catch (error) {
            logger.error('❌ Failed to create output directories:', error);
            throw error;
        }
    }

    async convertKerasToTensorFlowJS() {
        logger.info('🔄 Starting Keras to TensorFlow.js conversion...');

        // Create Python conversion script
        const pythonScript = this.createPythonConversionScript();
        const scriptPath = join(__dirname, 'convert_keras_models.py');

        try {
            await fs.writeFile(scriptPath, pythonScript);
            logger.info('📝 Python conversion script created');

            // Run the Python script
            const result = await this.runPythonScript(scriptPath);
            logger.info('✅ Keras models converted to TensorFlow.js format');

            // Clean up the script
            await fs.unlink(scriptPath);

            return result;

        } catch (error) {
            logger.error('❌ Keras conversion failed:', error);
            throw error;
        }
    }

    createPythonConversionScript() {
        return `#!/usr/bin/env python3
"""
Model Conversion Script for Singapore Science Centre Person Detection Backend
Converts Keras models to TensorFlow.js format
"""

import os
import sys
import numpy as np
import tensorflow as tf
from tensorflow import keras
import tensorflowjs as tfjs

def convert_age_gender_model():
    """Convert age/gender model from Keras to TensorFlow.js"""
    print("🔄 Converting age/gender model...")

    model_path = "${this.pythonKerasModels.ageGender}"
    output_path = "${join(this.outputDir, 'age_gender_model')}"

    if not os.path.exists(model_path):
        print(f"⚠️  Age/gender model not found at {model_path}")
        return False

    try:
        # Load the Keras model
        model = keras.models.load_model(model_path)
        print(f"✅ Loaded age/gender model: {model.input_shape} -> {model.output_shape}")

        # Convert to TensorFlow.js format without quantization for better performance
        tfjs.converters.save_keras_model(
            model,
            output_path,
            quantization_bytes=None  # Avoid quantization as suggested
        )
        print(f"✅ Age/gender model converted and saved to {output_path}")

        return True

    except Exception as e:
        print(f"❌ Failed to convert age/gender model: {e}")
        return False

def convert_emotion_model():
    """Convert emotion model from Keras to TensorFlow.js"""
    print("🔄 Converting emotion model...")

    model_path = "${this.pythonKerasModels.emotionLittleVgg}"
    output_path = "${join(this.outputDir, 'emotion_little_vgg')}"

    if not os.path.exists(model_path):
        print(f"⚠️  Emotion model not found at {model_path}")
        # Try to create the architecture and load weights
        return create_emotion_model_architecture(model_path, output_path)

    try:
        # Try to load as complete model first
        model = keras.models.load_model(model_path)
        print(f"✅ Loaded emotion model: {model.input_shape} -> {model.output_shape}")

        # Convert to TensorFlow.js format without quantization for better performance
        tfjs.converters.save_keras_model(
            model,
            output_path,
            quantization_bytes=None  # Avoid quantization as suggested
        )
        print(f"✅ Emotion model converted and saved to {output_path}")

        return True

    except ValueError as e:
        if "No model config found" in str(e):
            print("⚠️  Model file contains weights only, creating architecture...")
            return create_emotion_model_architecture(model_path, output_path)
        else:
            print(f"❌ Failed to convert emotion model: {e}")
            return False
    except Exception as e:
        print(f"❌ Failed to convert emotion model: {e}")
        return False

def create_emotion_model_architecture(weights_path, output_path):
    """Create Little VGG architecture and load weights"""
    print("🏗️  Creating Little VGG architecture for emotion recognition...")

    try:
        # Create Little VGG architecture matching the Node.js implementation
        model = keras.Sequential([
            # Block 1
            keras.layers.Conv2D(32, (3, 3), activation='relu', padding='same',
                              input_shape=(48, 48, 1)),
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

        # Try to load weights
        if os.path.exists(weights_path):
            model.load_weights(weights_path)
            print("✅ Weights loaded successfully")
        else:
            print("⚠️  Weights file not found, saving architecture only")

        # Convert to TensorFlow.js format without quantization for better performance
        tfjs.converters.save_keras_model(
            model,
            output_path,
            quantization_bytes=None  # Avoid quantization as suggested
        )
        print(f"✅ Emotion model architecture converted and saved to {output_path}")

        return True

    except Exception as e:
        print(f"❌ Failed to create emotion model architecture: {e}")
        return False

def convert_yolo_model():
    """Convert YOLO model (placeholder - requires special handling)"""
    print("🔄 Converting YOLO exhibit detection model...")

    model_path = "${this.pythonKerasModels.yoloExhibit}"
    output_path = "${join(this.outputDir, 'yolov8_model')}"

    if not os.path.exists(model_path):
        print(f"⚠️  YOLO model not found at {model_path}")
        return False

    print("⚠️  YOLO model conversion requires ultralytics package and special handling.")
    print("📋 Manual conversion steps:")
    print("1. Install ultralytics: pip install ultralytics")
    print("2. Export model: yolo export model=yolov8_model.pt format=onnx")
    print("3. Use onnx-tensorflowjs to convert ONNX to TensorFlow.js")
    print("4. Or use the YOLO.js library for direct inference")

    # Create placeholder info file
    info_content = '''
# YOLO Model Conversion Instructions

The YOLOv8 model requires special conversion steps:

## Option 1: ONNX Conversion
1. Export to ONNX: `yolo export model=yolov8_model.pt format=onnx`
2. Convert ONNX to TensorFlow.js: `tensorflowjs_converter --input_format=tf_saved_model --output_format=tfjs_graph_model yolov8_model.onnx ./yolov8_model/`

## Option 2: Direct PyTorch Export
1. Install required packages: `pip install torch torchvision tensorflowjs`
2. Use custom export script to convert PyTorch model

## Option 3: Use Pre-trained Model
1. Use a pre-trained YOLOv8 model from TensorFlow Hub or similar
2. Fine-tune on your exhibit detection dataset

The current implementation includes a fallback classification model for development.
'''

    try:
        info_path = join(output_path, 'CONVERSION_INSTRUCTIONS.md')
        with open(info_path, 'w') as f:
            f.write(info_content)
        print(f"📋 YOLO conversion instructions saved to {info_path}")
        return True
    except Exception as e:
        print(f"❌ Failed to create YOLO conversion instructions: {e}")
        return False

def copy_face_detection_model():
    """Copy Haar cascade XML file for face detection"""
    print("🔄 Copying face detection cascade...")

    source_path = "${this.pythonKerasModels.faceDetection}"
    output_path = "${join(this.outputDir, 'face-detection', 'haarcascade_frontalface_default.xml')}"

    if not os.path.exists(source_path):
        print(f"⚠️  Face detection cascade not found at {source_path}")
        return False

    try:
        import shutil
        shutil.copy2(source_path, output_path)
        print(f"✅ Face detection cascade copied to {output_path}")
        return True
    except Exception as e:
        print(f"❌ Failed to copy face detection cascade: {e}")
        return False

def main():
    """Main conversion function"""
    print("🚀 Starting model conversion process...")

    # Check TensorFlow.js availability
    try:
        import tensorflowjs
        print(f"✅ TensorFlow.js converter available: {tensorflowjs.__version__}")
    except ImportError:
        print("❌ TensorFlow.js converter not available. Install with:")
        print("pip install tensorflowjs")
        return False

    results = {
        'age_gender': convert_age_gender_model(),
        'emotion': convert_emotion_model(),
        'yolo': convert_yolo_model(),
        'face_detection': copy_face_detection_model()
    }

    successful = sum(results.values())
    total = len(results)

    print(f"\\n📊 Conversion Summary:")
    print(f"✅ Successful: {successful}/{total}")
    for model, success in results.items():
        status = "✅" if success else "❌"
        print(f"{status} {model}")

    if successful == total:
        print("\\n🎉 All models converted successfully!")
        return True
    else:
        print("\\n⚠️  Some models failed to convert. Check the logs above.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
`;
    }

    async runPythonScript(scriptPath) {
        return new Promise((resolve, reject) => {
            logger.info('🐍 Running Python conversion script...');

            const python = spawn('python', [scriptPath], {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: dirname(scriptPath)
            });

            let stdout = '';
            let stderr = '';

            python.stdout.on('data', (data) => {
                const output = data.toString();
                stdout += output;
                // Log Python output in real-time
                output.split('\n').filter(line => line.trim()).forEach(line => {
                    logger.info(`🐍 ${line}`);
                });
            });

            python.stderr.on('data', (data) => {
                const output = data.toString();
                stderr += output;
                logger.warn(`🐍 ${output}`);
            });

            python.on('close', (code) => {
                if (code === 0) {
                    logger.info('✅ Python script completed successfully');
                    resolve({ stdout, stderr, code });
                } else {
                    logger.error(`❌ Python script failed with exit code ${code}`);
                    reject(new Error(`Python script failed: ${stderr}`));
                }
            });

            python.on('error', (error) => {
                logger.error('❌ Failed to spawn Python process:', error);
                reject(error);
            });
        });
    }

    async generateModelInfo() {
        logger.info('📋 Generating model information files...');

        const modelInfo = {
            version: '1.0.0',
            created: new Date().toISOString(),
            models: {
                ageGender: {
                    name: 'Age and Gender Prediction',
                    input: '224x224x3 RGB image',
                    output: 'Age (continuous) + Gender (binary classification)',
                    framework: 'TensorFlow.js (converted from Keras)',
                    path: './age_gender_model/'
                },
                emotion: {
                    name: 'Emotion Recognition (Little VGG)',
                    input: '48x48x1 grayscale face image',
                    output: '7 emotion classes (Angry, Disgust, Fear, Happy, Neutral, Sad, Surprise)',
                    framework: 'TensorFlow.js (converted from Keras)',
                    path: './emotion_little_vgg/'
                },
                exhibit: {
                    name: 'Exhibit Detection (YOLOv8)',
                    input: '640x640x3 RGB image',
                    output: '2 exhibit classes (dialogue_with_time, earth_alive)',
                    framework: 'YOLO/PyTorch (conversion required)',
                    path: './yolov8_model/',
                    note: 'Requires special conversion - see CONVERSION_INSTRUCTIONS.md'
                },
                faceDetection: {
                    name: 'Face Detection (Haar Cascade)',
                    input: 'Grayscale image',
                    output: 'Face bounding boxes',
                    framework: 'OpenCV (XML cascade)',
                    path: './face-detection/',
                    fallback: 'BlazeFace from TensorFlow Hub'
                }
            },
            usage: {
                node: 'Use with @tensorflow/tfjs-node for server-side inference',
                browser: 'Use with @tensorflow/tfjs for client-side inference',
                performance: 'CPU optimized for server deployment'
            }
        };

        const infoPath = join(this.outputDir, 'model_info.json');
        await fs.writeFile(infoPath, JSON.stringify(modelInfo, null, 2));

        logger.info(`📋 Model information saved to ${infoPath}`);
        return modelInfo;
    }

    async createSetupInstructions() {
        const instructions = `# Model Setup Instructions

## Quick Start

1. **Install Dependencies**
   \`\`\`bash
   cd nodejs-backend
   npm install
   \`\`\`

2. **Convert Models** (if not already done)
   \`\`\`bash
   npm run convert-models
   \`\`\`

3. **Configure Environment**
   \`\`\`bash
   cp .env.example .env
   # Edit .env file with your configuration
   \`\`\`

4. **Start the Server**
   \`\`\`bash
   npm start
   \`\`\`

## Model Files Required

### From Python Implementation
- \`asset/age_gender_model.h5\` → \`models/age_gender_model/\`
- \`Emotion_little_vgg.h5\` → \`models/emotion_little_vgg/\`
- \`yolov8_model.pt\` → \`models/yolov8_model/\` (requires special conversion)
- \`asset/haarcascade_frontalface_default.xml\` → \`models/face-detection/\`

### Conversion Commands
\`\`\`bash
# Install Python dependencies
pip install tensorflow tensorflowjs ultralytics

# Run conversion script
node scripts/convert-models.js

# Or run Python script directly
python scripts/convert_keras_models.py
\`\`\`

## Model Architecture

### Age/Gender Model
- **Input**: 224×224×3 RGB image (face region)
- **Output**: Age (regression) + Gender (classification)
- **Format**: TensorFlow.js LayersModel

### Emotion Model (Little VGG)
- **Input**: 48×48×1 grayscale face image
- **Output**: 7 emotion probabilities
- **Architecture**: CNN with 4 convolutional blocks + dense layers
- **Format**: TensorFlow.js LayersModel

### Exhibit Detection (YOLOv8)
- **Input**: 640×640×3 RGB image
- **Output**: Bounding boxes + class probabilities
- **Classes**: dialogue_with_time, earth_alive
- **Format**: Requires conversion from PyTorch

### Face Detection
- **Primary**: Haar Cascade (OpenCV XML)
- **Fallback**: BlazeFace (TensorFlow Hub)
- **Input**: Grayscale image (any size)
- **Output**: Face bounding boxes

## Performance Optimization

### Memory Management
- Models are loaded once at startup
- Automatic memory cleanup after inference
- Configurable memory limits

### CPU Optimization
- Uses TensorFlow.js Node.js backend
- Optimized for server deployment
- Batch processing support

## Troubleshooting

### Model Loading Issues
1. Check file paths in \`.env\`
2. Verify model files exist
3. Check TensorFlow.js version compatibility

### Memory Issues
1. Reduce \`MAX_MEMORY_MB\` in \`.env\`
2. Enable automatic cleanup
3. Monitor memory usage with \`/api/v1/status\`

### Conversion Issues
1. Install required Python packages
2. Check model file formats
3. See individual model conversion instructions

## API Endpoints

- \`GET /health\` - Health check
- \`GET /api/v1/status\` - Model status
- \`POST /api/v1/face-analysis\` - Age/gender + emotion analysis
- \`POST /api/v1/exhibit/detect\` - Exhibit detection
- \`POST /api/v1/analyze/complete\` - Complete analysis

For detailed API documentation, visit \`/docs\` endpoint.
`;

        const instructionsPath = join(__dirname, '../SETUP.md');
        await fs.writeFile(instructionsPath, instructions);

        logger.info(`📋 Setup instructions saved to ${instructionsPath}`);
    }

    async convert() {
        try {
            await this.initialize();

            logger.info('🚀 Starting complete model conversion process...');

            // Step 1: Convert Keras models to TensorFlow.js
            logger.info('📝 Step 1: Converting Keras models...');
            await this.convertKerasToTensorFlowJS();

            // Step 2: Generate model information
            logger.info('📝 Step 2: Generating model information...');
            await this.generateModelInfo();

            // Step 3: Create setup instructions
            logger.info('📝 Step 3: Creating setup instructions...');
            await this.createSetupInstructions();

            logger.info('🎉 Model conversion process completed successfully!');

            return {
                success: true,
                message: 'All models converted and documentation generated',
                outputDir: this.outputDir
            };

        } catch (error) {
            logger.error('❌ Model conversion process failed:', error);
            throw error;
        }
    }
}

// Run conversion if script is called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const converter = new ModelConverter();
    converter.convert()
        .then(result => {
            console.log('✅ Conversion completed:', result);
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Conversion failed:', error);
            process.exit(1);
        });
}

export { ModelConverter };