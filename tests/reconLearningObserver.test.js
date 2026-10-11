import assert from 'node:assert/strict';
import { notifyReconLearningObserver } from '../src/services/reconLearningObserver.js';

let errorCount = 0;
const onError = () => {
  errorCount += 1;
};

await notifyReconLearningObserver(undefined, { success: false }, onError);
assert.equal(errorCount, 0);

await notifyReconLearningObserver(() => {
  throw new Error('observer failed');
}, { success: false }, onError);
assert.equal(errorCount, 1);

let detectionContinued = false;
await notifyReconLearningObserver(async () => {
  throw new Error('async observer failed');
}, { success: false }, onError);
detectionContinued = true;
assert.equal(detectionContinued, true);
assert.equal(errorCount, 2);

console.log('RECON learning observer behavior passed');