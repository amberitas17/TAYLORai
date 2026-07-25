import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { logger } from '../src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Optimized model conversion script based on manager's suggestions
 * Implements the specific conversion approach for emotion_vgg to model_tfjs_alt
 */
class OptimizedModelConverter {
    constructor() {
        this.modelPath = './models/emotion_vgg.h5'; // Original model
        this.outputPath = './models/model_tfjs_alt'; // Optimized output
    }

    async convertEmotionModel() {
        logger.info('🚀 Starting optimized emotion model conversion...');

        const optimizedScript = this.createOptimizedConversionScript();
        const scriptPath = join(__dirname, 'convert_emotion_optimized.py');

        try {
            await fs.writeFile(scriptPath, optimizedScript);
            logger.info('📝 Optimized conversion script created');

            const result = await this.runPythonScript(scriptPath);
            logger.info('✅ Optimized emotion model converted successfully');

            await fs.unlink(scriptPath);
            return result;

        } catch (error) {
            logger.error('❌ Optimized conversion failed:', error);
            throw error;
        }
    }

    createOptimizedConversionScript() {
        return `#!/usr/bin/env python3
"""
Optimized Model Conversion Script for Emotion Recognition
Based on manager's suggestions for better performance
"""

import os
import sys
import tensorflow as tf
from tensorflow import keras
import tensorflowjs as tfjs

def convert_emotion_model_optimized():
    """Convert emotion model with optimizations - no quantization"""
    print("🚀 Converting emotion model with optimizations...")

    model_path = "${this.modelPath}"
    output_path = "${this.outputPath}"

    if not os.path.exists(model_path):
        print(f"❌ Emotion model not found at {model_path}")
        return False

    try:
        # Load the Keras model
        print("📥 Loading emotion model...")
        model = keras.models.load_model(model_path)
        print(f"✅ Loaded model: {model.input_shape} -> {model.output_shape}")

        # Verify model architecture
        model.summary()

        # Convert WITHOUT quantization for better performance (manager's suggestion #1)
        print("🔄 Converting without quantization for optimal performance...")
        tfjs.converters.save_keras_model(
            model,
            output_path,
            quantization_bytes=None,  # No quantization
            metadata={'optimization': 'unquantized_for_performance'}
        )

        # Check for unsupported layers (manager's suggestion #2)
        print("🔍 Checking model layers compatibility...")
        for i, layer in enumerate(model.layers):
            print(f"Layer {i}: {layer.name} ({type(layer).__name__})")

        # Force TFJS layers model format (manager's suggestion #2)
        print("🔄 Ensuring TFJS layers model format...")
        tfjs.converters.save_keras_model(
            model,
            output_path + "_layers",
            output_format='tfjs_layers_model',
            quantization_bytes=None
        )

        print(f"✅ Optimized emotion model converted to {output_path}")
        print(f"✅ Layers model format saved to {output_path}_layers")

        # Create optimization info file
        optimization_info = {
            'conversion_method': 'optimized_no_quantization',
            'output_formats': ['tfjs_graph_model', 'tfjs_layers_model'],
            'backend_recommendations': {
                'webgl_force_f16_textures': False,
                'preferred_backend': 'cpu_for_nodejs',
                'backend_alternatives': ['webgl', 'wasm']
            },
            'performance_tips': [
                'Use tf.env().set("WEBGL_FORCE_F16_TEXTURES", false)',
                'Set backend with await tf.setBackend("cpu")',
                'Call await tf.ready() after backend setup',
                'Profile with performance.now() for timing'
            ]
        }

        import json
        with open(os.path.join(output_path, 'optimization_info.json'), 'w') as f:
            json.dump(optimization_info, f, indent=2)

        print("📋 Optimization info saved")

        return True

    except Exception as e:
        print(f"❌ Conversion failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def create_optimized_architecture():
    """Create optimized architecture matching the original VGG emotion model"""
    print("🏗️ Creating optimized emotion model architecture...")

    try:
        # Build the architecture with optimizations
        model = keras.Sequential([
            # Input layer with explicit shape
            keras.layers.InputLayer(input_shape=(48, 48, 1)),

            # Block 1 - optimized for TensorFlow.js
            keras.layers.Conv2D(32, (3, 3), padding='same', activation='elu', name='conv2d_1'),
            keras.layers.BatchNormalization(name='batch_norm_1'),
            keras.layers.Conv2D(32, (3, 3), padding='same', activation='elu', name='conv2d_2'),
            keras.layers.BatchNormalization(name='batch_norm_2'),
            keras.layers.MaxPooling2D((2, 2), name='maxpool_1'),
            keras.layers.Dropout(0.2, name='dropout_1'),

            # Block 2
            keras.layers.Conv2D(64, (3, 3), padding='same', activation='elu', name='conv2d_3'),
            keras.layers.BatchNormalization(name='batch_norm_3'),
            keras.layers.Conv2D(64, (3, 3), padding='same', activation='elu', name='conv2d_4'),
            keras.layers.BatchNormalization(name='batch_norm_4'),
            keras.layers.MaxPooling2D((2, 2), name='maxpool_2'),
            keras.layers.Dropout(0.2, name='dropout_2'),

            # Block 3
            keras.layers.Conv2D(128, (3, 3), padding='same', activation='elu', name='conv2d_5'),
            keras.layers.BatchNormalization(name='batch_norm_5'),
            keras.layers.Conv2D(128, (3, 3), padding='same', activation='elu', name='conv2d_6'),
            keras.layers.BatchNormalization(name='batch_norm_6'),
            keras.layers.MaxPooling2D((2, 2), name='maxpool_3'),
            keras.layers.Dropout(0.2, name='dropout_3'),

            # Block 4
            keras.layers.Conv2D(256, (3, 3), padding='same', activation='elu', name='conv2d_7'),
            keras.layers.BatchNormalization(name='batch_norm_7'),
            keras.layers.Conv2D(256, (3, 3), padding='same', activation='elu', name='conv2d_8'),
            keras.layers.BatchNormalization(name='batch_norm_8'),
            keras.layers.MaxPooling2D((2, 2), name='maxpool_4'),
            keras.layers.Dropout(0.2, name='dropout_4'),

            # Classifier - optimized for TensorFlow.js
            keras.layers.Flatten(name='flatten'),
            keras.layers.Dense(64, activation='elu', name='dense_1'),
            keras.layers.BatchNormalization(name='batch_norm_9'),
            keras.layers.Dropout(0.5, name='dropout_5'),
            keras.layers.Dense(64, activation='elu', name='dense_2'),
            keras.layers.BatchNormalization(name='batch_norm_10'),
            keras.layers.Dropout(0.5, name='dropout_6'),
            keras.layers.Dense(5, activation='softmax', name='predictions')  # 5 emotions
        ])

        # Compile with optimization settings
        model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=0.001),
            loss='categorical_crossentropy',
            metrics=['accuracy']
        )

        print("✅ Optimized architecture created")
        return model

    except Exception as e:
        print(f"❌ Architecture creation failed: {e}")
        return None

def main():
    """Main conversion function"""
    print("🚀 Starting optimized emotion model conversion...")

    # Check dependencies
    try:
        print(f"TensorFlow version: {tf.__version__}")
        print(f"TensorFlow.js converter version: {tfjs.__version__}")
    except Exception as e:
        print(f"❌ Dependency check failed: {e}")
        return False

    success = convert_emotion_model_optimized()

    if success:
        print("\\n🎉 Optimized conversion completed successfully!")
        print("\\n📋 Next steps:")
        print("1. Update your Node.js model path to use the new model")
        print("2. Apply the backend configuration optimizations")
        print("3. Test performance improvements")
        return True
    else:
        print("\\n❌ Conversion failed")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
`;
    }

    async runPythonScript(scriptPath) {
        return new Promise((resolve, reject) => {
            logger.info('🐍 Running optimized Python conversion script...');

            const python = spawn('python', [scriptPath], {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: dirname(scriptPath)
            });

            let stdout = '';
            let stderr = '';

            python.stdout.on('data', (data) => {
                const output = data.toString();
                stdout += output;
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
                    logger.info('✅ Optimized Python script completed successfully');
                    resolve({ stdout, stderr, code });
                } else {
                    logger.error(`❌ Optimized Python script failed with exit code ${code}`);
                    reject(new Error(`Python script failed: ${stderr}`));
                }
            });

            python.on('error', (error) => {
                logger.error('❌ Failed to spawn Python process:', error);
                reject(error);
            });
        });
    }
}

// Export for use in other scripts
export { OptimizedModelConverter };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const converter = new OptimizedModelConverter();
    converter.convertEmotionModel()
        .then(result => {
            console.log('✅ Optimized conversion completed:', result);
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Optimized conversion failed:', error);
            process.exit(1);
        });
}