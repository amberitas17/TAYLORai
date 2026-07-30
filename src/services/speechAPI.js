const HF_API_KEY = import.meta.env.VITE_HUGGINGFACE_API_KEY || '';
const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY || '';

let isAvatarSpeaking = false;
let _elevenLabsUnavailable = false;
let _speechInteractionEnabled = false;
let _pendingSpeechRequest = null;
let _cachedVoices = [];
let _voiceLoadPromise = null;
let _speechSupportState = { supported: false, available: false, isMobile: false, isPwa: false, warning: '' };
let _onSpeechStart = null;
let _currentElevenLabsAudio = null;

function updateSpeechSupportState() {
  if (typeof window === 'undefined') {
    _speechSupportState = { supported: false, available: false, isMobile: false, isPwa: false, warning: 'Speech synthesis is unavailable outside the browser.' };
    return _speechSupportState;
  }

  const speechSynthesis = window.speechSynthesis;
  const supported = Boolean(speechSynthesis && typeof SpeechSynthesisUtterance !== 'undefined');
  const userAgent = window.navigator?.userAgent || '';
  const isMobile = /Android|iPhone|iPad|iPod|SamsungBrowser|CriOS|FxiOS|Mobile/i.test(userAgent);
  const isPwa = Boolean(window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator?.standalone);
  const warning = supported
    ? ''
    : 'Speech synthesis is unavailable in this browser. Please try Chrome, Samsung Internet, Safari, or the installed PWA.';

  _speechSupportState = { supported, available: supported, isMobile, isPwa, warning };
  return _speechSupportState;
}

updateSpeechSupportState();

export function setAvatarSpeaking(v) {
  isAvatarSpeaking = v;
}

export function getAvatarSpeaking() {
  return isAvatarSpeaking;
}

export function getSpeechSupportState() {
  return { ..._speechSupportState, hasUserInteraction: _speechInteractionEnabled };
}

export function handleSpeechInteraction() {
  if (_speechInteractionEnabled) {
    return Promise.resolve(true);
  }

  _speechInteractionEnabled = true;

  if (_pendingSpeechRequest) {
    const request = _pendingSpeechRequest;
    _pendingSpeechRequest = null;
    if (request.timeoutId) {
      clearTimeout(request.timeoutId);
    }

    return _playSpeech(request.text, request.avatarName, request.lang)
      .then((result) => {
        request.resolve(result);
        return result;
      })
      .catch((error) => {
        console.error('[TTS] speech error', error);
        request.resolve(false);
        return false;
      });
  }

  return Promise.resolve(true);
}

export function stopCurrentAudio() {
  if (_currentElevenLabsAudio) {
    try {
      _currentElevenLabsAudio.pause();
      _currentElevenLabsAudio.currentTime = 0;
    } catch (error) {}
    _currentElevenLabsAudio = null;
  }

  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch (error) {}
  }

  const responsiveVoiceLib = typeof window !== 'undefined' ? window.responsiveVoice : undefined;
  if (responsiveVoiceLib) {
    try {
      responsiveVoiceLib.cancel();
    } catch (error) {}
  }

  isAvatarSpeaking = false;
}

export function onSpeechStarted(cb) {
  _onSpeechStart = cb;
  return () => {
    if (_onSpeechStart === cb) {
      _onSpeechStart = null;
    }
  };
}

function fireSpeechStart() {
  if (_onSpeechStart) {
    _onSpeechStart();
  }
}

const LANG_LOCALES = {
  en: ['en-US', 'en-GB', 'en-AU'],
  tl: ['fil-PH', 'tl-PH'],
  zh: ['zh-CN', 'zh-TW'],
  ja: ['ja-JP'],
  ko: ['ko-KR'],
};

const ELEVENLABS_VOICES = {
  taylor: {
    tl: 'cgSgspJ2msm6clMCkdW9',
    en: '21m00Tcm4TlvDq8ikWAM',
    zh: '21m00Tcm4TlvDq8ikWAM',
    ja: '21m00Tcm4TlvDq8ikWAM',
    ko: '21m00Tcm4TlvDq8ikWAM',
  },
  daisy: {
    tl: 'FGY2WhTYpPnrIDTdsKH5',
    en: 'XB0fDUnXU5powFXDhCwa',
    zh: 'XB0fDUnXU5powFXDhCwa',
    ja: 'XB0fDUnXU5powFXDhCwa',
    ko: 'XB0fDUnXU5powFXDhCwa',
  },
  john: {
    tl: 'nPczCjzI2devNBz1zQrb',
    en: 'nPczCjzI2devNBz1zQrb',
    zh: 'nPczCjzI2devNBz1zQrb',
    ja: 'nPczCjzI2devNBz1zQrb',
    ko: 'nPczCjzI2devNBz1zQrb',
  },
};

const ELEVENLABS_SETTINGS = {
  taylor: {
    stability: 0.60,
    similarity_boost: 0.85,
    style: 0.45,
    use_speaker_boost: true,
  },
  daisy: {
    stability: 0.50,
    similarity_boost: 0.82,
    style: 0.60,
    use_speaker_boost: true,
  },
  john: {
    stability: 0.80,
    similarity_boost: 0.90,
    style: 0.25,
    use_speaker_boost: true,
  },
};

const RV_FILIPINO_VOICE = {
  taylor: 'Filipino Female',
  daisy: 'Filipino Female',
  john: 'Filipino Male',
};

const RV_PARAMS = {
  taylor: { pitch: 1.05, rate: 0.88, volume: 1 },
  daisy: { pitch: 1.15, rate: 0.95, volume: 1 },
  john: { pitch: 0.75, rate: 0.85, volume: 1 },
};

const VOICE_CONFIG = {
  taylor: {
    gender: 'female',
    en: { pitch: 1.05, rate: 0.90, prefer: ['Samantha', 'Victoria', 'Google US English Female', 'Microsoft Zira Desktop', 'Karen', 'Hazel'] },
    zh: { pitch: 1.08, rate: 0.86, prefer: ['Ting-Ting', 'Meijia', 'Google 普通话（中国大陆）', 'Microsoft Huihui Desktop'] },
    ja: { pitch: 1.06, rate: 0.88, prefer: ['Kyoko', 'Google 日本語', 'Microsoft Haruka Desktop', 'Ayumi'] },
    ko: { pitch: 1.05, rate: 0.88, prefer: ['Yuna', 'Google 한국의', 'Microsoft Heami Desktop'] },
  },
  daisy: {
    gender: 'female',
    en: { pitch: 1.08, rate: 0.92, prefer: ['Samantha', 'Kate', 'Google UK English Female', 'Microsoft Hazel Desktop', 'Victoria'] },
    zh: { pitch: 1.10, rate: 0.88, prefer: ['Ting-Ting', 'Meijia', 'Google 普通话（中国大陆）', 'Microsoft Yaoyao Desktop'] },
    ja: { pitch: 1.08, rate: 0.90, prefer: ['Kyoko', 'Google 日本語', 'Microsoft Haruka Desktop'] },
    ko: { pitch: 1.07, rate: 0.90, prefer: ['Yuna', 'Google 한국의', 'Microsoft Heami Desktop'] },
  },
  john: {
    gender: 'male',
    en: { pitch: 0.75, rate: 0.90, prefer: ['Microsoft David', 'David', 'Microsoft Mark', 'Mark'] },
    zh: { pitch: 0.35, rate: 0.80, prefer: ['Microsoft Kangkang', 'Kangkang'] },
    ja: { pitch: 0.38, rate: 0.80, prefer: ['Microsoft Ichiro', 'Ichiro', 'Otoya'] },
    ko: { pitch: 0.40, rate: 0.80, prefer: ['Google 한국의', 'Korean Male'] },
  },
};

function logVoices(voices) {
  if (!voices?.length) {
    console.warn('[TTS] available voices', []);
    return;
  }

  console.info('[TTS] available voices', voices.map((voice) => ({ name: voice.name, lang: voice.lang, default: voice.default })));
}

export function loadVoices() {
  if (_voiceLoadPromise) {
    return _voiceLoadPromise;
  }

  _voiceLoadPromise = new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      updateSpeechSupportState();
      resolve([]);
      return;
    }

    const finish = () => {
      const voices = window.speechSynthesis.getVoices() || [];
      _cachedVoices = voices;
      logVoices(voices);
      resolve(voices);
    };

    const voices = window.speechSynthesis.getVoices() || [];
    if (voices.length) {
      _cachedVoices = voices;
      logVoices(voices);
      resolve(voices);
      return;
    }

    window.speechSynthesis.onvoiceschanged = () => {
      finish();
    };

    window.setTimeout(() => {
      finish();
    }, 2200);
  });

  return _voiceLoadPromise;
}

export async function speechToText(audioBlob) {
  try {
    const res = await fetch('https://api-inference.huggingface.co/models/openai/whisper-large-v3', {
      method: 'POST',
      headers: { Authorization: `Bearer ${HF_API_KEY}`, 'Content-Type': 'audio/wav' },
      body: audioBlob,
    });

    const data = await res.json();
    return data.text;
  } catch (err) {
    console.error('STT error:', err);
    throw err;
  }
}

function _isShortFiller(text) {
  const cleaned = text.trim().replace(/[.,!?]/g, '');
  return cleaned.split(/\s+/).length <= 2 && cleaned.length <= 12;
}

function _hasValidElevenLabsKey() {
  return Boolean(ELEVENLABS_API_KEY && ELEVENLABS_API_KEY.length > 20 && ELEVENLABS_API_KEY.startsWith('sk_'));
}

function _shouldTryElevenLabs() {
  return false;
}

function _playSpeech(text, avatarName = 'taylor', lang = 'en') {
  return new Promise((resolve) => {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    if (!synth) {
      updateSpeechSupportState();
      console.warn('[TTS] speech synthesis unavailable');
      resolve(false);
      return;
    }

    try {
      synth.cancel();
    } catch (e) {}

    const isFilipino = lang === 'tl';
    const hasKey = _shouldTryElevenLabs();
    const skipForFiller = _isShortFiller(text);
    const isJohn = avatarName === 'john';

    const finish = (result) => {
      setAvatarSpeaking(false);
      resolve(result);
    };

    const attemptBrowserTTS = async () => {
      const voices = await loadVoices();
      const cfg = VOICE_CONFIG[avatarName] || VOICE_CONFIG.taylor;
      const lCfg = cfg[lang] || cfg.en;
      const locales = LANG_LOCALES[lang] || ['en-US'];
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = locales[0];
      utt.pitch = lCfg.pitch;
      utt.rate = lCfg.rate;
      utt.volume = 1.0;

      const voice = pickVoice(avatarName, lang, voices);
      if (voice) {
        utt.voice = voice;
        console.info('[TTS] selected voice', { name: voice.name, lang: voice.lang });
      } else {
        console.warn('[TTS] selected voice', { name: 'none', lang: locales[0] });
      }

      utt.onstart = () => {
        console.info('[TTS] speech start', { text: text.slice(0, 120) });
        setAvatarSpeaking(true);
        fireSpeechStart();
      };
      utt.onend = () => {
        console.info('[TTS] speech end', { text: text.slice(0, 120) });
        finish(true);
      };
      utt.onerror = (event) => {
        console.error('[TTS] speech error', { error: event?.error || 'unknown', message: event?.message || 'speech synthesis failed' });
        finish(false);
      };

      if (synth.resume) {
        try {
          synth.resume();
        } catch (e) {}
      }

      try {
        synth.speak(utt);
      } catch (error) {
        console.error('[TTS] speech error', error);
        finish(false);
      }
    };

    (async () => {
      if (hasKey && !skipForFiller) {
        const ok = await _tryElevenLabs(text, avatarName, lang);
        if (ok) {
          resolve(ok);
          return;
        }
      }

      if (skipForFiller) {
        console.log('[TTS] Short filler — skipping ElevenLabs to save credits');
      }

      if (isFilipino && !isJohn) {
        const ok = await _responsiveVoiceFilipino(text, avatarName);
        if (ok) {
          resolve(ok);
          return;
        }
      }

      attemptBrowserTTS().catch((error) => {
        console.error('[TTS] speech error', error);
        finish(false);
      });
    })();
  });
}

export async function textToSpeech(text, _unused = false, avatarName = 'taylor', lang = 'en') {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    updateSpeechSupportState();
    console.warn('[TTS] speech synthesis unavailable');
    return false;
  }

  if (!_speechInteractionEnabled) {
    return new Promise((resolve) => {
      const request = {
        text,
        avatarName,
        lang,
        resolve,
        timeoutId: window.setTimeout(() => {
          if (_pendingSpeechRequest === request) {
            _pendingSpeechRequest = null;
            resolve(false);
          }
        }, 5000),
      };
      _pendingSpeechRequest = request;
      console.info('[TTS] queued until user interaction', { text: text.slice(0, 80) });
    });
  }

  return _playSpeech(text, avatarName, lang);
}

async function _tryElevenLabs(text, avatarName, lang) {
  const avatarMap = ELEVENLABS_VOICES[avatarName];
  if (!avatarMap) return null;

  const voiceId = avatarMap[lang];
  if (!voiceId) return null;

  const settings = ELEVENLABS_SETTINGS[avatarName] || ELEVENLABS_SETTINGS.taylor;

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        Accept: 'audio/mpeg',
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: settings,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 401) {
        console.error('[ElevenLabs] Invalid API key');
      } else if (status === 402) {
        _elevenLabsUnavailable = true;
        console.warn('[ElevenLabs] 402 Payment required or no credits available; falling back to browser speech');
      } else if (status === 429) {
        console.error('[ElevenLabs] Out of credits');
      } else if (status === 422) {
        console.error('[ElevenLabs] Invalid voice ID or model');
      } else {
        console.error(`[ElevenLabs] HTTP ${status}`);
      }
      return null;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    _currentElevenLabsAudio = audio;

    return new Promise((resolve) => {
      audio.onplay = () => {
        fireSpeechStart();
      };
      audio.onended = () => {
        if (_currentElevenLabsAudio === audio) _currentElevenLabsAudio = null;
        setAvatarSpeaking(false);
        URL.revokeObjectURL(url);
        resolve(true);
      };
      audio.onerror = () => {
        if (_currentElevenLabsAudio === audio) _currentElevenLabsAudio = null;
        setAvatarSpeaking(false);
        URL.revokeObjectURL(url);
        resolve(null);
      };
      audio.play().catch(() => {
        if (_currentElevenLabsAudio === audio) _currentElevenLabsAudio = null;
        setAvatarSpeaking(false);
        URL.revokeObjectURL(url);
        resolve(null);
      });
    });
  } catch (err) {
    console.error('[ElevenLabs] Network error:', err);
    return null;
  }
}

function _responsiveVoiceFilipino(text, avatarName) {
  return new Promise((resolve) => {
    const responsiveVoiceLib = typeof window !== 'undefined' ? window.responsiveVoice : undefined;
    if (!responsiveVoiceLib) {
      resolve(null);
      return;
    }

    const voiceName = RV_FILIPINO_VOICE[avatarName] || 'Filipino Female';
    const params = RV_PARAMS[avatarName] || RV_PARAMS.taylor;
    let started = false;

    responsiveVoiceLib.speak(text, voiceName, {
      pitch: params.pitch,
      rate: params.rate,
      volume: params.volume,
      onstart: () => {
        started = true;
        console.info('[TTS] speech start', { text: text.slice(0, 120) });
        setAvatarSpeaking(true);
        fireSpeechStart();
      },
      onend: () => {
        console.info('[TTS] speech end', { text: text.slice(0, 120) });
        setAvatarSpeaking(false);
        resolve(true);
      },
      onerror: () => {
        console.error('[TTS] speech error', { error: 'responsiveVoice', message: 'responsiveVoice failed' });
        setAvatarSpeaking(false);
        resolve(null);
      },
    });

    setTimeout(() => {
      if (!started) {
        try {
          responsiveVoiceLib.cancel();
        } catch (error) {}
        setAvatarSpeaking(false);
        resolve(null);
      }
    }, 5000);
  });
}

function pickVoice(avatarName, lang, voices = _cachedVoices) {
  const cfg = VOICE_CONFIG[avatarName] || VOICE_CONFIG.taylor;
  const lCfg = cfg[lang] || cfg.en;
  const locales = LANG_LOCALES[lang] || ['en-US'];
  const voiceList = voices?.length ? voices : _cachedVoices;
  const isFemale = cfg.gender === 'female';
  const isJohn = avatarName === 'john';

  const englishVoices = voiceList.filter((voice) => (voice.lang || '').toLowerCase().startsWith('en'));

  for (const name of (lCfg.prefer || [])) {
    for (const voice of englishVoices.length ? englishVoices : voiceList) {
      const vname = voice.name.toLowerCase();
      if (isJohn && (vname.includes('female') || vname.includes('woman') || vname.includes('girl'))) continue;
      if (vname.includes(name.toLowerCase())) return voice;
    }
  }

  if (isJohn) {
    for (const locale of locales) {
      const localeVoices = voiceList.filter((v) => (v.lang || '').toLowerCase().startsWith(locale.split('-')[0].toLowerCase()));
      const maleVoices = localeVoices.filter((v) => {
        const name = v.name.toLowerCase();
        return !name.includes('female') && !name.includes('woman') && !name.includes('girl');
      });
      if (maleVoices.length > 0) return maleVoices[0];
    }
  }

  if (isFemale) {
    for (const locale of locales) {
      const localeVoices = voiceList.filter((v) => (v.lang || '').toLowerCase().startsWith(locale.split('-')[0].toLowerCase()));
      const femaleKw = ['female', 'woman', 'girl', 'samantha', 'victoria', 'hazel', 'kate', 'kyoko', 'yuna', 'ting', 'zira'];
      for (const kw of femaleKw) {
        const v = localeVoices.find((voice) => voice.name.toLowerCase().includes(kw));
        if (v) return v;
      }
      if (localeVoices[0]) return localeVoices[0];
    }
  }

  return voiceList[0] || null;
}

export function getPhonemeData(text) {
  const phonemes = [];
  (text.toLowerCase().match(/./gu) || []).forEach((ch, i) => {
    const t = i * 0.08;
    if ('aeiouàáâäãåāæèéêëēìíîïīòóôöõøōùúûüū'.includes(ch)) phonemes.push({ time: t, shape: 'open' });
    else if ('mnŋ'.includes(ch)) phonemes.push({ time: t, shape: 'closed' });
    else if ('fvθð'.includes(ch)) phonemes.push({ time: t, shape: 'tight' });
  });
  return phonemes;
}
