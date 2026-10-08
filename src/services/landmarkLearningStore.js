const DB_NAME = 'taylor-landmark-learning';
const DB_VERSION = 2;
const STORES = ['unverified', 'confirmed', 'corrected', 'rejected', 'landmarkRegistry', 'syncQueue'];
const EXAMPLE_STORES = ['unverified', 'confirmed', 'corrected', 'rejected'];
const MAX_EXAMPLES = 120;
const MAX_BYTES = 50 * 1024 * 1024;
const CONSENT_KEY = 'taylor-landmark-learning-consent';

const hasIndexedDb = () => typeof indexedDB !== 'undefined';

function openDatabase() {
  if (!hasIndexedDb()) return Promise.reject(new Error('IndexedDB is unavailable'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      STORES.forEach((storeName) => {
        if (database.objectStoreNames.contains(storeName)) return;
        const store = database.createObjectStore(storeName, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
        store.createIndex('visualHash', 'visualHash');
        store.createIndex('label', 'label');
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open landmark learning store'));
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

function uid() {
  return globalThis.crypto?.randomUUID?.() || `candidate-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function imageHash(frame) {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(frame, 0, 0, 16, 16);
  const pixels = context.getImageData(0, 0, 16, 16).data;
  let total = 0;
  const values = [];
  for (let index = 0; index < pixels.length; index += 4) {
    const value = Math.round((pixels[index] * 299 + pixels[index + 1] * 587 + pixels[index + 2] * 114) / 1000);
    values.push(value);
    total += value;
  }
  const average = total / values.length;
  return values.map((value) => value >= average ? '1' : '0').join('');
}

function visualEmbedding(frame) {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(frame, 0, 0, 32, 32);
  const pixels = context.getImageData(0, 0, 32, 32).data;
  const values = [];
  for (let index = 0; index < pixels.length; index += 4) {
    values.push((pixels[index] * 299 + pixels[index + 1] * 587 + pixels[index + 2] * 114) / 255000);
  }
  const norm = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0)) || 1;
  return values.map((value) => Number((value / norm).toFixed(5)));
}

function hashDistance(first, second) {
  if (!first || !second || first.length !== second.length) return Number.POSITIVE_INFINITY;
  let distance = 0;
  for (let index = 0; index < first.length; index += 1) distance += first[index] === second[index] ? 0 : 1;
  return distance;
}

function embeddingSimilarity(first, second) {
  if (!Array.isArray(first) || !Array.isArray(second) || first.length !== second.length) return 0;
  return first.reduce((sum, value, index) => sum + value * second[index], 0);
}

async function frameBlobAndHash(video) {
  if (!video || !video.videoWidth || !video.videoHeight) throw new Error('Camera frame is not ready');
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 640 / video.videoWidth);
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  const hash = imageHash(canvas);
  const embedding = visualEmbedding(canvas);
  const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Could not encode camera frame')), 'image/jpeg', 0.78));
  return { blob, visualHash: hash, embedding };
}

function consentEnabled() {
  return typeof localStorage !== 'undefined' && localStorage.getItem(CONSENT_KEY) === 'true';
}

export function getLandmarkLearningConsent() {
  return consentEnabled();
}

export function setLandmarkLearningConsent(enabled) {
  if (typeof localStorage !== 'undefined') localStorage.setItem(CONSENT_KEY, enabled ? 'true' : 'false');
}

async function allRecords(storeName) {
  const database = await openDatabase();
  try {
    return await requestResult(database.transaction(storeName, 'readonly').objectStore(storeName).getAll());
  } finally {
    database.close();
  }
}

export async function getLearningSummary() {
  const records = (await Promise.all(EXAMPLE_STORES.map(allRecords))).flat();
  const byLabel = {};
  records.filter((record) => record.status !== 'unverified' && record.label).forEach((record) => {
    byLabel[record.label] = (byLabel[record.label] || 0) + 1;
  });
  return { total: records.length, unverified: records.filter((record) => record.status === 'unverified').length, confirmed: records.filter((record) => record.status === 'confirmed').length, corrected: records.filter((record) => record.status === 'corrected').length, rejected: records.filter((record) => record.status === 'rejected').length, byLabel };
}

export async function getLandmarkLearningDiagnostics() {
  const records = (await Promise.all(EXAMPLE_STORES.map(allRecords))).flat();
  const byHash = new Map();
  records.filter((record) => record.status !== 'unverified').forEach((record) => {
    const examples = byHash.get(record.visualHash) || [];
    examples.push({ id: record.id, label: record.label, status: record.status });
    byHash.set(record.visualHash, examples);
  });
  const contradictions = [...byHash.entries()]
    .map(([visualHash, examples]) => ({ visualHash, examples, labels: [...new Set(examples.map((example) => example.label))] }))
    .filter((group) => group.labels.length > 1);
  const summary = await getLearningSummary();
  const counts = Object.values(summary.byLabel);
  return {
    contradictions,
    classImbalance: counts.length > 1 ? { minimum: Math.min(...counts), maximum: Math.max(...counts), ratio: Math.max(...counts) / Math.max(1, Math.min(...counts)) } : null,
    verifiedExamples: summary.confirmed + summary.corrected,
  };
}

export async function captureLandmarkCandidate({ video, prediction, sourceSession, modelVersion, modelEmbedding = null, embeddingModelVersion = null, trigger = 'uncertain', reasons = [] }) {
  if (!consentEnabled()) return { saved: false, reason: 'consent_required' };
  const { blob, visualHash, embedding } = await frameBlobAndHash(video);
  const records = (await Promise.all(EXAMPLE_STORES.map(allRecords))).flat();
  if (records.some((record) => hashDistance(record.visualHash, visualHash) <= 10)) return { saved: false, reason: 'duplicate' };
  const record = {
    id: uid(),
    status: 'unverified',
    blob,
    visualHash,
    top1: prediction.top1,
    top2: prediction.top2,
    rawScores: prediction.rawScores || null,
    confidence: prediction.confidence,
    timestamp: new Date().toISOString(),
    createdAt: Date.now(),
    sourceSession,
    modelVersion,
    trigger,
    reasons,
    embedding,
    modelEmbedding: Array.isArray(modelEmbedding) ? modelEmbedding : null,
    embeddingModelVersion: embeddingModelVersion || null,
    label: null,
    consented: true,
  };
  const database = await openDatabase();
  try {
    const transaction = database.transaction('unverified', 'readwrite');
    transaction.objectStore('unverified').put(record);
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
  await enforceStorageLimit();
  return { saved: true, record };
}

export async function captureCorrectedLandmarkCandidate({ video, prediction, sourceSession, modelVersion }) {
  return captureLandmarkCandidate({
    video,
    prediction,
    sourceSession,
    modelVersion,
    trigger: 'user_correction',
    reasons: ['user_correction'],
  });
}

export async function labelLandmarkCandidate(record, label, mode) {
  if (!record?.id || !label || !['confirmed', 'corrected'].includes(mode)) throw new Error('A valid label action is required');
  const database = await openDatabase();
  try {
    const transaction = database.transaction(['unverified', mode], 'readwrite');
    transaction.objectStore('unverified').delete(record.id);
    transaction.objectStore(mode).put({ ...record, status: mode, label, reviewedAt: new Date().toISOString(), createdAt: record.createdAt || Date.now() });
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
  await registerVerifiedLandmark({ label, record: { ...record, status: mode }, category: 'indoor_landmark' });
  return getLearningSummary();
}

export async function dismissLandmarkCandidate(record) {
  if (!record?.id) return;
  const database = await openDatabase();
  try {
    const transaction = database.transaction(['unverified', 'rejected'], 'readwrite');
    transaction.objectStore('unverified').delete(record.id);
    transaction.objectStore('rejected').put({ ...record, status: 'rejected', rejectedAt: new Date().toISOString() });
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

export async function markLandmarkCandidateUnknown(record) {
  if (!record?.id) return;
  const database = await openDatabase();
  try {
    const transaction = database.transaction(['unverified', 'rejected'], 'readwrite');
    transaction.objectStore('unverified').delete(record.id);
    transaction.objectStore('rejected').put({ ...record, status: 'rejected', label: 'unknown', rejectedAt: new Date().toISOString() });
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

export async function deleteLandmarkExample(storeName, id) {
  if (!STORES.includes(storeName)) throw new Error('Unknown landmark example store');
  const database = await openDatabase();
  try {
    const transaction = database.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).delete(id);
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

export async function exportVerifiedLandmarkExamples() {
  const records = (await Promise.all(['confirmed', 'corrected'].map(allRecords))).flat();
  const toDataUrl = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Could not read stored image'));
    reader.readAsDataURL(blob);
  });
  return Promise.all(records.map(async ({ blob, ...metadata }) => ({ ...metadata, imageDataUrl: await toDataUrl(blob) })));
}

export async function listLandmarkRecords(storeName) {
  if (!STORES.includes(storeName)) throw new Error('Unknown landmark example store');
  return allRecords(storeName);
}

export async function registerVerifiedLandmark({ label, record, building = null, floor = null, category = 'indoor_landmark', mapPosition = null }) {
  if (!label || !record?.id) throw new Error('A verified landmark label and reference are required');
  const database = await openDatabase();
  const existing = await requestResult(database.transaction('landmarkRegistry', 'readonly').objectStore('landmarkRegistry').getAll());
  const current = existing.find((item) => item.label === label);
  const registry = current || {
    id: `landmark-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    label,
    name: label,
    building,
    floor,
    category,
    mapPosition,
    verificationStatus: 'user_verified',
    referenceIds: [],
    correctionHistory: [],
    modelVersions: [],
    provenance: [],
    createdAt: Date.now(),
  };
  registry.referenceIds ||= [];
  registry.modelVersions ||= [];
  registry.provenance ||= [];
  registry.correctionHistory ||= [];
  if (!registry.referenceIds.includes(record.id)) registry.referenceIds.push(record.id);
  if (record.modelVersion && !registry.modelVersions.includes(record.modelVersion)) registry.modelVersions.push(record.modelVersion);
  registry.provenance.push({ recordId: record.id, sourceSession: record.sourceSession, modelVersion: record.modelVersion, verifiedAt: new Date().toISOString() });
  registry.correctionHistory.push({ recordId: record.id, status: record.status, label, verifiedAt: new Date().toISOString() });
  registry.updatedAt = Date.now();
  try {
    const transaction = database.transaction('landmarkRegistry', 'readwrite');
    transaction.objectStore('landmarkRegistry').put(registry);
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
  return registry;
}

export async function findVerifiedLandmarkMatch(embedding, { minimumSimilarity = 0.92 } = {}) {
  if (!Array.isArray(embedding)) return null;
  const [registry, confirmed, corrected] = await Promise.all([
    allRecords('landmarkRegistry'),
    allRecords('confirmed'),
    allRecords('corrected'),
  ]);
  const references = [...confirmed, ...corrected];
  let best = null;
  for (const landmark of registry) {
    for (const referenceId of landmark.referenceIds || []) {
      const reference = references.find((item) => item.id === referenceId);
      const similarity = embeddingSimilarity(embedding, reference?.embedding);
      if (similarity >= minimumSimilarity && (!best || similarity > best.similarity)) best = { landmark: landmark.label, similarity, referenceId };
    }
  }
  return best;
}

export async function findVerifiedLandmarkMatchForVideo(video, options) {
  if (!consentEnabled()) return null;
  const { embedding } = await frameBlobAndHash(video);
  return findVerifiedLandmarkMatch(embedding, options);
}

export async function queueVerifiedSync(recordIds) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction('syncQueue', 'readwrite');
    transaction.objectStore('syncQueue').put({ id: `sync-${Date.now()}`, recordIds, status: 'queued', attempts: 0, createdAt: Date.now() });
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

async function queuedSyncRecords() {
  return allRecords('syncQueue');
}

async function acknowledgeQueuedSync(recordIds) {
  if (!recordIds.length) return;
  const database = await openDatabase();
  try {
    const transaction = database.transaction('syncQueue', 'readwrite');
    const store = transaction.objectStore('syncQueue');
    const queued = await requestResult(store.getAll());
    queued.filter((entry) => entry.recordIds?.some((id) => recordIds.includes(id))).forEach((entry) => store.delete(entry.id));
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

function secureSyncEndpoint(endpoint) {
  try {
    const url = new URL(endpoint, globalThis.location?.origin);
    return url.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(url.hostname);
  } catch {
    return false;
  }
}

export async function syncVerifiedLandmarkExamples({ endpoint, signal } = {}) {
  if (!consentEnabled()) return { synced: false, reason: 'consent_required' };
  if (!endpoint || !secureSyncEndpoint(endpoint)) return { synced: false, reason: 'secure_endpoint_required' };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { synced: false, reason: 'offline' };
  const examples = await exportVerifiedLandmarkExamples();
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-taylor-learning-schema': '1',
      },
      body: JSON.stringify({ examples }),
      signal,
    });
    if (!response.ok) throw new Error(`Sync failed with status ${response.status}`);
    const result = await response.json().catch(() => ({}));
    const accepted = Array.isArray(result.accepted) ? result.accepted : examples.map((example) => example.id);
    await acknowledgeQueuedSync(accepted);
    return { synced: true, count: accepted.length, batchId: result.batchId || null };
  } catch (error) {
    await queueVerifiedSync(examples.map((example) => example.id));
    return { synced: false, reason: 'queued', error };
  }
}

export async function getLandmarkSyncQueue() {
  return queuedSyncRecords();
}

export async function clearLandmarkLearningExamples() {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORES, 'readwrite');
    STORES.forEach((storeName) => transaction.objectStore(storeName).clear());
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

async function enforceStorageLimit() {
  const database = await openDatabase();
  try {
    const records = (await Promise.all(EXAMPLE_STORES.map((storeName) => requestResult(database.transaction(storeName, 'readonly').objectStore(storeName).getAll())))).flat();
    let totalBytes = records.reduce((sum, record) => sum + (record.blob?.size || 0), 0);
    const removable = records.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
    const deletions = [];
    while (records.length - deletions.length > MAX_EXAMPLES || totalBytes > MAX_BYTES) {
      const record = removable.shift();
      if (!record) break;
      deletions.push(record);
      totalBytes -= record.blob?.size || 0;
    }
    for (const record of deletions) {
      const transaction = database.transaction(record.status, 'readwrite');
      transaction.objectStore(record.status).delete(record.id);
      await transactionComplete(transaction);
    }
  } finally {
    database.close();
  }
}

export const LANDMARK_LEARNING_LIMITS = Object.freeze({ maxExamples: MAX_EXAMPLES, maxBytes: MAX_BYTES });
