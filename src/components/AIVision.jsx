import React, { useState, useEffect, useRef } from 'react';
import { Camera, Shield, User, Smile, Upload, Eye, Zap, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import clientSideFaceAnalysisService from '../services/clientSideFaceAnalysis.js';
import './AIVision.css';
import Hologram from '../../src/hologram'

export default function AIVision() {
  const navigate = useNavigate();
  const [cameraPermission, setCameraPermission] = useState(null);
  const [modelStatus, setModelStatus] = useState(null);
  const [stream, setStream] = useState(null);
  const [detectedProfile, setDetectedProfile] = useState(null);
  const [personDetected, setPersonDetected] = useState(false);
  const [entertainmentPhase, setEntertainmentPhase] = useState('detecting');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const detectionInterval = useRef(null);

  useEffect(() => {
    if (cameraPermission === 'granted') {
      startCamera();
    }
  }, [cameraPermission]);
  

  useEffect(() => {
    initializeModels();
    startEntertainmentSequence();

    return () => {
      if (detectionInterval.current) clearInterval(detectionInterval.current);
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeModels = async () => {
    try {
      console.log('🧠 Loading face-api.js models...');
      setModelStatus('loading');

      const success = await clientSideFaceAnalysisService.initialize();

      if (success) {
        setModelStatus('ready');
        console.log('✅ Face-api.js models loaded successfully!');
      } else {
        setModelStatus('error');
        console.error('❌ Failed to load face-api.js models');
      }

    } catch (error) {
      console.error('❌ Model loading failed:', error);
      setModelStatus('error');
    }
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });

      setStream(mediaStream);
      setCameraPermission('granted');

      if (videoRef.current) videoRef.current.srcObject = mediaStream;

      console.log('🎥 Camera started successfully');
    } catch (error) {
      console.error('❌ Camera access denied:', error);
      setCameraPermission('denied');
    }
  };

  // Live continuous emotion + age group detection
  useEffect(() => {
    if (stream && modelStatus === 'ready') {
      setEntertainmentPhase('analyzing');

      detectionInterval.current = setInterval(async () => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (video.videoWidth === 0 || video.videoHeight === 0) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);

        const result = await analyzeFrame(canvas);

        if (result && result.success) {
          setPersonDetected(true);
          setDetectedProfile({
            emotion: result.emotion,
            emotionConfidence: result.emotionConfidence,
            allEmotions: result.allEmotions,
            ageGroup: result.ageGroup, // adult/child
            timestamp: result.timestamp
          });
        } else {
          setPersonDetected(false);
          setDetectedProfile({
            emotion: 'No face',
            emotionConfidence: 0,
            allEmotions: {},
            ageGroup: 'Unknown',
            timestamp: new Date().toISOString()
          });
        }
      }, 1000);
    }

    return () => {
      if (detectionInterval.current) clearInterval(detectionInterval.current);
    };
  }, [stream, modelStatus]);

  const analyzeFrame = async (canvas) => {
    try {
      if (modelStatus !== 'ready') throw new Error('Models not ready');

      const result = await clientSideFaceAnalysisService.analyzeFaceFromImage(canvas);

      if (result && result.success && result.predictions?.face_analysis?.detections_count > 0) {
        const ageValue = result.predictions.age.value;
        const ageGroup = ageValue < 18 ? 'Child' : 'Adult';

        return {
          success: true,
          emotion: result.predictions.emotion.label,
          emotionConfidence: (result.predictions.emotion.confidence || 0) / 100,
          allEmotions: Object.fromEntries(Object.entries(result.predictions.all_emotions || {}).map(([k, v]) => [k, v])),
          ageGroup: ageGroup,
          timestamp: new Date().toISOString()
        };
      }

      return { success: false };
    } catch (err) {
      console.error('Analysis error:', err);
      return { success: false };
    }
  };

  const startEntertainmentSequence = async () => {
    console.log('🎭 Starting entertainment sequence...');
    await startCamera();
    
    // After camera warms up, start detection
    setTimeout(() => {
      setEntertainmentPhase('analyzing'); // UI shows "Analyzing..." immediately // ✅ this will trigger your useEffect
    }, 800);
  };


  const handleUploadPhoto = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = async () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const result = await analyzeFrame(canvas);
        if (result && result.success) {
          setDetectedProfile({
            emotion: result.emotion,
            emotionConfidence: result.emotionConfidence,
            allEmotions: result.allEmotions,
            ageGroup: result.ageGroup,
            timestamp: result.timestamp
          });
          setPersonDetected(true);
        }
      };

      img.src = URL.createObjectURL(file);
    };

    input.click();
  };

  const handleReset = () => {
    if (detectionInterval.current) clearInterval(detectionInterval.current);
    if (stream) stream.getTracks().forEach(track => track.stop());

    setStream(null);
    setDetectedProfile(null);
    setPersonDetected(false);
    setEntertainmentPhase('detecting');

    startEntertainmentSequence();
  };

  if (cameraPermission === null) {
    return (
      <div className="ai-vision-container permission-container">
        <button className="back-button" onClick={() => navigate('/')}> <ArrowLeft size={20} /> Back</button>
        <div className="permission-content">
          <Camera size={60} />
          <h2>Camera Permission Required</h2>
          <p>We need camera access to provide live emotion and age detection.</p>
          <button className="permission-button" onClick={startCamera}>Grant Permission</button>
          <button className="skip-button" onClick={() => setCameraPermission('denied')}>Skip for now</button>
        </div>
      </div>
    );
  }

  if (cameraPermission === 'denied') {
    return (
      <div className="ai-vision-container permission-container">
        <button className="back-button" onClick={() => navigate('/')}> <ArrowLeft size={20} /> Back</button>
        <div className="permission-content">
          <Shield size={60} />
          <h2>Camera Access Denied</h2>
          <p>You can still upload a photo for emotion and age detection or continue without it.</p>
          <button className="upload-button" onClick={handleUploadPhoto}><Upload size={20} /> Upload Photo</button>
          <button className="skip-button" onClick={() => navigate('/')}>Continue Without Analysis</button>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-vision-container main-container">
      <div className="header-with-back">
        <button className="back-button" onClick={() => navigate('/')}> <ArrowLeft size={20} /> Back</button>
        <div className="ai-header">
          <div className="ai-eye-container"><Eye size={40} /></div>
          <h1>AI Vision — Live Emotion & Age</h1>
          <p>{entertainmentPhase === 'detecting' ? 'Scanning for visitors...' : 'Live emotion and age detection running'}</p>
          <div className="status-section">
            <div className="status-row">
              <div className={`status-dot ${personDetected ? 'green' : 'yellow'}`} />
              <span>{personDetected ? 'Person Detected' : 'Waiting for visitor...'}</span>
            </div>
            <div className="status-row">
              <div className={`status-dot ${modelStatus === 'ready' ? 'green' : 'yellow'}`} />
              <span>{modelStatus === 'ready' ? 'Model ready' : 'Loading models...'}</span>
            </div>
            <div className="live-profile">
        <h3>Live Detected Emotion & Age</h3>
        {detectedProfile ? (
          <div className="profile-card">
            <div className="profile-row"><Smile size={18} /><span>Emotion: {detectedProfile.emotion}</span></div>
            <div className="profile-row"><User size={18} /><span>Confidence: {(detectedProfile.emotionConfidence || 0).toFixed(2)}</span></div>
            <div className="profile-row"><User size={18} /><span>Age Group: {detectedProfile.ageGroup}</span></div>
            <div className="profile-row"><span>Timestamp: {detectedProfile.timestamp}</span></div>
          </div>
        ) : (
          <p>No detection yet.</p>
        )}
      </div>
          </div>
        </div>
      </div>

      <Hologram emotion={detectedProfile?.emotion} />

      <div className="camera-container">
        <div className="camera-frame">
          <video ref={videoRef} autoPlay playsInline muted className="camera-video" onLoadedMetadata={() => console.log('🎥 Camera ready')} />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
      </div>
    </div>
  );
}
