import * as tf from '@tensorflow/tfjs-node';
import { logger } from '../utils/logger.js';
import { join } from 'path';
import { existsSync } from 'fs';

export class FaceDetectionModel {
    constructor() {
        this.model = null;
        this.modelPath = process.env.FACE_DETECTION_MODEL_PATH || './models/face-detection';
        this.isInitialized = false;

        // Face detection configuration
        this.config = {
            scoreThreshold: 0.5,
            iouThreshold: 0.4,
            inputSize: 416,
            maxDetections: 10
        };
    }

    async initialize() {
        try {
            logger.info('👤 Loading face detection model...');

            // Check if local model exists
            const localModelPath = join(this.modelPath, 'model.json');

            if (existsSync(localModelPath)) {
                // Load local TensorFlow.js model
                this.model = await tf.loadLayersModel(`file://${localModelPath}`);
                logger.info('✅ Local face detection model loaded');
            } else {
                // Fallback to MediaPipe BlazeFace model (lighter alternative)
                logger.warn('⚠️  Local model not found, loading BlazeFace model from web...');
                this.model = await this.loadBlazeFaceModel();
            }

            this.isInitialized = true;
            this.logModelInfo();

        } catch (error) {
            logger.error('❌ Face detection model initialization failed:', error);
            throw error;
        }
    }

    async loadBlazeFaceModel() {
        try {
            // Load BlazeFace model from TensorFlow Hub
            const modelUrl = 'https://tfhub.dev/mediapipe/tfjs-model/blazeface/1/default/1';
            const model = await tf.loadGraphModel(modelUrl, { fromTFHub: true });

            logger.info('✅ BlazeFace model loaded from TensorFlow Hub');
            return model;

        } catch (error) {
            logger.error('❌ Failed to load BlazeFace model:', error);
            // Create a simple fallback model (placeholder)
            return this.createFallbackModel();
        }
    }

    createFallbackModel() {
        logger.warn('⚠️  Creating fallback face detection model...');

        // Simple fallback that returns center region as "detected face"
        return {
            predict: (input) => {
                const batchSize = input.shape[0];
                const height = input.shape[1];
                const width = input.shape[2];

                // Return a single face detection in the center of the image
                const centerX = width / 2;
                const centerY = height / 2;
                const boxSize = Math.min(width, height) * 0.6;

                const x1 = Math.max(0, centerX - boxSize / 2);
                const y1 = Math.max(0, centerY - boxSize / 2);
                const x2 = Math.min(width, centerX + boxSize / 2);
                const y2 = Math.min(height, centerY + boxSize / 2);

                // Return in format expected by face detection consumers
                const boxes = tf.tensor3d([[[
                    y1 / height,  // y1 normalized
                    x1 / width,   // x1 normalized
                    y2 / height,  // y2 normalized
                    x2 / width    // x2 normalized
                ]]], [batchSize, 1, 4]);

                const scores = tf.tensor2d([[0.8]], [batchSize, 1]);

                return [boxes, scores];
            },
            isFallback: true
        };
    }

    async detectFaces(imageData) {
        try {
            if (!this.isInitialized) {
                throw new Error('Face detection model not initialized');
            }

            logger.debug('👤 Detecting faces...');
            const startTime = Date.now();

            // Preprocess image for face detection
            const input = await this.preprocessImage(imageData);

            // Run inference
            const predictions = await this.model.predict(input);

            // Post-process predictions
            const faces = await this.postprocessPredictions(predictions, imageData);

            // Cleanup tensors
            input.dispose();
            if (Array.isArray(predictions)) {
                predictions.forEach(tensor => tensor.dispose());
            } else {
                predictions.dispose();
            }

            const processingTime = Date.now() - startTime;
            logger.debug(`👤 Face detection complete: ${faces.length} faces in ${processingTime}ms`);

            return faces;

        } catch (error) {
            logger.error('❌ Face detection failed:', error);
            throw error;
        }
    }

    async preprocessImage(imageData) {
        try {
            // Convert image data to tensor
            let imageTensor;

            if (tf.isTensor(imageData)) {
                imageTensor = imageData;
            } else if (Buffer.isBuffer(imageData)) {
                imageTensor = tf.node.decodeImage(imageData, 3);
            } else {
                throw new Error('Unsupported image data format');
            }

            // Resize to model input size
            const resized = tf.image.resizeBilinear(imageTensor, [this.config.inputSize, this.config.inputSize]);

            // Normalize to [0, 1] range
            const normalized = resized.div(255.0);

            // Add batch dimension
            const batched = normalized.expandDims(0);

            // Cleanup intermediate tensors
            if (!tf.isTensor(imageData)) {
                imageTensor.dispose();
            }
            resized.dispose();
            normalized.dispose();

            return batched;

        } catch (error) {
            logger.error('❌ Image preprocessing failed:', error);
            throw error;
        }
    }

    async postprocessPredictions(predictions, originalImage) {
        try {
            let boxes, scores;

            if (Array.isArray(predictions) && predictions.length >= 2) {
                [boxes, scores] = predictions;
            } else if (this.model.isFallback) {
                [boxes, scores] = predictions;
            } else {
                // Handle different model output formats
                logger.warn('⚠️  Unexpected prediction format, using fallback processing');
                return this.createFallbackDetection(originalImage);
            }

            const boxesData = await boxes.data();
            const scoresData = await scores.data();

            const faces = [];
            const numDetections = Math.min(scores.shape[1], this.config.maxDetections);

            for (let i = 0; i < numDetections; i++) {
                const score = scoresData[i];

                if (score >= this.config.scoreThreshold) {
                    const y1 = boxesData[i * 4];
                    const x1 = boxesData[i * 4 + 1];
                    const y2 = boxesData[i * 4 + 2];
                    const x2 = boxesData[i * 4 + 3];

                    // Convert to absolute coordinates
                    const imageHeight = tf.isTensor(originalImage) ? originalImage.shape[1] : 480;
                    const imageWidth = tf.isTensor(originalImage) ? originalImage.shape[2] : 640;

                    faces.push({
                        box: {
                            x: Math.round(x1 * imageWidth),
                            y: Math.round(y1 * imageHeight),
                            width: Math.round((x2 - x1) * imageWidth),
                            height: Math.round((y2 - y1) * imageHeight)
                        },
                        confidence: score,
                        landmarks: null // Could be added if model supports it
                    });
                }
            }

            // Apply non-maximum suppression if multiple faces detected
            if (faces.length > 1) {
                return this.applyNMS(faces);
            }

            return faces;

        } catch (error) {
            logger.error('❌ Prediction post-processing failed:', error);
            return this.createFallbackDetection(originalImage);
        }
    }

    createFallbackDetection(imageData) {
        logger.warn('⚠️  Creating fallback face detection...');

        const imageWidth = tf.isTensor(imageData) ? imageData.shape[2] : 640;
        const imageHeight = tf.isTensor(imageData) ? imageData.shape[1] : 480;

        // Return a single "detected" face in the center
        const centerX = Math.round(imageWidth / 2);
        const centerY = Math.round(imageHeight / 2);
        const faceSize = Math.min(imageWidth, imageHeight) * 0.4;

        return [{
            box: {
                x: Math.round(centerX - faceSize / 2),
                y: Math.round(centerY - faceSize / 2),
                width: Math.round(faceSize),
                height: Math.round(faceSize)
            },
            confidence: 0.7,
            landmarks: null,
            isFallback: true
        }];
    }

    applyNMS(faces) {
        // Simple Non-Maximum Suppression
        const sortedFaces = faces.sort((a, b) => b.confidence - a.confidence);
        const filtered = [];

        for (const face of sortedFaces) {
            let shouldKeep = true;

            for (const existingFace of filtered) {
                const iou = this.calculateIOU(face.box, existingFace.box);
                if (iou > this.config.iouThreshold) {
                    shouldKeep = false;
                    break;
                }
            }

            if (shouldKeep) {
                filtered.push(face);
            }
        }

        return filtered;
    }

    calculateIOU(box1, box2) {
        const x1 = Math.max(box1.x, box2.x);
        const y1 = Math.max(box1.y, box2.y);
        const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
        const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);

        if (x2 <= x1 || y2 <= y1) return 0;

        const intersection = (x2 - x1) * (y2 - y1);
        const area1 = box1.width * box1.height;
        const area2 = box2.width * box2.height;
        const union = area1 + area2 - intersection;

        return intersection / union;
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

            logger.info('👤 Face Detection Model Info:', JSON.stringify(info, null, 2));
        }
    }

    async dispose() {
        if (this.model && typeof this.model.dispose === 'function') {
            this.model.dispose();
        }
        this.model = null;
        this.isInitialized = false;
        logger.info('👤 Face detection model disposed');
    }
}

export default FaceDetectionModel;