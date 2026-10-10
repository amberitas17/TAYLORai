import { captureLandmarkCandidate, getLandmarkLearningConsent } from './landmarkLearningStore.js';

const DB_NAME = 'taylor-confidence-retraining';
const DB_VERSION = 1;
const STORE_NAME = 'queue';
const MAX_RECORDS = 120;
const MAX_PER_CLASS = 12;
const MIN_VERIFIED_PER_CLASS = 12;
const LOW_CONFIDENCE = 0.8;
const LOW_MARGIN = 0.15;
const COOLDOWN_MS = 5 * 60 * 1000;
const HISTORY_LENGTH = 5;

const endpoint = () => typeof import.meta !== 'undefined' && import.meta.env?.VITE_RETRAINING_BATCH_ENDPOINT;
const trainingEndpoint = () => typeof import.meta !== 'undefined' && import.meta.env?.VITE_RETRAINING_TRAIN_ENDPOINT;
const hasIndexedDb = () => typeof indexedDB !== 'undefined';

function openDatabase() {
  if (!hasIndexedDb()) return Promise.reject(new Error('IndexedDB is unavailable'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('zone', 'zone');
        store.createIndex('classKey', 'classKey');
        store.createIndex('status', 'status');
        store.createIndex('createdAt', 'createdAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open retraining queue'));
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Retraining queue request failed'));
  });
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error('Retraining queue transaction failed'));
    transaction.onabort = () => reject(transaction.error || new Error('Retraining queue transaction aborted'));
  });
}

async function listRecords() {
  const database = await openDatabase();
  try {
    return await requestResult(database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll());
  } finally {
    database.close();
  }
}

async function putRecords(records) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    records.forEach((record) => store.put(record));
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

function score(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

export class ConfidenceRetrainingQueue {
  constructor({ now = () => Date.now() } = {}) {
    this.now = now;
    this.history = new Map();
    this.lastCaptured = new Map();
    this.onlineHandler = () => { this.syncVerified().catch(() => {}); };
    if (typeof window !== 'undefined') window.addEventListener('online', this.onlineHandler);
  }

  dispose() {
    if (typeof window !== 'undefined') window.removeEventListener('online', this.onlineHandler);
  }

  async observe({ zone, detection, video, modelVersion, sourceSession }) {
    const normalizedZone = String(zone || '').trim().toUpperCase();
    if (!['ARICC', 'RECON', 'FABLAB', 'CAESAR'].includes(normalizedZone) ||
      !getLandmarkLearningConsent() || !video?.videoWidth || !video?.videoHeight) {
      return { captured: false, reason: 'consent_or_frame_unavailable' };
    }

    const top1 = detection?.top1 || {
      class: detection?.exhibit || detection?.exhibitInfo?.code || 'UNKNOWN',
      confidence: detection?.exhibitConfidence
    };
    const top2 = detection?.top2 || { class: 'UNKNOWN', confidence: 0 };
    const prediction = {
      top1: String(top1.class || 'UNKNOWN'),
      top2: String(top2.class || 'UNKNOWN'),
      confidence: score(top1.confidence),
      margin: score(top1.confidence) - score(top2.confidence)
    };
    const historyKey = `${normalizedZone}:${prediction.top1}`;
    const history = [...(this.history.get(historyKey) || []), {
      label: prediction.top1,
      confidence: prediction.confidence,
      margin: prediction.margin
    }].slice(-HISTORY_LENGTH);
    this.history.set(historyKey, history);

    const unstable = history.length >= 3 && new Set(history.map((item) => item.label)).size > 1;
    const repeatedLowSignal = history.length >= 3 &&
      history.slice(-3).every((item) => item.confidence < LOW_CONFIDENCE || item.margin < LOW_MARGIN);
    const reasons = [];
    if (prediction.confidence < LOW_CONFIDENCE) reasons.push('LOW_CONFIDENCE');
    if (prediction.margin < LOW_MARGIN) reasons.push('LOW_MARGIN');
    if (unstable) reasons.push('UNSTABLE');
    if (repeatedLowSignal) reasons.push('REPEATED_REJECTION');
    if (!reasons.length || history.length < 3 || this.now() - (this.lastCaptured.get(historyKey) || 0) < COOLDOWN_MS) {
      return { captured: false, reason: 'temporal_threshold_not_met' };
    }

    this.lastCaptured.set(historyKey, this.now());
    const result = await captureLandmarkCandidate({
      video,
      prediction: {
        top1: prediction.top1,
        top2: prediction.top2,
        confidence: prediction.confidence
      },
      sourceSession,
      modelVersion,
      trigger: 'confidence_retraining',
      reasons,
      proposedLabel: null
    });
    if (!result.saved) return result;

    const records = await listRecords();
    const candidate = {
      id: result.record.id,
      zone: normalizedZone,
      classKey: prediction.top1,
      predictedLabel: prediction.top1,
      confidence: prediction.confidence,
      margin: prediction.margin,
      reasons,
      modelVersion,
      sourceSession,
      status: 'PENDING_VERIFICATION',
      verifiedLabel: null,
      createdAt: this.now(),
      syncedAt: null
    };
    const nextRecords = [...records.filter((item) => item.id !== candidate.id), candidate]
      .sort((first, second) => second.createdAt - first.createdAt)
      .filter((item, index, all) => {
        const sameClass = all.filter((other) => other.zone === item.zone && other.classKey === item.classKey);
        return sameClass.findIndex((other) => other.id === item.id) < MAX_PER_CLASS;
      })
      .slice(0, MAX_RECORDS);
    await putRecords(nextRecords);
    return { captured: true, candidate };
  }

  async list() {
    return listRecords();
  }

  async markVerified(idToVerify, verifiedLabel) {
    if (!idToVerify || !verifiedLabel) return { updated: false, reason: 'verified_label_required' };
    const records = await listRecords();
    const record = records.find((item) => item.id === idToVerify);
    if (!record) return { updated: false, reason: 'candidate_not_found' };
    record.verifiedLabel = String(verifiedLabel);
    record.status = 'VERIFIED';
    await putRecords(records);
    return { updated: true, record };
  }

  async markLatestVerified({ zone, predictedLabel, verifiedLabel }) {
    const records = await listRecords();
    const record = records
      .filter((item) => item.zone === String(zone || '').toUpperCase() &&
        item.predictedLabel === predictedLabel &&
        item.status === 'PENDING_VERIFICATION')
      .sort((first, second) => second.createdAt - first.createdAt)[0];
    return record
      ? this.markVerified(record.id, verifiedLabel)
      : { updated: false, reason: 'candidate_not_found' };
  }

  async getReadiness() {
    const records = await listRecords();
    const verified = records.filter((record) => record.status === 'VERIFIED' && record.verifiedLabel);
    const byZoneClass = {};
    verified.forEach((record) => {
      const key = `${record.zone}:${record.verifiedLabel}`;
      byZoneClass[key] = (byZoneClass[key] || 0) + 1;
    });
    return {
      verifiedCount: verified.length,
      byZoneClass,
      ready: Object.values(byZoneClass).some((count) => count >= MIN_VERIFIED_PER_CLASS),
      blockedReason: verified.length === 0 ? 'insufficient_verified_labeled_data' : null
    };
  }

  async syncVerified() {
    const url = endpoint();
    if (!url || typeof navigator !== 'undefined' && !navigator.onLine) return { synced: false, reason: 'sync_endpoint_or_connectivity_unavailable' };
    const records = (await listRecords()).filter((record) => record.status === 'VERIFIED' && !record.syncedAt);
    if (!records.length) return { synced: false, reason: 'no_verified_records' };
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'taylorai', records })
    });
    if (!response.ok) throw new Error(`Retraining batch upload failed (${response.status})`);
    const syncedAt = new Date().toISOString();
    const allRecords = await listRecords();
    const syncedIds = new Set(records.map((record) => record.id));
    allRecords.forEach((record) => {
      if (syncedIds.has(record.id)) record.syncedAt = syncedAt;
    });
    await putRecords(allRecords);
    const readiness = await this.getReadiness();
    let training = { triggered: false, reason: 'training_endpoint_unavailable' };
    if (readiness.ready && trainingEndpoint()) {
      const trainingResponse = await fetch(trainingEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'taylorai',
          sourceModelVersion: records[0].modelVersion,
          candidateOnly: true,
          readiness
        })
      });
      training = trainingResponse.ok
        ? { triggered: true, response: await trainingResponse.json().catch(() => null) }
        : { triggered: false, reason: `training_trigger_failed_${trainingResponse.status}` };
    }
    return { synced: true, count: records.length, readiness, training };
  }
}

export const confidenceRetrainingQueue = new ConfidenceRetrainingQueue();
