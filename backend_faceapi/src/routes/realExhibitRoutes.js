import express from 'express';
import multer from 'multer';
import { RealExhibitModelService } from '../services/realExhibitModelService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Configure multer for image uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    }
});

// Initialize the real model service
let realExhibitService;

// Initialize service on module load
(async () => {
    try {
        realExhibitService = new RealExhibitModelService();
        await realExhibitService.initialize();
        logger.info('✅ Real Exhibit Model Service initialized for API');
    } catch (error) {
        logger.error('❌ Failed to initialize Real Exhibit Model Service:', error);
    }
})();

// Health check endpoint
router.get('/health', (req, res) => {
    if (realExhibitService && realExhibitService.isInitialized) {
        res.json({
            status: 'healthy',
            service: 'Real Exhibit Model API',
            model: 'exhibit_yolo_tiny.pt',
            accuracy: '99.04%'
        });
    } else {
        res.status(503).json({
            status: 'unavailable',
            message: 'Real exhibit model service not initialized'
        });
    }
});

// Main exhibit detection endpoint using REAL model
router.post('/detect-exhibit', upload.single('image'), async (req, res) => {
    try {
        if (!realExhibitService || !realExhibitService.isInitialized) {
            return res.status(503).json({
                success: false,
                error: 'Real exhibit model service not available'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No image file provided'
            });
        }

        logger.info('🎯 Processing exhibit detection with REAL model');
        const startTime = Date.now();

        // Run inference with the REAL model
        const result = await realExhibitService.predict(req.file.buffer);

        const processingTime = Date.now() - startTime;
        logger.info(`🎯 REAL model inference completed in ${processingTime}ms`);

        // Return successful result
        res.json({
            success: true,
            exhibit: result.exhibit,
            predicted_class: result.exhibit === 'dialogue_with_time' ? 'DWT' : 'EAP',
            confidence: result.confidence,
            class_idx: result.classId,
            allDetections: result.allDetections,
            metadata: {
                ...result.metadata,
                processingTime,
                apiVersion: '1.0.0',
                realModel: true
            }
        });

    } catch (error) {
        logger.error('❌ Real exhibit detection API error:', error);

        res.status(500).json({
            success: false,
            error: error.message,
            model: 'REAL_exhibit_yolo_tiny.pt'
        });
    }
});

// Get model information
router.get('/model-info', (req, res) => {
    if (!realExhibitService || !realExhibitService.isInitialized) {
        return res.status(503).json({
            success: false,
            error: 'Service not available'
        });
    }

    res.json({
        success: true,
        model: {
            file: 'exhibit_yolo_tiny.pt',
            type: 'YOLOv5Tiny',
            accuracy: 99.04,
            classes: ['DWT', 'EAP'],
            inputSize: 224,
            framework: 'PyTorch TorchScript',
            status: 'loaded'
        }
    });
});

export default router;