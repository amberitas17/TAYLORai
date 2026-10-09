const AVATAR_CACHE_NAME = 'taylor-avatar-assets-v1';
const AVATAR_ASSETS = ['/sarah-avatar.glb'];
const AVATAR_TIMEOUT_MS = 30000;
const AVATAR_MAX_ATTEMPTS = 3;

class AvatarAssetService {
  constructor() {
    this.initializePromise = null;
    this.state = 'AVATAR_LOADING';
    this.source = 'NETWORK';
    this.downloadTime = 0;
    this.initializationTime = 0;
    this.firstRenderTime = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.error = '';
    this.resources = {};
    this.loadStartedAt = 0;
  }

  async initialize() {
    if (this.state === 'AVATAR_READY') return this.getDiagnostics();
    if (this.initializePromise) return this.initializePromise;

    this.loadStartedAt = performance.now();
    this.initializePromise = this.loadAssets()
      .then(() => {
        this.state = 'AVATAR_READY';
        return this.getDiagnostics();
      })
      .catch((error) => {
        this.state = 'AVATAR_ERROR';
        this.error = error.message || 'Avatar assets failed to load.';
        this.initializePromise = null;
        throw error;
      });
    return this.initializePromise;
  }

  async loadAssets() {
    const startedAt = performance.now();
    const cache = await caches.open(AVATAR_CACHE_NAME);
    const sources = await Promise.all(AVATAR_ASSETS.map(async (asset) => {
      const assetStartedAt = performance.now();
      const url = new URL(asset, window.location.origin).href;
      const cached = await cache.match(url);
      if (cached) {
        this.state = 'AVATAR_LOADING_FROM_CACHE';
        this.cacheHits += 1;
        this.resources[asset] = { source: 'CACHE', duration: performance.now() - assetStartedAt };
        return 'CACHE';
      }

      this.state = 'AVATAR_DOWNLOADING';
      this.cacheMisses += 1;
      let lastError;
      for (let attempt = 0; attempt < AVATAR_MAX_ATTEMPTS; attempt += 1) {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), AVATAR_TIMEOUT_MS);
        try {
          const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
          if (!response.ok) {
            const error = new Error(`${asset} returned HTTP ${response.status}`);
            error.retryable = response.status === 408 || response.status === 429 || response.status >= 500;
            throw error;
          }
          await cache.put(url, response.clone());
          if (!await cache.match(url)) throw new Error(`${asset} could not be verified in Cache Storage`);
          this.resources[asset] = { source: 'NETWORK', attempts: attempt + 1, duration: performance.now() - assetStartedAt };
          return 'NETWORK';
        } catch (error) {
          lastError = error;
          if (attempt + 1 >= AVATAR_MAX_ATTEMPTS || error.retryable === false) break;
          await new Promise((resolve) => window.setTimeout(resolve, 500 * (2 ** attempt)));
        } finally {
          window.clearTimeout(timeoutId);
        }
      }
      const reason = lastError?.name === 'AbortError' ? 'timed out' : lastError?.message || 'network request failed';
      this.resources[asset] = { source: 'ERROR', attempts: AVATAR_MAX_ATTEMPTS, duration: performance.now() - assetStartedAt, error: reason };
      throw new Error(`Avatar asset ${asset} failed: ${reason}`);
    }));

    this.source = sources.every((source) => source === 'CACHE') ? 'CACHE' : 'NETWORK';
    this.downloadTime = performance.now() - startedAt;
    this.initializationTime = this.downloadTime;
  }

  markFirstRender() {
    if (!this.firstRenderTime) {
      this.firstRenderTime = performance.now() - this.loadStartedAt;
      this.initializationTime = this.firstRenderTime;
    }
  }

  getDiagnostics() {
    return {
      state: this.state,
      source: this.source,
      downloadTime: this.downloadTime,
      initializationTime: this.initializationTime,
      firstRenderTime: this.firstRenderTime,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      error: this.error,
      resources: this.resources,
    };
  }
}

export const avatarAssetService = new AvatarAssetService();
export default avatarAssetService;
