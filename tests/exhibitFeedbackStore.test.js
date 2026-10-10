import assert from 'node:assert/strict';
import { buildFeedbackRecord, feedbackDedupeKey } from '../src/services/exhibitFeedbackStore.js';

const base = {
  predictedLabel: 'Fluke 971',
  correctedLabel: 'Fluke 922',
  feedbackType: 'wrong_exhibit',
  confidence: 0.58,
  zone: 'recon',
  modelVersion: 'test-model-v1',
  sessionId: 'anonymous-session-1',
};

const record = buildFeedbackRecord(base, 0);
assert.equal(record.feedbackType, 'WRONG_EXHIBIT');
assert.equal(record.zone, 'RECON');
assert.equal(record.confidence, 0.58);
assert.equal(record.createdAt, '1970-01-01T00:00:00.000Z');
assert.equal(record.consented, false);
assert.equal(record.id, feedbackDedupeKey(record));
assert.equal(buildFeedbackRecord({ ...base, feedbackType: 'correct', correctedLabel: null }).correctedLabel, null);
assert.throws(() => buildFeedbackRecord({ ...base, feedbackType: 'wrong_exhibit', correctedLabel: null }), /corrected exhibit label/);
assert.throws(() => buildFeedbackRecord({ ...base, feedbackType: 'maybe' }), /Unsupported/);

console.log('Exhibit feedback record behavior passed');