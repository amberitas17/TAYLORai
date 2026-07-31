import React, { useState, useEffect, useRef } from 'react';
import { Camera, Shield, User, Smile, Upload, Eye, Zap, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import clientSideFaceAnalysisService from '../services/clientSideFaceAnalysis.js';
import { handleSpeechInteraction, textToSpeech } from '../services/speechAPI.js';
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
  const [isGreeting, setIsGreeting] = useState(false);
  const [avatarSpeaking, setAvatarSpeaking] = useState(false);
  const [welcomeDone, setWelcomeDone] = useState(false);
  const [flowError, setFlowError] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const detectionInterval = useRef(null);
  const hasWelcomedRef = useRef(false);

  useEffect(() => {
    initializeModels();
    startEntertainmentSequence();

    return () => {
      if (detectionInterval.current) clearInterval(detectionInterval.current);
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!stream || !videoRef.current) return;

    videoRef.current.srcObject = stream;
    videoRef.current.muted = true;
    videoRef.current.playsInline = true;

    videoRef.current.play().catch((error) => {
      console.error('Unable to start video playback:', error);
      setFlowError('Camera stream connected, but the video could not start automatically.');
    });
  }, [stream]);

  const initializeModels = async () => {
    try {
      console.log('🧠 Loading face-api.js models...');
      setModelStatus('loading');
      setFlowError('');

      const success = await clientSideFaceAnalysisService.initialize();

      if (success) {
        setModelStatus('ready');
        console.log('✅ Face-api.js models loaded successfully!');
      } else {
        setModelStatus('error');
        setFlowError('Detection models failed to load.');
        console.error('❌ Failed to load face-api.js models');
      }

    } catch (error) {
      console.error('❌ Model loading failed:', error);
      setModelStatus('error');
      setFlowError('Unable to initialize detection models.');
    }
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraPermission('denied');
      setFlowError('This browser does not support camera access.');
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });

      setStream(mediaStream);
      setCameraPermission('granted');
      setFlowError('');

      console.log('🎥 Camera started successfully');
    } catch (error) {
      console.error('❌ Camera access denied:', error);
      setCameraPermission('denied');

      if (error.name === 'NotAllowedError') {
        setFlowError('Camera permission was blocked. Please allow camera access and try again.');
      } else if (error.name === 'NotFoundError') {
        setFlowError('No camera device was found on this machine.');
      } else {
        setFlowError('Camera access is required for emotion detection.');
      }
    }
  };

  const speakWelcomeOnce = () => {
    if (hasWelcomedRef.current) return;

    hasWelcomedRef.current = true;
    setIsGreeting(true);
    setAvatarSpeaking(true);
    setEntertainmentPhase('greeting');

    const fallbackComplete = () => {
      setIsGreeting(false);
      setAvatarSpeaking(false);
      setWelcomeDone(true);
      setEntertainmentPhase('analyzing');
    };

    const text = 'Welcome to Bulacan State University.';
    handleSpeechInteraction();
    textToSpeech(text, false, 'taylor', 'en').then(() => fallbackComplete()).catch(() => fallbackComplete());
  };

  // Live continuous emotion + age group detection
  useEffect(() => {
    if (stream && modelStatus === 'ready') {
      if (!isGreeting) {
        setEntertainmentPhase('analyzing');
      }

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
          const profile = {
            emotion: result.emotion,
            emotionConfidence: result.emotionConfidence,
            allEmotions: result.allEmotions,
            ageGroup: result.ageGroup, // adult/child
            timestamp: result.timestamp
          };

          setDetectedProfile(profile);
          localStorage.setItem('latestDetectedEmotionAge', JSON.stringify(profile));

          if (!hasWelcomedRef.current) {
            const profileWithAge = {
              ...profile,
              age: result.age,
              emotion: result.emotion
            };

            localStorage.setItem('firstDetectedEmotionAge', JSON.stringify(profileWithAge));
            navigate('/taylor', { replace: true, state: { detectedProfile: profileWithAge } });
            speakWelcomeOnce();
          }
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
  }, [stream, modelStatus, isGreeting]);

  const analyzeFrame = async (canvas) => {
    try {
      if (modelStatus !== 'ready') throw new Error('Models not ready');

      const result = await clientSideFaceAnalysisService.analyzeFaceFromImage(canvas);

      if (result && result.success && result.predictions?.face_analysis?.detections_count > 0) {
        const ageValue = result.predictions.age.value;
        const ageGroup = ageValue < 18 ? 'Child' : 'Adult';

        return {
          success: true,
          age: ageValue,
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
    window.speechSynthesis?.cancel();

    setStream(null);
    setDetectedProfile(null);
    setPersonDetected(false);
    setEntertainmentPhase('detecting');
    setIsGreeting(false);
    setWelcomeDone(false);
    setFlowError('');
    hasWelcomedRef.current = false;

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
          <p>
            {entertainmentPhase === 'detecting' && 'Detecting emotion...'}
            {entertainmentPhase === 'greeting' && 'Emotion detected. Greeting visitor...'}
            {entertainmentPhase === 'analyzing' && 'Live emotion and age detection running'}
          </p>
          {flowError && <p style={{ color: '#e53935', fontWeight: 600 }}>{flowError}</p>}
          {welcomeDone && <p style={{ color: '#2e7d32', fontWeight: 600 }}>Welcome greeting completed.</p>}
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

      <Hologram emotion={detectedProfile?.emotion} isAnimating={isGreeting || avatarSpeaking} spokenText={'Welcome to Bulacan State University.'} poseMode="wave" assetPreset="avatar" />

      <div className="camera-container">
        <div className="camera-frame">
          <video ref={videoRef} autoPlay playsInline muted className="camera-video" onLoadedMetadata={() => console.log('🎥 Camera ready')} />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
      </div>
    </div>
  );
}
