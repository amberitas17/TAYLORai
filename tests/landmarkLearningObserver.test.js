import assert from 'node:assert/strict';
import LandmarkLearningObserver from '../src/services/landmarkLearningObserver.js';

const observer = new LandmarkLearningObserver({
  lowConfidence: 0.6,
  closeMargin: 0.1,
  repeatedChanges: 3,
  unrecognizedFrames: 3,
  captureCooldownMs: 0,
});

assert.equal(observer.observe({ landmark: 'rio', confidence: 0.4, top2: { landmark: 'aricc', confidence: 0.2 } }).shouldCapture, true);
assert.ok(observer.observe({ landmark: 'rio', confidence: 0.8, top2: { landmark: 'aricc', confidence: 0.75 } }).reasons.includes('close_top_two'));
observer.observe({ landmark: 'rio', confidence: 0.8 });
observer.observe({ landmark: 'aricc', confidence: 0.8 });
observer.observe({ landmark: 'rio', confidence: 0.8 });
const oscillating = observer.observe({ landmark: 'fablab', confidence: 0.8 });
assert.ok(oscillating.reasons.includes('repeated_changes'));

const unknownObserver = new LandmarkLearningObserver({ unrecognizedFrames: 3, captureCooldownMs: 0 });
unknownObserver.observe({ landmark: 'unknown', confidence: 0 });
unknownObserver.observe({ landmark: 'unknown', confidence: 0 });
assert.ok(unknownObserver.observe({ landmark: 'unknown', confidence: 0 }).reasons.includes('repeated_unknown'));

unknownObserver.setConfirmedLandmark('aricc');
assert.ok(unknownObserver.observe({ landmark: 'rio', confidence: 0.9 }).reasons.includes('confirmed_conflict'));

console.log('LandmarkLearningObserver behavior passed');
