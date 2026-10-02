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
  const streamRef = useRef(null);
  const isProcessingRef = useRef(false);
  const inferenceCancelledRef = useRef(false);
  const lastAgeAtRef = useRef(0);
  const ageHistoryRef = useRef([]);
  const emotionCandidateRef = useRef({ label: '', count: 0 });
  const latestProfileRef = useRef(null);
  const faceCropCanvasRef = useRef(null);
  const inferenceCountRef = useRef(0);
  const inferenceWindowStartedRef = useRef(performance.now());

  useEffect(() => {
    initializeModels();
    startEntertainmentSequence();

    return () => {
      if (detectionInterval.current) clearInterval(detectionInterval.current);
      inferenceCancelledRef.current = true;
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
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
      streamRef.current = mediaStream;
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

  const createFaceCrop = (sourceCanvas, box) => {
    if (!box) return null;
    const cropCanvas = faceCropCanvasRef.current || document.createElement('canvas');
    faceCropCanvasRef.current = cropCanvas;
    const padding = Math.max(box.width, box.height) * 0.2;
    const x = Math.max(0, box.x - padding);
    const y = Math.max(0, box.y - padding);
    const width = Math.min(sourceCanvas.width - x, box.width + padding * 2);
    const height = Math.min(sourceCanvas.height - y, box.height + padding * 2);
    cropCanvas.width = 128;
    cropCanvas.height = 128;
    cropCanvas.getContext('2d').drawImage(sourceCanvas, x, y, width, height, 0, 0, 128, 128);
    return cropCanvas;
  };

  const applySmoothedResult = (result, ageValue) => {
    const emotion = result.emotion;
    const candidate = emotionCandidateRef.current;
    if (candidate.label === emotion) candidate.count += 1;
    else emotionCandidateRef.current = { label: emotion, count: 1 };

    const stableEmotion = emotionCandidateRef.current.count >= 2
      ? emotion
      : latestProfileRef.current?.emotion || emotion;
    const profile = {
      emotion: stableEmotion,
      emotionConfidence: result.emotionConfidence,
      allEmotions: result.allEmotions,
      ageGroup: ageValue === undefined ? (latestProfileRef.current?.ageGroup || 'Unknown') : ageValue < 18 ? 'Child' : ageValue < 65 ? 'Adult' : 'Senior',
      age: ageValue === undefined ? latestProfileRef.current?.age : ageValue,
      timestamp: new Date().toISOString()
    };
    latestProfileRef.current = { ...latestProfileRef.current, ...profile };
    setDetectedProfile(prev => ({ ...prev, ...profile }));
    setPersonDetected(true);
    localStorage.setItem('latestDetectedEmotionAge', JSON.stringify(profile));
    return profile;
  };

  const analyzeFrame = async (canvas) => {
    const totalStartedAt = performance.now();
    const result = await clientSideFaceAnalysisService.analyzeFaceFromImage(canvas, {
      includeAge: false,
      retryOnMiss: false,
      inputSize: 224,
      scoreThreshold: 0.3
    });
    const faceDetectionTime = performance.now() - totalStartedAt;
    let ageValue;
    let ageInferenceTime = 0;

    if (result?.success && performance.now() - lastAgeAtRef.current >= 1500) {
      const faceCrop = createFaceCrop(canvas, result.predictions.face_analysis.box);
      if (faceCrop) {
        const ageStartedAt = performance.now();
        const ageResult = await clientSideFaceAnalysisService.analyzeFaceFromImage(faceCrop, {
          includeAge: true,
          retryOnMiss: false,
          inputSize: 128,
          scoreThreshold: 0.25
        });
        ageInferenceTime = performance.now() - ageStartedAt;
        lastAgeAtRef.current = performance.now();
        if (ageResult?.success && Number.isFinite(ageResult.predictions.age.value)) {
          ageHistoryRef.current = [...ageHistoryRef.current, ageResult.predictions.age.value].slice(-3);
          const sortedAges = [...ageHistoryRef.current].sort((a, b) => a - b);
          ageValue = sortedAges[Math.floor(sortedAges.length / 2)];
        }
      }
    }

    const totalInferenceTime = performance.now() - totalStartedAt;
    inferenceCountRef.current += 1;
    const elapsed = performance.now() - inferenceWindowStartedRef.current;
    const inferenceFPS = elapsed >= 1000 ? (inferenceCountRef.current * 1000) / elapsed : 0;
    console.log({
      faceDetectionTime: Math.round(faceDetectionTime),
      emotionInferenceTime: Math.round(faceDetectionTime),
      ageInferenceTime: Math.round(ageInferenceTime),
      totalInferenceTime: Math.round(totalInferenceTime),
      inferenceFPS: Number(inferenceFPS.toFixed(2))
    });
    if (elapsed >= 1000) {
      inferenceCountRef.current = 0;
      inferenceWindowStartedRef.current = performance.now();
    }
    return { result, ageValue };
  };

  // Live continuous emotion + age group detection
  useEffect(() => {
    inferenceCancelledRef.current = false;
    let runInference;
    if (stream && modelStatus === 'ready' && !document.hidden) {
      if (!isGreeting) {
        setEntertainmentPhase('analyzing');
      }

      runInference = async () => {
        if (inferenceCancelledRef.current || document.hidden || isProcessingRef.current || !videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        if (video.videoWidth === 0 || video.videoHeight === 0) return;
        isProcessingRef.current = true;
        try {
          const canvas = canvasRef.current;
          canvas.width = 224;
          canvas.height = 224;
          canvas.getContext('2d').drawImage(video, 0, 0, 224, 224);
          const { result, ageValue } = await analyzeFrame(canvas);
          if (!inferenceCancelledRef.current && result?.success) {
            const profile = applySmoothedResult({
              emotion: result.predictions.emotion.label,
              emotionConfidence: (result.predictions.emotion.confidence || 0) / 100,
              allEmotions: result.predictions.all_emotions || {}
            }, ageValue);

            if (!hasWelcomedRef.current) {
              localStorage.setItem('firstDetectedEmotionAge', JSON.stringify(profile));
              navigate('/taylor', { replace: true, state: { detectedProfile: profile } });
              speakWelcomeOnce();
            }
          }
        } catch (error) {
          if (!inferenceCancelledRef.current) console.error('Analysis error:', error);
        } finally {
          isProcessingRef.current = false;
        }
      };

      detectionInterval.current = setInterval(runInference, 400);
      runInference();
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        inferenceCancelledRef.current = true;
        if (detectionInterval.current) clearInterval(detectionInterval.current);
        detectionInterval.current = null;
      } else if (stream && modelStatus === 'ready') {
        inferenceCancelledRef.current = false;
        if (runInference && !detectionInterval.current) {
          detectionInterval.current = setInterval(runInference, 400);
          runInference();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      inferenceCancelledRef.current = true;
      if (detectionInterval.current) clearInterval(detectionInterval.current);
      detectionInterval.current = null;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [stream, modelStatus, isGreeting]);

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

        const result = await clientSideFaceAnalysisService.analyzeFaceFromImage(canvas, {
          includeAge: true,
          retryOnMiss: true,
          inputSize: 224,
          scoreThreshold: 0.25
        });
        if (result && result.success && result.predictions?.face_analysis?.detections_count > 0) {
          setDetectedProfile({
            emotion: result.predictions.emotion.label,
            emotionConfidence: (result.predictions.emotion.confidence || 0) / 100,
            allEmotions: result.predictions.all_emotions,
            ageGroup: result.predictions.age.group,
            timestamp: new Date().toISOString()
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
