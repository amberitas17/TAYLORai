const DEFAULT_STORAGE_KEY = 'taylorExhibitImprovementCandidates';
const DEFAULT_MAX_CANDIDATES = 100;
const DEFAULT_MAX_STORAGE_BYTES = 2 * 1024 * 1024;
const DEFAULT_RATE_LIMIT_MS = 10000;
const DEFAULT_DEDUP_WINDOW_MS = 30000;

export const IMPROVEMENT_CANDIDATE_REASONS = Object.freeze([
    'LOW_CONFIDENCE',
    'LOW_MARGIN',
    'UNSTABLE',
    'REPEATED_REJECTION',
    'FALSE_POSITIVE_CANDIDATE',
    'UNKNOWN'
]);

const isFiniteNumber = value => Number.isFinite(Number(value));

const normalizeScore = score => ({
    class: score?.class ?? null,
    confidence: isFiniteNumber(score?.confidence) ? Number(score.confidence) : 0
});

const sizeInBytes = value => new Blob([JSON.stringify(value)]).size;

const safeNow = () => new Date().toISOString();

export class ExhibitImprovementCandidateStore {
    constructor({
        storage,
        storageKey = DEFAULT_STORAGE_KEY,
        maxCandidates = DEFAULT_MAX_CANDIDATES,
        maxStorageBytes = DEFAULT_MAX_STORAGE_BYTES,
        rateLimitMs = DEFAULT_RATE_LIMIT_MS,
        dedupWindowMs = DEFAULT_DEDUP_WINDOW_MS,
        now = () => Date.now(),
        idFactory = () => `candidate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    } = {}) {
        this.storage = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
        this.storageKey = storageKey;
        this.maxCandidates = maxCandidates;
        this.maxStorageBytes = maxStorageBytes;
        this.rateLimitMs = rateLimitMs;
        this.dedupWindowMs = dedupWindowMs;
        this.now = now;
        this.idFactory = idFactory;
        this.lastCapturedAt = new Map();
        this.recentKeys = new Map();
    }

    read() {
        if (!this.storage) return [];
        try {
            const parsed = JSON.parse(this.storage.getItem(this.storageKey) || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    write(candidates) {
        if (!this.storage) return false;
        try {
            this.storage.setItem(this.storageKey, JSON.stringify(candidates));
            return true;
        } catch {
            return false;
        }
    }

    getDiagnostics() {
        const candidates = this.read();
        return {
            count: candidates.length,
            storageKey: this.storageKey,
            maxCandidates: this.maxCandidates,
            maxStorageBytes: this.maxStorageBytes,
            oldestTimestamp: candidates[candidates.length - 1]?.timestamp || null,
            newestTimestamp: candidates[0]?.timestamp || null
        };
    }

    list() {
        return this.read();
    }

    clear() {
        if (!this.storage) return false;
        try {
            this.storage.removeItem(this.storageKey);
            this.lastCapturedAt.clear();
            this.recentKeys.clear();
            return true;
        } catch {
            return false;
        }
    }

    capture({
        zone,
        timestamp = safeNow(),
        timestampSeconds = null,
        modelVersion,
        top1,
        top2,
        temporalPredictions = [],
        candidateReasons,
        source = {},
        humanGroundTruth = null,
        reviewStatus = 'PENDING',
        datasetVersionAdded = null
    }) {
        if (!zone || !modelVersion || !Array.isArray(candidateReasons) || candidateReasons.length === 0) {
            return { captured: false, reason: 'invalid_candidate' };
        }

        const normalizedTop1 = normalizeScore(top1);
        const normalizedTop2 = normalizeScore(top2);
        const confidenceMargin = normalizedTop1.confidence - normalizedTop2.confidence;
        const sourceKey = source.sessionId || source.video || source.type || 'unknown-source';
        const classKey = `${normalizedTop1.class || 'UNKNOWN'}:${normalizedTop2.class || 'UNKNOWN'}`;
        const dedupKey = `${zone}:${sourceKey}:${classKey}:${Math.round(confidenceMargin * 100)}`;
        const now = this.now();
        const previousCaptureAt = this.lastCapturedAt.get(dedupKey) || 0;
        const previousKeyAt = this.recentKeys.get(dedupKey) || 0;

        if (now - previousCaptureAt < this.rateLimitMs || now - previousKeyAt < this.dedupWindowMs) {
            return { captured: false, reason: 'rate_limited', dedupKey };
        }

        const candidate = {
            candidate_id: this.idFactory(),
            zone: String(zone).toUpperCase(),
            timestamp,
            timestamp_seconds: isFiniteNumber(timestampSeconds) ? Number(timestampSeconds) : null,
            model_version: modelVersion,
            source: {
                type: source.type || null,
                session_id: source.sessionId || null,
                video: source.video || null
            },
            prediction: {
                top1: normalizedTop1,
                top2: normalizedTop2,
                confidence_margin: confidenceMargin
            },
            temporal_predictions: Array.isArray(temporalPredictions) ? temporalPredictions.slice(-5) : [],
            candidate_reason: [...new Set(candidateReasons)],
            human_ground_truth: humanGroundTruth,
            review_status: reviewStatus,
            dataset_version_added: datasetVersionAdded
        };

        let candidates = [candidate, ...this.read()];
        candidates = candidates.slice(0, this.maxCandidates);
        while (candidates.length > 1 && sizeInBytes(candidates) > this.maxStorageBytes) {
            candidates.pop();
        }

        if (!this.write(candidates)) {
            return { captured: false, reason: 'storage_unavailable', candidate };
        }

        this.lastCapturedAt.set(dedupKey, now);
        this.recentKeys.set(dedupKey, now);
        return { captured: true, candidate, dedupKey };
    }
}

export const exhibitImprovementCandidateStore = new ExhibitImprovementCandidateStore();
