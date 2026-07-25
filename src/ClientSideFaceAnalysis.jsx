// Client-Side Face Analysis Component - Runs entirely in browser without Node.js backend
import React, { useState, useEffect, useRef } from 'react';
import clientSideFaceAnalysisService from './services/clientSideFaceAnalysis.js';

const ClientSideFaceAnalysis = () => {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Initialize models on component mount
  useEffect(() => {
    const initializeModels = async () => {
      console.log('🚀 Initializing client-side face-api.js models...');
      setIsLoading(true);
      setError(null);

      try {
        const success = await clientSideFaceAnalysisService.initialize();
        if (success) {
          setIsModelLoaded(true);
          console.log('✅ Client-side models loaded successfully!');
        } else {
          setError('Failed to load face-api.js models');
        }
      } catch (err) {
        console.error('❌ Model initialization error:', err);
        setError(`Model loading failed: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    initializeModels();
  }, []);

  // Handle file upload
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!isModelLoaded) {
      setError('Models are not loaded yet. Please wait.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);

    try {
      // Create image preview
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Image = e.target.result;
        setImagePreview(base64Image);

        try {
          // Analyze the image client-side
          const result = await clientSideFaceAnalysisService.analyzeFaceFromBase64(base64Image);
          setAnalysisResult(result);
        } catch (analysisError) {
          console.error('❌ Analysis error:', analysisError);
          setError(`Analysis failed: ${analysisError.message}`);
        } finally {
          setIsLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('❌ File processing error:', err);
      setError(`File processing failed: ${err.message}`);
      setIsLoading(false);
    }
  };

  // Start webcam capture
  const startWebcam = async () => {
    if (!isModelLoaded) {
      setError('Models are not loaded yet. Please wait.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('❌ Webcam access error:', err);
      setError(`Webcam access failed: ${err.message}`);
    }
  };

  // Capture photo from webcam
  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || !isModelLoaded) return;

    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);

    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert canvas to base64
      const base64Image = canvas.toDataURL('image/jpeg', 0.8);
      setImagePreview(base64Image);

      // Analyze the captured image
      const result = await clientSideFaceAnalysisService.analyzeFaceFromBase64(base64Image);
      setAnalysisResult(result);
    } catch (err) {
      console.error('❌ Capture analysis error:', err);
      setError(`Capture analysis failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Stop webcam
  const stopWebcam = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>🧠 Client-Side Face Analysis</h1>
        <p style={styles.subtitle}>
          Face-api.js running entirely in your browser - No backend required!
        </p>

        <div style={styles.statusContainer}>
          <div style={styles.statusItem}>
            <span style={styles.statusLabel}>Models Status:</span>
            <span style={{
              ...styles.statusValue,
              color: isModelLoaded ? '#4CAF50' : '#FF5722'
            }}>
              {isLoading ? '🔄 Loading...' : isModelLoaded ? '✅ Loaded' : '❌ Not Loaded'}
            </span>
          </div>

          <div style={styles.statusItem}>
            <span style={styles.statusLabel}>Framework:</span>
            <span style={styles.statusValue}>face-api.js (client-side)</span>
          </div>
        </div>
      </div>

      {error && (
        <div style={styles.errorContainer}>
          <p style={styles.errorText}>❌ {error}</p>
        </div>
      )}

      <div style={styles.controlsContainer}>
        <div style={styles.uploadSection}>
          <h3>📁 Upload Image</h3>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            style={styles.fileInput}
            disabled={!isModelLoaded || isLoading}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!isModelLoaded || isLoading}
            style={{
              ...styles.button,
              backgroundColor: isModelLoaded && !isLoading ? '#2196F3' : '#ccc'
            }}
          >
            {isLoading ? '🔄 Analyzing...' : '📁 Choose Image'}
          </button>
        </div>

        <div style={styles.webcamSection}>
          <h3>📹 Webcam Analysis</h3>
          <div style={styles.webcamControls}>
            <button
              onClick={startWebcam}
              disabled={!isModelLoaded || isLoading}
              style={{
                ...styles.button,
                backgroundColor: isModelLoaded && !isLoading ? '#4CAF50' : '#ccc'
              }}
            >
              📹 Start Webcam
            </button>
            <button
              onClick={capturePhoto}
              disabled={!isModelLoaded || isLoading}
              style={{
                ...styles.button,
                backgroundColor: isModelLoaded && !isLoading ? '#FF9800' : '#ccc'
              }}
            >
              📸 Capture & Analyze
            </button>
            <button
              onClick={stopWebcam}
              style={{
                ...styles.button,
                backgroundColor: '#f44336'
              }}
            >
              ⏹️ Stop
            </button>
          </div>
        </div>
      </div>

      <div style={styles.mediaContainer}>
        {imagePreview && (
          <div style={styles.imagePreview}>
            <h4>🖼️ Analyzed Image</h4>
            <img
              src={imagePreview}
              alt="Analyzed"
              style={styles.previewImage}
            />
          </div>
        )}

        <div style={styles.webcamContainer}>
          <video
            ref={videoRef}
            style={styles.video}
            autoPlay
            muted
          />
          <canvas
            ref={canvasRef}
            style={styles.hiddenCanvas}
          />
        </div>
      </div>

      {analysisResult && (
        <div style={styles.resultsContainer}>
          <h3>🎯 Analysis Results</h3>

          {analysisResult.success ? (
            <div style={styles.resultGrid}>
              <div style={styles.resultCard}>
                <h4>👤 Age & Gender</h4>
                <p><strong>Age:</strong> {analysisResult.predictions.age.value} ({analysisResult.predictions.age.group})</p>
                <p><strong>Gender:</strong> {analysisResult.predictions.gender.label} ({analysisResult.predictions.gender.confidence}% confidence)</p>
              </div>

              <div style={styles.resultCard}>
                <h4>😊 Emotion</h4>
                <p><strong>Dominant:</strong> {analysisResult.predictions.emotion.label} ({analysisResult.predictions.emotion.confidence}% confidence)</p>
                <div style={styles.emotionList}>
                  {Object.entries(analysisResult.predictions.all_emotions).map(([emotion, confidence]) => (
                    <div key={emotion} style={styles.emotionItem}>
                      <span>{emotion}:</span>
                      <span>{Math.round(confidence * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={styles.resultCard}>
                <h4>📊 Technical Info</h4>
                <p><strong>Faces Detected:</strong> {analysisResult.predictions.face_analysis.detections_count}</p>
                <p><strong>Processing Time:</strong> {analysisResult.processingTime}ms</p>
                <p><strong>Source:</strong> {analysisResult.source}</p>
              </div>
            </div>
          ) : (
            <div style={styles.noFaceContainer}>
              <p>😐 No faces detected in the image</p>
            </div>
          )}
        </div>
      )}

      <div style={styles.infoSection}>
        <h4>ℹ️ Client-Side AI Info</h4>
        <ul style={styles.infoList}>
          <li>✅ Runs entirely in your browser</li>
          <li>🚫 No Node.js backend required</li>
          <li>🔒 Your images never leave your device</li>
          <li>⚡ Real-time face detection and analysis</li>
          <li>🧠 Uses face-api.js with TensorFlow.js</li>
        </ul>
      </div>
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
    backgroundColor: '#f5f5f5',
    minHeight: '100vh'
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px',
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '10px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
  },
  title: {
    fontSize: '2.5em',
    margin: '0 0 10px 0',
    color: '#333'
  },
  subtitle: {
    fontSize: '1.2em',
    color: '#666',
    margin: '0 0 20px 0'
  },
  statusContainer: {
    display: 'flex',
    justifyContent: 'center',
    gap: '30px',
    flexWrap: 'wrap'
  },
  statusItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  statusLabel: {
    fontSize: '0.9em',
    color: '#666',
    marginBottom: '5px'
  },
  statusValue: {
    fontSize: '1.1em',
    fontWeight: 'bold'
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    border: '1px solid #f44336',
    borderRadius: '5px',
    padding: '15px',
    marginBottom: '20px'
  },
  errorText: {
    color: '#f44336',
    margin: 0
  },
  controlsContainer: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
    marginBottom: '30px'
  },
  uploadSection: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '10px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
  },
  webcamSection: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '10px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
  },
  webcamControls: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap'
  },
  fileInput: {
    display: 'none'
  },
  button: {
    padding: '12px 20px',
    border: 'none',
    borderRadius: '5px',
    color: 'white',
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'opacity 0.3s'
  },
  mediaContainer: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
    marginBottom: '30px'
  },
  imagePreview: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '10px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
  },
  previewImage: {
    width: '100%',
    maxWidth: '400px',
    height: 'auto',
    borderRadius: '5px'
  },
  webcamContainer: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '10px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
  },
  video: {
    width: '100%',
    maxWidth: '400px',
    height: 'auto',
    borderRadius: '5px'
  },
  hiddenCanvas: {
    display: 'none'
  },
  resultsContainer: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '10px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    marginBottom: '30px'
  },
  resultGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '20px'
  },
  resultCard: {
    backgroundColor: '#f8f9fa',
    padding: '15px',
    borderRadius: '8px',
    border: '1px solid #dee2e6'
  },
  emotionList: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '5px',
    marginTop: '10px'
  },
  emotionItem: {
    display: 'flex',
    justifyContent: 'space-between'
  },
  noFaceContainer: {
    textAlign: 'center',
    padding: '20px',
    color: '#666'
  },
  infoSection: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '10px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
  },
  infoList: {
    listStyle: 'none',
    padding: 0
  }
};

export default ClientSideFaceAnalysis;