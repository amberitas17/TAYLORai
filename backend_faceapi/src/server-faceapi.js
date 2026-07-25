import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { createCanvas, loadImage } from 'canvas';
import * as faceapi from 'face-api.js';

// Set up canvas for face-api.js in Node.js environment
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Canvas, Image, ImageData } = require('canvas');
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

dotenv.config();

const app = express();
const port = process.env.PORT || 3033;

class FaceApiBackendService {
    constructor() {
        this.isLoaded = false;
        this.modelPath = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
        this.emotionLabels = ['angry', 'disgusted', 'fearful', 'happy', 'neutral', 'sad', 'surprised'];
    }

    async initialize() {
        console.log('🚀 Initializing face-api.js models for backend...');

        try {
            // Load all required models from CDN
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(this.modelPath),
                faceapi.nets.faceLandmark68Net.loadFromUri(this.modelPath),
                faceapi.nets.faceRecognitionNet.loadFromUri(this.modelPath),
                faceapi.nets.faceExpressionNet.loadFromUri(this.modelPath),
                faceapi.nets.ageGenderNet.loadFromUri(this.modelPath)
            ]);

            this.isLoaded = true;
            console.log('✅ All face-api.js models loaded successfully in backend!');
            console.log('🏷️ Emotion classes:', this.emotionLabels.join(', '));
            return true;

        } catch (error) {
            console.error('❌ Error loading face-api.js models in backend:', error);
            this.isLoaded = false;
            return false;
        }
    }

    async analyzeBase64Image(base64Image) {
        if (!this.isLoaded) {
            throw new Error('Face-api.js models not loaded yet. Please wait for initialization.');
        }

        console.log('🧠 Starting face-api.js analysis in backend...');
        const startTime = Date.now();

        try {
            // Convert base64 to image
            const base64Data = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
            const imageBuffer = Buffer.from(base64Data, 'base64');
            const img = await loadImage(imageBuffer);

            // Create canvas and draw image
            const canvas = createCanvas(img.width, img.height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            console.log('📷 Image dimensions:', img.width, 'x', img.height);

            // Use sensitive detection options
            const detectionOptions = new faceapi.TinyFaceDetectorOptions({
                inputSize: 416,
                scoreThreshold: 0.3
            });

            // Perform face detection with all features
            const detections = await faceapi
                .detectAllFaces(canvas, detectionOptions)
                .withFaceLandmarks()
                .withFaceExpressions()
                .withAgeAndGender();

            // Retry with more sensitive settings if no faces found
            if (detections.length === 0) {
                console.log('⚠️  No faces detected, retrying with more sensitive settings...');
                const sensitiveOptions = new faceapi.TinyFaceDetectorOptions({
                    inputSize: 320,
                    scoreThreshold: 0.2
                });

                const retryDetections = await faceapi
                    .detectAllFaces(canvas, sensitiveOptions)
                    .withFaceLandmarks()
                    .withFaceExpressions()
                    .withAgeAndGender();

                return this.formatResults(retryDetections, startTime);
            }

            return this.formatResults(detections, startTime);

        } catch (error) {
            console.error('❌ Face-api.js analysis failed in backend:', error);
            throw error;
        }
    }

    formatResults(detections, startTime) {
        const processingTime = Date.now() - startTime;
        console.log(`🔍 Found ${detections.length} face(s) in ${processingTime}ms`);

        if (detections.length === 0) {
            return {
                success: true,
                predictions: {
                    age: {
                        value: 0,
                        group: 'Unknown',
                        confidence: 0
                    },
                    gender: {
                        label: 'Unknown',
                        confidence: 0,
                        Male: 0,
                        Female: 0
                    },
                    emotion: {
                        label: 'Unknown',
                        confidence: 0
                    },
                    all_emotions: {
                        Angry: 0,
                        Disgusted: 0,
                        Fearful: 0,
                        Happy: 0,
                        Neutral: 0,
                        Sad: 0,
                        Surprised: 0
                    },
                    face_analysis: {
                        detections_count: 0,
                        confidence: 0,
                        face_coordinates: null,
                        processed: true,
                        message: 'No faces detected in the image'
                    }
                },
                processingTime,
                source: 'face-api.js-backend'
            };
        }

        // Process the first detected face
        const detection = detections[0];
        const expressions = detection.expressions;
        const { age, gender, genderProbability } = detection;

        // Find dominant emotion
        const dominantEmotion = Object.keys(expressions).reduce((a, b) =>
            expressions[a] > expressions[b] ? a : b
        );

        // Format all emotions with capitalized names
        const allEmotions = {};
        this.emotionLabels.forEach(emotion => {
            allEmotions[this.capitalizeFirst(emotion)] = expressions[emotion] || 0;
        });

        console.log(`✅ Face-api.js analysis complete in ${processingTime}ms`);
        console.log(`👤 Detected: ${Math.round(age)} years old ${gender} (${Math.round(genderProbability * 100)}% confidence)`);
        console.log(`😊 Emotion: ${this.capitalizeFirst(dominantEmotion)} (${Math.round(expressions[dominantEmotion] * 100)}% confidence)`);

        // Determine age group
        const ageValue = Math.round(age);
        let ageGroup = 'Adult';
        if (ageValue < 13) ageGroup = 'Child';
        else if (ageValue < 20) ageGroup = 'Teen';
        else if (ageValue < 65) ageGroup = 'Adult';
        else ageGroup = 'Senior';

        return {
            success: true,
            predictions: {
                age: {
                    value: ageValue,
                    group: ageGroup,
                    confidence: Math.round(genderProbability * 100)
                },
                gender: {
                    label: this.capitalizeFirst(gender),
                    confidence: Math.round(genderProbability * 100),
                    Male: gender === 'male' ? genderProbability : 1 - genderProbability,
                    Female: gender === 'female' ? genderProbability : 1 - genderProbability
                },
                emotion: {
                    label: this.capitalizeFirst(dominantEmotion),
                    confidence: Math.round(expressions[dominantEmotion] * 100)
                },
                all_emotions: allEmotions,
                face_analysis: {
                    detections_count: detections.length,
                    confidence: Math.round(expressions[dominantEmotion] * 100),
                    face_coordinates: {
                        x: detection.detection.box.x,
                        y: detection.detection.box.y,
                        width: detection.detection.box.width,
                        height: detection.detection.box.height
                    },
                    processed: true,
                    box: detection.detection.box,
                    landmarks: detection.landmarks ? detection.landmarks.positions : null
                }
            },
            processingTime,
            source: 'face-api.js-backend'
        };
    }

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    getModelStatus() {
        return {
            initialized: this.isLoaded,
            faceDetection: this.isLoaded,
            ageGender: this.isLoaded,
            emotion: this.isLoaded,
            exhibit: false,
            framework: 'face-api.js',
            backend: 'face-api.js-backend'
        };
    }
}

// Create face-api service instance
const faceApiService = new FaceApiBackendService();

// Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:8081', 'http://localhost:5001'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    credentials: true
}));
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
    const modelStatus = faceApiService.getModelStatus();
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        windowsMode: true,
        realModels: true,
        memory: {
            heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
            external: Math.round(process.memoryUsage().external / 1024 / 1024)
        },
        models: {
            faceDetection: modelStatus.faceDetection,
            ageGender: modelStatus.ageGender,
            emotion: modelStatus.emotion,
            exhibit: modelStatus.exhibit
        },
        aiService: {
            initialized: modelStatus.initialized,
            framework: modelStatus.framework
        },
        message: 'Running with face-api.js backend implementation'
    });
});

// Face analysis endpoint (compatible with existing frontend)
app.post('/api/v1/face-analysis', async (req, res) => {
    try {
        console.log('📡 Received face analysis request');

        if (!faceApiService.isLoaded) {
            return res.status(503).json({
                success: false,
                error: 'Face-api.js models not loaded yet',
                message: 'Please wait for model initialization'
            });
        }

        const { image } = req.body;
        if (!image) {
            return res.status(400).json({
                success: false,
                error: 'No image provided',
                message: 'Please provide a base64 encoded image'
            });
        }

        const result = await faceApiService.analyzeBase64Image(image);
        res.json(result);

    } catch (error) {
        console.error('❌ Face analysis failed:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Face analysis failed'
        });
    }
});

// Status endpoint
app.get('/api/v1/status', (req, res) => {
    const modelStatus = faceApiService.getModelStatus();
    res.json({
        success: true,
        initialized: modelStatus.initialized,
        windowsMode: true,
        realModels: true,
        models: {
            faceDetection: modelStatus.faceDetection,
            ageGender: modelStatus.ageGender,
            emotion: modelStatus.emotion,
            exhibit: modelStatus.exhibit
        },
        memory: {
            heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
            external: Math.round(process.memoryUsage().external / 1024 / 1024)
        },
        backend: modelStatus.backend,
        framework: modelStatus.framework,
        version: '1.0.0-faceapi'
    });
});

// Docs endpoint
app.get('/docs', (req, res) => {
    res.json({
        title: 'Face-API.js Backend Documentation',
        version: '1.0.0',
        description: 'Backend implementation using face-api.js for face detection, emotion recognition, and age/gender prediction',
        endpoints: {
            'GET /health': 'Health check and model status',
            'GET /api/v1/status': 'Detailed service status',
            'POST /api/v1/face-analysis': 'Analyze faces in base64 image'
        },
        framework: 'face-api.js',
        models: [
            'TinyFaceDetector',
            'FaceLandmark68Net',
            'FaceExpressionNet',
            'AgeGenderNet'
        ]
    });
});

// Real exhibit model API routes
import realExhibitRoutes from './routes/realExhibitRoutes.js';
app.use('/api', realExhibitRoutes);

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        message: `The requested endpoint ${req.method} ${req.originalUrl} was not found`,
        availableEndpoints: ['/health', '/api/v1/status', '/api/v1/face-analysis', '/docs']
    });
});

// Initialize models and start server
async function startServer() {
    try {
        console.log('🚀 Starting Face-API.js backend server...');

        // Initialize face-api models
        await faceApiService.initialize();

        // Start the server
        app.listen(port, '0.0.0.0', () => {
            console.log(`🌐 Face-API.js Backend running on http://0.0.0.0:${port}`);
            console.log(`✅ Face-API.js models loaded and ready!`);
            console.log(`📚 API documentation available at: http://localhost:${port}/docs`);
            console.log(`🔧 Framework: face-api.js`);
            console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
        });

    } catch (error) {
        console.error('❌ Failed to start Face-API.js backend server:', error);
        process.exit(1);
    }
}

// Start the server
startServer();