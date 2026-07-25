import express from 'express';
import multer from 'multer';
import { promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import FormData from 'form-data';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
        files: 1
    },
    fileFilter: (req, file, cb) => {
        // Accept audio files
        const allowedMimeTypes = [
            'audio/mpeg',
            'audio/wav',
            'audio/ogg',
            'audio/mp4',
            'audio/webm',
            'audio/flac',
            'audio/aac'
        ];

        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Please upload an audio file.'), false);
        }
    }
});

// Audio transcription endpoint using AssemblyAI
router.post('/transcribe', upload.single('audio'), async (req, res, next) => {
    let tempFilePath = null;

    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No audio file provided'
            });
        }

        const apiKey = process.env.ASSEMBLYAI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({
                success: false,
                error: 'AssemblyAI API key not configured'
            });
        }

        logger.info(`🎤 Audio transcription request received: ${req.file.originalname} (${req.file.size} bytes)`);

        // Create temp directory if it doesn't exist
        const tempDir = join(process.cwd(), 'temp');
        await fs.mkdir(tempDir, { recursive: true });

        // Save uploaded file temporarily
        const fileName = `${uuidv4()}_${req.file.originalname}`;
        tempFilePath = join(tempDir, fileName);
        await fs.writeFile(tempFilePath, req.file.buffer);

        // Step 1: Upload audio file to AssemblyAI
        logger.info('🔗 Uploading audio to AssemblyAI...');
        const uploadFormData = new FormData();
        uploadFormData.append('audio', req.file.buffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype
        });

        const uploadResponse = await axios.post('https://api.assemblyai.com/v2/upload', uploadFormData, {
            headers: {
                'authorization': apiKey,
                ...uploadFormData.getHeaders()
            }
        });

        const audioUrl = uploadResponse.data.upload_url;
        logger.info(`🔗 Audio uploaded successfully: ${audioUrl}`);

        // Step 2: Submit transcription request
        logger.info('📝 Submitting transcription request...');
        const transcriptResponse = await axios.post('https://api.assemblyai.com/v2/transcript', {
            audio_url: audioUrl,
            speech_model: 'universal'
        }, {
            headers: {
                'authorization': apiKey,
                'content-type': 'application/json'
            }
        });

        const transcriptId = transcriptResponse.data.id;
        logger.info(`📝 Transcription submitted with ID: ${transcriptId}`);

        // Step 3: Poll for transcription completion
        logger.info('⏳ Polling for transcription completion...');
        const maxAttempts = 60; // 3 minutes maximum
        let attempts = 0;
        let transcriptionResult = null;

        while (attempts < maxAttempts) {
            const statusResponse = await axios.get(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
                headers: {
                    'authorization': apiKey
                }
            });

            transcriptionResult = statusResponse.data;

            if (transcriptionResult.status === 'completed') {
                logger.info('✅ Transcription completed successfully');
                break;
            } else if (transcriptionResult.status === 'error') {
                throw new Error(`Transcription failed: ${transcriptionResult.error || 'Unknown error'}`);
            }

            // Wait 3 seconds before next poll
            await new Promise(resolve => setTimeout(resolve, 3000));
            attempts++;
        }

        if (attempts >= maxAttempts) {
            throw new Error('Transcription polling timeout');
        }

        // Step 4: Generate keyword-based response (matching your unify.py logic)
        const keywordResponse = generateKeywordResponse(transcriptionResult.text);

        const response = {
            success: true,
            transcript: transcriptionResult.text,
            keyword_response: keywordResponse,
            original_transcript: transcriptionResult.text,
            confidence: transcriptionResult.confidence,
            processing_time: Date.now() - Date.now(), // Could be improved with actual timing
            audio_info: {
                duration: transcriptionResult.audio_duration,
                filename: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype
            },
            timestamp: new Date().toISOString()
        };

        logger.info(`🎤 Transcription complete: "${transcriptionResult.text}"`);

        res.json(response);

    } catch (error) {
        logger.error('❌ Audio transcription failed:', error);

        if (error.response) {
            // AssemblyAI API error
            logger.error('AssemblyAI API Error:', error.response.data);
            return res.status(error.response.status).json({
                success: false,
                error: 'Transcription service error',
                details: error.response.data
            });
        }

        next(error);

    } finally {
        // Clean up temporary file
        if (tempFilePath) {
            try {
                await fs.unlink(tempFilePath);
                logger.debug(`🗑️  Temporary file cleaned up: ${tempFilePath}`);
            } catch (cleanupError) {
                logger.warn('⚠️  Failed to cleanup temporary file:', cleanupError);
            }
        }
    }
});

// Text-to-speech endpoint (future enhancement)
router.post('/tts', async (req, res, next) => {
    try {
        const { text, voice = 'en-US', speed = 1.0 } = req.body;

        if (!text) {
            return res.status(400).json({
                success: false,
                error: 'No text provided for text-to-speech'
            });
        }

        // This is a placeholder for TTS functionality
        // Could be implemented with services like Google TTS, AWS Polly, etc.
        logger.info('🗣️ Text-to-speech request received (not implemented)');

        res.json({
            success: false,
            error: 'Text-to-speech functionality not implemented yet',
            requested_text: text,
            voice,
            speed
        });

    } catch (error) {
        logger.error('❌ Text-to-speech failed:', error);
        next(error);
    }
});

// Generate keyword-based response (matching unify.py logic)
function generateKeywordResponse(transcript) {
    if (!transcript) return "How can I help you today?";

    const text = transcript.toLowerCase();

    // Define keyword patterns and responses (from your unify.py)
    const keywordResponses = {
        'hello': "Hello",
        'hi': "Hello",
        'good morning': "Good morning",
        'good afternoon': "Good afternoon",
        'opening hours': "What are the opening hours?",
        'hours': "What are the opening hours?",
        'food': "Where is the food court?",
        'eat': "Where is the food court?",
        'restaurant': "Where is the food court?",
        'kidsstop': "How do I get to KidsSTOP?",
        'children': "What activities are suitable for young children?",
        'kids': "What activities are suitable for young children?",
        'exhibition': "What exhibitions are currently showing?",
        'show': "What exhibitions are currently showing?",
        'park': "Where can I park?",
        'parking': "Where can I park?",
        'program': "Are there any special programs today?",
        'workshop': "Are there any educational workshops today?",
        'interactive': "Where can I find interactive science experiments?",
        'science': "Tell me about the interactive exhibits",
        'help': "How can I help you today?",
        'thank': "You're welcome!"
    };

    // Check for keyword matches
    for (const [keyword, response] of Object.entries(keywordResponses)) {
        if (text.includes(keyword)) {
            logger.info(`🔍 Detected keyword '${keyword}' in transcript: '${transcript}'`);
            return response;
        }
    }

    // If no keywords detected, return random response
    const randomResponses = [
        "What are the opening hours?",
        "Where is the food court?",
        "How do I get to KidsSTOP?",
        "What exhibitions are showing?",
        "Are there any special programs?",
        "Where can I park?",
        "What activities are for children?",
        "Tell me about the interactive exhibits"
    ];

    const randomResponse = randomResponses[Math.floor(Math.random() * randomResponses.length)];
    logger.info(`🎯 No keywords detected in '${transcript}', using random response: '${randomResponse}'`);
    return randomResponse;
}

export { router as audioRoutes };