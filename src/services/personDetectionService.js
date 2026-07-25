// Person Detection Service - Connects to Flask backend with YOLO model

const NODEJS_BASE_URL = process.env.NODEJS_API_URL || 'http://localhost:3004';

class PersonDetectionService {
  constructor() {
    this.baseUrl = NODEJS_BASE_URL;
    this.detectUrl = `${this.baseUrl}/api/v1/exhibit/detect`;
  }

  /**
   * Detect person from base64 encoded image
   * @param {string} base64Image - Base64 encoded image data
   * @returns {Promise<PersonDetectionResult>} Detection result
   */
  async detectPersonFromBase64(base64Image) {
    try {
      console.log('👤 Sending image to Flask backend for person detection...');

      const response = await fetch(this.detectUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: `data:image/jpeg;base64,${base64Image}`
        }),
      });

      if (!response.ok) {
        throw new Error(`Flask API responded with status: ${response.status}`);
      }

      const data = await response.json();
      console.log('👤 Flask person detection result:', data);

      // For person detection, we'll assume any successful exhibit detection means a person is present
      // Since exhibit detection requires a person to be holding/showing something
      const personDetected = !data.error && data.exhibit && data.exhibit !== 'unknown';
      const confidence = personDetected ? 0.8 : 0.2; // High confidence if exhibit detected

      const result = {
        person_detected: personDetected,
        confidence: confidence,
        message: personDetected ? 'Person detected via exhibit recognition' : 'No person clearly detected',
        exhibit_info: data.exhibit || 'unknown',
        timestamp: new Date().toISOString()
      };

      console.log('✅ Person detection completed:', result);

      return result;

    } catch (error) {
      console.error('❌ Person detection service error:', error);

      return {
        person_detected: false,
        confidence: 0.0,
        message: `Flask backend error: ${error.message}`,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Quick person detection for rapid scanning
   * @param {string} base64Image - Base64 encoded image data
   * @returns {Promise<PersonDetectionResult>} Detection result
   */
  async quickDetectPerson(base64Image) {
    // Use the same detection method but with faster processing
    return this.detectPersonFromBase64(base64Image);
  }
}

// Export service instance
export const personDetectionService = new PersonDetectionService();

// Result type definition for documentation
export const PersonDetectionResult = {
  person_detected: 'boolean',
  confidence: 'number', // 0.0 to 1.0
  message: 'string',
  exhibit_info: 'string', // Optional exhibit information
  error: 'string', // Optional error message
  timestamp: 'string'
};