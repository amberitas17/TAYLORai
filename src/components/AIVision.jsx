import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { Camera, Shield, User, Smile, Upload, Eye, Zap, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import clientSideFaceAnalysisService from '../services/clientSideFaceAnalysis.js';
import { handleSpeechInteraction, textToSpeech } from '../services/speechAPI.js';
import avatarAssetService from '../services/avatarAssetService.js';
import './AIVision.css';
const Hologram = lazy(() => import('../../src/hologram.jsx'));

function getFaceStatusLabel(status, avatarReady) {
  if (['FACE_MODELS_READY', 'OFFLINE_FACE_MODELS_READY'].includes(status)) {
    if (!avatarReady) return 'Face analysis ready';
    return status === 'OFFLINE_FACE_MODELS_READY' ? 'Using offline AI' : 'AI Vision ready';
  }
  if (status === 'FACE_MODEL_DOWNLOAD_REQUIRED') return 'Connect once to prepare AI Vision for offline use';
  if (status === 'FACE_MODEL_ERROR') return 'Face analysis unavailable';
  return 'Preparing AI Vision...';
}

function getAvatarStatusLabel(status) {
  if (status === 'AVATAR_READY') return 'AI Vision ready';
  if (status === 'AVATAR_ERROR') return 'Avatar unavailable. AI Vision can still use the camera.';
  if (status === 'AVATAR_DOWNLOADING') return 'Preparing AI Vision...';
  return 'Preparing AI Vision...';
}

class AvatarErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    this.props.onError?.(error);
  }

  render() {
    return this.state.hasError
      ? <div className="avatar-placeholder">Avatar unavailable. AI Vision can still use the camera.</div>
      : this.props.children;
  }
}

export default function AIVision() {
  const navigate = useNavigate();
  const [cameraPermission, setCameraPermission] = useState(null);
  const [cameraStatus, setCameraStatus] = useState('CAMERA_INITIALIZING');
  const [modelStatus, setModelStatus] = useState('FACE_CACHE_CHECK');
  const [stream, setStream] = useState(null);
  const [detectedProfile, setDetectedProfile] = useState(null);
  const [personDetected, setPersonDetected] = useState(false);
  const [entertainmentPhase, setEntertainmentPhase] = useState('detecting');
  const [isGreeting, setIsGreeting] = useState(false);
  const [avatarSpeaking, setAvatarSpeaking] = useState(false);
  const [welcomeDone, setWelcomeDone] = useState(false);
  const [flowError, setFlowError] = useState('');
  const [lastInference, setLastInference] = useState({ status: 'STOPPED', time: 0, rate: 0 });
  const [inferenceState, setInferenceState] = useState('STOPPED');
  const [diagnosticsTick, setDiagnosticsTick] = useState(0);
  const [avatarState, setAvatarState] = useState('AVATAR_CACHE_CHECK');
  const [avatarAssetsReady, setAvatarAssetsReady] = useState(false);
  const [avatarDiagnostics, setAvatarDiagnostics] = useState(avatarAssetService.getDiagnostics());
  const faceDebugEnabled = new URLSearchParams(window.location.search).has('faceDebug');
  const aiVisionReady = ['FACE_MODELS_READY', 'OFFLINE_FACE_MODELS_READY'].includes(modelStatus) && avatarState === 'AVATAR_READY';

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const detectionInterval = useRef(null);
  const hasWelcomedRef = useRef(false);
  const streamRef = useRef(null);
  const isProcessingRef = useRef(false);
  const inferenceCancelledRef = useRef(false);
  const ageHistoryRef = useRef([]);
  const emotionCandidateRef = useRef({ label: '', count: 0 });
  const latestProfileRef = useRef(null);
  const inferenceCountRef = useRef(0);
  const inferenceWindowStartedRef = useRef(performance.now());

  useEffect(() => {
    initializeModels();
    startEntertainmentSequence();
    initializeAvatar();

    return () => {
      if (detectionInterval.current) clearInterval(detectionInterval.current);
      inferenceCancelledRef.current = true;
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeAvatar = async () => {
    setAvatarState('AVATAR_CACHE_CHECK');
    try {
      await avatarAssetService.initialize();
      setAvatarAssetsReady(true);
      setAvatarDiagnostics(avatarAssetService.getDiagnostics());
    } catch (error) {
      setAvatarState('AVATAR_ERROR');
      setAvatarDiagnostics(avatarAssetService.getDiagnostics());
      console.error('Avatar initialization failed:', error);
    }
  };

  const handleAvatarReady = useRef(() => {
    setAvatarState('AVATAR_READY');
    avatarAssetService.markFirstRender();
    setAvatarDiagnostics(avatarAssetService.getDiagnostics());
    setDiagnosticsTick((tick) => tick + 1);
  }).current;
  const handleAvatarError = useRef((error) => {
    setAvatarState('AVATAR_ERROR');
    setAvatarDiagnostics((previous) => ({ ...previous, error: error?.message || 'Avatar render failed.' }));
  }).current;

  useEffect(() => {
    if (!stream || !videoRef.current) return;

    videoRef.current.srcObject = stream;
    videoRef.current.muted = true;
    videoRef.current.playsInline = true;

    videoRef.current.play().then(() => {
      setCameraStatus('CAMERA_READY');
    }).catch((error) => {
      console.error('Unable to start video playback:', error);
      setCameraStatus('CAMERA_ERROR');
      setFlowError('Camera stream connected, but the video could not start automatically.');
    });
  }, [stream]);

  const initializeModels = async () => {
    try {
      console.log('🧠 Loading face-api.js models...');
      setModelStatus('FACE_CACHE_CHECK');
      setFlowError('');

      const success = await clientSideFaceAnalysisService.initialize();

      if (success) {
        setModelStatus(clientSideFaceAnalysisService.getModelStatus().state);
        console.log('✅ Face-api.js models loaded successfully!');
      } else {
        setModelStatus('FACE_MODEL_ERROR');
        setFlowError('Detection models failed to load.');
        console.error('❌ Failed to load face-api.js models');
      }

    } catch (error) {
      console.error('❌ Model loading failed:', error);
      const status = clientSideFaceAnalysisService.getModelStatus();
      setModelStatus(status.state || 'FACE_MODEL_ERROR');
      setFlowError(error?.code === 'FACE_MODEL_DOWNLOAD_REQUIRED'
        ? 'Connect once to prepare AI Vision for offline use.'
        : 'Face analysis is temporarily unavailable. The camera can still be used.');
    }
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraPermission('denied');
      setCameraStatus('CAMERA_ERROR');
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
      setCameraStatus('CAMERA_READY');
      setFlowError('');

      console.log('🎥 Camera started successfully');
    } catch (error) {
      console.error('❌ Camera access denied:', error);
      setCameraPermission('denied');
      setCameraStatus('CAMERA_ERROR');

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
      includeAge: true,
      retryOnMiss: false,
      inputSize: 224,
      scoreThreshold: 0.3
    });
    const faceDetectionTime = performance.now() - totalStartedAt;
    let ageValue;
    if (result?.success && Number.isFinite(result.predictions.age.value)) {
      ageHistoryRef.current = [...ageHistoryRef.current, result.predictions.age.value].slice(-3);
      const sortedAges = [...ageHistoryRef.current].sort((a, b) => a - b);
      ageValue = sortedAges[Math.floor(sortedAges.length / 2)];
    }

    const totalInferenceTime = performance.now() - totalStartedAt;
    inferenceCountRef.current += 1;
    const elapsed = performance.now() - inferenceWindowStartedRef.current;
    const inferenceFPS = elapsed >= 1000 ? (inferenceCountRef.current * 1000) / elapsed : 0;
    console.log({
      faceDetectionTime: Math.round(faceDetectionTime),
      emotionInferenceTime: Math.round(faceDetectionTime),
      ageInferenceTime: Math.round(faceDetectionTime),
      totalInferenceTime: Math.round(totalInferenceTime),
      inferenceFPS: Number(inferenceFPS.toFixed(2))
    });
    if (elapsed >= 1000) {
      inferenceCountRef.current = 0;
      inferenceWindowStartedRef.current = performance.now();
    }
    setLastInference({ status: 'RUNNING', time: totalInferenceTime, rate: inferenceFPS });
    setDiagnosticsTick((tick) => tick + 1);
    return { result, ageValue };
  };

  // Live continuous emotion + age group detection
  useEffect(() => {
    inferenceCancelledRef.current = false;
    let runInference;
    if (stream && ['FACE_MODELS_READY', 'OFFLINE_FACE_MODELS_READY'].includes(modelStatus) && !document.hidden) {
      if (!isGreeting) {
        setEntertainmentPhase('analyzing');
      }

      runInference = async () => {
        if (inferenceCancelledRef.current || document.hidden || isProcessingRef.current || !videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        if (video.videoWidth === 0 || video.videoHeight === 0) return;
        isProcessingRef.current = true;
        setInferenceState('FACE_INFERENCE_RUNNING');
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
          setInferenceState('STOPPED');
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
      } else if (stream && ['FACE_MODELS_READY', 'OFFLINE_FACE_MODELS_READY'].includes(modelStatus)) {
        inferenceCancelledRef.current = false;
        const track = streamRef.current?.getVideoTracks?.()[0];
        if (!track || track.readyState === 'ended') startCamera();
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
              <div className={`status-dot ${['FACE_MODELS_READY', 'OFFLINE_FACE_MODELS_READY'].includes(modelStatus) ? 'green' : modelStatus === 'FACE_MODEL_ERROR' || modelStatus === 'FACE_MODEL_DOWNLOAD_REQUIRED' ? 'red' : 'yellow'}`} />
              <span>{getFaceStatusLabel(modelStatus, aiVisionReady)}</span>
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

      <div className="avatar-stage">
        {avatarAssetsReady && avatarState !== 'AVATAR_ERROR' ? (
          <AvatarErrorBoundary onError={handleAvatarError}>
            <Suspense fallback={<div className="avatar-placeholder">Preparing AI Vision...</div>}>
              <Hologram onReady={handleAvatarReady} emotion={detectedProfile?.emotion} isAnimating={isGreeting || avatarSpeaking} spokenText={'Welcome to Bulacan State University.'} poseMode="wave" assetPreset="avatar" />
            </Suspense>
          </AvatarErrorBoundary>
        ) : (
          <div className="avatar-placeholder">{getAvatarStatusLabel(avatarState)}</div>
        )}
      </div>

      <div className="camera-container">
        <div className="camera-frame">
          <video ref={videoRef} autoPlay playsInline muted className="camera-video" onLoadedMetadata={() => console.log('🎥 Camera ready')} />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
      </div>
      {faceDebugEnabled && (
        <div data-testid="face-diagnostics" style={{
          position: 'fixed',
          right: 12,
          bottom: 12,
          zIndex: 100,
          maxWidth: 320,
          padding: '10px 12px',
          background: 'rgba(0, 0, 0, 0.82)',
          color: '#fff',
          borderRadius: 6,
          font: '11px/1.45 monospace'
        }}>
          <div>Device: {clientSideFaceAnalysisService.getDiagnostics().device}</div>
          <div>Camera: {cameraStatus}</div>
          <div>Face detector: {clientSideFaceAnalysisService.getDiagnostics().detector}</div>
          <div>Expression model: {clientSideFaceAnalysisService.getDiagnostics().expressionModel}</div>
          <div>Age model: {clientSideFaceAnalysisService.getDiagnostics().ageModel}</div>
          <div>Model source: {clientSideFaceAnalysisService.getDiagnostics().modelSource}</div>
          <div>Models load time: {Math.round(clientSideFaceAnalysisService.getDiagnostics().modelsLoadTime)} ms</div>
          <div>Inference: {inferenceState === 'FACE_INFERENCE_RUNNING' ? 'RUNNING' : 'STOPPED'}</div>
          <div>Last inference time: {Math.round(lastInference.time)} ms</div>
          <div>FPS/inference rate: {lastInference.rate.toFixed(2)}</div>
          <div>Last error: {clientSideFaceAnalysisService.getDiagnostics().lastError || 'None'}</div>
          <div>Avatar state: {avatarState}</div>
          <div>Avatar source: {avatarDiagnostics.source}</div>
          <div>Avatar download time: {Math.round(avatarDiagnostics.downloadTime)} ms</div>
          <div>Avatar initialization time: {Math.round(avatarDiagnostics.initializationTime)} ms</div>
          <div>Avatar first-render time: {Math.round(avatarDiagnostics.firstRenderTime)} ms</div>
          <div>Avatar cache hits/misses: {avatarDiagnostics.cacheHits}/{avatarDiagnostics.cacheMisses}</div>
          <div>Avatar error: {avatarDiagnostics.error || 'None'}</div>
          <div aria-hidden="true">refresh:{diagnosticsTick}</div>
        </div>
      )}
    </div>
  );
}
