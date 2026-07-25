import * as tf from '@tensorflow/tfjs-node';
import { logger } from '../utils/logger.js';
import { memoryMonitor } from '../utils/memoryMonitor.js';
import { AgeGenderModel } from './AgeGenderModel.js';
import { EmotionModel } from './EmotionModel.js';
import { ExhibitModel } from './ExhibitModel.js';
import { FaceDetectionModel } from './FaceDetectionModel.js';

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
            logger.info('🤖 Starting model initialization...');
            const startTime = Date.now();

            // Set TensorFlow backend configuration
            await this.configureTensorFlow();

            // Initialize models in order of dependency
            await this.initializeFaceDetection();
            await this.initializeAgeGender();
            await this.initializeEmotion();
            await this.initializeExhibit();

            const loadTime = Date.now() - startTime;
            logger.info(`✅ All models initialized successfully in ${loadTime}ms`);

            this.isInitialized = true;
            this.logModelStatus();

        } catch (error) {
            logger.error('❌ Model initialization failed:', error);
            throw error;
        }
    }

    async configureTensorFlow() {
        try {
            // Enhanced TensorFlow.js configuration for optimal performance and accuracy
            tf.env().set('WEBGL_CPU_FORWARD', false);
            tf.env().set('WEBGL_FORCE_F16_TEXTURES', false);

            // Disable automatic backend selection to prevent accuracy loss
            tf.env().set('WEBGL_PACK', true);
            tf.env().set('WEBGL_RENDER_FLOAT32_CAPABLE', true);
            tf.env().set('WEBGL_RENDER_FLOAT32_ENABLED', true);

            // Force consistent float32 precision (prevents quantization artifacts)
            tf.env().set('WEBGL_CONV_IM2COL', true);
            tf.env().set('WEBGL_MAX_TEXTURE_SIZE', 2048);
            tf.env().set('WEBGL_PACK_DEPTHWISECONV', true);

            // Use CPU backend for better stability in server environment
            // But enable WebGL optimizations if available
            await tf.ready();

            logger.info(`📊 TensorFlow.js backend: ${tf.getBackend()}`);
            logger.info(`📊 TensorFlow.js version: ${tf.version.tfjs}`);
            logger.info(`📊 WebGL capabilities: ${JSON.stringify({
                webgl: tf.env().getBool('WEBGL_RENDER_FLOAT32_CAPABLE'),
                pack: tf.env().getBool('WEBGL_PACK'),
                maxTexture: tf.env().getNumber('WEBGL_MAX_TEXTURE_SIZE')
            })}`);

        } catch (error) {
            logger.error('❌ TensorFlow configuration failed:', error);
            throw error;
        }
    }

    async initializeFaceDetection() {
        try {
            logger.info('👤 Initializing face detection model...');

            this.models.faceDetection = new FaceDetectionModel();
            await this.models.faceDetection.initialize();

            this.modelStatus.faceDetection = true;
            logger.info('✅ Face detection model loaded');

        } catch (error) {
            logger.error('❌ Face detection model initialization failed:', error);
            this.modelStatus.faceDetection = false;
            // Don't throw - continue with other models
        }
    }

    async initializeAgeGender() {
        try {
            logger.info('👨‍👩‍👧‍👦 Initializing age/gender model...');

            this.models.ageGender = new AgeGenderModel();
            await this.models.ageGender.initialize();

            this.modelStatus.ageGender = true;
            logger.info('✅ Age/gender model loaded');

        } catch (error) {
            logger.error('❌ Age/gender model initialization failed:', error);
            this.modelStatus.ageGender = false;
        }
    }

    async initializeEmotion() {
        try {
            logger.info('😊 Initializing emotion model...');

            this.models.emotion = new EmotionModel();
            await this.models.emotion.initialize();

            this.modelStatus.emotion = true;
            logger.info('✅ Emotion model loaded');

        } catch (error) {
            logger.error('❌ Emotion model initialization failed:', error);
            this.modelStatus.emotion = false;
        }
    }

    async initializeExhibit() {
        try {
            logger.info('🏛️ Initializing exhibit detection model...');

            this.models.exhibit = new ExhibitModel();
            await this.models.exhibit.initialize();

            this.modelStatus.exhibit = true;
            logger.info('✅ Exhibit detection model loaded');

        } catch (error) {
            logger.error('❌ Exhibit detection model initialization failed:', error);
            this.modelStatus.exhibit = false;
        }
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
            logger.info('🔍 Starting complete analysis...');
            const startTime = performance.now();
            const tensorCountBefore = tf.memory().numTensors;

            const results = {
                success: false,
                timestamp: new Date().toISOString(),
                processingTime: 0,
                faceAnalysis: {
                    faces: [],
                    faceCount: 0
                },
                ageGender: null,
                emotion: null,
                exhibit: null,
                errors: [],
                performance: {
                    totalTime: 0,
                    faceDetectionTime: 0,
                    ageGenderTime: 0,
                    emotionTime: 0,
                    exhibitTime: 0,
                    memoryUsage: {
                        before: tf.memory(),
                        after: null
                    }
                }
            };

            // Step 1: Face Detection (required for other analyses)
            let faces = [];
            try {
                if (this.models.faceDetection) {
                    const faceDetectionStart = performance.now();
                    faces = await this.detectFaces(imageData);
                    results.performance.faceDetectionTime = performance.now() - faceDetectionStart;

                    results.faceAnalysis.faces = faces;
                    results.faceAnalysis.faceCount = faces.length;
                    logger.info(`👤 Detected ${faces.length} face(s) in ${results.performance.faceDetectionTime.toFixed(2)}ms`);
                } else {
                    results.errors.push('Face detection model not available');
                }
            } catch (error) {
                logger.error('❌ Face detection failed:', error);
                results.errors.push(`Face detection: ${error.message}`);
            }

            // Step 2: Age/Gender Prediction (requires faces)
            try {
                if (this.models.ageGender && faces.length > 0) {
                    const ageGenderStart = performance.now();
                    results.ageGender = await this.predictAgeGender(imageData, faces);
                    results.performance.ageGenderTime = performance.now() - ageGenderStart;
                    logger.info(`👨‍👩‍👧‍👦 Age/gender prediction complete in ${results.performance.ageGenderTime.toFixed(2)}ms`);
                } else if (!this.models.ageGender) {
                    results.errors.push('Age/gender model not available');
                } else {
                    results.errors.push('No faces detected for age/gender prediction');
                }
            } catch (error) {
                logger.error('❌ Age/gender prediction failed:', error);
                results.errors.push(`Age/gender: ${error.message}`);
            }

            // Step 3: Emotion Prediction (requires faces)
            try {
                if (this.models.emotion && faces.length > 0) {
                    const emotionStart = performance.now();
                    results.emotion = await this.predictEmotion(imageData, faces);
                    results.performance.emotionTime = performance.now() - emotionStart;
                    logger.info(`😊 Emotion prediction complete in ${results.performance.emotionTime.toFixed(2)}ms`);
                } else if (!this.models.emotion) {
                    results.errors.push('Emotion model not available');
                } else {
                    results.errors.push('No faces detected for emotion prediction');
                }
            } catch (error) {
                logger.error('❌ Emotion prediction failed:', error);
                results.errors.push(`Emotion: ${error.message}`);
            }

            // Step 4: Exhibit Detection (independent)
            try {
                if (this.models.exhibit) {
                    const exhibitStart = performance.now();
                    results.exhibit = await this.detectExhibit(imageData);
                    results.performance.exhibitTime = performance.now() - exhibitStart;
                    logger.info(`🏛️ Exhibit detection complete in ${results.performance.exhibitTime.toFixed(2)}ms`);
                } else {
                    results.errors.push('Exhibit detection model not available');
                }
            } catch (error) {
                logger.error('❌ Exhibit detection failed:', error);
                results.errors.push(`Exhibit detection: ${error.message}`);
            }

            // Final performance metrics
            results.performance.totalTime = performance.now() - startTime;
            results.performance.memoryUsage.after = tf.memory();
            results.processingTime = results.performance.totalTime;
            results.success = results.errors.length === 0;

            // Log detailed performance metrics
            logger.info(`🔍 Complete analysis finished in ${results.performance.totalTime.toFixed(2)}ms with ${results.errors.length} errors`);
            logger.info(`📊 Performance breakdown: Face(${results.performance.faceDetectionTime.toFixed(1)}ms) + Age/Gender(${results.performance.ageGenderTime.toFixed(1)}ms) + Emotion(${results.performance.emotionTime.toFixed(1)}ms) + Exhibit(${results.performance.exhibitTime.toFixed(1)}ms)`);
            logger.info(`🧠 Memory usage: Tensors ${results.performance.memoryUsage.before.numTensors}→${results.performance.memoryUsage.after.numTensors}, Data ${(results.performance.memoryUsage.before.numDataBuffers || 0)}→${(results.performance.memoryUsage.after.numDataBuffers || 0)}`);

            // Trigger cleanup if needed
            memoryMonitor.checkMemoryUsage();

            return results;

        } catch (error) {
            logger.error('❌ Complete analysis failed:', error);
            throw error;
        }
    }

    // Model Status and Health
    getModelStatus() {
        return {
            initialized: this.isInitialized,
            models: { ...this.modelStatus },
            memory: memoryMonitor.getMemoryUsage(),
            backend: tf.getBackend(),
            version: tf.version.tfjs
        };
    }

    logModelStatus() {
        const status = this.getModelStatus();
        logger.info('📊 Model Status:', JSON.stringify(status, null, 2));
    }

    // Cleanup and Memory Management
    async cleanup() {
        logger.info('🧹 Starting model cleanup...');

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
                tf.dispose();
                logger.debug('🗑️  TensorFlow tensors disposed');
            }

            this.isInitialized = false;
            logger.info('✅ Model cleanup complete');

        } catch (error) {
            logger.error('❌ Error during model cleanup:', error);
        }
    }

    // Reload models (for development/debugging)
    async reloadModels() {
        logger.info('🔄 Reloading all models...');
        await this.cleanup();
        await this.initializeModels();
        logger.info('✅ Models reloaded successfully');
    }
}

export default ModelManager;