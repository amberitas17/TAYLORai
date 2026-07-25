/**
 * Real Exhibit Model Service using Python subprocess to run the actual PyTorch model
 */

import { spawn } from 'child_process';
import { join } from 'path';
import { existsSync, writeFileSync, unlinkSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

export class RealExhibitModelService {
    constructor() {
        this.isInitialized = false;
        this.modelPath = join(process.cwd(), 'public', 'models', 'exhibit_yolo_tiny.pt');
        this.metadataPath = join(process.cwd(), 'public', 'models', 'exhibit_metadata.json');
        this.tempDir = join(process.cwd(), 'temp');
        this.pythonScript = join(process.cwd(), 'scripts', 'real_model_inference.py');

        // Model configuration from metadata
        this.config = {
            classes: ['DWT', 'EAP'],
            classToIdx: { 'DWT': 0, 'EAP': 1 },
            numClasses: 2,
            imgSize: 224,
            accuracy: 99.04,
            exhibitMapping: {
                'DWT': 'dialogue_with_time',
                'EAP': 'earth_alive'
            }
        };
    }

    async initialize() {
        try {
            logger.info('Initializing REAL Exhibit Model Service...');

            // Check if model files exist
            if (!existsSync(this.modelPath)) {
                throw new Error(`Real model file not found: ${this.modelPath}`);
            }
            if (!existsSync(this.metadataPath)) {
                throw new Error(`Metadata file not found: ${this.metadataPath}`);
            }

            // Create temp directory
            if (!existsSync(this.tempDir)) {
                require('fs').mkdirSync(this.tempDir, { recursive: true });
            }

            // Create the Python inference script
            await this.createPythonInferenceScript();

            // Test Python environment and model loading
            await this.testModelLoading();

            this.isInitialized = true;
            logger.info('REAL Exhibit Model Service initialized successfully');
            logger.info('Using your trained model with 99.04% accuracy');

        } catch (error) {
            logger.error('❌ REAL Exhibit Model Service initialization failed:', error);
            throw error;
        }
    }

    async createPythonInferenceScript() {
        const scriptContent = `#!/usr/bin/env python3
"""
Real exhibit model inference using the actual trained PyTorch model
"""

import sys
import torch
import json
import os
from PIL import Image
import torchvision.transforms as transforms
import warnings
warnings.filterwarnings('ignore')

def run_inference(model_path, metadata_path, image_path):
    try:
        # Load metadata
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)

        # Load the real TorchScript model
        model = torch.jit.load(model_path, map_location='cpu')
        model.eval()

        # Create preprocessing transforms matching training
        transform = transforms.Compose([
            transforms.Resize(metadata['inputSize']),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=metadata['normalization']['mean'],
                std=metadata['normalization']['std']
            )
        ])

        # Load and preprocess image
        image = Image.open(image_path).convert('RGB')
        input_tensor = transform(image).unsqueeze(0)

        # Run inference with the REAL model
        with torch.no_grad():
            outputs = model(input_tensor)
            probabilities = torch.nn.functional.softmax(outputs, dim=1)
            confidence, predicted_idx = torch.max(probabilities, 1)

            confidence = confidence.item()
            predicted_idx = predicted_idx.item()
            predicted_class = metadata['classes'][predicted_idx]

            # Get all class probabilities
            all_probs = probabilities[0].tolist()

            return {
                'success': True,
                'predicted_class': predicted_class,
                'confidence': confidence,
                'class_idx': predicted_idx,
                'all_probabilities': {
                    metadata['classes'][i]: prob for i, prob in enumerate(all_probs)
                },
                'metadata': {
                    'model_file': os.path.basename(model_path),
                    'accuracy': metadata['bestAccuracy'],
                    'model_type': metadata['modelType']
                }
            }

    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(json.dumps({'success': False, 'error': 'Usage: script.py <model_path> <metadata_path> <image_path>'}))
        sys.exit(1)

    model_path = sys.argv[1]
    metadata_path = sys.argv[2]
    image_path = sys.argv[3]

    result = run_inference(model_path, metadata_path, image_path)
    print(json.dumps(result))
`;

        writeFileSync(this.pythonScript, scriptContent);
        logger.info('✅ Python inference script created');
    }

    async testModelLoading() {
        return new Promise((resolve, reject) => {
            const testScript = `
import torch
import json

# Test loading the real model
model_path = "${this.modelPath.replace(/\\/g, '/')}"
metadata_path = "${this.metadataPath.replace(/\\/g, '/')}"

try:
    # Load metadata
    with open(metadata_path, 'r') as f:
        metadata = json.load(f)
    print(f"Metadata loaded: {metadata['modelType']}")

    # Load real model
    model = torch.jit.load(model_path, map_location='cpu')
    model.eval()
    print(f"Real model loaded successfully")

    # Test inference with dummy input
    import torch
    dummy_input = torch.randn(1, 3, 224, 224)
    with torch.no_grad():
        output = model(dummy_input)
    print(f"Test inference successful: output shape {output.shape}")
    print("REAL MODEL READY")

except Exception as e:
    print(f"ERROR: {e}")
    exit(1)
            `;

            const pythonProcess = spawn('python', ['-c', testScript]);
            let output = '';
            let errorOutput = '';

            pythonProcess.stdout.on('data', (data) => {
                output += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            pythonProcess.on('close', (code) => {
                if (code === 0 && output.includes('REAL MODEL READY')) {
                    logger.info('✅ Real model test passed');
                    logger.info(output.trim());
                    resolve();
                } else {
                    logger.error('❌ Real model test failed:', errorOutput || output);
                    reject(new Error(`Model test failed: ${errorOutput || output}`));
                }
            });
        });
    }

    async predict(imageBuffer) {
        try {
            if (!this.isInitialized) {
                throw new Error('Real Exhibit Model Service not initialized');
            }

            logger.debug('🎯 Running REAL model inference...');
            const startTime = Date.now();

            // Save image to temporary file
            const tempImagePath = join(this.tempDir, `exhibit_${uuidv4()}.jpg`);
            writeFileSync(tempImagePath, imageBuffer);

            try {
                // Run inference with REAL model
                const prediction = await this.runRealModelInference(tempImagePath);

                const processingTime = Date.now() - startTime;
                logger.debug(`🎯 REAL model inference complete in ${processingTime}ms`);

                return prediction;

            } finally {
                // Cleanup temp file
                if (existsSync(tempImagePath)) {
                    unlinkSync(tempImagePath);
                }
            }

        } catch (error) {
            logger.error('❌ REAL model inference failed:', error);
            throw error;
        }
    }

    async runRealModelInference(imagePath) {
        return new Promise((resolve, reject) => {
            const pythonProcess = spawn('python', [
                this.pythonScript,
                this.modelPath,
                this.metadataPath,
                imagePath
            ]);

            let output = '';
            let errorOutput = '';

            pythonProcess.stdout.on('data', (data) => {
                output += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            pythonProcess.on('close', (code) => {
                if (code === 0) {
                    try {
                        const result = JSON.parse(output.trim());
                        if (result.success) {
                            // Transform to expected format
                            const exhibitClass = result.predicted_class;
                            const exhibitKey = this.config.exhibitMapping[exhibitClass];

                            const transformedResult = {
                                exhibit: exhibitKey,
                                confidence: result.confidence,
                                classId: result.class_idx,
                                allDetections: Object.entries(result.all_probabilities).map(([cls, prob]) => ({
                                    exhibit: this.config.exhibitMapping[cls],
                                    confidence: prob,
                                    classId: this.config.classToIdx[cls]
                                })).sort((a, b) => b.confidence - a.confidence),
                                metadata: {
                                    model: 'REAL_exhibit_yolo_tiny.pt',
                                    processingTime: Date.now(),
                                    modelAccuracy: result.metadata.accuracy,
                                    modelType: result.metadata.model_type,
                                    realModel: true,
                                    rawPrediction: result
                                }
                            };

                            resolve(transformedResult);
                        } else {
                            reject(new Error(result.error));
                        }
                    } catch (parseError) {
                        logger.error('❌ Failed to parse real model output:', output);
                        reject(new Error(`Failed to parse prediction result: ${parseError.message}`));
                    }
                } else {
                    logger.error('❌ Real model Python script failed:', errorOutput);
                    reject(new Error(`Python script failed: ${errorOutput}`));
                }
            });
        });
    }

    dispose() {
        this.isInitialized = false;
        logger.info('🎯 Real Exhibit Model Service disposed');
    }
}

export default RealExhibitModelService;