const DB_NAME = 'taylor-exhibit-explanations';
const STORE_NAME = 'explanations';
const DB_VERSION = 1;
export const EXPLANATION_KNOWLEDGE_VERSION = 'exhibit-explanations-v1';

function cacheKey(center, exhibit, version = EXPLANATION_KNOWLEDGE_VERSION) {
  return `${String(center).toUpperCase()}:${String(exhibit).trim()}:${version}`;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB is unavailable'));
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open explanation cache'));
  });
}

export async function getCachedExhibitExplanation(center, exhibit, version = EXPLANATION_KNOWLEDGE_VERSION) {
  try {
    const db = await openDatabase();
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(cacheKey(center, exhibit, version));
      request.onsuccess = () => resolve(request.result?.explanation || null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

export async function cacheExhibitExplanation(center, exhibit, explanation, version = EXPLANATION_KNOWLEDGE_VERSION) {
  if (!explanation?.verified || !explanation?.whatIsIt || !explanation?.purpose || !explanation?.sources?.length) return false;
  try {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put({
        key: cacheKey(center, exhibit, version),
        explanation: { ...explanation, knowledgeVersion: version, cachedAt: new Date().toISOString() },
      });
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
    return true;
  } catch {
    return false;
  }
}

export async function requestExhibitExplanation({ center, recognitionLabel, displayName, signal }) {
  const response = await fetch('/api/exhibit-explanation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ center, recognitionLabel, displayName }),
    signal,
  });
  if (!response.ok) throw new Error(`Explanation request failed (${response.status})`);
  const payload = await response.json();
  if (!payload.success || !payload.explanation?.verified) throw new Error('Explanation was not verified by the server');
  return payload.explanation;
}

export { cacheKey };
