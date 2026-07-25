import express from 'express';
import { faceAnalysisRoutes } from './faceAnalysisRoutes.js';
import { exhibitRoutes } from './exhibitRoutes.js';
import { qrRoutes } from './qrRoutes.js';
import { audioRoutes } from './audioRoutes.js';
import { logger } from '../utils/logger.js';

export function setupRoutes(app) {
    logger.info('🔀 Setting up API routes...');

    // API base path
    const apiRouter = express.Router();

    // Mount route modules
    apiRouter.use('/face-analysis', faceAnalysisRoutes);
    apiRouter.use('/exhibit', exhibitRoutes);
    apiRouter.use('/qr', qrRoutes);
    apiRouter.use('/audio', audioRoutes);

    // Complete analysis endpoint (combines multiple analyses)
    apiRouter.post('/analyze/complete', async (req, res, next) => {
        try {
            const { image } = req.body;

            if (!image) {
                return res.status(400).json({
                    success: false,
                    error: 'No image data provided'
                });
            }

            logger.info('🔍 Starting complete analysis request...');
            const startTime = Date.now();

            // Get model manager
            const modelManager = req.app.locals.modelManager;
            if (!modelManager) {
                return res.status(500).json({
                    success: false,
                    error: 'Model manager not available'
                });
            }

            // Decode base64 image
            const imageBuffer = Buffer.from(image.replace(/^data:image\/[a-z]+;base64,/, ''), 'base64');

            // Perform complete analysis
            const results = await modelManager.analyzeComplete(imageBuffer);

            const processingTime = Date.now() - startTime;
            logger.info(`🔍 Complete analysis completed in ${processingTime}ms`);

            res.json({
                success: true,
                processingTime,
                ...results
            });

        } catch (error) {
            logger.error('❌ Complete analysis failed:', error);
            next(error);
        }
    });

    // Model status endpoint
    apiRouter.get('/status', (req, res) => {
        try {
            const modelManager = req.app.locals.modelManager;
            if (!modelManager) {
                return res.status(500).json({
                    success: false,
                    error: 'Model manager not available'
                });
            }

            const status = modelManager.getModelStatus();
            res.json({
                success: true,
                ...status
            });

        } catch (error) {
            logger.error('❌ Status check failed:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Model reload endpoint (development only)
    if (process.env.NODE_ENV === 'development') {
        apiRouter.post('/reload-models', async (req, res) => {
            try {
                logger.info('🔄 Reloading models (development mode)...');

                const modelManager = req.app.locals.modelManager;
                if (!modelManager) {
                    return res.status(500).json({
                        success: false,
                        error: 'Model manager not available'
                    });
                }

                await modelManager.reloadModels();

                res.json({
                    success: true,
                    message: 'Models reloaded successfully',
                    status: modelManager.getModelStatus()
                });

            } catch (error) {
                logger.error('❌ Model reload failed:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });
    }

    // Mount API router
    app.use('/api/v1', apiRouter);

    // Legacy routes for backward compatibility with Python Flask implementation
    const legacyRouter = express.Router();

    // Legacy face analysis endpoint
    legacyRouter.post('/predict/face_analysis', async (req, res, next) => {
        logger.info('📍 Legacy face analysis endpoint called, redirecting...');
        req.url = '/api/v1/face-analysis';
        apiRouter(req, res, next);
    });

    // Legacy exhibit detection endpoint
    legacyRouter.post('/detect_exhibit', async (req, res, next) => {
        logger.info('📍 Legacy exhibit detection endpoint called, redirecting...');
        req.url = '/api/v1/exhibit/detect';
        apiRouter(req, res, next);
    });

    // Legacy complete analysis endpoint
    legacyRouter.post('/analyze/complete', async (req, res, next) => {
        logger.info('📍 Legacy complete analysis endpoint called, redirecting...');
        req.url = '/api/v1/analyze/complete';
        apiRouter(req, res, next);
    });

    // Mount legacy routes
    app.use('/', legacyRouter);

    // API documentation route
    app.get('/docs', (req, res) => {
        res.json({
            title: 'SSC Person Detection API',
            version: '1.0.0',
            description: 'Singapore Science Centre Person Detection & Emotion Recognition Backend',
            endpoints: {
                health: {
                    method: 'GET',
                    path: '/health',
                    description: 'Health check endpoint'
                },
                status: {
                    method: 'GET',
                    path: '/api/v1/status',
                    description: 'Model status and configuration'
                },
                faceAnalysis: {
                    method: 'POST',
                    path: '/api/v1/face-analysis',
                    description: 'Analyze faces for age/gender and emotion',
                    body: { image: 'base64 encoded image' }
                },
                exhibitDetection: {
                    method: 'POST',
                    path: '/api/v1/exhibit/detect',
                    description: 'Detect exhibits in image',
                    body: { image: 'base64 encoded image' }
                },
                completeAnalysis: {
                    method: 'POST',
                    path: '/api/v1/analyze/complete',
                    description: 'Complete analysis (face + exhibit detection)',
                    body: { image: 'base64 encoded image' }
                },
                qrGeneration: {
                    method: 'POST',
                    path: '/api/v1/qr/generate',
                    description: 'Generate QR code',
                    body: { data: 'text to encode', options: {} }
                },
                audioTranscription: {
                    method: 'POST',
                    path: '/api/v1/audio/transcribe',
                    description: 'Transcribe audio file',
                    body: 'multipart/form-data with audio file'
                }
            },
            legacyEndpoints: {
                faceAnalysis: '/predict/face_analysis',
                exhibitDetection: '/detect_exhibit',
                completeAnalysis: '/analyze/complete'
            }
        });
    });

    logger.info('✅ API routes setup complete');
}