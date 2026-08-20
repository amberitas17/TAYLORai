import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import clientSideFaceAnalysisService from './services/clientSideFaceAnalysis.js';
import { handleSpeechInteraction, textToSpeech } from './services/speechAPI.js';
import Hologram from './hologram.jsx';
import './HomePage.css';

const suggestionItems = [
  { key: 'bulsu', label: 'What is BulSU?', answer: 'Bulacan State University is a premier public university in the Philippines, known for academic excellence, innovation, and service to the community.' },
  { key: 'aricc', label: 'What is ARICC?', answer: 'What is ARICC?' },
  { key: 'programs', label: 'Academic Programs', answer: 'BulSU offers strong programs in engineering, education, business, health sciences, information technology, and the arts.' },
  { key: 'facilities', label: 'Campus Facilities', answer: 'BulSU provides modern classrooms, libraries, laboratories, innovation spaces, student centers, and smart campus facilities.' },
  { key: 'research', label: 'Research and Innovation', answer: 'BulSU supports impactful research through laboratories, industry partnerships, technology transfer, and community-driven innovation.' },
  { key: 'services', label: 'Student Services', answer: 'Student services include academic advising, counseling, wellness support, scholarships, and campus engagement programs.' },
  { key: 'scholarships', label: 'Scholarships', answer: 'BulSU offers scholarship and financial assistance opportunities to support deserving students in their academic journey.' },
  { key: 'voice', label: 'Start Voice Conversation', answer: 'I am TAYLOR and I am ready to assist you. You may ask me about BulSU, ARICC, programs, research, facilities, or student services.' }
];

const getInitialSessionContext = () => {
  if (typeof window === 'undefined') return null;

  try {
    const saved = window.sessionStorage.getItem('aiGuideSessionContext');
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.error('Unable to restore session context:', error);
    return null;
  }
};

export default function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [phase, setPhase] = useState('idle');
  const [statusMessage, setStatusMessage] = useState('Initializing TAYLOR...');
  const [sessionContext, setSessionContext] = useState(getInitialSessionContext);
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false);
  const [messages, setMessages] = useState([
    { speaker: 'guide', text: 'Hello! I am TAYLOR. Start the experience so I can personalize your visit to BulSU.' }
  ]);
  const [greetingShown, setGreetingShown] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem('aiGuideGreetingShown') === 'true';
  });

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    const routeProfile = location.state?.detectedProfile;
    if (!routeProfile) return;

    const context = {
      age: routeProfile.age ?? (routeProfile.ageGroup === 'Child' ? 16 : 25),
      initialEmotion: routeProfile.emotion || 'Neutral',
      timestamp: routeProfile.timestamp || new Date().toISOString(),
      initialized: true
    };

    persistContext(context);
    setPhase('ready');
    setStatusMessage('TAYLOR is ready.');

    if (!greetingShown) {
      window.sessionStorage.setItem('aiGuideGreetingShown', 'true');
      setGreetingShown(true);
      const greeting = `Welcome to Bulacan State University. I am TAYLOR, your AI hologram guide. I estimate that you are approximately ${context.age} years old. Your initial emotion appears to be ${context.initialEmotion}. I am here to help you explore Bulacan State University and the Academic Research Innovation and Commercialization Center, known as ARICC. You may ask me about our programs, facilities, innovations, research projects, student services, and university achievements. How may I assist you today?`;
      speak(greeting);
      setMessages([
        { speaker: 'guide', text: 'Welcome to Bulacan State University.' },
        { speaker: 'guide', text: `I am TAYLOR, your AI hologram guide.` },
        { speaker: 'guide', text: `I estimate that you are approximately ${context.age} years old.` },
        { speaker: 'guide', text: `Your initial emotion appears to be ${context.initialEmotion}.` },
        { speaker: 'guide', text: 'I am here to assist you with BulSU and ARICC. Ask me about programs, facilities, research, student services, and more.' }
      ]);
    }
  }, [location.state]);

  const persistContext = (context) => {
    const safeContext = {
      age: context.age,
      emotion: context.initialEmotion,
      initialEmotion: context.initialEmotion,
      timestamp: context.timestamp,
      initialized: true
    };

    setSessionContext(safeContext);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('aiGuideSessionContext', JSON.stringify(safeContext));
      window.localStorage.setItem('firstDetectedEmotionAge', JSON.stringify(safeContext));
    }
  };

  const speak = (text) => {
    setIsAvatarSpeaking(true);
    handleSpeechInteraction();
    textToSpeech(text, false, 'taylor', 'en').finally(() => setIsAvatarSpeaking(false));
  };

  const handleStartGuide = () => {
    navigate('/machine-vision');
  };

  const handleExhibitDetection = () => {
    navigate('/machine-vision-exhibit');
  };

  const handleStartGuideLegacy = async () => {
    if (phase === 'detecting') return;

    setPhase('detecting');
    setStatusMessage('Activating camera and preparing your ARICC guide...');

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('This browser does not support camera access.');
      }

      const modelsReady = await clientSideFaceAnalysisService.initialize();
      if (!modelsReady) {
        throw new Error('AI models are still loading. Please try again in a moment.');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });

      streamRef.current = mediaStream;

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        await videoRef.current.play().catch(() => {});
      }

      setStatusMessage('Scanning your face to estimate age and emotion...');
      await new Promise((resolve) => setTimeout(resolve, 1200));

      if (!videoRef.current || videoRef.current.videoWidth === 0) {
        throw new Error('Camera preview is not ready yet.');
      }

      const canvas = document.createElement('canvas');
      const video = videoRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const result = await clientSideFaceAnalysisService.analyzeFaceFromImage(canvas);
      if (!result?.success || !result.predictions?.age?.value) {
        throw new Error('No face detected. Please position yourself in front of the camera.');
      }

      const age = Math.round(result.predictions.age.value);
      const initialEmotion = result.predictions.emotion.label || 'Neutral';
      const context = {
        age,
        initialEmotion,
        timestamp: new Date().toISOString()
      };

      persistContext(context);

      setStatusMessage('Detection complete. Your AI hologram guide is ready.');
      setPhase('ready');

      if (!greetingShown) {
        window.sessionStorage.setItem('aiGuideGreetingShown', 'true');
        setGreetingShown(true);
        speak('Welcome to Bulacan State University. I am your AI Hologram Guide.');
      }

      setMessages([
        { speaker: 'guide', text: 'Welcome to Bulacan State University. I am your AI Hologram Guide.' },
        { speaker: 'guide', text: `I can see you as a ${age} year old guest with a ${initialEmotion.toLowerCase()} mood. Ask me about BulSU.` }
      ]);
    } catch (error) {
      console.error('Guide start failed:', error);
      setPhase('error');
      setStatusMessage(error.message || 'Unable to start the guide right now.');
    }
  };

  const handleSuggestion = (suggestion) => {
    const reply = suggestion.answer;
    setMessages((prev) => [
      ...prev,
      { speaker: 'user', text: suggestion.label },
      { speaker: 'guide', text: reply }
    ]);
    speak(reply);
  };

  const previewTitle = useMemo(() => {
    if (!sessionContext) return 'TAYLOR • BulSU ARICC Guide';
    return `TAYLOR READY`; 
  }, [sessionContext]);

  return (
    <div className="homepage-shell">
      <div className="homepage-panel">
        <section className="hero-section">
          <div className="hero-copy">
            <div className="eyebrow">Bulacan State University • ARICC Experience</div>
            <h1>TAYLOR</h1>
            <p className="hero-subtitle">Meet TAYLOR – Your AI-Powered BulSU Hologram Guide</p>
            <p>
              Experience an intelligent and personalized campus guide designed to introduce visitors to Bulacan State University and ARICC.
            </p>

            <div className="action-row">
              <button className="start-button" onClick={handleStartGuide}>
                Start AI Guide
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
