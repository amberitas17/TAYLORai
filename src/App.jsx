import React, { useEffect, useState } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { handleSpeechInteraction, textToSpeech } from './services/speechAPI.js';
import AiText from './ai-text.jsx';
import AIVision from './components/AIVision.jsx'; // New web-compatible AI Vision component
import AiExhibit from './ai-exhibit.jsx';
import AiVisionTest from './ai-vision-test.jsx';
import ClientSideAIInterface from './components/ClientSideAIInterface.jsx';
import FaceApiInterface from './components/FaceApiInterface.jsx';
import ClientSideFaceAnalysis from './ClientSideFaceAnalysis.jsx';
import Hologram from './hologram.jsx';
import HomePage from './HomePage.jsx';
import TaylorDashboard from './TaylorDashboard.jsx';

function LandingPage() {
  const navigate = useNavigate();
  const [isReady, setIsReady] = useState(false);
  const [guestProfile, setGuestProfile] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    try {
      const storedProfile = localStorage.getItem('firstDetectedEmotionAge');
      if (storedProfile) {
        const parsed = JSON.parse(storedProfile);
        setGuestProfile(parsed);

        handleSpeechInteraction();
        textToSpeech(`Welcome to the exhibition. I detected a ${parsed.emotion || 'friendly'} mood. Let us begin the experience.`, false, 'taylor', 'en');
      }
    } catch (error) {
      console.error('Unable to load guest profile:', error);
    }
  }, []);

  const handleGetStarted = () => {
    navigate('/machine-vision');
  };

  const handleExhibitVision = () => {
    navigate('/machine-vision-exhibit');
  };

  const handleResetWelcome = () => {
    localStorage.removeItem('firstDetectedEmotionAge');
    setGuestProfile(null);
  };

  if (!isReady) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #eaf6ff 0%, #d9ecff 100%)'
      }}>
        <span style={{ color: '#12324a', fontSize: 24 }}>Loading...</span>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #eaf6ff 0%, #d9ecff 100%)',
      padding: 24
    }}>
      {guestProfile ? (
        <div style={{ textAlign: 'center', width: '100%', maxWidth: 860 }}>
          <div style={{
            background: 'rgba(255,255,255,0.95)',
            borderRadius: 32,
            padding: 28,
            boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16
          }}>
            <Hologram emotion={guestProfile.emotion || 'happy'} isAnimating={true} spokenText={`Welcome! I detected a ${guestProfile.emotion || 'friendly'} mood.`} />
            <h2 style={{ margin: 0, color: '#12324a', fontSize: 28 }}>Welcome, Guest!</h2>
            <p style={{ margin: 0, color: '#345d7a', fontSize: 18, lineHeight: 1.5 }}>
              The AI avatar detected your {guestProfile.emotion || 'friendly'} mood and is ready to entertain you.
            </p>
            <button
              onClick={handleResetWelcome}
              style={{
                background: '#4a90d9',
                color: 'white',
                border: 'none',
                borderRadius: 999,
                padding: '12px 24px',
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Back to Home
            </button>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 160,
            height: 160,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.95)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 30px auto',
            boxShadow: '0 8px 16px rgba(0,0,0,0.3)'
          }}>
            <img src="/logo.png" alt="Logo" style={{ width: 100, height: 100 }} />
          </div>
          <h1 style={{
            color: '#12324a',
            fontSize: 32,
            fontWeight: 'bold',
            marginTop: 20,
            textShadow: 'none'
          }}>Singapore Science Centre</h1>
          <h2 style={{
            color: '#345d7a',
            fontSize: 18,
            marginTop: 12,
            fontWeight: 500,
            textShadow: 'none'
          }}>Interactive AI Vision Experience</h2>
          <button
            onClick={handleGetStarted}
            style={{
              background: '#4a90d9',
              padding: '18px 40px',
              borderRadius: 35,
              border: '2px solid #4a90d9',
              color: 'white',
              fontSize: 18,
              fontWeight: 700,
              marginTop: 60,
              cursor: 'pointer',
              boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
              display: 'block',
              marginLeft: 'auto',
              marginRight: 'auto'
            }}
          >
            Emotion Detection
          </button>

          <button
            onClick={handleExhibitVision}
            style={{
              background: 'rgba(255,255,255,0.95)',
              padding: '18px 40px',
              borderRadius: 35,
              border: '2px solid #8ec5ff',
              color: '#2f6fa3',
              fontSize: 18,
              fontWeight: 700,
              marginTop: 16,
              cursor: 'pointer',
              boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
              display: 'block',
              marginLeft: 'auto',
              marginRight: 'auto'
            }}
          >
            Exhibit Detection
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/taylor" element={<TaylorDashboard />} />
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/ai-text" element={<AiText />} />
      <Route path="/machine-vision" element={<AIVision />} />
      <Route path="/machine-vision-exhibit" element={<AiExhibit classifierMode="recon" />} />
      <Route path="/machine-vision-recon" element={<AiExhibit classifierMode="recon" />} />
      <Route path="/machine-vision-exhibit-aricc" element={<AiExhibit classifierMode="aricc" />} />
      <Route path="/machine-vision-aricc" element={<AiExhibit classifierMode="aricc" />} />
      <Route path="/test" element={<AiVisionTest />} />
      <Route path="/client-ai" element={<ClientSideAIInterface />} />
      <Route path="/face-api" element={<FaceApiInterface />} />
      <Route path="/client-side-face-analysis" element={<ClientSideFaceAnalysis />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
