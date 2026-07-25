import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { aiService } from './ai-service.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3016;

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

// Serve model files statically for TensorFlow.js
app.use('/models', express.static('models'));

// Simple logger
const logger = {
    info: (message, ...args) => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [INFO] ${message}`, ...args);
    },
    warn: (message, ...args) => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [WARN] ${message}`, ...args);
    },
    error: (message, ...args) => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [ERROR] ${message}`, ...args);
    },
    debug: (message, ...args) => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [DEBUG] ${message}`, ...args);
    }
};

// Memory monitoring
const getMemoryUsage = () => {
    const usage = process.memoryUsage();
    return {
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
        rss: Math.round(usage.rss / 1024 / 1024),
        external: Math.round(usage.external / 1024 / 1024)
    };
};

// Mock AI Models for Windows Development
class MockAIModels {
    constructor() {
        this.isInitialized = true;
        this.windowsMode = true;
    }

    // Mock Face Detection
    detectFaces(imageData) {
        logger.debug('🎭 Mock face detection running...');
        return [{
            box: {
                x: Math.round(Math.random() * 100 + 160),
                y: Math.round(Math.random() * 80 + 100),
                width: Math.round(150 + Math.random() * 100),
                height: Math.round(200 + Math.random() * 100)
            },
            confidence: 0.6 + Math.random() * 0.3,
            landmarks: null,
            isMock: true
        }];
    }

    // Mock Age/Gender Prediction
    predictAgeGender(imageData, faces) {
        logger.debug('👨‍👩‍👧‍👦 Mock age/gender prediction running...');
        const ages = [22, 25, 28, 30, 32, 35, 38, 40, 42, 45];
        const estimatedAge = ages[Math.floor(Math.random() * ages.length)];
        const gender = Math.random() > 0.5 ? 'Female' : 'Male';
        const confidence = 0.6 + Math.random() * 0.3;

        return {
            age: {
                estimated: estimatedAge,
                group: estimatedAge <= 18 ? 'Child' : 'Adult',
                confidence: confidence
            },
            gender: {
                label: gender,
                confidence: confidence,
                probabilities: {
                    Male: gender === 'Male' ? confidence : 1 - confidence,
                    Female: gender === 'Female' ? confidence : 1 - confidence
                }
            },
            face: faces[0],
            metadata: {
                model: 'mock_model',
                windowsMode: true
            }
        };
    }

    // Mock Emotion Prediction
    predictEmotion(imageData, faces) {
        logger.debug('😊 Mock emotion prediction running...');
        const emotions = ['Happy', 'Neutral', 'Surprise', 'Sad'];
        const predictedEmotion = emotions[Math.floor(Math.random() * emotions.length)];

        const allEmotions = {
            'Angry': Math.random() * 0.1,
            'Disgust': Math.random() * 0.05,
            'Fear': Math.random() * 0.1,
            'Happy': predictedEmotion === 'Happy' ? 0.6 + Math.random() * 0.2 : Math.random() * 0.2,
            'Neutral': predictedEmotion === 'Neutral' ? 0.6 + Math.random() * 0.2 : Math.random() * 0.3,
            'Sad': predictedEmotion === 'Sad' ? 0.5 + Math.random() * 0.2 : Math.random() * 0.1,
            'Surprise': predictedEmotion === 'Surprise' ? 0.5 + Math.random() * 0.2 : Math.random() * 0.1
        };

        // Normalize
        const sum = Object.values(allEmotions).reduce((a, b) => a + b, 0);
        Object.keys(allEmotions).forEach(emotion => {
            allEmotions[emotion] /= sum;
        });

        return {
            emotion: {
                predicted: predictedEmotion,
                confidence: allEmotions[predictedEmotion],
                probabilities: allEmotions,
                significant: { [predictedEmotion]: allEmotions[predictedEmotion] }
            },
            face: faces[0],
            metadata: {
                model: 'mock_model',
                windowsMode: true
            }
        };
    }

    // Mock Exhibit Detection
    detectExhibit(imageData) {
        logger.debug('🏛️ Mock exhibit detection running...');
        const exhibits = ['dialogue_with_time', 'earth_alive'];
        const randomExhibit = exhibits[Math.floor(Math.random() * exhibits.length)];
        const confidence = 0.5 + Math.random() * 0.4;

        return {
            exhibit: randomExhibit,
            confidence: confidence,
            classId: exhibits.indexOf(randomExhibit),
            allDetections: exhibits.map((exhibit, index) => ({
                exhibit,
                confidence: exhibit === randomExhibit ? confidence : Math.random() * 0.4,
                classId: index
            })),
            metadata: {
                model: 'mock_model',
                windowsMode: true
            }
        };
    }

    // Complete Analysis
    async analyzeComplete(imageData) {
        logger.info('🔍 Starting mock complete analysis...');
        const startTime = Date.now();

        const faces = this.detectFaces(imageData);
        const ageGender = this.predictAgeGender(imageData, faces);
        const emotion = this.predictEmotion(imageData, faces);
        const exhibit = this.detectExhibit(imageData);

        const processingTime = Date.now() - startTime;

        return {
            success: true,
            windowsMode: true,
            processingTime,
            faceAnalysis: {
                faces,
                faceCount: faces.length
            },
            ageGender,
            emotion,
            exhibit,
            errors: [],
            timestamp: new Date().toISOString()
        };
    }
}

// Initialize mock AI models
const mockAI = new MockAIModels();

// Exhibit path data (from frontend)
const exhibitPath = [
  {
    id: 10,
    name: 'Kinetic Garden',
    key: 'kinetic_garden',
    description: 'Our Science Centre welcome begins at the Kinetic Garden, where you can discover the inter-relationship among forms of energy and more through interactive exhibits such as the Magic Swing, a Sundial and a Lithophone. The Kinetic Garden is a unique outdoor exhibition which demonstrates certain scientific principles and phenomena that would be difficult to create in an indoor setting.',
    image: 'https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/kinetic-garden/teasers/kineticgarden-teaser.jpg',
    hall: 'kinetic_garden',
    mapPosition: { x: 45, y: 65 },
    displays: [
      {
        image: 'https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/kinetic-garden/highlights/kineticgarden-highlight-01.jpg',
        name: 'Echo',
        description: 'Speak into the Echo Tube and listen to the echoes!'
      },
      {
        image: 'https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/kinetic-garden/highlights/kineticgarden-highlight-02.jpg',
        name: 'Giant Chair',
        description: 'Places everyone! Position your camera at the photo spot onsite (on the yellow sticker) and be tickled by the interesting illusion of how large or small your photo subjects look seated on the two chairs! It perfectly demonstrates how our visual system relies on shortcuts and sometimes glosses over details in favour of the big picture!'
      },
    ]
  },
  {
    id: 2,
    name: 'Dialogue with Time',
    key: 'dialogue_with_time',
    description: "Dialogue with Time is an interactive exhibition that shows ageing from an original perspective. By 2030, one third of the world's population will be over the age of 65. As this is an important social issue, we aim for individuals to experience and understand more about the ageing process and reconsider their perception of ageing.",
    image: 'https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/dialogue-with-time/teasers/dialoguewithtime-teaser.jpg',
    hall: 'hall_b',
    mapPosition: { x: 35, y: 25 },
    displays: [
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/dialogue-with-time/heartdrum---science-of-ageing.jpg",
        name: 'Science of Ageing',
        description: "Ageing is an ongoing process that eventually causes an irreversible decline in body functions. Through the interactive exhibitions in this zone, individuals will be able to distinguish between natural causes of ageing and causes from external factors. We highlight common misconceptions associated to ageing such as the skin, bones and dementia."
      }
    ]
  },
  {
    id: 4,
    name: 'Earth Alive',
    key: 'earth_alive',
    description: "The Earth is constantly changing. Some changes are incremental, some are split-second, but both can result in violent events that devastate human communities. Experience Earth Alive, where you can encounter forces and processes that underlie Earth's changes. Through active, engaging exhibits and compelling visual displays, get a feel for some of Earth's physical functionings! The exhibits are organised into spheres that reflect Earth sciences and systems – Geosphere, Hydrosphere and Atmosphere. Each of these spheres looks at how Earth changes can manifest in the environment, causing phenomena such as earthquakes, tsunamis, mountain-building and rock strata, and volcanic eruptions. A fourth section, the Human Sphere, places people into the picture to highlight how Earth changes impact our lives in critical ways and how we can affect the Earth and respond to such changes.",
    image: 'https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/earth-alive/teaser-image/earth-alive-web-teaser.jpg',
    hall: 'hall_b',
    mapPosition: { x: 75, y: 35 },
    displays: [
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/earth-alive/highlights/gaia.jpg",
        name: 'GAIA',
        description: "Be mesmerised by the GAIA, a 5-metre inflatable globe installation by artist Luke Jerram, featuring detailed NASA imagery of the Earth surface."
      }
    ]
  }
];

// Helper function to get direction for navigation
function getDirection(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'East' : 'West';
  return dy > 0 ? 'South' : 'North';
}

// Routes

// Exhibit data endpoints
app.get('/api/v1/exhibits', (req, res) => {
    res.json({
        success: true,
        exhibits: exhibitPath,
        count: exhibitPath.length
    });
});

app.get('/api/v1/exhibits/:key', (req, res) => {
    const exhibit = exhibitPath.find(e => e.key === req.params.key);
    if (!exhibit) {
        return res.status(404).json({
            success: false,
            error: 'Exhibit not found'
        });
    }
    res.json({
        success: true,
        exhibit
    });
});

app.get('/api/v1/exhibits/:key/navigation/:targetKey', (req, res) => {
    const from = exhibitPath.find(e => e.key === req.params.key);
    const to = exhibitPath.find(e => e.key === req.params.targetKey);

    if (!from || !to) {
        return res.status(404).json({
            success: false,
            error: 'One or both exhibits not found'
        });
    }

    const distance = Math.round(Math.sqrt((to.mapPosition.x - from.mapPosition.x) ** 2 + (to.mapPosition.y - from.mapPosition.y) ** 2));
    const direction = getDirection(from.mapPosition, to.mapPosition);

    res.json({
        success: true,
        navigation: {
            from: from.name,
            to: to.name,
            distance,
            direction
        }
    });
});

// Health check
app.get('/health', (req, res) => {
    const aiStatus = aiService.getStatus();
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        windowsMode: true,
        realModels: true,
        memory: getMemoryUsage(),
        models: {
            faceDetection: true,
            ageGender: aiStatus.models.ageGender,
            emotion: aiStatus.models.emotion,
            exhibit: aiStatus.models.yolo
        },
        aiService: {
            initialized: aiStatus.isLoaded,
            framework: aiStatus.framework
        },
        message: 'Running in Windows mode with TensorFlow.js AI models'
    });
});

// Model status
app.get('/api/v1/status', (req, res) => {
    const aiStatus = aiService.getStatus();
    res.json({
        success: true,
        initialized: aiStatus.isLoaded,
        windowsMode: true,
        realModels: true,
        models: {
            faceDetection: true, // Using OpenCV Haar cascade
            ageGender: aiStatus.models.ageGender,
            emotion: aiStatus.models.emotion,
            exhibit: aiStatus.models.yolo
        },
        memory: getMemoryUsage(),
        backend: 'tensorflowjs',
        framework: aiStatus.framework,
        version: '1.0.0-tensorflowjs'
    });
});

// Face Analysis endpoint
app.post('/api/v1/face-analysis', async (req, res) => {
    try {
        const { image } = req.body;

        if (!image) {
            return res.status(400).json({
                success: false,
                error: 'No image provided'
            });
        }

        logger.info('👤 Face analysis request received (TensorFlow.js Mode)');
        logger.info('🔍 Image data length:', image ? image.length : 'null');
        logger.info('🔍 Image data preview:', image ? image.substring(0, 50) + '...' : 'null');

        // Use AI service for real face analysis
        const analysisResult = await aiService.analyzeFace(image);

        if (!analysisResult.success) {
            return res.status(400).json({
                success: false,
                error: 'No face detected in the image. Please ensure your face is clearly visible and try again.',
                message: 'No faces found in image - no fallback data provided',
                analysisResult: analysisResult
            });
        }

        // Map AI service response to expected frontend format
        const response = {
            success: true,
            windowsMode: true,
            realModels: true,
            predictions: {
                age: {
                    value: analysisResult.ageGender.estimated_age,
                    group: analysisResult.ageGender.age_group,
                    confidence: analysisResult.ageGender.confidence
                },
                gender: {
                    label: analysisResult.ageGender.gender,
                    confidence: analysisResult.ageGender.gender_confidence
                },
                emotion: {
                    label: analysisResult.emotion.predicted_emotion,
                    confidence: analysisResult.emotion.confidence
                },
                all_emotions: analysisResult.emotion.all_emotions,
                face_analysis: {
                    detections_count: analysisResult.faceAnalysis.faceCount,
                    face_coordinates: [
                        analysisResult.faceAnalysis.faces[0].box.x,
                        analysisResult.faceAnalysis.faces[0].box.y,
                        analysisResult.faceAnalysis.faces[0].box.width,
                        analysisResult.faceAnalysis.faces[0].box.height
                    ],
                    processed: true
                }
            }
        };

        logger.info(`👤 TensorFlow.js face analysis complete: Age=${response.predictions.age.value}, Gender=${response.predictions.gender.label}, Emotion=${response.predictions.emotion.label}`);

        res.json(response);

    } catch (error) {
        logger.error('❌ Face analysis failed:', error);
        res.status(500).json({
            success: false,
            error: 'Face analysis failed',
            details: error.message
        });
    }
});

// Exhibit detection endpoint
app.post('/api/v1/exhibit/detect', async (req, res) => {
    try {
        const { image } = req.body;

        if (!image) {
            return res.status(400).json({
                success: false,
                error: 'No image provided'
            });
        }

        logger.info('🏛️ Exhibit detection request received (Mock Mode)');

        const result = mockAI.detectExhibit(image);

        logger.info(`🏛️ Mock exhibit detection complete: ${result.exhibit} (confidence: ${result.confidence.toFixed(3)})`);

        res.json({
            exhibit: result.exhibit,
            confidence: result.confidence,
            windowsMode: true,
            mockModel: true,
            metadata: result.metadata
        });

    } catch (error) {
        logger.error('❌ Exhibit detection failed:', error);
        res.status(500).json({
            success: false,
            error: 'Exhibit detection failed',
            details: error.message
        });
    }
});

// Complete analysis endpoint
app.post('/api/v1/analyze/complete', async (req, res) => {
    try {
        const { image } = req.body;

        if (!image) {
            return res.status(400).json({
                success: false,
                error: 'No image provided'
            });
        }

        logger.info('🔍 Complete analysis request received (Mock Mode)');

        const results = await mockAI.analyzeComplete(image);

        logger.info(`🔍 Mock complete analysis complete in ${results.processingTime}ms`);

        res.json(results);

    } catch (error) {
        logger.error('❌ Complete analysis failed:', error);
        res.status(500).json({
            success: false,
            error: 'Complete analysis failed',
            details: error.message
        });
    }
});

// QR Code generation endpoint
app.post('/api/v1/qr/generate', async (req, res) => {
    try {
        const { data, options = {} } = req.body;

        if (!data) {
            return res.status(400).json({
                success: false,
                error: 'No data provided for QR code generation'
            });
        }

        logger.info('📱 QR code generation request received');

        const qrOptions = {
            type: options.type || 'image/png',
            quality: options.quality || 0.92,
            margin: options.margin || 1,
            color: {
                dark: options.darkColor || '#000000',
                light: options.lightColor || '#FFFFFF'
            },
            width: options.width || 256
        };

        const qrCodeDataURL = await QRCode.toDataURL(data, qrOptions);

        const response = {
            success: true,
            data: {
                originalData: data,
                qrCode: qrCodeDataURL,
                options: qrOptions,
                timestamp: new Date().toISOString()
            }
        };

        logger.info(`📱 QR code generated successfully for data length: ${data.length}`);

        res.json(response);

    } catch (error) {
        logger.error('❌ QR code generation failed:', error);
        res.status(500).json({
            success: false,
            error: 'QR code generation failed',
            details: error.message
        });
    }
});

// AI Chat endpoint
app.post('/api/v1/chat', async (req, res) => {
    try {
        const { message, conversationHistory = [] } = req.body;

        if (!message) {
            return res.status(400).json({
                success: false,
                error: 'No message provided'
            });
        }

        logger.info(`🤖 AI chat request: "${message.substring(0, 50)}..."`);

        // Mock AI responses - replace with actual AI integration
        const responses = [
            `That's an interesting question about "${message}". At Singapore Science Centre, we have many exhibits that explore similar topics!`,
            `Great question! The Science Centre has wonderful interactive displays that can help explain that concept.`,
            `I see you're curious about "${message}". Have you visited our interactive exhibitions? They're perfect for hands-on learning!`,
            `That relates to some fascinating scientific principles! You should check out our exhibits in Hall B for more insights.`,
            `Excellent question! Science is all about curiosity like yours. Our exhibits can help demonstrate those concepts visually.`
        ];

        const response = responses[Math.floor(Math.random() * responses.length)];

        const result = {
            success: true,
            response,
            timestamp: new Date().toISOString(),
            conversationId: uuidv4(),
            mockAI: true
        };

        logger.info(`🤖 AI response generated: "${response.substring(0, 50)}..."`);

        res.json(result);

    } catch (error) {
        logger.error('❌ AI chat failed:', error);
        res.status(500).json({
            success: false,
            error: 'AI chat failed',
            details: error.message
        });
    }
});

// SSC Website QR code generator
app.post('/api/v1/qr/ssc-website', async (req, res) => {
    try {
        const { exhibit, language = 'en', additionalParams = {} } = req.body;

        let baseUrl = 'https://www.science.edu.sg';

        if (exhibit) {
            baseUrl += `/exhibits/${exhibit}`;
        }

        const urlParams = new URLSearchParams({
            lang: language,
            source: 'qr_hologram',
            ...additionalParams
        });

        const fullUrl = `${baseUrl}?${urlParams.toString()}`;

        logger.info(`📱 Generating QR code for SSC website: ${fullUrl}`);

        const qrOptions = {
            type: 'image/png',
            quality: 0.95,
            margin: 2,
            color: {
                dark: '#0066cc',
                light: '#ffffff'
            },
            width: 400,
            errorCorrectionLevel: 'H'
        };

        const qrCodeDataURL = await QRCode.toDataURL(fullUrl, qrOptions);

        const response = {
            success: true,
            data: {
                url: fullUrl,
                qrCode: qrCodeDataURL,
                exhibit,
                language,
                timestamp: new Date().toISOString(),
                instructions: 'Scan this QR code to visit the Singapore Science Centre website'
            }
        };

        logger.info(`📱 SSC website QR code generated successfully`);

        res.json(response);

    } catch (error) {
        logger.error('❌ SSC website QR code generation failed:', error);
        res.status(500).json({
            success: false,
            error: 'SSC website QR code generation failed',
            details: error.message
        });
    }
});

// Legacy compatibility routes
app.post('/predict/face_analysis', (req, res) => {
    logger.info('📍 Legacy face analysis endpoint called, redirecting...');
    req.url = '/api/v1/face-analysis';
    app._router.handle(req, res);
});

app.post('/detect_exhibit', (req, res) => {
    logger.info('📍 Legacy exhibit detection endpoint called, redirecting...');
    req.url = '/api/v1/exhibit/detect';
    app._router.handle(req, res);
});

app.post('/analyze/complete', (req, res) => {
    logger.info('📍 Legacy complete analysis endpoint called, redirecting...');
    req.url = '/api/v1/analyze/complete';
    app._router.handle(req, res);
});

// API documentation
app.get('/docs', (req, res) => {
    const aiStatus = aiService.getStatus();
    res.json({
        title: 'SSC Person Detection API (TensorFlow.js Mode)',
        version: '1.0.0-tensorflowjs',
        description: 'Singapore Science Centre Person Detection & Emotion Recognition Backend - TensorFlow.js Integration',
        windowsMode: true,
        realModels: true,
        aiFramework: aiStatus.framework,
        note: 'This version uses TensorFlow.js with real AI models for emotion and age/gender prediction.',
        endpoints: {
            health: { method: 'GET', path: '/health' },
            status: { method: 'GET', path: '/api/v1/status' },
            exhibits: { method: 'GET', path: '/api/v1/exhibits' },
            exhibitByKey: { method: 'GET', path: '/api/v1/exhibits/:key' },
            navigation: { method: 'GET', path: '/api/v1/exhibits/:key/navigation/:targetKey' },
            faceAnalysis: { method: 'POST', path: '/api/v1/face-analysis', body: { image: 'base64 encoded image' } },
            exhibitDetection: { method: 'POST', path: '/api/v1/exhibit/detect', body: { image: 'base64 encoded image' } },
            completeAnalysis: { method: 'POST', path: '/api/v1/analyze/complete', body: { image: 'base64 encoded image' } },
            aiChat: { method: 'POST', path: '/api/v1/chat', body: { message: 'user message' } },
            qrGeneration: { method: 'POST', path: '/api/v1/qr/generate', body: { data: 'text to encode' } },
            sscQR: { method: 'POST', path: '/api/v1/qr/ssc-website', body: { exhibit: 'exhibit_name' } }
        }
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        message: `The requested endpoint ${req.method} ${req.originalUrl} was not found`,
        availableEndpoints: ['/health', '/api/v1/status', '/api/v1/face-analysis', '/api/v1/exhibit/detect', '/api/v1/analyze/complete', '/docs']
    });
});

// Global error handler
app.use((err, req, res, next) => {
    logger.error('❌ Unhandled error:', err);

    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred',
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(port, '0.0.0.0', () => {
    const aiStatus = aiService.getStatus();
    logger.info(`🚀 SSC Person Detection Backend (TensorFlow.js Mode) running on http://0.0.0.0:${port}`);
    logger.info(`🧠 Using TensorFlow.js with real AI models`);
    logger.info(`🎭 AI Service Status: ${aiStatus.isLoaded ? 'Loaded' : 'Loading...'}`);
    logger.info(`🔧 Framework: ${aiStatus.framework}`);
    logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`💾 Memory usage: ${JSON.stringify(getMemoryUsage())}MB`);
    logger.info(`📚 API documentation available at: http://localhost:${port}/docs`);
    logger.info('✅ Ready for real AI face analysis and emotion detection!');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('🛑 Received SIGTERM. Starting graceful shutdown...');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('🛑 Received SIGINT. Starting graceful shutdown...');
    process.exit(0);
});