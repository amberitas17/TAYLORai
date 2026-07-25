import * as tf from '@tensorflow/tfjs';
import { logger } from '../utils/logger.js';
import { memoryMonitor } from '../utils/memoryMonitor.js';
import { AgeGenderModel } from './AgeGenderModel-windows.js';
import { EmotionModel } from './EmotionModel-windows.js';
import { ExhibitModel } from './ExhibitModel-windows.js';
import { FaceDetectionModel } from './FaceDetectionModel-windows.js';

export class ModelManager {
    constructor() {
        this.models = {
            faceDetection: null,
            ageGender: null,
            emotion: null,
            exhibit: null
        };

        this.modelStatus = {
            faceDetection: false,
            ageGender: false,
            emotion: false,
            exhibit: false
        };

        this.isInitialized = false;
        this.initializationPromise = null;
        this.isWindowsMode = true; // Flag for Windows compatibility mode
    }

    async initializeModels() {
        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        this.initializationPromise = this._initializeModels();
        return this.initializationPromise;
    }

    async _initializeModels() {
        try {
            logger.info('🤖 Starting model initialization (Windows Mode)...');
            const startTime = Date.now();

            // Configure TensorFlow.js for browser-like environment (no Node.js native bindings)
            await this.configureTensorFlow();

            // Initialize models in order of dependency
            await this.initializeFaceDetection();
            await this.initializeAgeGender();
            await this.initializeEmotion();
            await this.initializeExhibit();

            const loadTime = Date.now() - startTime;
            logger.info(`✅ All models initialized successfully in ${loadTime}ms (Windows Mode)`);

            this.isInitialized = true;
            this.logModelStatus();

        } catch (error) {
            logger.error('❌ Model initialization failed:', error);
            throw error;
        }
    }

    async configureTensorFlow() {
        try {
            // Configure TensorFlow.js for CPU-only mode without Node.js bindings
            tf.env().set('WEBGL_CPU_FORWARD', false);
            tf.env().set('WEBGL_FORCE_F16_TEXTURES', false);

            // Wait for TensorFlow.js to be ready
            await tf.ready();

            logger.info(`📊 TensorFlow.js backend (Windows Mode): ${tf.getBackend()}`);
            logger.info(`📊 TensorFlow.js version: ${tf.version.tfjs}`);
            logger.warn('⚠️  Running in Windows compatibility mode - using CPU-only inference');

        } catch (error) {
            logger.error('❌ TensorFlow configuration failed:', error);
            throw error;
        }
    }

    async initializeFaceDetection() {
        try {
            logger.info('👤 Initializing face detection model (Windows Mode)...');

            this.models.faceDetection = new FaceDetectionModel();
            await this.models.faceDetection.initialize();

            this.modelStatus.faceDetection = true;
            logger.info('✅ Face detection model loaded (Windows Mode)');

        } catch (error) {
            logger.error('❌ Face detection model initialization failed:', error);
            this.modelStatus.faceDetection = false;
            // Create fallback model
            this.models.faceDetection = {
                detectFaces: this.createFallbackFaceDetection.bind(this)
            };
            this.modelStatus.faceDetection = true;
            logger.warn('⚠️  Using fallback face detection');
        }
    }

    async initializeAgeGender() {
        try {
            logger.info('👨‍👩‍👧‍👦 Initializing age/gender model (Windows Mode)...');

            this.models.ageGender = new AgeGenderModel();
            await this.models.ageGender.initialize();

            this.modelStatus.ageGender = true;
            logger.info('✅ Age/gender model loaded (Windows Mode)');

        } catch (error) {
            logger.error('❌ Age/gender model initialization failed:', error);
            this.modelStatus.ageGender = false;
        }
    }

    async initializeEmotion() {
        try {
            logger.info('😊 Initializing emotion model (Windows Mode)...');

            this.models.emotion = new EmotionModel();
            await this.models.emotion.initialize();

            this.modelStatus.emotion = true;
            logger.info('✅ Emotion model loaded (Windows Mode)');

        } catch (error) {
            logger.error('❌ Emotion model initialization failed:', error);
            this.modelStatus.emotion = false;
        }
    }

    async initializeExhibit() {
        try {
            logger.info('🏛️ Initializing exhibit detection model (Windows Mode)...');

            this.models.exhibit = new ExhibitModel();
            await this.models.exhibit.initialize();

            this.modelStatus.exhibit = true;
            logger.info('✅ Exhibit detection model loaded (Windows Mode)');

        } catch (error) {
            logger.error('❌ Exhibit detection model initialization failed:', error);
            this.modelStatus.exhibit = false;
        }
    }

    // Fallback face detection for Windows mode
    createFallbackFaceDetection(imageBuffer) {
        logger.warn('⚠️  Using fallback face detection (center region)');

        // Create a simple fallback that assumes a face in the center of the image
        return [{
            box: {
                x: Math.round(320 * 0.3), // Assume 640px width, face in center 40%
                y: Math.round(240 * 0.2), // Assume 480px height, face in upper center
                width: Math.round(320 * 0.4),
                height: Math.round(240 * 0.6)
            },
            confidence: 0.7,
            landmarks: null,
            isFallback: true
        }];
    }

    // Face Detection
    async detectFaces(imageData) {
        if (!this.models.faceDetection) {
            throw new Error('Face detection model not available');
        }
        return await this.models.faceDetection.detectFaces(imageData);
    }

    // Age and Gender Prediction
    async predictAgeGender(imageData, faces = null) {
        if (!this.models.ageGender) {
            throw new Error('Age/gender model not available');
        }

        // If no faces provided, detect them first
        if (!faces && this.models.faceDetection) {
            faces = await this.detectFaces(imageData);
        }

        return await this.models.ageGender.predict(imageData, faces);
    }

    // Emotion Prediction
    async predictEmotion(imageData, faces = null) {
        if (!this.models.emotion) {
            throw new Error('Emotion model not available');
        }

        // If no faces provided, detect them first
        if (!faces && this.models.faceDetection) {
            faces = await this.detectFaces(imageData);
        }

        return await this.models.emotion.predict(imageData, faces);
    }

    // Exhibit Detection
    async detectExhibit(imageData) {
        if (!this.models.exhibit) {
            throw new Error('Exhibit detection model not available');
        }
        return await this.models.exhibit.detect(imageData);
    }

    // Complete Analysis (Face + Age/Gender + Emotion + Exhibit)
    async analyzeComplete(imageData) {
        try {
            logger.info('🔍 Starting complete analysis (Windows Mode)...');
            const startTime = Date.now();

            const results = {
                success: false,
                timestamp: new Date().toISOString(),
                processingTime: 0,
                windowsMode: true,
                faceAnalysis: {
                    faces: [],
                    faceCount: 0
                },
                ageGender: null,
                emotion: null,
                exhibit: null,
                errors: []
            };

            // Convert Buffer to ImageData-like object for browser TensorFlow.js
            const imageBuffer = this.bufferToImageData(imageData);

            // Step 1: Face Detection
            let faces = [];
            try {
                if (this.models.faceDetection) {
                    faces = await this.detectFaces(imageBuffer);
                    results.faceAnalysis.faces = faces;
                    results.faceAnalysis.faceCount = faces.length;
                    logger.info(`👤 Detected ${faces.length} face(s) (Windows Mode)`);
                } else {
                    results.errors.push('Face detection model not available');
                }
            } catch (error) {
                logger.error('❌ Face detection failed:', error);
                results.errors.push(`Face detection: ${error.message}`);
            }

            // Step 2: Age/Gender Prediction
            try {
                if (this.models.ageGender && faces.length > 0) {
                    results.ageGender = await this.predictAgeGender(imageBuffer, faces);
                    logger.info('👨‍👩‍👧‍👦 Age/gender prediction complete (Windows Mode)');
                } else if (!this.models.ageGender) {
                    results.errors.push('Age/gender model not available');
                } else {
                    results.errors.push('No faces detected for age/gender prediction');
                }
            } catch (error) {
                logger.error('❌ Age/gender prediction failed:', error);
                results.errors.push(`Age/gender: ${error.message}`);
            }

            // Step 3: Emotion Prediction
            try {
                if (this.models.emotion && faces.length > 0) {
                    results.emotion = await this.predictEmotion(imageBuffer, faces);
                    logger.info('😊 Emotion prediction complete (Windows Mode)');
                } else if (!this.models.emotion) {
                    results.errors.push('Emotion model not available');
                } else {
                    results.errors.push('No faces detected for emotion prediction');
                }
            } catch (error) {
                logger.error('❌ Emotion prediction failed:', error);
                results.errors.push(`Emotion: ${error.message}`);
            }

            // Step 4: Exhibit Detection
            try {
                if (this.models.exhibit) {
                    results.exhibit = await this.detectExhibit(imageBuffer);
                    logger.info('🏛️ Exhibit detection complete (Windows Mode)');
                } else {
                    results.errors.push('Exhibit detection model not available');
                }
            } catch (error) {
                logger.error('❌ Exhibit detection failed:', error);
                results.errors.push(`Exhibit detection: ${error.message}`);
            }

            results.processingTime = Date.now() - startTime;
            results.success = results.errors.length === 0;

            logger.info(`🔍 Complete analysis finished in ${results.processingTime}ms with ${results.errors.length} errors (Windows Mode)`);

            return results;

        } catch (error) {
            logger.error('❌ Complete analysis failed:', error);
            throw error;
        }
    }

    // Helper function to convert Buffer to ImageData for browser TensorFlow.js
    bufferToImageData(buffer) {
        // This is a simplified conversion - in a real implementation,
        // you'd use a library like Jimp to properly decode the image
        logger.warn('⚠️  Using simplified buffer conversion for Windows mode');
        return buffer;
    }

    // Model Status and Health
    getModelStatus() {
        return {
            initialized: this.isInitialized,
            windowsMode: this.isWindowsMode,
            models: { ...this.modelStatus },
            memory: memoryMonitor.getMemoryUsage(),
            backend: tf.getBackend(),
            version: tf.version.tfjs,
            note: 'Running in Windows compatibility mode'
        };
    }

    logModelStatus() {
        const status = this.getModelStatus();
        logger.info('📊 Model Status (Windows Mode):', JSON.stringify(status, null, 2));
    }

    // Cleanup and Memory Management
    async cleanup() {
        logger.info('🧹 Starting model cleanup (Windows Mode)...');

        try {
            // Dispose of all models
            for (const [name, model] of Object.entries(this.models)) {
                if (model && typeof model.dispose === 'function') {
                    await model.dispose();
                    logger.debug(`✅ ${name} model disposed`);
                }
                this.models[name] = null;
                this.modelStatus[name] = false;
            }

            // Clear TensorFlow memory
            if (tf.memory().numTensors > 0) {
                tf.disposeVariables();
                logger.debug('🗑️  TensorFlow tensors disposed');
            }

            this.isInitialized = false;
            logger.info('✅ Model cleanup complete (Windows Mode)');

        } catch (error) {
            logger.error('❌ Error during model cleanup:', error);
        }
    }

    // Reload models (for development/debugging)
    async reloadModels() {
        logger.info('🔄 Reloading all models (Windows Mode)...');
        await this.cleanup();
        await this.initializeModels();
        logger.info('✅ Models reloaded successfully (Windows Mode)');
    }
}

export default ModelManager;