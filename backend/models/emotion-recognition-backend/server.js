const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const cors = require('cors');
const EmotionModel = require('./emotion_model');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const upload = multer({
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    }
});

// Initialize model
let emotionModel = null;

async function initializeModel() {
    try {
        emotionModel = new EmotionModel();
        const initialized = await emotionModel.initialize();
        if (initialized) {
            console.log('✓ Emotion recognition model loaded successfully');
        } else {
            console.error('✗ Failed to initialize emotion recognition model');
            process.exit(1);
        }
    } catch (error) {
        console.error('✗ Error initializing model:', error);
        process.exit(1);
    }
}

// Routes

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        model_loaded: emotionModel !== null && emotionModel.isInitialized,
        timestamp: new Date().toISOString()
    });
});

// Predict emotion from uploaded image
app.post('/predict', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'No image file provided',
                message: 'Please upload an image file'
            });
        }

        if (!emotionModel || !emotionModel.isInitialized) {
            return res.status(503).json({
                error: 'Model not ready',
                message: 'Emotion recognition model is not initialized'
            });
        }

        // Process image to 48x48 grayscale
        const imageBuffer = await sharp(req.file.buffer)
            .resize(48, 48)
            .grayscale()
            .raw()
            .toBuffer();

        const imageArray = Array.from(imageBuffer);

        // Get prediction
        const prediction = await emotionModel.predict(imageArray);

        res.json({
            success: true,
            prediction: {
                emotion: prediction.emotion,
                confidence: Math.round(prediction.confidence * 10000) / 100, // Round to 2 decimal places
                all_predictions: prediction.allPredictions.map(pred => ({
                    emotion: pred.emotion,
                    probability: Math.round(pred.probability * 10000) / 100
                }))
            },
            metadata: {
                original_size: `${req.file.size} bytes`,
                processed_size: '48x48 grayscale',
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Prediction error:', error);
        res.status(500).json({
            error: 'Prediction failed',
            message: error.message
        });
    }
});

// Predict emotion from base64 image
app.post('/predict-base64', async (req, res) => {
    try {
        const { image_data } = req.body;

        if (!image_data) {
            return res.status(400).json({
                error: 'No image data provided',
                message: 'Please provide image_data as base64 string'
            });
        }

        if (!emotionModel || !emotionModel.isInitialized) {
            return res.status(503).json({
                error: 'Model not ready',
                message: 'Emotion recognition model is not initialized'
            });
        }

        // Remove data:image/...;base64, prefix if present
        const base64Data = image_data.replace(/^data:image\/[a-z]+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // Process image to 48x48 grayscale
        const processedBuffer = await sharp(imageBuffer)
            .resize(48, 48)
            .grayscale()
            .raw()
            .toBuffer();

        const imageArray = Array.from(processedBuffer);

        // Get prediction
        const prediction = await emotionModel.predict(imageArray);

        res.json({
            success: true,
            prediction: {
                emotion: prediction.emotion,
                confidence: Math.round(prediction.confidence * 10000) / 100,
                all_predictions: prediction.allPredictions.map(pred => ({
                    emotion: pred.emotion,
                    probability: Math.round(pred.probability * 10000) / 100
                }))
            },
            metadata: {
                processed_size: '48x48 grayscale',
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Base64 prediction error:', error);
        res.status(500).json({
            error: 'Prediction failed',
            message: error.message
        });
    }
});

// Get model info
app.get('/model-info', (req, res) => {
    res.json({
        model_name: 'Emotion Little VGG',
        classes: ['Angry', 'Happy', 'Neutral', 'Sad', 'Surprise'],
        input_size: '48x48 grayscale',
        architecture: 'CNN with 8 conv layers + 3 dense layers',
        preprocessing: 'Resize to 48x48, grayscale, normalize to [0,1]'
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                error: 'File too large',
                message: 'File size must be less than 10MB'
            });
        }
    }

    console.error('Unhandled error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Not found',
        message: 'The requested endpoint does not exist'
    });
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    if (emotionModel) {
        emotionModel.dispose();
    }
    process.exit(0);
});

// Start server
async function startServer() {
    await initializeModel();

    app.listen(port, () => {
        console.log(`\n🚀 Emotion Recognition API Server running on port ${port}`);
        console.log(`\nAvailable endpoints:`);
        console.log(`  GET  /health          - Health check`);
        console.log(`  GET  /model-info      - Model information`);
        console.log(`  POST /predict         - Upload image file for prediction`);
        console.log(`  POST /predict-base64  - Send base64 image for prediction`);
        console.log(`\nExample usage:`);
        console.log(`  curl -X POST -F "image=@face.jpg" http://localhost:${port}/predict`);
    });
}

startServer().catch(console.error);