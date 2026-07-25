// Face-api.js AI Service - Reliable face detection and emotion recognition
import * as faceapi from 'face-api.js';

class FaceApiAIService {
    constructor() {
        this.isLoaded = false;
        // Use CDN-hosted models for better compatibility
        this.modelPath = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';

        // Face-api.js supports these emotions
        this.emotionLabels = ['angry', 'disgusted', 'fearful', 'happy', 'neutral', 'sad', 'surprised'];
    }

    async initialize() {
        console.log('🚀 Initializing face-api.js models...');

        try {
            // Load all required models
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(this.modelPath),
                faceapi.nets.faceLandmark68Net.loadFromUri(this.modelPath),
                faceapi.nets.faceRecognitionNet.loadFromUri(this.modelPath),
                faceapi.nets.faceExpressionNet.loadFromUri(this.modelPath),
                faceapi.nets.ageGenderNet.loadFromUri(this.modelPath)
            ]);

            this.isLoaded = true;
            console.log('✅ All face-api.js models loaded successfully!');
            console.log('🏷️ Emotion classes:', this.emotionLabels.join(', '));
            return true;

        } catch (error) {
            console.error('❌ Error loading face-api.js models:', error);
            this.isLoaded = false;
            return false;
        }
    }

    async analyzeImage(imageElement) {
        if (!this.isLoaded) {
            throw new Error('Face-api.js models not loaded yet. Please wait for initialization.');
        }

        console.log('🧠 Starting face-api.js analysis...');
        console.log('📷 Image dimensions:', imageElement.width, 'x', imageElement.height);
        const startTime = Date.now();

        try {
            // Use more sensitive detection options
            const detectionOptions = new faceapi.TinyFaceDetectorOptions({
                inputSize: 416,        // Higher input size for better detection
                scoreThreshold: 0.3    // Lower threshold for more sensitive detection
            });

            console.log('🔍 Detection options:', detectionOptions);

            // Detect faces with expressions and age/gender
            const detections = await faceapi
                .detectAllFaces(imageElement, detectionOptions)
                .withFaceLandmarks()
                .withFaceExpressions()
                .withAgeAndGender();

            console.log(`👤 Found ${detections.length} face(s)`);

            if (detections.length === 0) {
                // Try with even more sensitive settings
                console.log('🔄 Retrying with more sensitive detection...');
                const sensitiveOptions = new faceapi.TinyFaceDetectorOptions({
                    inputSize: 512,
                    scoreThreshold: 0.1
                });

                const retryDetections = await faceapi
                    .detectAllFaces(imageElement, sensitiveOptions)
                    .withFaceLandmarks()
                    .withFaceExpressions()
                    .withAgeAndGender();

                console.log(`👤 Retry found ${retryDetections.length} face(s)`);

                if (retryDetections.length === 0) {
                    throw new Error('No faces detected in the image. Please ensure your face is clearly visible and well-lit.');
                }

                // Use retry results
                const detection = retryDetections[0];
                return this.processDetection(detection, Date.now() - startTime);
            }

            // Use the first detected face
            const detection = detections[0];
            return this.processDetection(detection, Date.now() - startTime);

        } catch (error) {
            console.error('❌ Face-api.js analysis failed:', error);
            throw error;
        }
    }

    // Helper method to process detection results
    processDetection(detection, processingTime) {
        const expressions = detection.expressions;
        const { age, gender, genderProbability } = detection;

        console.log('🎭 Raw expressions:', expressions);
        console.log('👤 Age/Gender:', { age, gender, genderProbability });

        // Find the dominant emotion
        const emotionEntries = Object.entries(expressions);
        const [dominantEmotion, confidence] = emotionEntries.reduce((max, current) =>
            current[1] > max[1] ? current : max
        );

        // Convert to your expected format
        const allEmotions = {};
        this.emotionLabels.forEach(emotion => {
            allEmotions[this.capitalizeFirst(emotion)] = expressions[emotion] || 0;
        });

        // Determine age group
        let ageGroup = 'Adult';
        if (age <= 18) {
            ageGroup = 'Child';
        } else if (age >= 65) {
            ageGroup = 'Senior';
        }

        console.log(`✅ Face-api.js analysis complete in ${processingTime}ms`);
        console.log(`😊 Dominant emotion: ${dominantEmotion} (${(confidence * 100).toFixed(1)}%)`);

        return {
            success: true,
            emotion: this.capitalizeFirst(dominantEmotion),
            emotionConfidence: confidence,
            allEmotions: allEmotions,
            age: Math.round(age),
            ageGroup: ageGroup,
            ageConfidence: 0.85, // Face-api.js doesn't provide age confidence
            gender: gender,
            genderConfidence: genderProbability,
            processingTime,
            timestamp: new Date().toISOString(),
            source: 'face-api.js'
        };
    }

    // Helper method to capitalize first letter
    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // Check if models are ready
    isReady() {
        return this.isLoaded;
    }

    // Get model status
    getStatus() {
        return {
            faceDetection: this.isLoaded,
            emotionRecognition: this.isLoaded,
            ageGenderDetection: this.isLoaded,
            ready: this.isReady(),
            backend: 'face-api.js'
        };
    }
}

// Create and export a singleton instance
export const faceApiAI = new FaceApiAIService();
export default faceApiAI;