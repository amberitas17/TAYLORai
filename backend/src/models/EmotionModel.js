import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-cpu';
import { logger } from '../utils/logger.js';
import { join } from 'path';
import { existsSync } from 'fs';

export class EmotionModel {
    constructor() {
        this.model = null;
        this.modelPath = process.env.EMOTION_MODEL_PATH || './models/emotion_model_weights';
        this.isInitialized = false;
        this.isGraphModel = false;
        this.isCustomFormat = false;

        // Model configuration for TensorFlow.js converted model
        this.config = {
            inputSize: 48, // 48x48 input size for emotion model
            emotions: ['Angry', 'Happy', 'Neutral', 'Sad', 'Surprise'], // Updated emotions from new model
            threshold: 0.1
        };
    }

    async configureTensorFlowBackend() {
        try {
            logger.info('⚙️ Configuring TensorFlow.js backend for optimal performance...');

            // Force float32 backend to avoid WebGL fallback issues
            tf.env().set('WEBGL_FORCE_F16_TEXTURES', false);
            logger.debug('✅ Set WEBGL_FORCE_F16_TEXTURES to false');

            // Set the appropriate backend for Node.js environment
            // In Node.js, 'cpu' backend is typically better for small operations
            await tf.setBackend('cpu');
            logger.info('✅ Set TensorFlow.js backend to CPU for Node.js');

            // Wait for backend to be ready
            await tf.ready();
            logger.info('✅ TensorFlow.js backend ready');

            // Log current backend information
            const currentBackend = tf.getBackend();
            logger.info(`📊 Current TensorFlow.js backend: ${currentBackend}`);

            // Additional optimizations for memory and performance
            const memoryInfo = tf.memory();
            logger.info(`📊 Initial memory usage: ${JSON.stringify(memoryInfo)}`);

        } catch (error) {
            logger.warn('⚠️ Backend configuration warning:', error.message);
            // Continue with default backend if configuration fails
        }
    }

    async initialize() {
        try {
            logger.info('😊 Loading emotion recognition model...');

            // Configure TensorFlow.js backend for optimal performance
            await this.configureTensorFlowBackend();

            const customArchitecturePath = join(this.modelPath, 'architecture.json');
            const customWeightsPath = join(this.modelPath, 'weights.json');
            const localModelPath = join(this.modelPath, 'model.json');

            if (existsSync(customArchitecturePath) && existsSync(customWeightsPath)) {
                // Load custom format with architecture and weights JSON files
                logger.info('📊 Loading custom emotion model format...');
                this.model = await this.loadCustomModel();
                logger.info('✅ Custom emotion model loaded successfully');
                this.isCustomFormat = true;
            } else if (existsSync(localModelPath)) {
                // Load TensorFlow.js graph model converted from Keras
                logger.info('📊 Loading TensorFlow.js graph model...');
                this.model = await tf.loadGraphModel(`file://${localModelPath}`);
                logger.info('✅ TensorFlow.js graph emotion model loaded successfully');
                this.isGraphModel = true;
            } else {
                // Try loading legacy model format as fallback
                const weightsPath = join(this.modelPath, 'model.weights.bin');
                if (existsSync(weightsPath)) {
                    logger.info('📊 Found weights file, creating Little VGG architecture...');
                    this.model = await this.createLittleVGGArchitecture();
                    await this.model.loadWeights(`file://${this.modelPath}/model.weights.bin`);
                    logger.info('✅ Emotion model architecture created and weights loaded');
                } else {
                    throw new Error('Emotion model files not found and no fallback available');
                }
            }

            this.isInitialized = true;
            this.logModelInfo();

        } catch (error) {
            logger.error('❌ Emotion model initialization failed:', error);
            throw error;
        }
    }

    async loadCustomModel() {
        try {
            const { readFileSync } = await import('fs');

            // Load architecture configuration
            const architecturePath = join(this.modelPath, 'architecture.json');
            const weightsPath = join(this.modelPath, 'weights.json');

            logger.info('📖 Reading model architecture...');
            const architectureData = JSON.parse(readFileSync(architecturePath, 'utf8'));

            logger.info('📖 Reading model weights...');
            const weightsData = JSON.parse(readFileSync(weightsPath, 'utf8'));

            // Update config based on architecture data
            if (architectureData.class_labels) {
                this.config.emotions = architectureData.class_labels;
                logger.info(`🏷️ Updated emotion labels: ${this.config.emotions.join(', ')}`);
            }

            if (architectureData.input_shape) {
                this.config.inputSize = architectureData.input_shape[0]; // Assuming square input
                logger.info(`📐 Updated input size: ${this.config.inputSize}x${this.config.inputSize}`);
            }

            // Create model architecture from configuration
            logger.info('🏗️ Building model architecture from configuration...');
            const model = await this.buildModelFromArchitecture(architectureData.architecture);

            // Load weights into the model
            logger.info('⚖️ Loading weights into model...');
            await this.loadWeightsIntoModel(model, weightsData);

            return model;

        } catch (error) {
            logger.error('❌ Failed to load custom model:', error);
            throw error;
        }
    }

    async buildModelFromArchitecture(architecture) {
        const layers = [];

        for (let i = 0; i < architecture.length; i++) {
            const layerConfig = architecture[i];

            switch (layerConfig.type) {
                case 'conv2d':
                    if (i === 0) {
                        // First layer needs input shape
                        layers.push(tf.layers.conv2d({
                            filters: layerConfig.filters,
                            kernelSize: [layerConfig.kernel_size, layerConfig.kernel_size],
                            padding: 'same',
                            inputShape: [this.config.inputSize, this.config.inputSize, 1],
                            name: layerConfig.name
                        }));
                    } else {
                        layers.push(tf.layers.conv2d({
                            filters: layerConfig.filters,
                            kernelSize: [layerConfig.kernel_size, layerConfig.kernel_size],
                            padding: 'same',
                            name: layerConfig.name
                        }));
                    }
                    if (layerConfig.activation) {
                        layers.push(tf.layers.activation({
                            activation: layerConfig.activation
                        }));
                    }
                    break;

                case 'batch_norm':
                    layers.push(tf.layers.batchNormalization({
                        name: layerConfig.name
                    }));
                    break;

                case 'max_pool':
                    layers.push(tf.layers.maxPooling2d({
                        poolSize: [layerConfig.pool_size, layerConfig.pool_size],
                        strides: [layerConfig.pool_size, layerConfig.pool_size]
                    }));
                    break;

                case 'dropout':
                    layers.push(tf.layers.dropout({
                        rate: layerConfig.rate
                    }));
                    break;

                case 'flatten':
                    layers.push(tf.layers.flatten());
                    break;

                case 'dense':
                    layers.push(tf.layers.dense({
                        units: layerConfig.units,
                        activation: layerConfig.activation,
                        name: layerConfig.name
                    }));
                    break;

                default:
                    logger.warn(`⚠️ Unknown layer type: ${layerConfig.type}`);
            }
        }

        const model = tf.sequential({ layers });
        logger.info(`✅ Model architecture built with ${layers.length} layers`);
        return model;
    }

    async loadWeightsIntoModel(model, weightsData) {
        try {
            // Get all the weights from the model layers
            const modelWeights = model.getWeights();
            const weightNames = Object.keys(weightsData);

            logger.info(`🔍 Model has ${modelWeights.length} weight tensors`);
            logger.info(`🔍 Weights data has ${weightNames.length} weight arrays`);

            // Create a mapping of weight names to tensors
            const weightTensors = [];

            for (const weightName of weightNames) {
                const weightArray = weightsData[weightName];

                if (Array.isArray(weightArray)) {
                    // Convert the nested array to a tensor with the appropriate shape
                    const tensor = tf.tensor(weightArray);
                    weightTensors.push(tensor);
                    logger.debug(`📦 Loaded weight ${weightName} with shape [${tensor.shape}]`);
                }
            }

            // Set the weights in the model
            if (weightTensors.length > 0) {
                model.setWeights(weightTensors);
                logger.info(`✅ Successfully loaded ${weightTensors.length} weight tensors into model`);
            } else {
                throw new Error('No valid weight tensors found in weights data');
            }

        } catch (error) {
            logger.error('❌ Failed to load weights into model:', error);
            throw error;
        }
    }

    async createLittleVGGArchitecture() {
        // Recreate the exact architecture matching the converted model
        logger.info('🏗️  Creating Little VGG architecture with batch normalization...');

        const model = tf.sequential({
            layers: [
                // Block 1 - matches converted model architecture
                tf.layers.conv2d({
                    filters: 32,
                    kernelSize: [3, 3],
                    padding: 'same',
                    inputShape: [this.config.inputSize, this.config.inputSize, 1],
                    name: 'conv2d_1'
                }),
                tf.layers.activation({ activation: 'elu', name: 'activation_1' }),
                tf.layers.batchNormalization({ name: 'batch_normalization_1' }),

                tf.layers.conv2d({
                    filters: 32,
                    kernelSize: [3, 3],
                    padding: 'same',
                    name: 'conv2d_2'
                }),
                tf.layers.activation({ activation: 'elu', name: 'activation_2' }),
                tf.layers.batchNormalization({ name: 'batch_normalization_2' }),
                tf.layers.maxPooling2d({
                    poolSize: [2, 2],
                    strides: [2, 2],
                    name: 'max_pooling2d_1'
                }),
                tf.layers.dropout({ rate: 0.2, name: 'dropout_1' }),

                // Block 2
                tf.layers.conv2d({
                    filters: 64,
                    kernelSize: [3, 3],
                    padding: 'same',
                    name: 'conv2d_3'
                }),
                tf.layers.activation({ activation: 'elu', name: 'activation_3' }),
                tf.layers.batchNormalization({ name: 'batch_normalization_3' }),

                tf.layers.conv2d({
                    filters: 64,
                    kernelSize: [3, 3],
                    padding: 'same',
                    name: 'conv2d_4'
                }),
                tf.layers.activation({ activation: 'elu', name: 'activation_4' }),
                tf.layers.batchNormalization({ name: 'batch_normalization_4' }),
                tf.layers.maxPooling2d({
                    poolSize: [2, 2],
                    strides: [2, 2],
                    name: 'max_pooling2d_2'
                }),
                tf.layers.dropout({ rate: 0.2, name: 'dropout_2' }),

                // Block 3
                tf.layers.conv2d({
                    filters: 128,
                    kernelSize: [3, 3],
                    padding: 'same',
                    name: 'conv2d_5'
                }),
                tf.layers.activation({ activation: 'elu', name: 'activation_5' }),
                tf.layers.batchNormalization({ name: 'batch_normalization_5' }),

                tf.layers.conv2d({
                    filters: 128,
                    kernelSize: [3, 3],
                    padding: 'same',
                    name: 'conv2d_6'
                }),
                tf.layers.activation({ activation: 'elu', name: 'activation_6' }),
                tf.layers.batchNormalization({ name: 'batch_normalization_6' }),
                tf.layers.maxPooling2d({
                    poolSize: [2, 2],
                    strides: [2, 2],
                    name: 'max_pooling2d_3'
                }),
                tf.layers.dropout({ rate: 0.2, name: 'dropout_3' }),

                // Block 4
                tf.layers.conv2d({
                    filters: 256,
                    kernelSize: [3, 3],
                    padding: 'same',
                    name: 'conv2d_7'
                }),
                tf.layers.activation({ activation: 'elu', name: 'activation_7' }),
                tf.layers.batchNormalization({ name: 'batch_normalization_7' }),

                tf.layers.conv2d({
                    filters: 256,
                    kernelSize: [3, 3],
                    padding: 'same',
                    name: 'conv2d_8'
                }),
                tf.layers.activation({ activation: 'elu', name: 'activation_8' }),
                tf.layers.batchNormalization({ name: 'batch_normalization_8' }),
                tf.layers.maxPooling2d({
                    poolSize: [2, 2],
                    strides: [2, 2],
                    name: 'max_pooling2d_4'
                }),
                tf.layers.dropout({ rate: 0.2, name: 'dropout_4' }),

                // Classifier - matches converted model
                tf.layers.flatten({ name: 'flatten_1' }),
                tf.layers.dense({
                    units: 64,
                    name: 'dense_1'
                }),
                tf.layers.activation({ activation: 'elu', name: 'activation_9' }),
                tf.layers.batchNormalization({ name: 'batch_normalization_9' }),
                tf.layers.dropout({ rate: 0.5, name: 'dropout_5' }),

                tf.layers.dense({
                    units: 64,
                    name: 'dense_2'
                }),
                tf.layers.activation({ activation: 'elu', name: 'activation_10' }),
                tf.layers.batchNormalization({ name: 'batch_normalization_10' }),
                tf.layers.dropout({ rate: 0.5, name: 'dropout_6' }),

                tf.layers.dense({
                    units: this.config.emotions.length,
                    activation: 'softmax',
                    name: 'dense_3'
                })
            ]
        });

        return model;
    }

    createFallbackModel() {
        logger.warn('⚠️  Creating fallback emotion model...');

        // Simple fallback that returns semi-random but realistic emotion distributions
        return {
            predict: (input) => {
                const batchSize = input.shape[0];

                // Create reasonable emotion distributions
                const predictions = Array.from({ length: batchSize }, () => {
                    const emotions = new Array(this.config.emotions.length);

                    // Generate a somewhat realistic emotion distribution
                    // with a bias toward neutral and happy emotions
                    emotions[4] = Math.random() * 0.4 + 0.3; // Neutral (0.3-0.7)
                    emotions[3] = Math.random() * 0.3 + 0.1; // Happy (0.1-0.4)

                    // Fill remaining emotions with smaller probabilities
                    const remaining = 1.0 - emotions[3] - emotions[4];
                    for (let i = 0; i < emotions.length; i++) {
                        if (i !== 3 && i !== 4) {
                            emotions[i] = Math.random() * (remaining / 5);
                        }
                    }

                    // Normalize to sum to 1
                    const sum = emotions.reduce((a, b) => a + b, 0);
                    return emotions.map(e => e / sum);
                });

                return tf.tensor2d(predictions, [batchSize, this.config.emotions.length]);
            },
            isFallback: true
        };
    }

    async predict(imageData, faces = null) {
        try {
            if (!this.isInitialized) {
                throw new Error('Emotion model not initialized');
            }

            if (!faces || faces.length === 0) {
                throw new Error('No faces provided for emotion prediction');
            }

            logger.debug('😊 Predicting emotion...');

            // Performance profiling as suggested by manager
            const t0 = performance.now();

            // Use the largest/most confident face for prediction
            const targetFace = this.selectBestFace(faces);

            // Extract and preprocess face region
            const preprocessStartTime = performance.now();
            const faceInput = await this.preprocessFace(imageData, targetFace);
            const preprocessTime = performance.now() - preprocessStartTime;

            // Run inference - handle both graph and layers models with profiling
            const inferenceStartTime = performance.now();
            let predictions;

            if (this.isGraphModel) {
                // For graph models, use execute method
                predictions = this.model.execute(faceInput);
            } else {
                // For layers models (including custom format), use predict method
                predictions = this.model.predict(faceInput);
            }

            // Ensure prediction data is computed for accurate timing
            await predictions.data();
            const inferenceTime = performance.now() - inferenceStartTime;

            // Post-process predictions
            const postprocessStartTime = performance.now();
            const result = await this.postprocessPredictions(predictions, targetFace);
            const postprocessTime = performance.now() - postprocessStartTime;

            // Cleanup tensors
            faceInput.dispose();
            if (predictions && typeof predictions.dispose === 'function') {
                predictions.dispose();
            }

            const t1 = performance.now();
            const totalTime = t1 - t0;

            // Detailed performance logging
            logger.debug(`😊 Emotion prediction performance:
                Total: ${totalTime.toFixed(2)}ms
                Preprocess: ${preprocessTime.toFixed(2)}ms
                Inference: ${inferenceTime.toFixed(2)}ms
                Postprocess: ${postprocessTime.toFixed(2)}ms`);

            // Add performance metrics to result
            result.performance = {
                total: totalTime,
                preprocessing: preprocessTime,
                inference: inferenceTime,
                postprocessing: postprocessTime
            };

            return result;

        } catch (error) {
            logger.error('❌ Emotion prediction failed:', error);
            throw error;
        }
    }

    selectBestFace(faces) {
        // Select face with highest confidence
        return faces.reduce((best, current) =>
            (current.confidence > best.confidence) ? current : best
        );
    }

    async preprocessFace(imageData, face) {
        try {
            let imageTensor;

            // Convert image data to tensor if needed
            if (tf.isTensor(imageData)) {
                imageTensor = imageData;
            } else if (Buffer.isBuffer(imageData)) {
                // For browser backend, we need to decode differently
                imageTensor = tf.browser.fromPixels(new ImageData(new Uint8ClampedArray(imageData), 48, 48), 3);
            } else {
                throw new Error('Unsupported image data format');
            }

            // Convert to grayscale if needed (emotion model expects grayscale)
            let grayTensor;
            if (imageTensor.shape[2] === 3) {
                // Convert RGB to grayscale using standard formula
                const [r, g, b] = tf.split(imageTensor, 3, 2);
                grayTensor = r.mul(0.299).add(g.mul(0.587)).add(b.mul(0.114));
                r.dispose();
                g.dispose();
                b.dispose();
            } else {
                grayTensor = imageTensor;
            }

            // Extract face region with padding for better quality
            const { x, y, width, height } = face.box;
            const imageHeight = grayTensor.shape[0];
            const imageWidth = grayTensor.shape[1];

            // Add 20% padding around face for better context
            const padding = 0.2;
            const paddedWidth = width * (1 + padding);
            const paddedHeight = height * (1 + padding);
            const paddedX = Math.max(0, x - (paddedWidth - width) / 2);
            const paddedY = Math.max(0, y - (paddedHeight - height) / 2);

            // Normalize coordinates and ensure they're within bounds
            const x1 = Math.max(0, paddedX) / imageWidth;
            const y1 = Math.max(0, paddedY) / imageHeight;
            const x2 = Math.min(imageWidth, paddedX + paddedWidth) / imageWidth;
            const y2 = Math.min(imageHeight, paddedY + paddedHeight) / imageHeight;

            // Crop face region
            const cropped = tf.image.cropAndResize(
                grayTensor.expandDims(0), // Add batch dimension
                [[y1, x1, y2, x2]], // boxes
                [0], // box_indices
                [this.config.inputSize, this.config.inputSize] // crop_size
            );

            // Improved normalization for better model performance
            // Standard normalization: (pixel - mean) / std
            // Use ImageNet-like normalization adapted for grayscale
            const normalized = cropped.div(255.0);
            const centered = normalized.sub(0.5); // Center around 0
            const scaled = centered.mul(2.0); // Scale to [-1, 1]

            // Add channel dimension for grayscale (48x48x1)
            const withChannel = scaled.expandDims(-1);

            // Optional: Add slight Gaussian noise for robustness (disabled by default)
            // const withNoise = this.addGaussianNoise(withChannel, 0.01);

            // Cleanup intermediate tensors
            if (!tf.isTensor(imageData)) {
                imageTensor.dispose();
            }
            if (grayTensor !== imageTensor) {
                grayTensor.dispose();
            }
            cropped.dispose();
            normalized.dispose();
            centered.dispose();
            scaled.dispose();

            return withChannel;

        } catch (error) {
            logger.error('❌ Face preprocessing for emotion failed:', error);
            throw error;
        }
    }

    // Helper method for adding Gaussian noise (can improve robustness)
    addGaussianNoise(tensor, stddev = 0.01) {
        const noise = tf.randomNormal(tensor.shape, 0, stddev);
        const result = tensor.add(noise);
        noise.dispose();
        return result;
    }

    async postprocessPredictions(predictions, face) {
        try {
            const predictionData = await predictions.data();
            const emotionProbs = Array.from(predictionData);

            // Find the emotion with highest probability
            const maxProbIndex = emotionProbs.indexOf(Math.max(...emotionProbs));
            const predictedEmotion = this.config.emotions[maxProbIndex];
            const confidence = emotionProbs[maxProbIndex];

            // Create emotion probabilities object
            const allEmotions = {};
            this.config.emotions.forEach((emotion, index) => {
                allEmotions[emotion] = emotionProbs[index];
            });

            // Filter out very low probability emotions for cleaner results
            const significantEmotions = {};
            Object.entries(allEmotions).forEach(([emotion, prob]) => {
                if (prob >= this.config.threshold) {
                    significantEmotions[emotion] = prob;
                }
            });

            return {
                emotion: {
                    predicted: predictedEmotion,
                    confidence: confidence,
                    probabilities: allEmotions,
                    significant: significantEmotions
                },
                face: {
                    box: face.box,
                    confidence: face.confidence
                },
                metadata: {
                    model: this.model.isFallback ? 'fallback' : 'trained',
                    processingTime: Date.now(),
                    totalEmotions: this.config.emotions.length
                }
            };

        } catch (error) {
            logger.error('❌ Emotion prediction post-processing failed:', error);
            return this.createFallbackResult(face);
        }
    }

    createFallbackResult(face) {
        // Create a fallback result with neutral emotion
        const allEmotions = {};
        this.config.emotions.forEach((emotion, index) => {
            if (emotion === 'Neutral') {
                allEmotions[emotion] = 0.6;
            } else if (emotion === 'Happy') {
                allEmotions[emotion] = 0.25;
            } else {
                allEmotions[emotion] = 0.15 / (this.config.emotions.length - 2);
            }
        });

        return {
            emotion: {
                predicted: 'Neutral',
                confidence: 0.6,
                probabilities: allEmotions,
                significant: { 'Neutral': 0.6, 'Happy': 0.25 }
            },
            face: {
                box: face.box,
                confidence: face.confidence
            },
            metadata: {
                model: 'fallback',
                processingTime: Date.now(),
                totalEmotions: this.config.emotions.length
            }
        };
    }

    logModelInfo() {
        if (this.model) {
            const info = {
                initialized: this.isInitialized,
                isFallback: this.model.isFallback || false,
                modelType: this.model.isFallback ? 'fallback' : (this.isGraphModel ? 'graph' : (this.isCustomFormat ? 'custom' : 'layers')),
                config: this.config
            };

            if (!this.model.isFallback) {
                try {
                    if (this.isGraphModel) {
                        // For graph models
                        info.inputShape = 'Graph model - input shape [batch, 48, 48, 1]';
                        info.outputShape = 'Graph model - output shape [batch, 5]';
                    } else {
                        // For layers models (including custom format)
                        if (this.model.inputs && this.model.outputs) {
                            info.inputShape = this.model.inputs[0].shape;
                            info.outputShape = this.model.outputs[0].shape;
                            info.totalParams = this.model.countParams();
                        }
                    }

                    if (this.isCustomFormat) {
                        info.format = 'Custom JSON format (architecture + weights)';
                        info.modelPath = this.modelPath;
                    }
                } catch (error) {
                    logger.debug('Could not get model info:', error.message);
                }
            }

            logger.info('😊 Emotion Model Info:', JSON.stringify(info, null, 2));
        }
    }

    async dispose() {
        if (this.model && typeof this.model.dispose === 'function') {
            this.model.dispose();
        }
        this.model = null;
        this.isInitialized = false;
        logger.info('😊 Emotion model disposed');
    }
}

export default EmotionModel;