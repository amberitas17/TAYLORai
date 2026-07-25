import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from "react-router-dom";
import { faceAnalysisService } from './services/faceAnalysisService.js';

export default function FaceVerificationTest() {
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [detectedProfile, setDetectedProfile] = useState(null);
  const [backendStatus, setBackendStatus] = useState(null);
  const [error, setError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    checkBackendHealth();
    requestCamera();
  }, []);

  const checkBackendHealth = async () => {
    try {
      const isHealthy = await faceAnalysisService.checkHealth();
      setBackendStatus(isHealthy);
      if (!isHealthy) {
        setError('TensorFlow.js backend is not available. Please ensure the backend is running.');
      }
    } catch (error) {
      console.error('Backend health check failed:', error);
      setBackendStatus(false);
      setError('Failed to connect to TensorFlow.js backend.');
    }
  };

  const requestCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setPermissionGranted(true);
    } catch {
      setError('Camera permission denied or not available.');
    }
  };

  const captureImageFromVideo = () => {
    if (!videoRef.current) return null;

    const canvas = document.createElement('canvas');
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    return canvas.toDataURL('image/jpeg', 0.8).split(',')[1]; // Return base64 without prefix
  };

  const handleStartVerification = async () => {
    setIsVerifying(true);
    setError('');

    try {
      const base64Image = captureImageFromVideo();

      if (!base64Image) {
        throw new Error('Failed to capture image from camera');
      }

      console.log('🧠 Starting real face analysis with TensorFlow.js...');
      console.log('📸 Image data length:', base64Image.length);

      const analysisResult = await faceAnalysisService.analyzeFaceFromBase64(base64Image);

      if (!analysisResult.success) {
        throw new Error(analysisResult.message || 'Face analysis failed');
      }

      const profile = {
        ageGroup: analysisResult.ageGroup,
        age: analysisResult.age,
        gender: analysisResult.gender,
        emotion: analysisResult.emotion,
        confidence: analysisResult.emotionConfidence,
        allEmotions: analysisResult.allEmotions,
        message: "Real AI analysis complete!",
      };

      console.log('✅ Face analysis completed:', profile);

      setDetectedProfile(profile);
      setIsVerified(true);
      setIsVerifying(false);

    } catch (error) {
      console.error('❌ Face verification failed:', error);
      setError(`Face analysis failed: ${error.message}`);
      setIsVerifying(false);
    }
  };

  const convertFileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleUploadPhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsVerifying(true);
    setError('');

    try {
      console.log('🧠 Starting real photo analysis with TensorFlow.js...');

      const base64Image = await convertFileToBase64(file);
      console.log('📸 Image data length:', base64Image.length);

      const analysisResult = await faceAnalysisService.analyzeFaceFromBase64(base64Image);

      if (!analysisResult.success) {
        throw new Error(analysisResult.message || 'Photo analysis failed');
      }

      const profile = {
        ageGroup: analysisResult.ageGroup,
        age: analysisResult.age,
        gender: analysisResult.gender,
        emotion: analysisResult.emotion,
        confidence: analysisResult.emotionConfidence,
        allEmotions: analysisResult.allEmotions,
        message: "Real AI photo analysis complete!",
      };

      console.log('✅ Photo analysis completed:', profile);

      setDetectedProfile(profile);
      setIsVerified(true);
      setIsVerifying(false);

    } catch (error) {
      console.error('❌ Photo analysis failed:', error);
      setError(`Photo analysis failed: ${error.message}`);
      setIsVerifying(false);
    }
  };

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorContainer}>
          <h2>⚠️ Error</h2>
          <p>{error}</p>
          <button style={styles.button} onClick={() => window.location.reload()}>Retry</button>
          <div style={styles.backendStatus}>
            <span style={{...styles.statusDot, backgroundColor: backendStatus ? '#4CAF50' : '#FF5722'}} />
            Backend Status: {backendStatus ? 'Connected' : 'Disconnected'}
          </div>
        </div>
      </div>
    );
  }

  if (!permissionGranted) {
    return (
      <div style={styles.container}>
        <div style={styles.permissionContainer}>
          <h2>📷 Camera Permission Required</h2>
          <p>We need camera access to test the TensorFlow.js emotion detection.</p>
          <button style={styles.button} onClick={requestCamera}>Grant Permission</button>
        </div>
      </div>
    );
  }

  if (isVerified && detectedProfile) {
    return (
      <div style={{ ...styles.container, background: 'linear-gradient(90deg, #4CAF50, #66BB6A)' }}>
        <div style={styles.successContainer}>
          <h2>✅ TensorFlow.js Analysis Complete!</h2>
          <h3>Backend Test Successful</h3>
          <div style={styles.profileCard}>
            <div><strong>Age:</strong> {detectedProfile.age} ({detectedProfile.ageGroup})</div>
            <div><strong>Gender:</strong> {detectedProfile.gender}</div>
            <div><strong>Emotion:</strong> {detectedProfile.emotion} ({(detectedProfile.confidence * 100).toFixed(1)}% confidence)</div>
            <div><strong>Message:</strong> {detectedProfile.message}</div>
            {detectedProfile.allEmotions && (
              <div style={styles.emotionsList}>
                <strong>All Emotions:</strong>
                {Object.entries(detectedProfile.allEmotions).map(([emotion, conf]) => (
                  <div key={emotion} style={styles.emotionItem}>
                    {emotion}: {(conf * 100).toFixed(1)}%
                  </div>
                ))}
              </div>
            )}
          </div>
          <button style={styles.button} onClick={() => window.location.reload()}>Test Again</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...styles.container, background: 'linear-gradient(90deg, #FF6B35, #FF8C42)' }}>
      <div style={styles.header}>
        <h2>🧠 TensorFlow.js Backend Test</h2>
        <p>Testing real emotion detection with your backend</p>
      </div>

      <div style={styles.cameraContainer}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          width={320}
          height={240}
          style={styles.camera}
        />

        <div style={styles.controls}>
          <button
            style={styles.startButton}
            onClick={handleStartVerification}
            disabled={isVerifying}
          >
            {isVerifying ? '🔄 Analyzing...' : '📸 Capture & Analyze'}
          </button>

          <label style={styles.uploadButton}>
            📁 Upload Photo
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUploadPhoto} />
          </label>
        </div>
      </div>

      <div style={styles.statusSection}>
        <div style={styles.statusRow}>
          <span style={{...styles.statusDot, backgroundColor: backendStatus ? '#4CAF50' : '#FF5722'}} />
          Backend: {backendStatus ? 'Connected ✅' : 'Disconnected ❌'}
        </div>
        <div style={styles.statusRow}>
          <span style={{...styles.statusDot, backgroundColor: permissionGranted ? '#4CAF50' : '#FFC107'}} />
          Camera: {permissionGranted ? 'Ready ✅' : 'Waiting...'}
        </div>
      </div>

      <div style={styles.infoSection}>
        <h4>🚀 Real TensorFlow.js Testing</h4>
        <p>This tests your backend with real emotion detection!</p>
        <p><strong>Backend URL:</strong> {import.meta.env.VITE_NODEJS_API_URL || 'http://localhost:3033'}</p>
        <p><strong>Emotion Classes:</strong> Angry, Fear, Happy, Neutral, Sad</p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'sans-serif',
    color: 'white',
    padding: '20px',
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px',
  },
  cameraContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '30px',
  },
  camera: {
    borderRadius: '16px',
    border: '3px solid white',
    marginBottom: '20px',
    background: '#222',
  },
  controls: {
    display: 'flex',
    gap: '16px',
    marginBottom: '20px',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  startButton: {
    background: 'white',
    color: '#FF6B35',
    borderRadius: '25px',
    padding: '15px 30px',
    fontWeight: 'bold',
    fontSize: '16px',
    border: 'none',
    cursor: 'pointer',
  },
  uploadButton: {
    background: '#4CAF50',
    color: 'white',
    borderRadius: '25px',
    padding: '15px 30px',
    fontWeight: 'bold',
    fontSize: '16px',
    border: 'none',
    cursor: 'pointer',
    display: 'inline-block',
  },
  button: {
    background: 'white',
    color: '#FF6B35',
    borderRadius: '25px',
    padding: '15px 30px',
    fontWeight: 'bold',
    fontSize: '16px',
    border: 'none',
    cursor: 'pointer',
    margin: '10px',
  },
  statusSection: {
    marginBottom: '30px',
    textAlign: 'center',
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '8px',
  },
  statusDot: {
    display: 'inline-block',
    width: '10px',
    height: '10px',
    borderRadius: '5px',
    marginRight: '8px',
  },
  infoSection: {
    textAlign: 'center',
    maxWidth: '500px',
  },
  permissionContainer: {
    background: 'rgba(0,0,0,0.3)',
    padding: '40px',
    borderRadius: '16px',
    textAlign: 'center',
  },
  errorContainer: {
    background: 'rgba(255,87,34,0.9)',
    padding: '40px',
    borderRadius: '16px',
    textAlign: 'center',
    maxWidth: '500px',
  },
  successContainer: {
    textAlign: 'center',
    padding: '40px',
    maxWidth: '600px',
  },
  profileCard: {
    background: 'rgba(255,255,255,0.9)',
    color: '#333',
    borderRadius: '15px',
    padding: '20px',
    marginTop: '30px',
    textAlign: 'left',
  },
  emotionsList: {
    marginTop: '15px',
    padding: '10px',
    background: 'rgba(0,0,0,0.1)',
    borderRadius: '8px',
  },
  emotionItem: {
    fontSize: '14px',
    margin: '2px 0',
  },
  backendStatus: {
    marginTop: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};