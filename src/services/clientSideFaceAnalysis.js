// Client-Side Face Analysis Service - Runs face-api.js entirely in the browser
// No Node.js backend required - models loaded and inference done client-side

import * as faceapi from 'face-api.js';

class ClientSideFaceAnalysisService {
  constructor() {
    this.isLoaded = false;
    this.modelPath = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights'; // Official models
    this.emotionLabels = ['angry', 'disgusted', 'fearful', 'happy', 'neutral', 'sad', 'surprised'];
  }

  /**
   * Initialize face-api.js models in the browser
   */
  async initialize() {
    console.log('🚀 Initializing face-api.js models in browser...');

    try {
      // Load all required models from public/models directory
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(this.modelPath),
        faceapi.nets.faceLandmark68Net.loadFromUri(this.modelPath),
        faceapi.nets.faceRecognitionNet.loadFromUri(this.modelPath),
        faceapi.nets.faceExpressionNet.loadFromUri(this.modelPath),
        faceapi.nets.ageGenderNet.loadFromUri(this.modelPath)
      ]);

      this.isLoaded = true;
      console.log('✅ All face-api.js models loaded successfully in browser!');
      console.log('🏷️ Emotion classes:', this.emotionLabels.join(', '));
      return true;

    } catch (error) {
      console.error('❌ Error loading face-api.js models in browser:', error);
      this.isLoaded = false;
      return false;
    }
  }

  /**
   * Analyze face from image element or canvas
   * @param {HTMLImageElement|HTMLCanvasElement|HTMLVideoElement} imageElement - Image element to analyze
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeFaceFromImage(imageElement) {
    if (!this.isLoaded) {
      throw new Error('Face-api.js models not loaded yet. Please wait for initialization.');
    }

    console.log('🧠 Starting client-side face analysis...');
    const startTime = Date.now();

    try {
      // Use more sensitive detection options
      const detectionOptions = new faceapi.TinyFaceDetectorOptions({
        inputSize: 512,
        scoreThreshold: 0.2
      });

      // Perform face detection with all features
      const detections = await faceapi
        .detectAllFaces(imageElement, detectionOptions)
        .withFaceLandmarks()
        .withFaceExpressions()
        .withAgeAndGender();

      // Retry with even more sensitive settings if no faces found
      if (detections.length === 0) {
        console.log('⚠️  No faces detected, retrying with ultra-sensitive settings...');
        const ultraSensitiveOptions = new faceapi.TinyFaceDetectorOptions({
          inputSize: 320,
          scoreThreshold: 0.1
        });

        const retryDetections = await faceapi
          .detectAllFaces(imageElement, ultraSensitiveOptions)
          .withFaceLandmarks()
          .withFaceExpressions()
          .withAgeAndGender();

        return this.formatResults(retryDetections, startTime);
      }

      return this.formatResults(detections, startTime);

    } catch (error) {
      console.error('❌ Client-side face analysis failed:', error);
      throw error;
    }
  }

  /**
   * Analyze face from base64 encoded image
   * @param {string} base64Image - Base64 encoded image data
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeFaceFromBase64(base64Image) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = async () => {
        try {
          const result = await this.analyzeFaceFromImage(img);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error('Failed to load image from base64'));
      };

      // Handle both full data URL and just base64 string
      if (base64Image.startsWith('data:')) {
        img.src = base64Image;
      } else {
        img.src = `data:image/jpeg;base64,${base64Image}`;
      }
    });
  }

  /**
   * Format detection results
   */
  formatResults(detections, startTime) {
    const processingTime = Date.now() - startTime;
    console.log(`🔍 Found ${detections.length} face(s) in ${processingTime}ms (client-side)`);

    if (detections.length === 0) {
      return {
        success: false,
        predictions: {
          age: {
            value: 0,
            group: 'No face detected',
            confidence: 0
          },
          gender: {
            label: 'No face detected',
            confidence: 0,
            Male: 0,
            Female: 0
          },
          emotion: {
            label: 'No face detected',
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
            message: 'No face detected - please place your camera correctly'
          }
        },
        processingTime,
        source: 'face-api.js-client-side'
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

    console.log(`✅ Client-side face analysis complete in ${processingTime}ms`);
    console.log(`👤 Detected: ${Math.round(age)} years old ${gender} (${Math.round(genderProbability * 100)}% confidence)`);
    console.log(`😊 Emotion: ${this.capitalizeFirst(dominantEmotion)} (${Math.round(expressions[dominantEmotion] * 100)}% confidence)`);

    // Determine age group
    const ageValue = Math.round(age);
    let ageGroup = 'Adult';
    if (ageValue < 18) ageGroup = 'Child';
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
      source: 'face-api.js-client-side'
    };
  }

  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Get model status
   */
  getModelStatus() {
    return {
      initialized: this.isLoaded,
      faceDetection: this.isLoaded,
      ageGender: this.isLoaded,
      emotion: this.isLoaded,
      exhibit: false,
      framework: 'face-api.js',
      mode: 'client-side'
    };
  }

  /**
   * Check if models are loaded and healthy
   */
  async checkHealth() {
    try {
      const status = this.getModelStatus();
      console.log('✅ Client-side face-api.js health check:', status);

      if (status.initialized) {
        console.log('✅ Client-side AI models are loaded');
        return true;
      } else {
        console.warn('⚠️ Client-side models are not loaded yet');
        return false;
      }
    } catch (error) {
      console.error('❌ Client-side health check failed:', error);
      return false;
    }
  }
}

// Export service instance
export const clientSideFaceAnalysisService = new ClientSideFaceAnalysisService();

// Export for use in React components
export default clientSideFaceAnalysisService;