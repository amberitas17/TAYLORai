import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Hologram from './hologram.jsx';
import { handleSpeechInteraction, onSpeechStarted, textToSpeech, getSpeechSupportState } from './services/speechAPI.js';
import './HomePage.css';

const API_URL = (import.meta.env.VITE_NODEJS_API_URL || '').trim();
const CHAT_ENDPOINT = API_URL && !/localhost|127\.0\.0\.1/i.test(API_URL)
  ? `${API_URL.replace(/\/$/, '')}/chat`
  : '/api/chat';

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
  } catch {
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
  const [speechWarning, setSpeechWarning] = useState('');
  const [speechStatus, setSpeechStatus] = useState(getSpeechSupportState());
  const [greetingPlayed, setGreetingPlayed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem('taylorGreetingPlayed') === 'true';
  });

  useEffect(() => {
    const stopListening = onSpeechStarted(() => setIsSpeaking(true));
    return () => stopListening();
  }, []);

  const speakWithPreferredVoice = useCallback(async (text) => {
    if (!text) return;

    setSpeechText(text);
    setSpeechWarning('');

    try {
      const speechStarted = await textToSpeech(text, false, 'taylor', 'en');
      if (!speechStarted) {
        setSpeechWarning('Speech synthesis is unavailable or blocked on this device. Tap the Test Voice button to verify audio.');
      }
    } catch (error) {
      console.error('[taylor] speech request failed', error);
      setSpeechWarning('Speech synthesis failed. Try the Test Voice button after tapping the screen.');
    } finally {
      setSpeechStatus(getSpeechSupportState());
      setIsSpeaking(false);
    }
  }, []);

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
  }, [location.state, greetingPlayed, speakWithPreferredVoice]);

  useEffect(() => {
    const syncSpeechStatus = () => setSpeechStatus(getSpeechSupportState());
    syncSpeechStatus();

    if (typeof window === 'undefined') return undefined;

    const triggerInteraction = () => {
      handleSpeechInteraction().then(syncSpeechStatus);
    };

    window.addEventListener('pointerdown', triggerInteraction, { passive: true });
    window.addEventListener('touchstart', triggerInteraction, { passive: true });
    window.addEventListener('keydown', triggerInteraction, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', triggerInteraction);
      window.removeEventListener('touchstart', triggerInteraction);
      window.removeEventListener('keydown', triggerInteraction);
    };
  }, []);

  const getFriendlyErrorMessage = (error) => {
    const message = error?.message || 'Backend unavailable';
    if (message.includes('Invalid API key') || message.includes('invalid-api-key')) {
      return 'The AI service key is invalid. Please contact the site administrator.';
    }
    if (message.includes('Rate limit') || message.includes('rate-limit')) {
      return 'The AI service is temporarily rate-limiting requests. Please try again soon.';
    }
    if (message.includes('API not found') || message.includes('not found')) {
      return 'The chat endpoint could not be found. Please try again in a moment.';
    }
    if (message.includes('Network') || message.includes('network')) {
      return 'A network error prevented the chat request from completing.';
    }
    return 'The chat service is temporarily unavailable. Please try again in a moment.';
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
      console.info('[taylor] chat request', {
        endpoint: CHAT_ENDPOINT,
        payload: { messages: nextMessages.map(({ speaker, text }) => ({ role: speaker === 'user' ? 'user' : 'assistant', content: text })) }
      });

      const response = await fetch(CHAT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages.map(({ speaker, text }) => ({ role: speaker === 'user' ? 'user' : 'assistant', content: text })) })
      });

      const responseText = await response.text();
      let data = {};

      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch {
          data = { reply: responseText };
        }
      }

      console.info('[taylor] chat response', {
        status: response.status,
        body: responseText
      });

      if (!response.ok || data.success === false) {
        throw new Error(data.message || data.error || data.errorType || 'Backend unavailable');
      }

      const reply = data.reply || 'I am sorry, I am having trouble responding right now. Please try again in a moment.';
      setMessages((prev) => [...prev, { speaker: 'guide', text: reply }]);
      speakWithPreferredVoice(reply);
    } catch (error) {
      console.error('[taylor] chat request failed', error);
      const friendly = getFriendlyErrorMessage(error);
      setMessages((prev) => [...prev, { speaker: 'guide', text: friendly }]);
      speakWithPreferredVoice(friendly);
    } finally {
      setIsThinking(false);
    }
  };

  const handleSuggestion = (suggestion) => {
    handleSendMessage(suggestion.answer);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSendMessage();
    }
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
            <p>Status: {speechStatus?.available ? 'Voice ready' : 'Voice unavailable'}</p>
          </div>
        </section>

        {speechWarning && (
          <section className="typing-pill" style={{ marginBottom: '0.75rem', display: 'block' }}>
            {speechWarning}
          </section>
        )}

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
