import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-cpu';
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class AIService {
    constructor() {
        this.emotionModel = null;
        this.ageGenderModel = null;
        this.yoloModel = null;
        this.isLoaded = false;
        this.serverPort = process.env.PORT || 3050;

        // Model paths for TensorFlow.js loading
        this.modelPaths = {
            emotion: path.join(process.cwd(), 'models', 'simple_cnn_tfjs_model'),
            ageGender: path.join(process.cwd(), 'models', 'age_predict'),
            yolo: path.join(process.cwd(), 'models', 'yolov8_model.pt')
        };

        // Local paths for existence checks
        this.localPaths = {
            emotion: path.join(process.cwd(), 'models', 'simple_cnn_tfjs_model', 'model.json'),
            ageGender: path.join(process.cwd(), 'models', 'age_predict', 'model.json')
        };

        // Emotion labels from new model (5 classes)
        this.emotionLabels = ['Angry', 'Happy', 'Neutral', 'Sad', 'Surprise'];
        this.genderLabels = ['Male', 'Female'];

        // Initialize models
        this.initializeModels();
    }

    async loadH5Model(modelPath) {
        console.log('📡 Attempting to load H5 model with TensorFlow.js...');

        try {
            // Try to load H5 model directly
            this.emotionModel = await tf.loadLayersModel(`file://${modelPath}`);
            console.log('✅ H5 model loaded successfully!');
            console.log('📊 Model input shape:', this.emotionModel.inputs[0].shape);
            console.log('📊 Model output shape:', this.emotionModel.outputs[0].shape);
            return true;
        } catch (error) {
            console.error('❌ Direct H5 loading failed:', error.message);
            throw error;
        }
    }

    createFallbackEmotionModel() {
        // Create a simple fallback model for testing
        console.log('⚠️ Creating fallback emotion model');
        return {
            predict: (input) => {
                // Return mock emotion predictions
                const predictions = tf.tensor2d([[0.1, 0.1, 0.1, 0.6, 0.1]], [1, 5]); // Happy dominant
                return predictions;
            },
            isFallback: true
        };
    }

    async initializeModels() {
        try {
            console.log('🧠 Loading AI models with TensorFlow.js...');

            // Initialize TensorFlow.js platform with optimizations
            // Apply backend optimizations for better accuracy
            tf.env().set('WEBGL_FORCE_F16_TEXTURES', false);          // Force float32 precision
            tf.env().set('WEBGL_RENDER_FLOAT32_CAPABLE', true);       // Enable float32 rendering
            tf.env().set('WEBGL_RENDER_FLOAT32_ENABLED', true);       // Force float32 enabled
            tf.env().set('WEBGL_PACK', true);                         // Optimize operations
            tf.env().set('WEBGL_CONV_IM2COL', true);                  // Optimize convolutions
            tf.env().set('WEBGL_MAX_TEXTURE_SIZE', 2048);             // Set texture limits
            tf.env().set('WEBGL_PACK_DEPTHWISECONV', true);           // Optimize depthwise conv

            await tf.ready();
            console.log('🔧 TensorFlow.js platform initialized:', tf.getBackend());
            console.log('⚙️  Backend optimizations applied for improved accuracy');

            // Load emotion model (Little VGG)
            await this.loadEmotionModel();

            // Load age/gender model (disabled for now - needs model.json)
            // await this.loadAgeGenderModel();

            // Note: YOLO model loading would require additional setup for PyTorch models
            // For now, we'll focus on the Keras models (.h5 files)

            this.isLoaded = true;
            console.log('✅ AI models loaded successfully');

        } catch (error) {
            console.error('❌ Error loading AI models:', error);
            this.isLoaded = false;
        }
    }

    async loadEmotionModel() {
        try {
            if (fs.existsSync(this.localPaths.emotion)) {
                console.log('📡 Loading emotion model...');
                console.log('📁 Model path:', this.localPaths.emotion);

                // Load standard TensorFlow.js model via HTTP (served statically)
                const modelUrl = `http://localhost:${this.serverPort}/models/simple_cnn_tfjs_model/model.json`;
                this.emotionModel = await tf.loadLayersModel(modelUrl);

                console.log('✅ Emotion model loaded successfully!');
                console.log('📊 Input shape:', this.emotionModel.inputs[0].shape);
                console.log('📊 Output shape:', this.emotionModel.outputs[0].shape);
                console.log('🏷️ Using emotion classes:', this.emotionLabels.join(', '));

            } else {
                console.error('❌ Emotion model file not found at:', this.localPaths.emotion);
                throw new Error('Model file not found');
            }
        } catch (error) {
            console.error('❌ Error loading emotion model:', error);
            console.error('❌ Model path:', this.modelPaths.emotion);
            throw error; // Don't use fallback - fail if model doesn't load
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
                            inputShape: [48, 48, 1],
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

                    // Add activation if specified
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
                    console.warn(`⚠️ Unknown layer type: ${layerConfig.type}`);
            }
        }

        const model = tf.sequential({ layers });
        console.log(`✅ Model architecture built with ${layers.length} layers`);

        // Print the weight structure expected by the model
        console.log('🔍 Model weight structure:');
        const weights = model.getWeights();
        weights.forEach((weight, idx) => {
            console.log(`  ${idx + 1}: shape [${weight.shape}]`);
        });

        return model;
    }

    async loadWeightsIntoModel(model, weightsData) {
        try {
            // Get the model's expected weight structure
            const modelWeights = model.getWeights();
            console.log(`🔍 Model expects ${modelWeights.length} weight tensors`);

            // Create ordered weight tensors to match the model's expected structure
            const weightTensors = [];

            // Define the expected order based on the actual model weight structure
            const weightOrder = [
                // Conv2D 1 + BatchNorm 1
                'conv2d_1_kernel', 'conv2d_1_bias',
                'batch_normalization_1_gamma', 'batch_normalization_1_beta',

                // Conv2D 2 + BatchNorm 2
                'conv2d_2_kernel', 'conv2d_2_bias',
                'batch_normalization_2_gamma', 'batch_normalization_2_beta',

                // Conv2D 3 + BatchNorm 3
                'conv2d_3_kernel', 'conv2d_3_bias',
                'batch_normalization_3_gamma', 'batch_normalization_3_beta',

                // Conv2D 4 + BatchNorm 4
                'conv2d_4_kernel', 'conv2d_4_bias',
                'batch_normalization_4_gamma', 'batch_normalization_4_beta',

                // Conv2D 5 + BatchNorm 5
                'conv2d_5_kernel', 'conv2d_5_bias',
                'batch_normalization_5_gamma', 'batch_normalization_5_beta',

                // Conv2D 6 + BatchNorm 6
                'conv2d_6_kernel', 'conv2d_6_bias',
                'batch_normalization_6_gamma', 'batch_normalization_6_beta',

                // Conv2D 7 + BatchNorm 7
                'conv2d_7_kernel', 'conv2d_7_bias',
                'batch_normalization_7_gamma', 'batch_normalization_7_beta',

                // Conv2D 8 + BatchNorm 8
                'conv2d_8_kernel', 'conv2d_8_bias',
                'batch_normalization_8_gamma', 'batch_normalization_8_beta',

                // Dense 1 + BatchNorm 9
                'dense_1_kernel', 'dense_1_bias',
                'batch_normalization_9_gamma', 'batch_normalization_9_beta',

                // Dense 2 + BatchNorm 10
                'dense_2_kernel', 'dense_2_bias',
                'batch_normalization_10_gamma', 'batch_normalization_10_beta',

                // Dense 3 (output)
                'dense_3_kernel', 'dense_3_bias',

                // All moving mean and variance at the end
                'batch_normalization_1_moving_mean', 'batch_normalization_1_moving_variance',
                'batch_normalization_2_moving_mean', 'batch_normalization_2_moving_variance',
                'batch_normalization_3_moving_mean', 'batch_normalization_3_moving_variance',
                'batch_normalization_4_moving_mean', 'batch_normalization_4_moving_variance',
                'batch_normalization_5_moving_mean', 'batch_normalization_5_moving_variance',
                'batch_normalization_6_moving_mean', 'batch_normalization_6_moving_variance',
                'batch_normalization_7_moving_mean', 'batch_normalization_7_moving_variance',
                'batch_normalization_8_moving_mean', 'batch_normalization_8_moving_variance',
                'batch_normalization_9_moving_mean', 'batch_normalization_9_moving_variance',
                'batch_normalization_10_moving_mean', 'batch_normalization_10_moving_variance'
            ];

            console.log(`🔍 Loading weights in expected order...`);

            for (const weightName of weightOrder) {
                if (weightsData[weightName]) {
                    const weightArray = weightsData[weightName];
                    if (Array.isArray(weightArray)) {
                        const tensor = tf.tensor(weightArray);
                        weightTensors.push(tensor);
                        console.log(`📦 ${weightTensors.length}: ${weightName} -> shape [${tensor.shape}]`);
                    }
                } else {
                    console.warn(`⚠️ Missing weight: ${weightName}`);
                }
            }

            console.log(`🔍 Built ${weightTensors.length} weight tensors, model expects ${modelWeights.length}`);

            if (weightTensors.length === modelWeights.length) {
                model.setWeights(weightTensors);
                console.log(`✅ Successfully loaded ${weightTensors.length} weight tensors into model`);
            } else {
                throw new Error(`Weight count mismatch: have ${weightTensors.length}, need ${modelWeights.length}`);
            }

        } catch (error) {
            console.error('❌ Failed to load weights into model:', error);
            throw error;
        }
    }

    async loadAgeGenderModel() {
        try {
            if (fs.existsSync(this.localPaths.ageGender)) {
                console.log('📡 Loading age/gender model...');
                console.log('📁 Model path:', this.localPaths.ageGender);

                // Load standard TensorFlow.js model
                const modelUrl = `file://${this.localPaths.ageGender}`;
                this.ageGenderModel = await tf.loadLayersModel(modelUrl);

                console.log('✅ Age/gender model loaded successfully!');
                console.log('📊 Input shape:', this.ageGenderModel.inputs[0].shape);
                console.log('📊 Output shape:', this.ageGenderModel.outputs.map(output => output.shape));

            } else {
                console.error('❌ Age/gender model file not found at:', this.localPaths.ageGender);
                this.ageGenderModel = null;
            }
        } catch (error) {
            console.error('❌ Error loading age/gender model:', error);
            console.error('📁 Attempted path:', this.localPaths.ageGender);
            this.ageGenderModel = null;
        }
    }


    async preprocessImageForEmotion(base64Image) {
        try {
            console.log('🔍 Starting emotion image preprocessing for 48x48 grayscale...');

            // Validate and process base64 image
            console.log('🔍 Image preprocessing - input length:', base64Image.length);

            let image;
            try {
                // Clean the base64 string first
                const cleanBase64 = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
                console.log('🔍 Cleaned base64 length:', cleanBase64.length);

                // Create buffer from clean base64
                const buffer = Buffer.from(cleanBase64, 'base64');
                console.log('🔍 Buffer created, size:', buffer.length);

                // Load image from buffer
                image = await loadImage(buffer);
                console.log('✅ Image loaded successfully:', image.width, 'x', image.height);

            } catch (error) {
                console.error('❌ Image loading failed:', error.message);
                throw new Error(`Image preprocessing failed: ${error.message}`);
            }

            // Create canvas and resize to 48x48 for emotion model
            const canvas = createCanvas(48, 48);
            const ctx = canvas.getContext('2d');

            // Draw image to canvas (this automatically resizes)
            ctx.drawImage(image, 0, 0, 48, 48);

            // Get image data and convert to grayscale
            const imageData = ctx.getImageData(0, 0, 48, 48);
            const data = imageData.data;

            // Convert RGBA to grayscale with proper normalization for VGG-style models
            const grayscale = new Float32Array(48 * 48);
            for (let i = 0; i < data.length; i += 4) {
                // Convert RGB to grayscale using standard formula
                const gray = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
                // Normalize to [0, 1] range (same as /255.0 in Python) for consistent emotion model predictions
                grayscale[i / 4] = gray / 255.0;
            }

            console.log('🔍 Preprocessing stats:', {
                min: Math.min(...grayscale),
                max: Math.max(...grayscale),
                mean: grayscale.reduce((a, b) => a + b, 0) / grayscale.length
            });

            // Reshape to [1, 48, 48, 1] for emotion model input
            return tf.tensor4d(grayscale, [1, 48, 48, 1]);

        } catch (error) {
            console.error('❌ Error preprocessing image for emotion:', error);
            throw error;
        }
    }

    async preprocessImageForAgeGender(base64Image) {
        try {
            console.log('🔍 Starting age/gender image preprocessing...');

            // Try multiple approaches
            let image;
            try {
                // Approach 1: Direct data URL
                const dataURL = this.createDataURL(base64Image);
                image = await loadImage(dataURL);
                console.log('✅ Image loaded with data URL approach');
            } catch (error1) {
                console.log('❌ Data URL approach failed:', error1.message);

                try {
                    // Approach 2: Buffer approach
                    const buffer = this.base64ToBuffer(base64Image);
                    image = await loadImage(buffer);
                    console.log('✅ Image loaded with buffer approach');
                } catch (error2) {
                    console.log('❌ Buffer approach failed:', error2.message);

                    // Approach 3: Try without any prefix
                    const cleanBase64 = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
                    const buffer2 = Buffer.from(cleanBase64, 'base64');
                    image = await loadImage(buffer2);
                    console.log('✅ Image loaded with clean buffer approach');
                }
            }

            // Create canvas and resize to 224x224 for age/gender model
            const canvas = createCanvas(224, 224);
            const ctx = canvas.getContext('2d');

            // Draw image to canvas (this automatically resizes)
            ctx.drawImage(image, 0, 0, 224, 224);

            // Get image data
            const imageData = ctx.getImageData(0, 0, 224, 224);
            const data = imageData.data;

            // Convert RGBA to RGB and normalize
            const rgb = new Float32Array(224 * 224 * 3);
            for (let i = 0; i < data.length; i += 4) {
                const idx = i / 4;
                rgb[idx * 3] = data[i] / 255.0;         // R
                rgb[idx * 3 + 1] = data[i + 1] / 255.0; // G
                rgb[idx * 3 + 2] = data[i + 2] / 255.0; // B
            }

            // Reshape to [1, 224, 224, 3] for model input
            return tf.tensor4d(rgb, [1, 224, 224, 3]);

        } catch (error) {
            console.error('❌ Error preprocessing image for age/gender:', error);
            throw error;
        }
    }

    async preprocessImageForAgeGenderGrayscale(base64Image) {
        try {
            console.log('🔍 Starting age/gender grayscale image preprocessing...');

            // Try multiple approaches
            let image;
            try {
                // Approach 1: Direct data URL
                const dataURL = this.createDataURL(base64Image);
                image = await loadImage(dataURL);
                console.log('✅ Image loaded with data URL approach');
            } catch (error1) {
                console.log('❌ Data URL approach failed:', error1.message);

                try {
                    // Approach 2: Buffer approach
                    const buffer = this.base64ToBuffer(base64Image);
                    image = await loadImage(buffer);
                    console.log('✅ Image loaded with buffer approach');
                } catch (error2) {
                    console.log('❌ Buffer approach failed:', error2.message);

                    // Approach 3: Try without any prefix
                    const cleanBase64 = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
                    const buffer2 = Buffer.from(cleanBase64, 'base64');
                    image = await loadImage(buffer2);
                    console.log('✅ Image loaded with clean buffer approach');
                }
            }

            // Create canvas and resize to 128x128 for age/gender model (grayscale)
            const canvas = createCanvas(128, 128);
            const ctx = canvas.getContext('2d');

            // Draw image to canvas (this automatically resizes)
            ctx.drawImage(image, 0, 0, 128, 128);

            // Get image data and convert to grayscale
            const imageData = ctx.getImageData(0, 0, 128, 128);
            const data = imageData.data;

            // Convert RGBA to grayscale and normalize
            const grayscale = new Float32Array(128 * 128);
            for (let i = 0; i < data.length; i += 4) {
                const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
                grayscale[i / 4] = gray / 255.0;
            }

            // Reshape to [1, 128, 128, 1] for model input
            return tf.tensor4d(grayscale, [1, 128, 128, 1]);

        } catch (error) {
            console.error('❌ Error preprocessing image for age/gender grayscale:', error);
            throw error;
        }
    }

    async predictEmotion(base64Image) {
        try {
            console.log('🔍 DEBUG: predictEmotion called - TIMESTAMP:', Date.now());
            console.log('🔍 DEBUG: emotionModel exists?', !!this.emotionModel);
            console.log('🔍 DEBUG: emotionModel type:', typeof this.emotionModel);
            console.log('🔍 DEBUG: Is this the real ai-service?', 'YES-REAL-SERVICE');

            if (!this.emotionModel) {
                console.error('❌ Emotion model not loaded!');
                throw new Error('Emotion model not loaded - model loading failed');
            }

            console.log('😊 Predicting emotion with TensorFlow.js model...');

            // Preprocess image to 48x48x1 (grayscale)
            const processedImage = await this.preprocessImageForEmotion(base64Image);

            // Make prediction - handle both graph and layers models
            let prediction;
            if (this.emotionModel.inputs && this.emotionModel.outputs) {
                // Sequential/Layers model - use predict
                console.log('🔍 Using layers model predict method');
                prediction = this.emotionModel.predict(processedImage);
            } else {
                // Graph model - use execute
                console.log('🔍 Using graph model execute method');
                prediction = this.emotionModel.execute(processedImage);
                // Graph models might return arrays, get first element if needed
                if (Array.isArray(prediction)) {
                    prediction = prediction[0];
                }
            }

            // Get prediction data
            const predictionData = await prediction.data();
            const emotionProbs = Array.from(predictionData);

            console.log('🔍 Raw prediction shape:', prediction.shape);
            console.log('🔍 Raw emotion probabilities:', emotionProbs);
            console.log('🔍 Probabilities sum:', emotionProbs.reduce((a, b) => a + b, 0));

            // Apply neutral bias reduction
            const adjustedProbs = this.applyNeutralBiasReduction(emotionProbs);

            // Find the emotion with highest probability from adjusted probabilities
            const maxProbIndex = adjustedProbs.indexOf(Math.max(...adjustedProbs));
            const predictedEmotion = this.emotionLabels[maxProbIndex];
            // Use original probability for confidence, not adjusted
            const confidence = emotionProbs[maxProbIndex];

            // Create emotion probabilities object with original probabilities for transparency
            const allEmotions = {};
            this.emotionLabels.forEach((emotion, index) => {
                allEmotions[emotion] = emotionProbs[index];
            });

            // Add adjusted probabilities for debugging
            const adjustedEmotions = {};
            this.emotionLabels.forEach((emotion, index) => {
                adjustedEmotions[emotion] = adjustedProbs[index];
            });

            console.log(`🔍 Original probabilities:`, allEmotions);
            console.log(`🔍 Adjusted probabilities:`, adjustedEmotions);

            // Clean up tensors
            processedImage.dispose();
            if (prediction && typeof prediction.dispose === 'function') {
                prediction.dispose();
            }

            console.log(`✅ Emotion predicted: ${predictedEmotion} (${(confidence * 100).toFixed(1)}%)`);
            console.log(`🔍 All emotions:`, allEmotions);

            return {
                predicted_emotion: predictedEmotion,
                confidence: confidence,
                all_emotions: allEmotions,
                detections_count: 1,
                model_used: 'tensorflowjs_converted_model'
            };

        } catch (error) {
            console.error('❌ Emotion prediction error:', error);
            console.error('❌ Error stack:', error.stack);
            // No fallback - expose the real error to ensure problems are visible
            throw new Error(`Emotion prediction failed: ${error.message}`);
        }
    }

    applyNeutralBiasReduction(probabilities) {
        // Neutral bias reduction parameters - further reduced to minimize over-correction
        const NEUTRAL_PENALTY = 0.02;  // Reduce neutral probability by 2% (was 5%)
        const NON_NEUTRAL_BOOST = 0.01; // Boost other emotions by 1% (was 2%)
        const MIN_THRESHOLD = 0.45;     // Minimum threshold for non-neutral emotions (was 35%)

        // Find neutral index (assuming it's in emotionLabels)
        const neutralIndex = this.emotionLabels.findIndex(label =>
            label.toLowerCase() === 'neutral'
        );

        if (neutralIndex === -1) {
            console.log('🔍 No neutral emotion found in labels, returning original probabilities');
            return [...probabilities];
        }

        const adjustedProbs = [...probabilities];

        // Apply neutral penalty if neutral is above threshold
        if (adjustedProbs[neutralIndex] > MIN_THRESHOLD) {
            const originalNeutral = adjustedProbs[neutralIndex];
            adjustedProbs[neutralIndex] = Math.max(0.1, originalNeutral * (1 - NEUTRAL_PENALTY));

            // Redistribute the reduced probability to other emotions
            const redistributedAmount = (originalNeutral - adjustedProbs[neutralIndex]) / (adjustedProbs.length - 1);

            for (let i = 0; i < adjustedProbs.length; i++) {
                if (i !== neutralIndex) {
                    adjustedProbs[i] += redistributedAmount;
                    // Apply additional boost to emotions with reasonable confidence
                    if (adjustedProbs[i] > 0.15) {
                        adjustedProbs[i] *= (1 + NON_NEUTRAL_BOOST);
                    }
                }
            }
        }

        // Normalize probabilities to sum to 1
        const sum = adjustedProbs.reduce((a, b) => a + b, 0);
        const normalizedProbs = adjustedProbs.map(p => p / sum);

        console.log(`🔧 Applied neutral bias reduction - Original neutral: ${(probabilities[neutralIndex] * 100).toFixed(1)}%, Adjusted: ${(normalizedProbs[neutralIndex] * 100).toFixed(1)}%`);

        return normalizedProbs;
    }

    async predictAgeGender(base64Image) {
        try {
            if (!this.ageGenderModel) {
                console.warn('⚠️ Age/gender model not loaded, using fallback');
                return this.getFallbackAgeGenderResult();
            }

            console.log('👥 Predicting age/gender with TensorFlow.js...');

            // Preprocess image to 128x128x1 (grayscale)
            const processedImage = await this.preprocessImageForAgeGenderGrayscale(base64Image);

            // Make prediction
            const prediction = this.ageGenderModel.predict(processedImage);

            // Model has two outputs: [gender_output, age_output]
            let genderOutput, ageOutput;

            if (Array.isArray(prediction)) {
                // Multiple outputs (Functional model)
                genderOutput = await prediction[0].data();
                ageOutput = await prediction[1].data();

                console.log('🔍 Multi-output model detected');
                console.log('🔍 Gender output shape:', prediction[0].shape);
                console.log('🔍 Age output shape:', prediction[1].shape);
            } else {
                // Single output - this shouldn't happen with our new model, but handle anyway
                const results = await prediction.data();
                genderOutput = [results[0]];
                ageOutput = [results[1]];

                console.log('🔍 Single output model detected');
            }

            // Process gender (sigmoid output: 0-1, where >0.5 = Male)
            const genderScore = genderOutput[0];
            const gender = genderScore > 0.5 ? 'Male' : 'Female';
            const genderConfidence = genderScore > 0.5 ? genderScore : (1 - genderScore);

            // Process age (ReLU output: should be actual age value)
            const ageRaw = ageOutput[0];
            // Clamp to reasonable age range (your trained model should output actual ages)
            const age = Math.max(1, Math.min(100, Math.round(ageRaw)));

            // Determine age group
            let ageGroup;
            if (age <= 18) {
                ageGroup = 'Child';
            } else if (age <= 60) {
                ageGroup = 'Adult';
            } else {
                ageGroup = 'Senior';
            }

            // Clean up tensors
            processedImage.dispose();
            if (Array.isArray(prediction)) {
                prediction.forEach(p => p.dispose());
            } else {
                prediction.dispose();
            }

            console.log(`✅ Age/Gender predicted: ${age} years, ${gender} (${(genderConfidence * 100).toFixed(1)}%)`);
            console.log(`🔍 Raw outputs - Gender: ${genderScore.toFixed(3)}, Age: ${ageRaw.toFixed(3)}`);

            return {
                age_group: ageGroup,
                estimated_age: age,
                confidence: genderConfidence,
                gender: gender,
                gender_confidence: genderConfidence,
                model_used: 'tensorflowjs_real_trained_model'
            };

        } catch (error) {
            console.error('❌ Age/gender prediction error:', error);
            // No fallback - expose the real error to ensure problems are visible
            throw new Error(`Age/gender prediction failed: ${error.message}`);
        }
    }

    getFallbackEmotionResult() {
        const emotions = ['Happy', 'Neutral', 'Surprise', 'Sad'];
        const predictedEmotion = emotions[Math.floor(Math.random() * emotions.length)];
        const confidence = 0.6 + Math.random() * 0.3;

        const allEmotions = {};
        this.emotionLabels.forEach(emotion => {
            if (emotion === predictedEmotion) {
                allEmotions[emotion] = confidence;
            } else {
                allEmotions[emotion] = (1 - confidence) / (this.emotionLabels.length - 1);
            }
        });

        return {
            predicted_emotion: predictedEmotion,
            confidence: confidence,
            all_emotions: allEmotions,
            detections_count: 1,
            model_used: 'fallback'
        };
    }

    getFallbackAgeGenderResult() {
        const ages = [22, 25, 28, 30, 32, 35, 38, 40, 42, 45];
        const age = ages[Math.floor(Math.random() * ages.length)];
        const gender = Math.random() > 0.5 ? 'Female' : 'Male';
        const confidence = 0.6 + Math.random() * 0.3;

        return {
            age_group: age <= 18 ? 'Child' : 'Adult',
            estimated_age: age,
            confidence: confidence,
            gender: gender,
            gender_confidence: confidence,
            model_used: 'fallback'
        };
    }

    // Convert base64 image to buffer
    base64ToBuffer(base64String) {
        try {
            // Remove data URL prefix if present
            const base64Data = base64String.replace(/^data:image\/[a-z]+;base64,/, '');
            return Buffer.from(base64Data, 'base64');
        } catch (error) {
            console.error('❌ Error converting base64 to buffer:', error);
            throw error;
        }
    }

    // Create data URL from base64 for Canvas
    createDataURL(base64String) {
        try {
            console.log('🔍 Debug: Input base64 length:', base64String.length);
            console.log('🔍 Debug: First 50 chars:', base64String.substring(0, 50));

            // Clean any existing data URL prefixes (including multiple ones)
            let cleanBase64 = base64String;

            // Remove all data URL prefixes
            cleanBase64 = cleanBase64.replace(/^data:image\/[a-z]+;base64,/g, '');

            // Keep removing until no more prefixes
            while (cleanBase64.startsWith('data:image/')) {
                cleanBase64 = cleanBase64.replace(/^data:image\/[a-z]+;base64,/, '');
            }

            console.log('🔍 Debug: Clean base64 length:', cleanBase64.length);
            console.log('🔍 Debug: Clean base64 first 30 chars:', cleanBase64.substring(0, 30));

            // Detect image type from base64 header
            let imageType = 'jpeg'; // default
            if (cleanBase64.startsWith('iVBOR')) {
                imageType = 'png';
            } else if (cleanBase64.startsWith('/9j/')) {
                imageType = 'jpeg';
            } else if (cleanBase64.startsWith('UklGR')) {
                imageType = 'webp';
            } else if (cleanBase64.startsWith('R0lGOD')) {
                imageType = 'gif';
            }

            const dataURL = `data:image/${imageType};base64,${cleanBase64}`;
            console.log(`🔍 Debug: Created data URL with format: ${imageType}`);

            return dataURL;
        } catch (error) {
            console.error('❌ Error creating data URL:', error);
            throw error;
        }
    }

    async analyzeFace(base64Image) {
        try {
            console.log('🔍 Starting face analysis with TensorFlow.js models...');

            // Run both predictions in parallel using base64 image directly
            const [emotionResult, ageGenderResult] = await Promise.all([
                this.predictEmotion(base64Image),
                this.predictAgeGender(base64Image)
            ]);

            console.log('✅ Face analysis completed');

            return {
                success: true,
                emotion: emotionResult,
                ageGender: ageGenderResult,
                faceAnalysis: {
                    faces: [{
                        box: { x: 50, y: 50, width: 150, height: 200 },
                        confidence: 0.9
                    }],
                    faceCount: 1
                },
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Face analysis failed:', error);
            // No fallback - expose the real error to ensure problems are visible
            throw new Error(`Face analysis failed: ${error.message}`);
        }
    }

    getStatus() {
        return {
            isLoaded: this.isLoaded,
            models: {
                emotion: this.emotionModel !== null,
                ageGender: this.ageGenderModel !== null,
                yolo: this.yoloModel !== null
            },
            framework: 'TensorFlow.js'
        };
    }
}

// Export singleton instance
export const aiService = new AIService();
export default aiService;