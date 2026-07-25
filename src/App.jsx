import React, { useEffect, useState } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import AiText from './ai-text.jsx';
import AIVision from './components/AIVision.jsx'; // New web-compatible AI Vision component
import AiExhibit from './ai-exhibit.jsx';
import AiVisionTest from './ai-vision-test.jsx';
import ClientSideAIInterface from './components/ClientSideAIInterface.jsx';
import FaceApiInterface from './components/FaceApiInterface.jsx';
import ClientSideFaceAnalysis from './ClientSideFaceAnalysis.jsx';

function LandingPage() {
  const navigate = useNavigate();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleGetStarted = () => {
    navigate('/machine-vision');
  };

  const handleExhibitVision = () => {
    navigate('/machine-vision-exhibit');
  };

  if (!isReady) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(90deg, #FF6B35, #FF8C42)'
      }}>
        <span style={{ color: 'white', fontSize: 24 }}>Loading...</span>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(90deg, #FF6B35, #FF8C42)'
    }}>
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
          color: 'white',
          fontSize: 32,
          fontWeight: 'bold',
          marginTop: 20,
          textShadow: '0 2px 4px rgba(0,0,0,0.3)'
        }}>Singapore Science Centre</h1>
        <h2 style={{
          color: 'rgba(255,255,255,0.95)',
          fontSize: 18,
          marginTop: 12,
          fontWeight: 500,
          textShadow: '0 1px 3px rgba(0,0,0,0.2)'
        }}>Interactive AI Vision Experience</h2>
        <button
          onClick={handleGetStarted}
          style={{
            background: 'rgba(255,255,255,0.25)',
            padding: '18px 40px',
            borderRadius: 35,
            border: '2px solid rgba(255,255,255,0.4)',
            color: 'white',
            fontSize: 18,
            fontWeight: 700,
            marginTop: 60,
            cursor: 'pointer',
            boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
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
            border: '2px solid rgba(255,255,255,0.4)',
            color: '#FF6B35',
            fontSize: 18,
            fontWeight: 700,
            marginTop: 16,
            cursor: 'pointer',
            boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
            display: 'block',
            marginLeft: 'auto',
            marginRight: 'auto'
          }}
        >
          Exhibit Detection
        </button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/ai-text" element={<AiText />} />
      <Route path="/machine-vision" element={<AIVision />} />
      <Route path="/machine-vision-exhibit" element={<AiExhibit />} />
      <Route path="/test" element={<AiVisionTest />} />
      <Route path="/client-ai" element={<ClientSideAIInterface />} />
      <Route path="/face-api" element={<FaceApiInterface />} />
      <Route path="/client-side-face-analysis" element={<ClientSideFaceAnalysis />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
