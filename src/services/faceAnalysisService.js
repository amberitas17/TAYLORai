// Face Analysis Service - Connects to TensorFlow.js Node.js backend with real AI models

const NODEJS_BASE_URL = import.meta.env.VITE_NODEJS_API_URL || 'http://localhost:3016';

class FaceAnalysisService {
  constructor() {
    this.baseUrl = NODEJS_BASE_URL;
    this.healthCheckUrl = `${this.baseUrl}/health`;
    this.faceAnalysisUrl = `${this.baseUrl}/api/v1/face-analysis`;
  }

  /**
   * Check if Flask backend is healthy and models are loaded
   */
  async checkHealth() {
    try {
      console.log('🔍 Checking backend health at:', this.healthCheckUrl);
      const response = await fetch(this.healthCheckUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      console.log('📡 Health check response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ TensorFlow.js backend health check:', data);

        // Check if required models are loaded
        const hasModels = data.models && (data.models.emotion || data.models.ageGender);

        if (hasModels) {
          console.log('✅ TensorFlow.js AI models are loaded');
          return true;
        } else {
          console.warn('⚠️ Some AI models are not loaded:', data.models);
          return false;
        }
      } else {
        console.error('❌ TensorFlow.js backend health check failed:', response.status);
        return false;
      }
    } catch (error) {
      console.error('❌ TensorFlow.js backend connection failed:', error);
      return false;
    }
  }

  /**
   * Analyze face from base64 encoded image using TensorFlow.js backend with real AI models
   * @param {string} base64Image - Base64 encoded image data
   * @returns {Promise<FaceAnalysisResult>} Analysis result
   */
  async analyzeFaceFromBase64(base64Image) {
    try {
      console.log('🧠 Sending image to TensorFlow.js backend for real AI analysis...');

      const response = await fetch(this.faceAnalysisUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: `data:image/jpeg;base64,${base64Image}`
        }),
      });

      if (!response.ok) {
        throw new Error(`TensorFlow.js API responded with status: ${response.status}`);
      }

      const data = await response.json();
      console.log('🧠 TensorFlow.js AI analysis result:', data);

      if (!data.success) {
        return {
          success: false,
          message: data.error || 'Face analysis failed',
          error: data.error,
          ageGroup: 'Unknown',
          emotion: 'Unknown',
          emotionConfidence: 0,
          confidence: 0,
          timestamp: new Date().toISOString()
        };
      }

      // Extract predictions from TensorFlow.js response
      const predictions = data.predictions;
      const ageInfo = predictions.age;
      const genderInfo = predictions.gender;
      const emotionInfo = predictions.emotion;
      const allEmotions = predictions.all_emotions;
      const faceInfo = predictions.face_analysis;

      // Map to expected frontend format
      const result = {
        success: true,
        age: ageInfo.value,
        ageGroup: ageInfo.group,
        ageConfidence: ageInfo.confidence,
        gender: genderInfo.label,
        genderConfidence: genderInfo.confidence,
        emotion: emotionInfo.label,
        emotionConfidence: emotionInfo.confidence,
        allEmotions: allEmotions,
        confidence: emotionInfo.confidence,
        faceCount: faceInfo.detections_count,
        faceCoordinates: faceInfo.face_coordinates,
        processed: faceInfo.processed,
        timestamp: new Date().toISOString(),
        message: 'Real AI analysis completed successfully'
      };

      console.log('✅ Face analysis completed:', {
        age: result.age,
        ageGroup: result.ageGroup,
        gender: result.gender,
        emotion: result.emotion,
        confidence: result.emotionConfidence
      });

      return result;

    } catch (error) {
      console.error('❌ Face analysis service error:', error);

      return {
        success: false,
        message: `TensorFlow.js backend error: ${error.message}`,
        error: error.message,
        ageGroup: 'Unknown',
        emotion: 'Unknown',
        emotionConfidence: 0,
        confidence: 0,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Export service instance and type definition
export const faceAnalysisService = new FaceAnalysisService();

// TypeScript-like interface for documentation
export const FaceAnalysisResult = {
  success: 'boolean',
  age: 'number',
  ageGroup: 'string', // 'Child', 'Adult', 'Senior'
  ageConfidence: 'number',
  gender: 'string', // 'Male', 'Female', 'Unknown'
  genderConfidence: 'number',
  emotion: 'string', // 'Happy', 'Sad', 'Angry', 'Neutral', etc.
  emotionConfidence: 'number',
  allEmotions: 'object', // { emotion: confidence }
  confidence: 'number',
  faceCount: 'number',
  faceCoordinates: 'array',
  processed: 'boolean',
  timestamp: 'string',
  message: 'string',
  error: 'string'
};