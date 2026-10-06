import assert from 'node:assert/strict';
import { ExhibitImprovementCandidateStore } from '../src/services/exhibitImprovementCandidateStore.js';

class MemoryStorage {
    constructor() {
        this.values = new Map();
    }

    getItem(key) {
        return this.values.get(key) || null;
    }

    setItem(key, value) {
        this.values.set(key, value);
    }

    removeItem(key) {
        this.values.delete(key);
    }
}

const storage = new MemoryStorage();
let clock = 1000;
const store = new ExhibitImprovementCandidateStore({
    storage,
    maxCandidates: 2,
    maxStorageBytes: 100000,
    rateLimitMs: 100,
    dedupWindowMs: 300,
    now: () => clock,
    idFactory: (() => {
        let id = 0;
        return () => `candidate-${++id}`;
    })()
});

const capture = (zone, top1 = '3D Printer', top2 = 'Collaborative Robot') => store.capture({
    zone,
    timestamp: new Date(clock).toISOString(),
    modelVersion: `${zone.toLowerCase()}-v1`,
    top1: { class: top1, confidence: 0.51 },
    top2: { class: top2, confidence: 0.48 },
    temporalPredictions: [{ top1_class: top1, top1_confidence: 0.51 }],
    candidateReasons: ['LOW_MARGIN'],
    source: { type: 'video', sessionId: 'session-1', video: 'test.MOV' }
});

const first = capture('ARICC');
assert.equal(first.captured, true);
assert.equal(first.candidate.human_ground_truth, null);
assert.equal(first.candidate.review_status, 'PENDING');
assert.equal(first.candidate.dataset_version_added, null);
assert.ok(Math.abs(first.candidate.prediction.confidence_margin - 0.03) < 0.000001);

const duplicate = capture('ARICC');
assert.equal(duplicate.captured, false);
assert.equal(duplicate.reason, 'rate_limited');
assert.equal(store.list()[0].human_ground_truth, null);

clock += 301;
const recon = capture('RECON', 'testo_420_volume_flow_hood', 'testo_440_air_velocity_iaq');
assert.equal(recon.captured, true);
assert.equal(store.list()[0].zone, 'RECON');
assert.equal(store.list()[1].zone, 'ARICC');

clock += 301;
const fablab = capture('FABLAB', 'STRATASYS', 'VAQUFORM');
assert.equal(fablab.captured, true);
assert.equal(store.list().length, 2);
assert.equal(store.list().some(candidate => candidate.zone === 'ARICC'), false);

clock += 301;
const caesar = capture('CAESAR', 'incubator', 'digital_dry_bath_incubator');
assert.equal(caesar.captured, true);
assert.equal(store.list().length, 2);
assert.equal(store.list()[0].zone, 'CAESAR');
assert.equal(store.list()[1].zone, 'FABLAB');
assert.equal(store.getDiagnostics().count, 2);

console.log('ExhibitImprovementCandidateStore behavior passed');
