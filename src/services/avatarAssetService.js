const AVATAR_CACHE_NAME = 'taylor-avatar-assets-v1';
const AVATAR_ASSETS = ['/sarah-avatar.glb', '/sarah-idle.glb'];
const AVATAR_TIMEOUT_MS = 30000;

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
  }

  async initialize() {
    if (this.state === 'AVATAR_READY') return this.getDiagnostics();
    if (this.initializePromise) return this.initializePromise;

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
        this.cacheHits += 1;
        this.resources[asset] = { source: 'CACHE', duration: performance.now() - assetStartedAt };
        return 'CACHE';
      }

      this.cacheMisses += 1;
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), AVATAR_TIMEOUT_MS);
      try {
        const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error(`${asset} returned HTTP ${response.status}`);
        await cache.put(url, response.clone());
        this.resources[asset] = { source: 'NETWORK', duration: performance.now() - assetStartedAt };
        return 'NETWORK';
      } catch (error) {
        const reason = error.name === 'AbortError' ? 'timed out' : error.message;
        this.resources[asset] = { source: 'ERROR', duration: performance.now() - assetStartedAt, error: reason };
        throw new Error(`Avatar asset ${asset} failed: ${reason}`);
      } finally {
        window.clearTimeout(timeoutId);
      }
    }));

    this.source = sources.every((source) => source === 'CACHE') ? 'CACHE' : 'NETWORK';
    this.downloadTime = performance.now() - startedAt;
    this.initializationTime = this.downloadTime;
  }

  markFirstRender() {
    if (!this.firstRenderTime) this.firstRenderTime = performance.now();
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
