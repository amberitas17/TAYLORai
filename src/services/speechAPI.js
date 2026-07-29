const HF_API_KEY = import.meta.env.VITE_HUGGINGFACE_API_KEY || '';
const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY || '';

let isAvatarSpeaking = false;
let _elevenLabsUnavailable = false;
export function setAvatarSpeaking(v) {
  isAvatarSpeaking = v;
}

export function getAvatarSpeaking() {
  return isAvatarSpeaking;
}

let _currentElevenLabsAudio = null;
export function stopCurrentAudio() {
  if (_currentElevenLabsAudio) {
    try {
      _currentElevenLabsAudio.pause();
      _currentElevenLabsAudio.currentTime = 0;
    } catch (e) {}
    _currentElevenLabsAudio = null;
  }

  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  if (typeof responsiveVoice !== 'undefined') {
    try {
      responsiveVoice.cancel();
    } catch (e) {}
  }

  isAvatarSpeaking = false;
}

let _onSpeechStart = null;
export function onSpeechStarted(cb) {
  _onSpeechStart = cb;
}

function fireSpeechStart() {
  if (_onSpeechStart) _onSpeechStart();
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

let _cachedVoices = [];
export function loadVoices() {
  return new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length) {
      _cachedVoices = voices;
      resolve(voices);
      return;
    }

    window.speechSynthesis.onvoiceschanged = () => {
      _cachedVoices = window.speechSynthesis.getVoices();
      resolve(_cachedVoices);
    };
  });
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

export async function textToSpeech(text, _unused = false, avatarName = 'taylor', lang = 'en') {
  if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
    window.speechSynthesis.cancel();
  }
  if (typeof responsiveVoice !== 'undefined') {
    try {
      responsiveVoice.cancel();
    } catch (e) {}
  }

  await new Promise((resolve) => setTimeout(resolve, 80));
  setAvatarSpeaking(true);

  const isFilipino = lang === 'tl';
  const hasKey = _shouldTryElevenLabs();
  const skipForFiller = _isShortFiller(text);
  const isJohn = avatarName === 'john';

  if (hasKey && !skipForFiller) {
    const ok = await _tryElevenLabs(text, avatarName, lang);
    if (ok) return ok;
  }

  if (skipForFiller) {
    console.log('[TTS] Short filler — skipping ElevenLabs to save credits');
  }

  if (isFilipino && !isJohn) {
    const ok = await _responsiveVoiceFilipino(text, avatarName);
    if (ok) return ok;
  }

  return _browserTTS(text, avatarName, lang);
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
    if (typeof responsiveVoice === 'undefined') {
      resolve(null);
      return;
    }

    const voiceName = RV_FILIPINO_VOICE[avatarName] || 'Filipino Female';
    const params = RV_PARAMS[avatarName] || RV_PARAMS.taylor;
    let started = false;

    responsiveVoice.speak(text, voiceName, {
      pitch: params.pitch,
      rate: params.rate,
      volume: params.volume,
      onstart: () => { started = true; fireSpeechStart(); },
      onend: () => { setAvatarSpeaking(false); resolve(true); },
      onerror: () => { setAvatarSpeaking(false); resolve(null); },
    });

    setTimeout(() => {
      if (!started) {
        try {
          responsiveVoice.cancel();
        } catch (e) {}
        setAvatarSpeaking(false);
        resolve(null);
      }
    }, 5000);
  });
}

function pickVoice(avatarName, lang) {
  const cfg = VOICE_CONFIG[avatarName] || VOICE_CONFIG.taylor;
  const lCfg = cfg[lang] || cfg.en;
  const locales = LANG_LOCALES[lang] || ['en-US'];
  const voices = _cachedVoices.length ? _cachedVoices : window.speechSynthesis.getVoices();
  const isFemale = cfg.gender === 'female';
  const isJohn = avatarName === 'john';

  for (const name of (lCfg.prefer || [])) {
    for (const voice of voices) {
      const vname = voice.name.toLowerCase();
      if (isJohn && (vname.includes('female') || vname.includes('woman') || vname.includes('girl'))) continue;
      if (vname.includes(name.toLowerCase())) return voice;
    }
  }

  if (isJohn) {
    for (const locale of locales) {
      const localeVoices = voices.filter((v) => v.lang.startsWith(locale.split('-')[0]));
      const maleVoices = localeVoices.filter((v) => {
        const name = v.name.toLowerCase();
        return !name.includes('female') && !name.includes('woman') && !name.includes('girl');
      });
      if (maleVoices.length > 0) return maleVoices[0];
    }
  }

  if (isFemale) {
    for (const locale of locales) {
      const localeVoices = voices.filter((v) => v.lang.startsWith(locale.split('-')[0]));
      const femaleKw = ['female', 'woman', 'girl', 'samantha', 'victoria', 'hazel', 'kate', 'kyoko', 'yuna', 'ting', 'zira'];
      for (const kw of femaleKw) {
        const v = localeVoices.find((voice) => voice.name.toLowerCase().includes(kw));
        if (v) return v;
      }
      if (localeVoices[0]) return localeVoices[0];
    }
  }

  return voices[0] || null;
}

function _browserTTS(text, avatarName, lang) {
  return new Promise((resolve) => {
    const doSpeak = () => {
      const cfg = VOICE_CONFIG[avatarName] || VOICE_CONFIG.taylor;
      const lCfg = cfg[lang] || cfg.en;
      const locales = LANG_LOCALES[lang] || ['en-US'];
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = locales[0];
      utt.pitch = lCfg.pitch;
      utt.rate = lCfg.rate;
      utt.volume = 1.0;

      const voice = pickVoice(avatarName, lang);
      if (voice) {
        utt.voice = voice;
      }

      utt.onstart = () => fireSpeechStart();
      utt.onend = () => {
        setAvatarSpeaking(false);
        resolve(true);
      };
      utt.onerror = () => {
        setAvatarSpeaking(false);
        resolve(false);
      };

      setTimeout(() => {
        try {
          window.speechSynthesis.speak(utt);
        } catch (e) {
          setAvatarSpeaking(false);
          resolve(false);
        }
      }, 60);
    };

    if (_cachedVoices.length) doSpeak();
    else loadVoices().then(doSpeak);
  });
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
