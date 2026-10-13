import { getPerformanceSettings } from './services/devicePerformance.js';
import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiMapPin } from 'react-icons/fi';
const Hologram = lazy(() => import('./hologram.jsx'));
import { handleSpeechInteraction, onSpeechStarted, textToSpeech, getSpeechSupportState } from './services/speechAPI.js';
import { subscribePwaBootstrap } from './services/pwaBootstrapService.js';
import {
  createKnowledgeIndex,
  initializeLocalKnowledge,
} from './services/localKnowledgeService.js';
import { resolveLocalFirstChat } from './services/localKnowledgeChat.js';
import './HomePage.css';

class AvatarErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.error('[taylor] Avatar rendering failed', error); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function AvatarPlaceholder({ message, onRetry }) {
  return <div className="avatar-placeholder" role="status" aria-live="polite" style={{ minHeight: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20, textAlign: 'center' }}>
    <span>{message}</span>
    <span style={{ fontSize: 13 }}>You can continue chatting while the avatar is unavailable.</span>
    {onRetry && <button type="button" onClick={onRetry}>Retry avatar</button>}
  </div>;
}

const API_URL = (import.meta.env.VITE_NODEJS_API_URL || '').trim();
const IS_LOCAL_BROWSER = typeof window !== 'undefined' && /localhost|127\.0\.0\.1/i.test(window.location.hostname);
const CHAT_ENDPOINT = API_URL && (!/localhost|127\.0\.0\.1/i.test(API_URL) || IS_LOCAL_BROWSER)
  ? `${API_URL.replace(/\/$/, '')}/chat`
  : '/api/chat';
// Allow server-side retrieval plus OpenRouter inference to complete on mobile.
const CHAT_TIMEOUT_MS = 35000;
// Avoid two back-to-back 15-second cancellations and duplicate LLM requests.
const CHAT_MAX_ATTEMPTS = 1;
const KNOWLEDGE_ENTITIES = new Set(['ARICC', 'RIO', 'CAESAR', 'FABLAB', 'RECON', 'CBS', 'BARAS TBI', 'FIC']);

// const suggestionItems = [
//   { key: 'bulsu', label: 'What is BulSU?', answer: 'Bulacan State University is a premier public university in the Philippines, known for academic excellence, innovation, and service to the community.' },
//   { key: 'aricc', label: 'What is ARICC?', answer: 'What is ARICC?' },
//   { key: 'programs', label: 'Academic Programs', answer: 'BulSU offers strong programs in engineering, education, business, health sciences, information technology, and the arts.' },
//   { key: 'facilities', label: 'Campus Facilities', answer: 'BulSU provides modern classrooms, libraries, laboratories, innovation spaces, student centers, and smart campus facilities.' },
//   { key: 'research', label: 'Research and Innovation', answer: 'BulSU supports impactful research through laboratories, industry partnerships, technology transfer, and community-driven innovation.' },
//   { key: 'services', label: 'Student Services', answer: 'Student services include academic advising, counseling, wellness support, scholarships, and campus engagement programs.' },
//   { key: 'scholarships', label: 'Scholarships', answer: 'BulSU offers scholarship and financial assistance opportunities to support deserving students in their academic journey.' }
// ];

const CENTER_PROMPTS = {
  ARICC: [
    'What is ARICC?',
    'What services does ARICC offer?',
    'What training and workshops are available?',
    'What technical services does ARICC provide?',
    "What are ARICC's objectives?"
  ],
  RIO: [
    'What is RIO?',
    'What services does RIO offer?',
    'How does RIO support research?',
    'How does RIO support innovation?',
    'How can students or researchers work with RIO?'
  ],
  CAESAR: [
    'What is CAESAR?',
    'What services does CAESAR offer?',
    'What research does CAESAR conduct?',
    'What laboratory services are available?',
    'How does CAESAR support communities?'
  ],
  FABLAB: [
    'What is FABLAB?',
    'What services does FABLAB offer?',
    'What fabrication equipment is available?',
    'What training does FABLAB provide?',
    'Who can use FABLAB?'
  ],
  RECON: [
    'What is RECON?',
    'What services does RECON offer?',
    "What are RECON's focus areas?",
    'What projects does RECON work on?',
    'How does RECON support disaster resilience and renewable energy?'
  ]
};
const MAIN_CENTER_PROMPTS = ['ARICC', 'RECON', 'FABLAB', 'CAESAR'].map((center) => ({
  key: center,
  label: CENTER_PROMPTS[center][0],
  answer: CENTER_PROMPTS[center][0],
}));


const UI_TEXT = {
  en: {ready:'TAYLOR is ready.', offline:'Preparing TAYLOR for offline use...', connection:'This AI feature needs a one-time connection to prepare for offline use.', subtitle:'BulSU AI Hologram Guide', language:'Language', navigation:'Indoor navigation', status:'TAYLOR READY', age:'Age Group', emotion:'Initial Emotion', voice:'Status', voiceReady:'Voice ready', voiceUnavailable:'Voice unavailable', recognized:'Recognized', askCenter:'Ask TAYLOR about this center', preparing:'Preparing AI Vision...', placeholder:'Ask TAYLOR anything about Bulacan State University...', send:'Send', thinking:'TAYLOR is thinking...', greetingWarm:'Welcome to Bulacan State University! I am TAYLOR, your AI hologram guide. I am glad you are here.', greetingGentle:'Welcome to Bulacan State University. I am TAYLOR, your AI hologram guide. We can explore at your own pace.', greetingCurious:'Welcome to Bulacan State University! I am TAYLOR, your AI hologram guide. There is plenty to discover here.', greeting:'Welcome to Bulacan State University. I am TAYLOR, your AI hologram guide.', question:'How may I assist you today?', estimate:'Your estimated age group is {ageGroup}.', feeling:'Your initial emotion appears to be {emotion}.', speakWarning:'Speech is unavailable on this device. Tap the screen and try again.', failed:'TAYLOR could not complete your request. Please try again.'},
  tl: {ready:'Handa na si TAYLOR.', offline:'Inihahanda si TAYLOR para sa offline na paggamit...', connection:'Kailangan ng isang beses na koneksyon upang maihanda ang AI para sa offline na paggamit.', subtitle:'AI Hologram Guide ng BulSU', language:'Wika', navigation:'Panloob na nabigasyon', status:'HANDA NA SI TAYLOR', age:'Pangkat ng Edad', emotion:'Paunang Emosyon', voice:'Katayuan', voiceReady:'Handa ang boses', voiceUnavailable:'Hindi available ang boses', recognized:'Nakilala', askCenter:'Magtanong kay TAYLOR tungkol sa sentrong ito', preparing:'Inihahanda ang AI Vision...', placeholder:'Magtanong kay TAYLOR tungkol sa Bulacan State University...', send:'Ipadala', thinking:'Nag-iisip si TAYLOR...', greetingWarm:'Maligayang pagdating sa Bulacan State University! Ako si TAYLOR, ang inyong AI hologram guide. Masaya akong nandito kayo.', greetingGentle:'Maligayang pagdating sa Bulacan State University. Ako si TAYLOR, ang inyong AI hologram guide. Maaari tayong maglibot sa sarili ninyong bilis.', greetingCurious:'Maligayang pagdating sa Bulacan State University! Ako si TAYLOR, ang inyong AI hologram guide. Marami tayong maaaring tuklasin dito.', greeting:'Maligayang pagdating sa Bulacan State University. Ako si TAYLOR, ang inyong AI hologram guide.', question:'Paano kita matutulungan ngayon?', estimate:'Ang tinatayang pangkat ng edad mo ay {ageGroup}.', feeling:'Ang iyong unang emosyon ay {emotion}.', speakWarning:'Hindi available ang boses sa device na ito. Pindutin ang screen at subukang muli.', failed:'Hindi nakumpleto ni TAYLOR ang kahilingan. Pakisubukang muli.'},
  zh: {ready:'TAYLOR 已准备就绪。', offline:'正在准备 TAYLOR 的离线功能...', connection:'此 AI 功能需要连接一次网络才能准备离线使用。', subtitle:'BulSU AI 全息导览助手', language:'语言', navigation:'室内导航', status:'TAYLOR 已就绪', age:'年龄组', emotion:'初始情绪', voice:'状态', voiceReady:'语音已就绪', voiceUnavailable:'语音不可用', recognized:'已识别', askCenter:'向 TAYLOR 询问该中心的信息', preparing:'正在准备 AI 视觉...', placeholder:'向 TAYLOR 询问有关布拉干州立大学的问题...', send:'发送', thinking:'TAYLOR 正在思考...', greetingWarm:'欢迎来到布拉干州立大学！我是您的 AI 全息导览助手 TAYLOR。很高兴您来到这里。', greetingGentle:'欢迎来到布拉干州立大学。我是您的 AI 全息导览助手 TAYLOR。我们可以按照您的节奏参观。', greetingCurious:'欢迎来到布拉干州立大学！我是您的 AI 全息导览助手 TAYLOR。这里有很多值得探索的内容。', greeting:'欢迎来到布拉干州立大学。我是您的 AI 全息导览助手 TAYLOR。', question:'今天有什么可以帮您？', estimate:'您估计的年龄组是{ageGroup}。', feeling:'您最初的情绪似乎是 {emotion}。', speakWarning:'此设备无法使用语音。请点击屏幕后重试。', failed:'TAYLOR 无法完成请求，请重试。'}
};
// A detected facial expression is only a tentative signal. Keep greetings supportive
// without claiming to know the visitor's feelings or changing factual content.
const greetingToneKey = (emotion) => {
  const value = String(emotion || '').trim().toLowerCase();
  if (value === 'happy') return 'greetingWarm';
  if (value === 'sad' || value === 'fearful' || value === 'fear') return 'greetingGentle';
  if (value === 'surprised') return 'greetingCurious';
  return 'greeting';
};

const CENTER_QUESTION_LABELS = {
  tl: ['Ano ang sentrong ito?', 'Anong mga serbisyo ang inaalok?', 'Anong pagsasanay ang available?', 'Ano ang mga pangunahing gawain?', 'Paano ito makatutulong?'],
  zh: ['这个中心是什么？', '提供哪些服务？', '有哪些培训？', '主要工作是什么？', '如何提供帮助？']
};
const interpolate = (template, values) => template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''));

const getSessionContext = () => {
  if (typeof window === 'undefined') return null;
  try {
    const saved = window.sessionStorage.getItem('taylorSessionContext');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

const getActiveEntity = () => {
  if (typeof window === 'undefined') return '';
  const saved = window.sessionStorage.getItem('taylorActiveEntity') || '';
  return KNOWLEDGE_ENTITIES.has(saved) ? saved : '';
};

function isRetryableChatStatus(status) {
  return [408, 425, 429, 502, 503, 504].includes(status);
}

async function requestChat(payload) {
  let lastError;
  for (let attempt = 1; attempt <= CHAT_MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);
    try {
      const response = await fetch(CHAT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!isRetryableChatStatus(response.status) || attempt === CHAT_MAX_ATTEMPTS) return response;
      lastError = new Error(`Chat service returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt === CHAT_MAX_ATTEMPTS) throw error;
    } finally {
      window.clearTimeout(timeout);
    }
    await new Promise((resolve) => window.setTimeout(resolve, 300 * attempt));
  }
  throw lastError || new Error('Chat request failed');
}

export default function TaylorDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sessionContext, setSessionContext] = useState(() => location.state?.skipFacialAnalysis ? null : getSessionContext());
  const [activeEntity, setActiveEntity] = useState(() => location.state?.activeEntity || getActiveEntity());
  const [avatarEnabled, setAvatarEnabled] = useState(false);
  const [avatarAttempt, setAvatarAttempt] = useState(0);
  useEffect(() => {
    const timer = window.setTimeout(() => setAvatarEnabled(true), 250);
    return () => window.clearTimeout(timer);
  }, []);
  const retryAvatar = () => { setAvatarEnabled(true); setAvatarAttempt((attempt) => attempt + 1); };
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [language, setLanguage] = useState(() => {
    if (typeof window === 'undefined') return 'en';
    const saved = window.localStorage.getItem('taylorLanguage');
    return ['en', 'tl', 'zh'].includes(saved) ? saved : 'en';
  });
  const changeLanguage = (value) => {
    setLanguage(value);
    window.localStorage.setItem('taylorLanguage', value);
  };
  const [explanationLevel, setExplanationLevel] = useState(() => {
    try {
      const saved = window.localStorage.getItem('taylorExplanationLevel');
      return ['simple', 'standard', 'technical'].includes(saved) ? saved : 'standard';
    } catch { return 'standard'; }
  });
  const changeExplanationLevel = (value) => {
    setExplanationLevel(value);
    try { window.localStorage.setItem('taylorExplanationLevel', value); } catch {}
  };
  const explanationInstruction = {
    role: 'system',
    content: explanationLevel === 'simple'
      ? 'Explain clearly in short sentences using familiar examples. Avoid jargon; define necessary technical terms. Preserve factual accuracy.'
      : explanationLevel === 'technical'
        ? 'Give a technically detailed, accurate explanation, including mechanisms and relevant engineering terminology. Do not invent specifications.'
        : 'Explain clearly at a general visitor level, balancing accessible language with accurate technical details.',
  };
  const [tourInterest, setTourInterest] = useState(() => {
    try {
      const saved = window.localStorage.getItem('taylorTourInterest');
      return ['general', 'robotics', 'fabrication', 'environment', 'research'].includes(saved) ? saved : 'general';
    } catch { return 'general'; }
  });
  const changeTourInterest = (value) => {
    setTourInterest(value);
    try { window.localStorage.setItem('taylorTourInterest', value); } catch {}
  };
  const TOUR_INTERESTS = {
    general: { label: 'General exploration', destination: null },
    robotics: { label: 'Robotics and AI', destination: 'ARICC' },
    fabrication: { label: 'Fabrication and prototyping', destination: 'FABLAB' },
    environment: { label: 'Environmental science', destination: 'CAESAR' },
    research: { label: 'Research and innovation', destination: 'RIO' },
  };
  const selectedTourInterest = TOUR_INTERESTS[tourInterest];
  const t = UI_TEXT[language] || UI_TEXT.en;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [speechText, setSpeechText] = useState('');
  const [speechWarning, setSpeechWarning] = useState('');
  const [speechStatus, setSpeechStatus] = useState(getSpeechSupportState());
  const [greetingPlayed, setGreetingPlayed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem('taylorGreetingPlayed') === 'true';
  });
  const [bootstrap, setBootstrap] = useState(() => ({ state: 'BOOTSTRAP_PENDING', completed: 0, total: 4 }));
  const [localKnowledge, setLocalKnowledge] = useState(createKnowledgeIndex);

  useEffect(() => subscribePwaBootstrap(setBootstrap), []);

  useEffect(() => {
    let mounted = true;
    initializeLocalKnowledge()
      .then((index) => {
        if (mounted) setLocalKnowledge(index);
      })
      .catch((error) => console.warn('[taylor] local knowledge persistence unavailable', error));
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const handleActiveEntityChange = (event) => {
      if (event.detail?.confirmed && event.detail.activeEntity) {
        setActiveEntity(event.detail.activeEntity);
      }
    };
    window.addEventListener('taylor-active-entity-change', handleActiveEntityChange);
    return () => window.removeEventListener('taylor-active-entity-change', handleActiveEntityChange);
  }, []);

  useEffect(() => {
    const stopListening = onSpeechStarted(() => setIsSpeaking(true));
    return () => stopListening();
  }, []);

  const speakWithPreferredVoice = useCallback(async (text) => {
    if (!text) return;

    setSpeechText(text);
    setSpeechWarning('');

    try {
      const speechStarted = await textToSpeech(text, false, 'taylor', language);
      if (!speechStarted) {
        setSpeechWarning((UI_TEXT[language] || UI_TEXT.en).speakWarning);
      }
    } catch (error) {
      console.error('[taylor] speech request failed', error);
      setSpeechWarning((UI_TEXT[language] || UI_TEXT.en).speakWarning);
    } finally {
      setSpeechStatus(getSpeechSupportState());
      setIsSpeaking(false);
    }
  }, [language]);

  useEffect(() => {
    if (location.state?.skipFacialAnalysis) {
      setSessionContext(null);
      setMessages([{ speaker: 'guide', greetingKey: 'greeting' }, { speaker: 'guide', greetingKey: 'question' }]);
      return;
    }
    const profile = location.state?.detectedProfile || getSessionContext();
    if (!profile) return;

    const context = {
      age: profile.age ?? null,
      ageGroup: Number.isFinite(Number(profile.age)) && profile.age !== null && profile.age !== '' ? (Number(profile.age) < 13 ? 'Child' : 'Adult') : 'Unknown',
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
      const greeting = [t[greetingToneKey(context.emotion)], interpolate(t.estimate, context), interpolate(t.feeling, context), t.question].join(' ');
      speakWithPreferredVoice(greeting);
    }

    setMessages((prev) => {
      if (prev.length > 0) return prev;
      return [
        { speaker: 'guide', greetingKey: greetingToneKey(context.emotion) },
        { speaker: 'guide', greetingKey: 'estimate', values: { ageGroup: context.ageGroup } },
        { speaker: 'guide', greetingKey: 'feeling', values: { emotion: context.emotion } },
        { speaker: 'guide', greetingKey: 'question' }
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
    if (message.includes('API not found') || message.includes('endpoint could not be found')) {
      return 'The chat service configuration is unavailable. Please contact the site administrator.';
    }
    if (message.includes('model') && message.includes('not found')) {
      return 'The configured AI model is unavailable. Please contact the site administrator.';
    }
    if (error?.name === 'AbortError') return 'The request timed out on this connection. Please retry, or ask about a research center with offline information.';
    if (message.includes('Network') || message.includes('network') || message.includes('Failed to fetch')) {
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
      const responseLanguage = language === 'tl' ? 'Filipino (Tagalog)' : 'Simplified Chinese (Mandarin)';
      const languageInstruction = language === 'en' ? null : {
        role: 'system',
        content: `Reply entirely in ${responseLanguage}. Translate explanations naturally; preserve proper names such as ARICC and Bulacan State University. Do not translate into English unless asked.`,
      };
      const resolution = await resolveLocalFirstChat({
        query: text,
        activeEntity,
        index: localKnowledge,
        requestBackend: (localResult) => {
          console.info('[taylor] local knowledge insufficient; using backend', {
            reason: localResult.reason,
            entity: localResult.entity || null,
            latencyMs: localResult.latencyMs,
          });
          return requestChat({
            messages: [explanationInstruction, ...(languageInstruction ? [languageInstruction] : []), ...nextMessages.map(({ speaker, text: messageText }) => ({ role: speaker === 'user' ? 'user' : 'assistant', content: messageText }))],
            activeEntity,
          });
        },
      });

      if (resolution.kind === 'local' && language === 'en') {
        const reply = resolution.result.match.text;
        setMessages((prev) => [...prev, { speaker: 'guide', text: reply }]);
        speakWithPreferredVoice(reply);
        console.info('[taylor] local knowledge answer', {
          entity: resolution.result.match.entity,
          intent: resolution.result.match.intent,
          sourceIds: resolution.result.match.sourceIds,
          latencyMs: resolution.result.latencyMs,
        });
        return;
      }

      if (resolution.kind === 'local' && language !== 'en') {
        // Local knowledge is English-only; ask the backend to translate rather than reading English aloud.
        const response = await requestChat({
          messages: [explanationInstruction, languageInstruction, ...nextMessages.map(({ speaker, text: messageText }) => ({ role: speaker === 'user' ? 'user' : 'assistant', content: messageText }))],
          activeEntity,
        });
        const data = await response.json();
        if (!response.ok || data.success === false) throw new Error(data.message || 'Translation unavailable');
        const reply = data.reply || 'Translation unavailable.';
        setMessages((prev) => [...prev, { speaker: 'guide', text: reply }]);
        speakWithPreferredVoice(reply);
        return;
      }

      if (resolution.kind === 'unavailable') {
        setMessages((prev) => [...prev, { speaker: 'guide', text: resolution.message }]);
        speakWithPreferredVoice(resolution.message);
        return;
      }

      // Avoid logging visitor conversation content to the browser console.
      console.info('[taylor] chat request', { endpoint: CHAT_ENDPOINT, messageCount: nextMessages.length });

      const response = resolution.response;

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
        retrievalMode: data.retrievalMode || 'unspecified'
      });

      if (!response.ok || data.success === false) {
        throw new Error(data.message || data.error || data.errorType || 'Backend unavailable');
      }

      const reply = data.reply || 'I am sorry, I am having trouble responding right now. Please try again in a moment.';
      setActiveEntity(data.activeEntity || '');
      if (data.activeEntity) window.sessionStorage.setItem('taylorActiveEntity', data.activeEntity);
      else window.sessionStorage.removeItem('taylorActiveEntity');
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

  useEffect(() => {
    const prompt = String(location.state?.initialPrompt || '').trim();
    if (prompt) setInputText(prompt);
  }, [location.state?.initialPrompt]);

  const handleSuggestion = (suggestion) => {
    handleSendMessage(suggestion.answer);
  };

  const centerPrompts = CENTER_PROMPTS[activeEntity] || [];

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="homepage-shell taylor-shell">
      <button
        type="button"
        className="taylor-navigation-fab"
        onClick={() => navigate('/ai-navigation')}
        aria-label={t.navigation}
        title={t.navigation}
      >
        <FiMapPin aria-hidden="true" />
        <span>{t.navigation}</span>
      </button>
      <div className="homepage-panel taylor-panel">
        <section className="taylor-header">
          <button type="button" onClick={() => navigate("/")} aria-label="Back to homepage" style={{ alignSelf: "flex-start", padding: "0.55rem 0.9rem", borderRadius: "0.6rem", cursor: "pointer" }}>← Home</button>
          <div>
            <div className="eyebrow">Bulacan State University</div>
            <h1>TAYLOR</h1>
            {bootstrap.state !== 'BOOTSTRAP_READY' && (
              <p aria-live="polite">
                {bootstrap.state === 'BOOTSTRAP_NEEDS_CONNECTION'
                  ? t.connection
                  : t.offline}
                {' '}{bootstrap.completed}/{bootstrap.total}
              </p>
            )}
            {bootstrap.state === 'BOOTSTRAP_READY' && <p aria-live="polite">{t.ready}</p>}
            <p className="hero-subtitle">{t.subtitle}</p>
          </div>
          <div className="status-card">
            <label htmlFor="taylor-language" style={{ display: 'block', marginBottom: '0.35rem' }}>{t.language}</label>
            <select id="taylor-language" aria-label="TAYLOR response language" value={language} onChange={(event) => changeLanguage(event.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', marginBottom: '0.75rem' }}>
              <option value="en">English</option>
              <option value="tl">Filipino (Tagalog)</option>
              <option value="zh">中文 (Mandarin)</option>
            </select>
            <label htmlFor="taylor-explanation-level" style={{ display: 'block', marginBottom: '0.35rem' }}>Explanation level</label>
            <select id="taylor-explanation-level" aria-label="Preferred explanation level" value={explanationLevel} onChange={(event) => changeExplanationLevel(event.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', marginBottom: '0.75rem' }}>
              <option value="simple">Simple</option>
              <option value="standard">Standard</option>
              <option value="technical">Technical</option>
            </select>
            <label htmlFor="taylor-tour-interest" style={{ display: 'block', marginBottom: '0.35rem' }}>Tour interest</label>
            <select id="taylor-tour-interest" aria-label="Preferred tour interest" value={tourInterest} onChange={(event) => changeTourInterest(event.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', marginBottom: '0.75rem' }}>
              {Object.entries(TOUR_INTERESTS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
            </select>
            {selectedTourInterest.destination && (
              <p role="status" style={{ marginBottom: '0.75rem' }}>
                Suggested destination: <strong>{selectedTourInterest.destination}</strong>
                {' '}<button type="button" onClick={() => navigate('/ai-navigation')} style={{ cursor: 'pointer' }}>View directions</button>
              </p>
            )}
            <h3>{t.status}</h3>
            {sessionContext?.initialized && <>
              <p>{t.age}: {sessionContext.age != null && Number.isFinite(Number(sessionContext.age)) ? (Number(sessionContext.age) < 13 ? 'Child' : 'Adult') : 'Unknown'}</p>
              <p>{t.emotion}: {sessionContext.emotion ?? '—'}</p>
            </>}
            <p>{t.voice}: {speechStatus?.available ? t.voiceReady : t.voiceUnavailable}</p>
          </div>
        </section>

        {speechWarning && (
          <section className="typing-pill" style={{ marginBottom: '0.75rem', display: 'block' }}>
            {speechWarning}
          </section>
        )}

        <section className="guide-section">
          {activeEntity && (
            <section className="center-context" aria-live="polite">
              <div className="center-context-label">✓ {activeEntity} {t.recognized}</div>
              <div className="center-context-prompt">{t.askCenter}</div>
              <div className="center-context-actions">
                {centerPrompts.map((prompt, index) => (
                  <button key={prompt} className="suggestion-chip" onClick={() => handleSendMessage(prompt)}>
                    {language === 'en' ? prompt : CENTER_QUESTION_LABELS[language]?.[index] || prompt}
                  </button>
                ))}
              </div>
            </section>
          )}
          <div className="avatar-card">
            {!getPerformanceSettings().avatar3D ? (
              <div className="avatar-placeholder" role="status">TAYLOR voice and chat are ready. 3D avatar is disabled in lightweight mode.</div>
            ) : !avatarEnabled ? (
              <AvatarPlaceholder message="Preparing TAYLOR avatar... Chat remains available while loading." />
            ) : (
              <AvatarErrorBoundary key={avatarAttempt} fallback={<AvatarPlaceholder message="Avatar rendering is unavailable on this device or connection." onRetry={retryAvatar} />}>
                <Suspense fallback={<AvatarPlaceholder message="Loading TAYLOR avatar..." />}>
                  <Hologram emotion={sessionContext?.emotion || 'neutral'} isAnimating={isSpeaking} spokenText={speechText} disableAnimations={true} poseMode="relaxed" assetPreset="idle" />
                </Suspense>
              </AvatarErrorBoundary>
            )}
          </div>
          {!activeEntity && <div className="suggestion-row">
                {MAIN_CENTER_PROMPTS.map((item) => (
                  <button key={item.key} className="suggestion-chip" onClick={() => handleSuggestion(item)}>
                    {item.label}
                  </button>
                ))}
              </div>}
            <div className="chat-log">
                {messages.map((message, index) => (
                  <div key={`${message.speaker}-${index}`} className={`bubble ${message.speaker}`}>
                    {message.greetingKey ? interpolate(t[message.greetingKey], message.values || {}) : message.text}
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
                  placeholder={t.placeholder}
                />
                <button className="chat-send" onClick={() => handleSendMessage()}>{t.send}</button>
              </div>
              {isThinking && <div className="typing-pill">{t.thinking}</div>}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
