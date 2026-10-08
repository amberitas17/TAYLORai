const CACHE_NAME = 'taylor-landmark-approved-models-v1';
const ACTIVE_KEY = 'taylor-landmark-active-model';
const ROLLBACK_KEY = 'taylor-landmark-rollback-model';
const CACHE_METADATA_PREFIX = 'metadata:';
const RETRIEVAL_CACHE_NAME = 'taylor-landmark-retrieval-experimental-v1';

function metadataCacheUrl(id) {
  return new URL(`/__taylor-landmark-metadata/${encodeURIComponent(id)}`, window.location.href).toString();
}

function sha256Hex(buffer) {
  return crypto.subtle.digest('SHA-256', buffer).then((digest) => [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join(''));
}

function readMetadata() {
  try {
    return JSON.parse(localStorage.getItem(ACTIVE_KEY) || 'null');
  } catch {
    return null;
  }
}

export function getActiveLandmarkModel() {
  return readMetadata();
}

export function getRollbackLandmarkModel() {
  try {
    return JSON.parse(localStorage.getItem(ROLLBACK_KEY) || 'null');
  } catch {
    return null;
  }
}

export async function installApprovedLandmarkModel({ manifest, signal } = {}) {
  if (!manifest?.id || !manifest.url || manifest.approved !== true || !manifest.sha256) {
    throw new Error('Only approved models with a URL and SHA-256 can be installed.');
  }
  const response = await fetch(manifest.url, { cache: 'no-store', signal });
  if (!response.ok) throw new Error(`Model download failed with status ${response.status}`);
  const body = await response.arrayBuffer();
  const digest = await sha256Hex(body);
  if (digest.toLowerCase() !== manifest.sha256.toLowerCase()) throw new Error('Model checksum verification failed.');
  const cache = await caches.open(CACHE_NAME);
  const cacheUrl = new URL(manifest.url, window.location.href).toString();
  await cache.put(cacheUrl, new Response(body, { headers: { 'content-type': 'application/octet-stream', 'x-taylor-model-id': manifest.id } }));
  if (manifest.metadataUrl) {
    const metadataResponse = await fetch(manifest.metadataUrl, { cache: 'no-store', signal });
    if (!metadataResponse.ok) throw new Error(`Model metadata download failed with status ${metadataResponse.status}`);
    await cache.put(metadataCacheUrl(manifest.id), new Response(await metadataResponse.text(), { headers: { 'content-type': 'application/json' } }));
  }
  const previous = readMetadata();
  if (previous) localStorage.setItem(ROLLBACK_KEY, JSON.stringify(previous));
  localStorage.setItem(ACTIVE_KEY, JSON.stringify({ ...manifest, cacheUrl, installedAt: new Date().toISOString() }));
  return getActiveLandmarkModel();
}

async function cachedManifestModel(manifest) {
  const cache = await caches.open(CACHE_NAME);
  const active = readMetadata();
  const candidate = active?.approved ? active : manifest;
  if (!candidate?.url || candidate.approved !== true) return null;
  const cacheUrl = candidate.cacheUrl || new URL(candidate.url, window.location.href).toString();
  const response = await cache.match(cacheUrl);
  if (!response) return null;
  const body = await response.arrayBuffer();
  if (candidate.sha256 && (await sha256Hex(body)).toLowerCase() !== candidate.sha256.toLowerCase()) return null;
  let metadata = candidate.metadata || null;
  const metadataResponse = await cache.match(metadataCacheUrl(candidate.id));
  if (metadataResponse) metadata = await metadataResponse.json();
  return { ...candidate, metadata, model: body };
}

export async function loadApprovedLandmarkModel({ manifestUrl = import.meta.env.VITE_LANDMARK_MODEL_MANIFEST, signal } = {}) {
  let manifest = null;
  if (manifestUrl) {
    try {
      const response = await fetch(manifestUrl, { cache: 'no-store', signal });
      if (response.ok) manifest = await response.json();
    } catch {
      // A cached approved model can still initialize while the network is unavailable.
    }
  }
  const cached = await cachedManifestModel(manifest);
  if (cached) return cached;
  if (!manifest || manifest.approved !== true) return null;
  return installApprovedLandmarkModel({ manifest, signal }).then(async (installed) => cachedManifestModel(installed));
}

export async function rollbackLandmarkModel() {
  const rollback = getRollbackLandmarkModel();
  if (!rollback) return null;
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(rollback));
  localStorage.removeItem(ROLLBACK_KEY);
  return rollback;
}

export async function clearLandmarkModelCache() {
  localStorage.removeItem(ACTIVE_KEY);
  localStorage.removeItem(ROLLBACK_KEY);
  return caches.delete(CACHE_NAME);
}

export async function loadExperimentalLandmarkRetrievalModel({
  manifestUrl = '/models/landmark_browser_candidate/retrieval.metadata.json',
  signal,
} = {}) {
  let manifest;
  try {
    const response = await fetch(manifestUrl, { cache: 'no-store', signal });
    if (!response.ok) throw new Error(`Retrieval metadata download failed with status ${response.status}`);
    manifest = await response.json();
  } catch (error) {
    const cache = await caches.open(RETRIEVAL_CACHE_NAME);
    const cached = await cache.match(metadataCacheUrl('retrieval-experimental'));
    if (!cached) throw error;
    manifest = await cached.json();
  }
  if (manifest?.approved === true || manifest?.status !== 'experimental' || manifest?.mode !== 'retrieval') return null;
  if (!manifest.url || !manifest.sha256 || !Array.isArray(manifest.references) || manifest.references.length === 0) return null;

  const cache = await caches.open(RETRIEVAL_CACHE_NAME);
  await cache.put(metadataCacheUrl('retrieval-experimental'), new Response(JSON.stringify(manifest), { headers: { 'content-type': 'application/json' } }));
  const modelUrl = new URL(manifest.url, window.location.href).toString();
  let modelResponse = await cache.match(modelUrl);
  if (!modelResponse) {
    const response = await fetch(manifest.url, { cache: 'no-store', signal });
    if (!response.ok) throw new Error(`Retrieval model download failed with status ${response.status}`);
    const body = await response.arrayBuffer();
    if ((await sha256Hex(body)).toLowerCase() !== manifest.sha256.toLowerCase()) throw new Error('Retrieval model checksum verification failed.');
    await cache.put(modelUrl, new Response(body, { headers: { 'content-type': 'application/octet-stream', 'x-taylor-model-id': manifest.id } }));
    modelResponse = await cache.match(modelUrl);
  }
  const body = await modelResponse.arrayBuffer();
  if ((await sha256Hex(body)).toLowerCase() !== manifest.sha256.toLowerCase()) throw new Error('Cached retrieval model checksum verification failed.');
  return { ...manifest, model: body, cacheUrl: modelUrl };
}

export async function clearExperimentalLandmarkRetrievalCache() {
  return caches.delete(RETRIEVAL_CACHE_NAME);
}
