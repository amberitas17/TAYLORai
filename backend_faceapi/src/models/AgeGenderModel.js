import * as tf from '@tensorflow/tfjs-node';
import { logger } from '../utils/logger.js';
import { join } from 'path';
import { existsSync } from 'fs';

export class AgeGenderModel {
    constructor() {
        this.model = null;
        this.modelPath = process.env.AGE_GENDER_MODEL_PATH || './models/age_gender_model';
        this.isInitialized = false;

        // Model configuration
        this.config = {
            inputSize: 224,
            ageGroups: ['Child', 'Adult'],
            genderLabels: ['Male', 'Female'],
            maxAge: 100,
            minAge: 1
        };
    }

    async initialize() {
        try {
            logger.info('👨‍👩‍👧‍👦 Loading age/gender model...');

            const localModelPath = join(this.modelPath, 'model.json');

            if (existsSync(localModelPath)) {
                // Load local TensorFlow.js model converted from Keras
                this.model = await tf.loadLayersModel(`file://${localModelPath}`);
                logger.info('✅ Local age/gender model loaded');
            } else {
                // Create a fallback model for development
                logger.warn('⚠️  Age/gender model not found, creating fallback...');
                this.model = this.createFallbackModel();
            }

            this.isInitialized = true;
            this.logModelInfo();

        } catch (error) {
            logger.error('❌ Age/gender model initialization failed:', error);
            throw error;
        }
    }

    createFallbackModel() {
        logger.warn('⚠️  Creating fallback age/gender model...');

        // Simple fallback that returns random but reasonable predictions
        return {
            predict: (input) => {
                const batchSize = input.shape[0];

                // Generate reasonable age predictions (20-40 range)
                const agePredictions = Array.from({ length: batchSize }, () =>
                    Math.random() * 20 + 20 // 20-40 years old
                );

                // Generate gender predictions (slightly random but tend toward 50/50)
                const genderPredictions = Array.from({ length: batchSize }, () => [
                    Math.random() * 0.4 + 0.3, // Male probability (0.3-0.7)
                    Math.random() * 0.4 + 0.3  // Female probability (0.3-0.7)
                ]);

                // Return as tensors matching expected format
                return [
                    tf.tensor2d(agePredictions.map(age => [age]), [batchSize, 1]),
                    tf.tensor2d(genderPredictions, [batchSize, 2])
                ];
            },
            isFallback: true
        };
    }

    async predict(imageData, faces = null) {
        try {
            if (!this.isInitialized) {
                throw new Error('Age/gender model not initialized');
            }

            if (!faces || faces.length === 0) {
                throw new Error('No faces provided for age/gender prediction');
            }

            logger.debug('👨‍👩‍👧‍👦 Predicting age and gender...');
            const startTime = Date.now();

            // Use the largest/most confident face for prediction
            const targetFace = this.selectBestFace(faces);

            // Extract and preprocess face region
            const faceInput = await this.preprocessFace(imageData, targetFace);

            // Run inference
            const predictions = await this.model.predict(faceInput);

            // Post-process predictions
            const result = await this.postprocessPredictions(predictions, targetFace);

            // Cleanup tensors
            faceInput.dispose();
            if (Array.isArray(predictions)) {
                predictions.forEach(tensor => tensor.dispose());
            } else {
                predictions.dispose();
            }

            const processingTime = Date.now() - startTime;
            logger.debug(`👨‍👩‍👧‍👦 Age/gender prediction complete in ${processingTime}ms`);

            return result;

        } catch (error) {
            logger.error('❌ Age/gender prediction failed:', error);
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
                imageTensor = tf.node.decodeImage(imageData, 3);
            } else {
                throw new Error('Unsupported image data format');
            }

            // Extract face region
            const { x, y, width, height } = face.box;
            const imageHeight = imageTensor.shape[0];
            const imageWidth = imageTensor.shape[1];

            // Normalize coordinates
            const x1 = Math.max(0, x) / imageWidth;
            const y1 = Math.max(0, y) / imageHeight;
            const x2 = Math.min(imageWidth, x + width) / imageWidth;
            const y2 = Math.min(imageHeight, y + height) / imageHeight;

            // Crop face region
            const cropped = tf.image.cropAndResize(
                imageTensor.expandDims(0), // Add batch dimension
                [[y1, x1, y2, x2]], // boxes
                [0], // box_indices
                [this.config.inputSize, this.config.inputSize] // crop_size
            );

            // Normalize to [0, 1] range
            const normalized = cropped.div(255.0);

            // Cleanup intermediate tensors
            if (!tf.isTensor(imageData)) {
                imageTensor.dispose();
            }
            cropped.dispose();

            return normalized;

        } catch (error) {
            logger.error('❌ Face preprocessing failed:', error);
            throw error;
        }
    }

    async postprocessPredictions(predictions, face) {
        try {
            let agePred, genderPred;

            if (Array.isArray(predictions) && predictions.length >= 2) {
                [agePred, genderPred] = predictions;
            } else if (Array.isArray(predictions) && predictions.length === 1) {
                // Single output containing both age and gender
                const combined = predictions[0];
                const combinedData = await combined.data();

                // Assuming format: [age, gender_male_prob, gender_female_prob]
                const estimatedAge = combinedData[0];
                const genderProbs = [combinedData[1], combinedData[2]];

                return this.formatResult(estimatedAge, genderProbs, face);
            } else {
                // Fallback model format
                [agePred, genderPred] = predictions;
            }

            // Extract data from tensors
            const ageData = await agePred.data();
            const genderData = await genderPred.data();

            // Get age prediction
            const estimatedAge = Math.max(this.config.minAge,
                Math.min(this.config.maxAge, Math.round(ageData[0])));

            // Get gender prediction
            const genderProbs = Array.from(genderData);

            return this.formatResult(estimatedAge, genderProbs, face);

        } catch (error) {
            logger.error('❌ Prediction post-processing failed:', error);
            // Return fallback result
            return this.createFallbackResult(face);
        }
    }

    formatResult(estimatedAge, genderProbs, face) {
        // Determine age group
        let ageGroup = 'Adult';
        if (estimatedAge <= 18) {
            ageGroup = 'Child';
        }

        // Determine gender
        const genderIdx = genderProbs.indexOf(Math.max(...genderProbs));
        const gender = this.config.genderLabels[genderIdx] || 'Unknown';
        const genderConfidence = Math.max(...genderProbs);

        // Calculate age confidence (simplified)
        const ageConfidence = Math.min(1.0, Math.max(0.1, genderConfidence));

        return {
            age: {
                estimated: estimatedAge,
                group: ageGroup,
                confidence: ageConfidence
            },
            gender: {
                label: gender,
                confidence: genderConfidence,
                probabilities: {
                    Male: genderProbs[0] || 0,
                    Female: genderProbs[1] || 0
                }
            },
            face: {
                box: face.box,
                confidence: face.confidence
            },
            metadata: {
                model: this.model.isFallback ? 'fallback' : 'trained',
                processingTime: Date.now()
            }
        };
    }

    createFallbackResult(face) {
        const estimatedAge = Math.floor(Math.random() * 30) + 20; // 20-50
        const ageGroup = estimatedAge <= 18 ? 'Child' : 'Adult';
        const gender = Math.random() > 0.5 ? 'Female' : 'Male';

        return {
            age: {
                estimated: estimatedAge,
                group: ageGroup,
                confidence: 0.5
            },
            gender: {
                label: gender,
                confidence: 0.5,
                probabilities: {
                    Male: gender === 'Male' ? 0.6 : 0.4,
                    Female: gender === 'Female' ? 0.6 : 0.4
                }
            },
            face: {
                box: face.box,
                confidence: face.confidence
            },
            metadata: {
                model: 'fallback',
                processingTime: Date.now()
            }
        };
    }

    logModelInfo() {
        if (this.model) {
            const info = {
                initialized: this.isInitialized,
                isFallback: this.model.isFallback || false,
                config: this.config
            };

            if (!this.model.isFallback) {
                try {
                    info.inputShape = this.model.inputs[0].shape;
                    info.outputShape = this.model.outputs.map(output => output.shape);
                } catch (error) {
                    logger.debug('Could not get model shape info:', error.message);
                }
            }

            logger.info('👨‍👩‍👧‍👦 Age/Gender Model Info:', JSON.stringify(info, null, 2));
        }
    }

    async dispose() {
        if (this.model && typeof this.model.dispose === 'function') {
            this.model.dispose();
        }
        this.model = null;
        this.isInitialized = false;
        logger.info('👨‍👩‍👧‍👦 Age/gender model disposed');
    }
}

export default AgeGenderModel;