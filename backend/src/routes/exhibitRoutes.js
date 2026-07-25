import express from 'express';
import { logger } from '../utils/logger.js';
import { validateImageInput, validateModelManager } from '../middleware/validation.js';

const router = express.Router();

// Exhibit detection endpoint
router.post('/detect', validateImageInput, validateModelManager, async (req, res, next) => {
    try {
        const { image } = req.body;
        const modelManager = req.app.locals.modelManager;

        logger.info('🏛️ Exhibit detection request received');
        const startTime = Date.now();

        // Decode base64 image
        const imageBuffer = Buffer.from(image.replace(/^data:image\/[a-z]+;base64,/, ''), 'base64');

        // Perform exhibit detection
        const result = await modelManager.detectExhibit(imageBuffer);

        const processingTime = Date.now() - startTime;

        // Format response to match Flask API format for compatibility
        const response = {
            exhibit: result.exhibit || 'unknown',
            confidence: result.confidence || 0.0,
            processing_time: processingTime,
            metadata: result.metadata || {}
        };

        // Include additional details if available
        if (result.allDetections && result.allDetections.length > 0) {
            response.all_detections = result.allDetections;
        }

        if (result.box) {
            response.box = result.box;
        }

        logger.info(`🏛️ Exhibit detection complete: ${result.exhibit} (confidence: ${result.confidence?.toFixed(3)}) in ${processingTime}ms`);

        res.json(response);

    } catch (error) {
        logger.error('❌ Exhibit detection endpoint failed:', error);
        next(error);
    }
});

// Exhibit detection with detailed response
router.post('/detect/detailed', validateImageInput, validateModelManager, async (req, res, next) => {
    try {
        const { image } = req.body;
        const modelManager = req.app.locals.modelManager;

        logger.info('🏛️ Detailed exhibit detection request received');
        const startTime = Date.now();

        // Decode base64 image
        const imageBuffer = Buffer.from(image.replace(/^data:image\/[a-z]+;base64,/, ''), 'base64');

        // Perform exhibit detection
        const result = await modelManager.detectExhibit(imageBuffer);

        const processingTime = Date.now() - startTime;

        // Return full detailed response
        res.json({
            success: true,
            processing_time: processingTime,
            result,
            timestamp: new Date().toISOString()
        });

        logger.info(`🏛️ Detailed exhibit detection complete in ${processingTime}ms`);

    } catch (error) {
        logger.error('❌ Detailed exhibit detection endpoint failed:', error);
        next(error);
    }
});

// Exhibit list endpoint
router.get('/list', (req, res) => {
    try {
        // Return list of available exhibits
        const exhibits = {
            0: 'dialogue_with_time',
            1: 'earth_alive'
        };

        res.json({
            success: true,
            exhibits,
            count: Object.keys(exhibits).length
        });

    } catch (error) {
        logger.error('❌ Exhibit list endpoint failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Exhibit information endpoint
router.get('/info/:exhibit', (req, res) => {
    try {
        const { exhibit } = req.params;

        // Exhibit information (could be expanded with actual exhibit data)
        const exhibitInfo = {
            dialogue_with_time: {
                id: 0,
                name: 'Dialogue with Time',
                description: 'An interactive exhibit exploring the concept of time through various perspectives',
                location: 'Level 1',
                category: 'Physics & Time',
                interactivity: 'High',
                suitable_for: ['Adults', 'Children above 8']
            },
            earth_alive: {
                id: 1,
                name: 'Earth Alive',
                description: 'Discover the living processes that shape our planet',
                location: 'Level 2',
                category: 'Earth Sciences',
                interactivity: 'Medium',
                suitable_for: ['All ages']
            }
        };

        const info = exhibitInfo[exhibit];

        if (!info) {
            return res.status(404).json({
                success: false,
                error: 'Exhibit not found',
                available_exhibits: Object.keys(exhibitInfo)
            });
        }

        res.json({
            success: true,
            exhibit: info
        });

    } catch (error) {
        logger.error('❌ Exhibit info endpoint failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export { router as exhibitRoutes };