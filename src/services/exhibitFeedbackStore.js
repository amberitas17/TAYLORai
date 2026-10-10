const DB_NAME = 'taylor-exhibit-feedback';
const STORE_NAME = 'feedback';
const DB_VERSION = 1;
const SESSION_KEY = 'taylor-anonymous-session-id';
let fallbackSessionId = null;

const normalize = (value = '') => value == null ? '' : String(value).trim().replace(/\s+/g, ' ');

function createId() {
  return globalThis.crypto?.randomUUID?.() || `session-${Date.now().toString(36)}`;
}

export function getAnonymousSessionId() {
  if (typeof localStorage !== 'undefined') {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const sessionId = createId();
    localStorage.setItem(SESSION_KEY, sessionId);
    return sessionId;
  }
  fallbackSessionId ||= createId();
  return fallbackSessionId;
}

export function feedbackDedupeKey({ sessionId, zone, predictedLabel, correctedLabel, feedbackType }) {
  return [sessionId, zone, predictedLabel, correctedLabel, feedbackType]
    .map(normalize)
    .map((value) => value.toLowerCase())
    .join('|');
}

export function buildFeedbackRecord({
  predictedLabel,
  correctedLabel = null,
  feedbackType,
  confidence,
  zone,
  modelVersion,
  sessionId = getAnonymousSessionId(),
}, now = Date.now()) {
  const normalizedPrediction = normalize(predictedLabel);
  const normalizedZone = normalize(zone).toUpperCase();
  const normalizedType = normalize(feedbackType).toUpperCase();
  if (!normalizedPrediction || !normalizedZone || !normalize(modelVersion) || !sessionId) {
    throw new Error('Complete exhibit feedback context is required');
  }
  if (!['CORRECT', 'WRONG_EXHIBIT', 'NOT_SURE'].includes(normalizedType)) {
    throw new Error('Unsupported exhibit feedback type');
  }
  if (normalizedType === 'WRONG_EXHIBIT' && !normalize(correctedLabel)) {
    throw new Error('A corrected exhibit label is required');
  }

  const record = {
    id: feedbackDedupeKey({
      sessionId,
      zone: normalizedZone,
      predictedLabel: normalizedPrediction,
      correctedLabel: normalize(correctedLabel),
      feedbackType: normalizedType,
    }),
    predictedLabel: normalizedPrediction,
    correctedLabel: normalize(correctedLabel) || null,
    feedbackType: normalizedType,
    confidence: Number.isFinite(Number(confidence)) ? Number(confidence) : 0,
    zone: normalizedZone,
    modelVersion: normalize(modelVersion),
    sessionId,
    createdAt: new Date(now).toISOString(),
    consented: false,
  };
  return record;
}

function openDatabase() {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB is unavailable'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open exhibit feedback store'));
  });
}

export async function saveExhibitFeedback(input) {
  const record = buildFeedbackRecord(input);
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const request = transaction.objectStore(STORE_NAME).add(record);
      request.onsuccess = () => resolve({ saved: true, duplicate: false, record });
      request.onerror = () => {
        if (request.error?.name === 'ConstraintError') {
          resolve({ saved: false, duplicate: true, record });
          return;
        }
        reject(request.error || new Error('Could not save exhibit feedback'));
      };
    });
  } finally {
    database.close();
  }
}

export async function listExhibitFeedback() {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error('Could not read exhibit feedback'));
    });
  } finally {
    database.close();
  }
}