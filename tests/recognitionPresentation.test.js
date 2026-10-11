import assert from 'node:assert/strict';
import { classifyRecognitionPresentation } from '../src/services/recognitionPresentation.js';

const prediction = (exhibit, confidence) => ({ class: exhibit, exhibit, confidence });

assert.equal(classifyRecognitionPresentation({
  success: true,
  isRecognized: true,
  top1: prediction('Fluke 971', 0.91),
  top2: prediction('Fluke 922', 0.05),
  specificConfidenceGap: 0.86
}).state, 'confirmed');

assert.equal(classifyRecognitionPresentation({
  success: true,
  isRecognized: true,
  top1: prediction('Fluke 971', 0.79),
  top2: prediction('Fluke 922', 0.10),
  specificConfidenceGap: 0.69
}).state, 'tentative');

assert.equal(classifyRecognitionPresentation({
  success: true,
  isRecognized: true,
  top1: prediction('Fluke 971', 0.88),
  top2: prediction('Fluke 922', 0.77),
  specificConfidenceGap: 0.11
}).state, 'tentative');

const tentative = classifyRecognitionPresentation({
  success: false,
  reason: 'low_specific_confidence',
  top1: prediction('Fluke 971', 0.58),
  top2: prediction('Fluke 922', 0.20),
  specificConfidenceGap: 0.38,
  gate: { finalGateDecision: true }
});
assert.equal(tentative.state, 'tentative');
assert.deepEqual(tentative.alternatives, ['Fluke 971']);

const ambiguous = classifyRecognitionPresentation({
  success: false,
  reason: 'low_specific_confidence_gap',
  top1: prediction('Fluke 971', 0.44),
  top2: prediction('Fluke 922', 0.40),
  specificConfidenceGap: 0.04,
  gate: { finalGateDecision: true }
});
assert.deepEqual(ambiguous.alternatives, ['Fluke 971', 'Fluke 922']);

assert.equal(classifyRecognitionPresentation({
  success: false,
  reason: 'noise_rejected',
  top1: prediction('Fluke 971', 0.90),
  gate: { finalGateDecision: false }
}).state, 'unknown');
assert.equal(classifyRecognitionPresentation({
  success: false,
  reason: 'background_class',
  top1: prediction('unknown_background', 0.92),
  gate: { finalGateDecision: false }
}).state, 'unknown');
assert.equal(classifyRecognitionPresentation({
  success: false,
  reason: 'unknown_exhibit',
  personDetector: { detected: true },
  top1: prediction('Fluke 971', 0.90)
}).state, 'unknown');

console.log('Recognition presentation behavior passed');