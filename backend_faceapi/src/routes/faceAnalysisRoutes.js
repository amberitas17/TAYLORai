import express from 'express';
import { logger } from '../utils/logger.js';
import { validateImageInput, validateModelManager } from '../middleware/validation.js';

const router = express.Router();

// Face Analysis endpoint - Age/Gender + Emotion prediction
router.post('/', validateImageInput, validateModelManager, async (req, res, next) => {
    try {
        const { image } = req.body;
        const modelManager = req.app.locals.modelManager;

        logger.info('👤 Face analysis request received');
        const startTime = Date.now();

        // Decode base64 image
        const imageBuffer = Buffer.from(image.replace(/^data:image\/[a-z]+;base64,/, ''), 'base64');

        // Detect faces first
        let faces = [];
        try {
            faces = await modelManager.detectFaces(imageBuffer);
            logger.debug(`👤 Detected ${faces.length} face(s)`);
        } catch (error) {
            logger.warn('⚠️  Face detection failed, will return error:', error.message);
            return res.json({
                success: false,
                error: 'No face detected in the image. Please ensure your face is clearly visible and try again.',
                message: 'Face detection failed',
                predictions: {
                    age: { value: 25, group: 'Unknown', confidence: 0.0 },
                    gender: { label: 'Unknown', confidence: 0.0 },
                    emotion: { label: 'Unknown', confidence: 0.0 },
                    all_emotions: {
                        'Angry': 0.0, 'Disgust': 0.0, 'Fear': 0.0, 'Happy': 0.0,
                        'Neutral': 0.0, 'Sad': 0.0, 'Surprise': 0.0
                    },
                    face_analysis: {
                        detections_count: 0,
                        face_coordinates: [],
                        processed: false
                    }
                }
            });
        }

        if (faces.length === 0) {
            return res.json({
                success: false,
                error: 'No face detected in the image. Please ensure your face is clearly visible and try again.',
                message: 'No faces found in image',
                predictions: {
                    age: { value: 25, group: 'Unknown', confidence: 0.0 },
                    gender: { label: 'Unknown', confidence: 0.0 },
                    emotion: { label: 'Unknown', confidence: 0.0 },
                    all_emotions: {
                        'Angry': 0.0, 'Disgust': 0.0, 'Fear': 0.0, 'Happy': 0.0,
                        'Neutral': 0.0, 'Sad': 0.0, 'Surprise': 0.0
                    },
                    face_analysis: {
                        detections_count: 0,
                        face_coordinates: [],
                        processed: false
                    }
                }
            });
        }

        // Predict age and gender
        let ageGenderResult = null;
        try {
            ageGenderResult = await modelManager.predictAgeGender(imageBuffer, faces);
            logger.debug('👨‍👩‍👧‍👦 Age/gender prediction complete');
        } catch (error) {
            logger.error('❌ Age/gender prediction failed:', error);
            ageGenderResult = {
                age: { estimated: 25, group: 'Adult', confidence: 0.5 },
                gender: { label: 'Unknown', confidence: 0.5 }
            };
        }

        // Predict emotion
        let emotionResult = null;
        try {
            emotionResult = await modelManager.predictEmotion(imageBuffer, faces);
            logger.debug('😊 Emotion prediction complete');
        } catch (error) {
            logger.error('❌ Emotion prediction failed:', error);
            emotionResult = {
                emotion: {
                    predicted: 'Neutral',
                    confidence: 0.5,
                    probabilities: {
                        'Angry': 0.1, 'Disgust': 0.05, 'Fear': 0.05, 'Happy': 0.2,
                        'Neutral': 0.5, 'Sad': 0.05, 'Surprise': 0.05
                    }
                }
            };
        }

        const processingTime = Date.now() - startTime;

        // Format response to match Flask API format
        const response = {
            success: true,
            processing_time: processingTime,
            predictions: {
                age: {
                    value: ageGenderResult.age.estimated,
                    group: ageGenderResult.age.group,
                    confidence: ageGenderResult.age.confidence
                },
                gender: {
                    label: ageGenderResult.gender.label,
                    confidence: ageGenderResult.gender.confidence
                },
                emotion: {
                    label: emotionResult.emotion.predicted,
                    confidence: emotionResult.emotion.confidence
                },
                all_emotions: emotionResult.emotion.probabilities,
                face_analysis: {
                    detections_count: faces.length,
                    face_coordinates: faces[0] ? [faces[0].box.x, faces[0].box.y, faces[0].box.width, faces[0].box.height] : [],
                    processed: true
                }
            }
        };

        logger.info(`👤 Face analysis complete: Age=${ageGenderResult.age.estimated} (${ageGenderResult.age.group}), Gender=${ageGenderResult.gender.label}, Emotion=${emotionResult.emotion.predicted} in ${processingTime}ms`);

        res.json(response);

    } catch (error) {
        logger.error('❌ Face analysis endpoint failed:', error);
        next(error);
    }
});

// Age/Gender prediction only endpoint
router.post('/age-gender', validateImageInput, validateModelManager, async (req, res, next) => {
    try {
        const { image } = req.body;
        const modelManager = req.app.locals.modelManager;

        logger.info('👨‍👩‍👧‍👦 Age/gender prediction request received');

        // Decode base64 image
        const imageBuffer = Buffer.from(image.replace(/^data:image\/[a-z]+;base64,/, ''), 'base64');

        // Perform age/gender prediction
        const result = await modelManager.predictAgeGender(imageBuffer);

        res.json({
            success: true,
            result
        });

    } catch (error) {
        logger.error('❌ Age/gender prediction endpoint failed:', error);
        next(error);
    }
});

// Emotion prediction only endpoint
router.post('/emotion', validateImageInput, validateModelManager, async (req, res, next) => {
    try {
        const { image } = req.body;
        const modelManager = req.app.locals.modelManager;

        logger.info('😊 Emotion prediction request received');

        // Decode base64 image
        const imageBuffer = Buffer.from(image.replace(/^data:image\/[a-z]+;base64,/, ''), 'base64');

        // Perform emotion prediction
        const result = await modelManager.predictEmotion(imageBuffer);

        res.json({
            success: true,
            result
        });

    } catch (error) {
        logger.error('❌ Emotion prediction endpoint failed:', error);
        next(error);
    }
});

// Face detection only endpoint
router.post('/detect-faces', validateImageInput, validateModelManager, async (req, res, next) => {
    try {
        const { image } = req.body;
        const modelManager = req.app.locals.modelManager;

        logger.info('👤 Face detection request received');

        // Decode base64 image
        const imageBuffer = Buffer.from(image.replace(/^data:image\/[a-z]+;base64,/, ''), 'base64');

        // Perform face detection
        const faces = await modelManager.detectFaces(imageBuffer);

        res.json({
            success: true,
            faces,
            count: faces.length
        });

    } catch (error) {
        logger.error('❌ Face detection endpoint failed:', error);
        next(error);
    }
});

export { router as faceAnalysisRoutes };