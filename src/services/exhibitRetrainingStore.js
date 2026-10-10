const DB_NAME = 'taylor-exhibit-retraining';
const DB_VERSION = 1;
const CANDIDATE_STORE = 'candidates';
const MAX_RECORDS = 240;
const MAX_BYTES = 40 * 1024 * 1024;
const CONSENT_KEY = 'taylor-exhibit-retraining-consent';
const CONFIG_KEY = 'taylor-exhibit-retraining-config';

export const DEFAULT_EXHIBIT_RETRAINING_CONFIG = Object.freeze({
  acceptanceThreshold: 0.8,
  minimumMargin: 0.15,
  temporalWindow: 5,
  minimumEvidenceFrames: 2,
  unstableLabelCount: 3,
  captureCooldownMs: 10000,
  maxRecordsPerZone: 60,
  maxRecordsPerClass: 12,
  minimumBrightness: 0.08,
  minimumContrast: 0.02,
});

const hasIndexedDb = () => typeof indexedDB !== 'undefined';

function openDatabase() {
  if (!hasIndexedDb()) return Promise.reject(new Error('IndexedDB is unavailable'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(CANDIDATE_STORE)) {
        const store = database.createObjectStore(CANDIDATE_STORE, { keyPath: 'id' });
        store.createIndex('zone', 'zone');
        store.createIndex('classKey', 'classKey');
        store.createIndex('status', 'status');
        store.createIndex('createdAt', 'createdAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open exhibit retraining store'));
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
  });
}

function id() {
  return globalThis.crypto?.randomUUID?.() || `exhibit-candidate-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getStoredConfig() {
  if (typeof localStorage === 'undefined') return {};
  try {
    const value = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

export function getExhibitRetrainingConfig(overrides = {}) {
  return { ...DEFAULT_EXHIBIT_RETRAINING_CONFIG, ...getStoredConfig(), ...overrides };
}

export function setExhibitRetrainingConfig(config = {}) {
  if (typeof localStorage !== 'undefined') localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  return getExhibitRetrainingConfig();
}

export function getExhibitRetrainingConsent() {
  return typeof localStorage !== 'undefined' && localStorage.getItem(CONSENT_KEY) === 'true';
}

export function setExhibitRetrainingConsent(enabled) {
  if (typeof localStorage !== 'undefined') localStorage.setItem(CONSENT_KEY, enabled ? 'true' : 'false');
}

async function listRecords() {
  const database = await openDatabase();
  try {
    return await requestResult(database.transaction(CANDIDATE_STORE, 'readonly').objectStore(CANDIDATE_STORE).getAll());
  } finally {
    database.close();
  }
}

function frameQuality(frame) {
  if (typeof document === 'undefined' || !frame) return { brightness: null, contrast: null, qualityAccepted: true };
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(frame, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const luminance = [];
  for (let index = 0; index < pixels.length; index += 4) {
    luminance.push((pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722) / 255);
  }
  const brightness = luminance.reduce((sum, value) => sum + value, 0) / luminance.length;
  const variance = luminance.reduce((sum, value) => sum + ((value - brightness) ** 2), 0) / luminance.length;
  const contrast = Math.sqrt(variance);
  const config = getExhibitRetrainingConfig();
  return { brightness, contrast, qualityAccepted: brightness >= config.minimumBrightness && contrast >= config.minimumContrast };
}

async function frameBlob(frame) {
  if (typeof document === 'undefined' || !frame) throw new Error('A camera frame is required');
  const width = frame.videoWidth || frame.width;
  const height = frame.videoHeight || frame.height;
  if (!width || !height) throw new Error('Camera frame is not ready');
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 640 / width);
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  canvas.getContext('2d').drawImage(frame, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Could not encode candidate frame')), 'image/jpeg', 0.78));
  return blob;
}

function temporalEvidence(temporalPredictions, reasons, config) {
  const history = Array.isArray(temporalPredictions) ? temporalPredictions.slice(-config.temporalWindow) : [];
  const uncertainFrames = history.filter((prediction) => prediction.top1_confidence < config.acceptanceThreshold || prediction.confidence_margin < config.minimumMargin).length;
  const labels = new Set(history.map((prediction) => prediction.top1_class).filter(Boolean));
  return {
    frameCount: history.length,
    uncertainFrames,
    distinctLabels: labels.size,
    sufficient: uncertainFrames >= config.minimumEvidenceFrames || (reasons.includes('UNSTABLE') && labels.size >= config.unstableLabelCount),
  };
}

export async function captureExhibitRetrainingCandidate({ frame, zone, modelVersion, top1, top2, temporalPredictions, reasons, source = {} }) {
  if (!getExhibitRetrainingConsent()) return { saved: false, reason: 'consent_required' };
  if (!zone || !modelVersion || !Array.isArray(reasons) || reasons.length === 0) return { saved: false, reason: 'invalid_candidate' };
  const config = getExhibitRetrainingConfig();
  const evidence = temporalEvidence(temporalPredictions, reasons, config);
  if (!evidence.sufficient) return { saved: false, reason: 'insufficient_temporal_evidence', evidence };
  const quality = frameQuality(frame);
  if (!quality.qualityAccepted) return { saved: false, reason: 'poor_frame_quality', quality };
  const records = await listRecords();
  const normalizedZone = String(zone).toUpperCase();
  const classKey = String(top1?.class || top1?.exhibit || 'UNKNOWN');
  const now = Date.now();
  const lastCapture = records.find((record) => record.zone === normalizedZone && record.classKey === classKey && now - record.createdAt < config.captureCooldownMs);
  if (lastCapture) return { saved: false, reason: 'capture_cooldown' };
  if (records.filter((record) => record.zone === normalizedZone).length >= config.maxRecordsPerZone) return { saved: false, reason: 'zone_budget_exhausted' };
  if (records.filter((record) => record.zone === normalizedZone && record.classKey === classKey).length >= config.maxRecordsPerClass) return { saved: false, reason: 'class_budget_exhausted' };
  const record = {
    id: id(),
    status: 'UNVERIFIED',
    zone: normalizedZone,
    classKey,
    modelVersion,
    prediction: { top1: top1 || null, top2: top2 || null },
    temporalPredictions: Array.isArray(temporalPredictions) ? temporalPredictions.slice(-config.temporalWindow) : [],
    reasons: [...new Set(reasons)],
    evidence,
    quality,
    source: { type: source.type || null, sessionId: source.sessionId || null, video: source.video || null },
    createdAt: now,
    consented: true,
    independentlyVerified: false,
    syncedAt: null,
  };
  record.image = await frameBlob(frame);
  const database = await openDatabase();
  try {
    const transaction = database.transaction(CANDIDATE_STORE, 'readwrite');
    transaction.objectStore(CANDIDATE_STORE).put(record);
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
  await enforceStorageLimit();
  return { saved: true, record };
}

// Explicit corrections are eligible for review even when the classifier was confident.
// The corrected label remains UNVERIFIED until a trusted reviewer approves it.
export async function captureCorrectedExhibitCandidate({ frame, zone, modelVersion, predictedLabel, correctedLabel, confidence, source = {} }) {
  if (!getExhibitRetrainingConsent()) return { saved: false, reason: 'consent_required' };
  if (!frame || !zone || !modelVersion || !predictedLabel || !correctedLabel || predictedLabel === correctedLabel) {
    return { saved: false, reason: 'invalid_correction' };
  }
  const config = getExhibitRetrainingConfig();
  const normalizedZone = String(zone).toUpperCase();
  const records = await listRecords();
  const now = Date.now();
  if (records.some((record) => record.zone === normalizedZone && record.source?.sessionId === source.sessionId &&
      record.prediction?.top1?.class === predictedLabel && record.proposedLabel === correctedLabel &&
      now - record.createdAt < config.captureCooldownMs)) {
    return { saved: false, reason: 'duplicate_correction' };
  }
  if (records.filter((record) => record.zone === normalizedZone).length >= config.maxRecordsPerZone ||
      records.filter((record) => record.zone === normalizedZone && record.classKey === predictedLabel).length >= config.maxRecordsPerClass) {
    return { saved: false, reason: 'capture_budget_exhausted' };
  }
  const quality = frameQuality(frame);
  if (!quality.qualityAccepted) return { saved: false, reason: 'poor_frame_quality', quality };
  const record = {
    id: id(),
    status: 'UNVERIFIED',
    zone: normalizedZone,
    classKey: String(predictedLabel),
    proposedLabel: String(correctedLabel),
    modelVersion,
    prediction: { top1: { class: String(predictedLabel), confidence: Number(confidence) || 0 }, top2: null },
    temporalPredictions: [],
    reasons: ['USER_REPORTED_MISCLASSIFICATION'],
    evidence: { frameCount: 1, uncertainFrames: 0, distinctLabels: 1, sufficient: false, userCorrection: true },
    quality,
    source: { type: source.type || 'user_correction', sessionId: source.sessionId || null, video: source.video || null },
    createdAt: now,
    consented: true,
    independentlyVerified: false,
    syncedAt: null,
    image: await frameBlob(frame),
  };
  const database = await openDatabase();
  try {
    const transaction = database.transaction(CANDIDATE_STORE, 'readwrite');
    transaction.objectStore(CANDIDATE_STORE).put(record);
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
  await enforceStorageLimit();
  return { saved: true, record };
}

export async function listExhibitRetrainingCandidates() {
  return listRecords();
}

export async function verifyExhibitRetrainingCandidate(candidateId, label, verificationSource = 'human_review') {
  if (!candidateId || !label || verificationSource === 'model') throw new Error('Independent human verification is required');
  const records = await listRecords();
  const candidate = records.find((record) => record.id === candidateId);
  if (!candidate) throw new Error('Candidate was not found');
  const database = await openDatabase();
  try {
    const transaction = database.transaction(CANDIDATE_STORE, 'readwrite');
    transaction.objectStore(CANDIDATE_STORE).put({ ...candidate, status: 'VERIFIED', label: String(label), independentlyVerified: true, verificationSource, verifiedAt: Date.now() });
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

export async function syncExhibitRetrainingQueue({ endpoint = '/api/exhibit-retraining/sync', fetchImpl = globalThis.fetch } = {}) {
  if (!fetchImpl || (typeof navigator !== 'undefined' && navigator.onLine === false)) return { synced: 0, reason: 'offline' };
  const records = (await listRecords()).filter((record) => !record.syncedAt).slice(0, 10);
  if (!records.length) return { synced: 0, reason: 'empty' };
  const serialized = await Promise.all(records.map(async ({ image, ...record }) => ({
    ...record,
    imageDataUrl: image ? await blobToDataUrl(image) : null,
  })));
  const response = await fetchImpl(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ records: serialized }) });
  if (!response.ok) throw new Error(`Retraining queue sync failed (${response.status})`);
  const result = await response.json();
  const accepted = new Set(result.accepted || []);
  if (accepted.size) {
    const database = await openDatabase();
    try {
      const transaction = database.transaction(CANDIDATE_STORE, 'readwrite');
      const store = transaction.objectStore(CANDIDATE_STORE);
      records.filter((record) => accepted.has(record.id)).forEach((record) => store.put({ ...record, syncedAt: Date.now() }));
      await transactionComplete(transaction);
    } finally {
      database.close();
    }
  }
  return { synced: accepted.size, ...result };
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Could not serialize candidate frame'));
    reader.readAsDataURL(blob);
  });
}

async function enforceStorageLimit() {
  const records = await listRecords();
  let retained = records.sort((first, second) => second.createdAt - first.createdAt).slice(0, MAX_RECORDS);
  while (retained.length > 1) {
    const size = retained.reduce((total, record) => total + (record.image?.size || 0), 0);
    if (size <= MAX_BYTES) break;
    retained.pop();
  }
  const retainedIds = new Set(retained.map((record) => record.id));
  const database = await openDatabase();
  try {
    const transaction = database.transaction(CANDIDATE_STORE, 'readwrite');
    const store = transaction.objectStore(CANDIDATE_STORE);
    records.filter((record) => !retainedIds.has(record.id)).forEach((record) => store.delete(record.id));
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}