const BOOTSTRAP_CACHE = 'taylor-essential-shell-v1';
const REQUEST_TIMEOUT_MS = 8000;
const RETRIES = 2;
const STATIC_ESSENTIAL_RESOURCES = [
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg'
];

function getEssentialResources() {
  const documentResources = [...document.querySelectorAll('script[src], link[rel="stylesheet"]')]
    .map((element) => element.src || element.href)
    .filter((url) => url && new URL(url, window.location.origin).origin === window.location.origin)
    .map((url) => new URL(url, window.location.origin).pathname);
  return [...new Set([...STATIC_ESSENTIAL_RESOURCES, ...documentResources])];
}

const listeners = new Set();
let bootstrapPromise = null;
let snapshot = {
  state: 'BOOTSTRAP_PENDING',
  completed: 0,
  total: STATIC_ESSENTIAL_RESOURCES.length,
  resources: {}
};

function publish(nextSnapshot) {
  snapshot = { ...snapshot, ...nextSnapshot };
  listeners.forEach((listener) => listener(snapshot));
}

async function fetchWithTimeout(url) {
  let lastError;
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < RETRIES) await new Promise((resolve) => window.setTimeout(resolve, 250 * (attempt + 1)));
    } finally {
      window.clearTimeout(timeout);
    }
  }
  throw lastError;
}

async function verifyOrFetch(resource, cache) {
  const cached = await caches.match(resource);
  if (cached) return 'CACHE';

  const response = await fetchWithTimeout(resource);
  await cache.put(resource, response.clone());
  if (!await cache.match(resource)) throw new Error('Cache verification failed');
  return 'NETWORK';
}

async function bootstrap() {
  const essentialResources = getEssentialResources();
  if ('serviceWorker' in navigator) {
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((resolve) => window.setTimeout(resolve, REQUEST_TIMEOUT_MS))
    ]);
  }
  const cache = await caches.open(BOOTSTRAP_CACHE);
  const resources = {};
  let completed = 0;
  publish({ state: 'BOOTSTRAP_PREPARING', completed, total: essentialResources.length, resources });

  for (const resource of essentialResources) {
    try {
      const source = await verifyOrFetch(resource, cache);
      resources[resource] = { state: 'READY', source };
      completed += 1;
      publish({ completed, total: essentialResources.length, resources });
    } catch (error) {
      resources[resource] = { state: 'MISSING', error: error.message || 'Request failed' };
      publish({ state: 'BOOTSTRAP_NEEDS_CONNECTION', total: essentialResources.length, resources });
    }
  }

  const ready = completed === essentialResources.length;
  publish({ state: ready ? 'BOOTSTRAP_READY' : 'BOOTSTRAP_NEEDS_CONNECTION', total: essentialResources.length, completed, resources });
  return snapshot;
}

export function startPwaBootstrap() {
  if (!bootstrapPromise) {
    bootstrapPromise = bootstrap().catch((error) => {
      publish({ state: 'BOOTSTRAP_NEEDS_CONNECTION', error: error.message || 'Unable to prepare shell' });
      return snapshot;
    });
  }
  return bootstrapPromise;
}

export function subscribePwaBootstrap(listener) {
  listeners.add(listener);
  listener(snapshot);
  return () => listeners.delete(listener);
}

export function getPwaBootstrapSnapshot() {
  return snapshot;
}