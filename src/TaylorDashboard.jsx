import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Hologram from './hologram.jsx';
import { textToSpeech } from './services/speechAPI.js';
import './HomePage.css';

const API_URL = import.meta.env.VITE_NODEJS_API_URL || '';

const suggestionItems = [
  { key: 'bulsu', label: 'What is BulSU?', answer: 'Bulacan State University is a premier public university in the Philippines, known for academic excellence, innovation, and service to the community.' },
  { key: 'aricc', label: 'What is ARICC?', answer: 'ARICC is the Academic Research Innovation and Commercialization Center, where BulSU advances research, innovation, and partnerships.' },
  { key: 'programs', label: 'Academic Programs', answer: 'BulSU offers strong programs in engineering, education, business, health sciences, information technology, and the arts.' },
  { key: 'facilities', label: 'Campus Facilities', answer: 'BulSU provides modern classrooms, libraries, laboratories, innovation spaces, student centers, and smart campus facilities.' },
  { key: 'research', label: 'Research and Innovation', answer: 'BulSU supports impactful research through laboratories, industry partnerships, technology transfer, and community-driven innovation.' },
  { key: 'services', label: 'Student Services', answer: 'Student services include academic advising, counseling, wellness support, scholarships, and campus engagement programs.' },
  { key: 'scholarships', label: 'Scholarships', answer: 'BulSU offers scholarship and financial assistance opportunities to support deserving students in their academic journey.' }
];

const getSessionContext = () => {
  if (typeof window === 'undefined') return null;
  try {
    const saved = window.sessionStorage.getItem('taylorSessionContext');
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    return null;
  }
};

export default function TaylorDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sessionContext, setSessionContext] = useState(getSessionContext);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [speechText, setSpeechText] = useState('');
  const [greetingPlayed, setGreetingPlayed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem('taylorGreetingPlayed') === 'true';
  });

  useEffect(() => {
    const profile = location.state?.detectedProfile || getSessionContext();
    if (!profile) return;

    const context = {
      age: profile.age ?? 20,
      emotion: profile.emotion || profile.initialEmotion || 'Neutral',
      timestamp: profile.timestamp || new Date().toISOString(),
      initialized: true
    };

    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('taylorSessionContext', JSON.stringify(context));
      window.localStorage.setItem('firstDetectedEmotionAge', JSON.stringify(context));
    }

    setSessionContext(context);

    if (!greetingPlayed && typeof window !== 'undefined') {
      window.sessionStorage.setItem('taylorGreetingPlayed', 'true');
      setGreetingPlayed(true);
      const greeting = `Welcome to Bulacan State University. I am TAYLOR, your AI hologram guide. I estimate that you are approximately ${context.age} years old. Your initial emotion appears to be ${context.emotion}. I am here to help you learn more about Bulacan State University and ARICC. How may I assist you today?`;
      speakWithPreferredVoice(greeting);
    }

    setMessages((prev) => {
      if (prev.length > 0) return prev;
      return [
        { speaker: 'guide', text: 'Welcome to Bulacan State University.' },
        { speaker: 'guide', text: `I am TAYLOR, your AI hologram guide.` },
        { speaker: 'guide', text: `I estimate that you are approximately ${context.age} years old.` },
        { speaker: 'guide', text: `Your initial emotion appears to be ${context.emotion}.` },
        { speaker: 'guide', text: 'How may I assist you today?' }
      ];
    });
  }, [location.state]);

  const speakWithPreferredVoice = (text) => {
    setSpeechText(text);
    setIsSpeaking(true);
    textToSpeech(text, false, 'taylor', 'en').finally(() => setIsSpeaking(false));
  };

  const handleSendMessage = async (overrideText) => {
    const text = (overrideText ?? inputText).trim();
    if (!text) return;

    const userMessage = { speaker: 'user', text };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInputText('');
    setIsThinking(true);

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...nextMessages.map(({ speaker, text }) => ({ role: speaker === 'user' ? 'user' : 'assistant', content: text }))] })
      });

      const data = await response.json();
      const reply = data.reply || 'I am TAYLOR and I am here to assist you.';
      setMessages((prev) => [...prev, { speaker: 'guide', text: reply }]);
      speakWithPreferredVoice(reply);
    } catch (error) {
      console.error('Chat request failed:', error);
      const fallback = 'I am sorry, I am having trouble responding right now.';
      setMessages((prev) => [...prev, { speaker: 'guide', text: fallback }]);
      speakWithPreferredVoice(fallback);
    } finally {
      setIsThinking(false);
    }
  };

  const handleSuggestion = (suggestion) => {
    handleSendMessage(suggestion.answer);
  };

  const handleExhibitDetection = () => {
    navigate('/machine-vision-exhibit');
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleIntroduceYourself = () => {
    const introText = 'Hello! I am TAYLOR, your AI hologram guide. I can help you explore Bulacan State University and ARICC. How may I assist you today?';
    setMessages((prev) => [
      ...prev,
      { speaker: 'user', text: 'Introduce yourself' },
      { speaker: 'guide', text: introText }
    ]);
    speakWithPreferredVoice(introText);
  };

  const handleNavigation = () => {
    setMessages((prev) => [
      ...prev,
      { speaker: 'user', text: 'Navigation' },
      { speaker: 'guide', text: 'I can help you reach ARICC Offices, the Library, the Registrar, Colleges, and Student Services.' }
    ]);
  };

  const handleVoiceConversation = () => {
    setMessages((prev) => [
      ...prev,
      { speaker: 'user', text: 'Start Voice Conversation' },
      { speaker: 'guide', text: 'Voice conversation is ready. Ask me about BulSU, ARICC, programs, scholarships, or campus facilities.' }
    ]);
  };

  return (
    <div className="homepage-shell taylor-shell">
      <div className="homepage-panel taylor-panel">
        <section className="taylor-header">
          <div>
            <div className="eyebrow">Bulacan State University • ARICC</div>
            <h1>TAYLOR</h1>
            <p className="hero-subtitle">BulSU AI Hologram Guide</p>
          </div>
          <div className="status-card">
            <h3>TAYLOR READY</h3>
            <p>Age Detected: {sessionContext?.age ?? '—'}</p>
            <p>Initial Emotion: {sessionContext?.emotion ?? '—'}</p>
            <p>Status: Connected</p>
          </div>
        </section>

        <section className="guide-section">
          <div className="avatar-card">
            <Hologram emotion={sessionContext?.emotion || 'happy'} isAnimating={isSpeaking} spokenText={speechText} disableAnimations={true} poseMode="relaxed" assetPreset="idle" />
          </div>
          <div className="suggestion-row">
                {suggestionItems.map((item) => (
                  <button key={item.key} className="suggestion-chip" onClick={() => handleSuggestion(item)}>
                    {item.label}
                  </button>
                ))}
              </div>
            <div className="chat-log">
                {messages.map((message, index) => (
                  <div key={`${message.speaker}-${index}`} className={`bubble ${message.speaker}`}>
                    {message.text}
                  </div>
                ))}
              </div>
          <div className="conversation-card">
            <div className="chat-shell">
              <div className="chat-input-row">
                <input
                  className="chat-input"
                  value={inputText}
                  onChange={(event) => setInputText(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask TAYLOR anything about Bulacan State University..."
                />
                <button className="chat-send" onClick={() => handleSendMessage()}>Send</button>
              </div>
              {isThinking && <div className="typing-pill">TAYLOR is thinking...</div>}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
