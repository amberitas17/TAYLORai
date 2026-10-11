const DEFAULT_THRESHOLDS = Object.freeze({
  lowConfidence: 0.58,
  closeMargin: 0.12,
  repeatedChanges: 3,
  unrecognizedFrames: 4,
  captureCooldownMs: 8000,
});

function normalizeTop(prediction, key, fallback) {
  const value = prediction?.[key];
  if (value && typeof value.landmark === 'string') return value;
  return fallback;
}

export function normalizeLearningPrediction(prediction = {}) {
  const landmark = typeof prediction.landmark === 'string' ? prediction.landmark : 'unknown';
  const confidence = Number.isFinite(prediction.confidence) ? prediction.confidence : 0;
  const top1 = normalizeTop(prediction, 'top1', { landmark, confidence });
  const top2 = normalizeTop(prediction, 'top2', null);
  const top2Confidence = Number.isFinite(top2?.confidence) ? top2.confidence : 0;
  return {
    landmark,
    confidence,
    top1: { landmark: top1.landmark, confidence: Number.isFinite(top1.confidence) ? top1.confidence : confidence },
    top2: top2 ? { landmark: top2.landmark, confidence: top2Confidence } : null,
    rawScores: prediction.rawScores || prediction.scores || null,
  };
}

export class LandmarkLearningObserver {
  constructor(thresholds = {}) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
    this.history = [];
    this.lastCaptureAt = 0;
    this.lastCandidateKey = null;
    this.confirmedLandmark = null;
  }

  setConfirmedLandmark(landmark) {
    this.confirmedLandmark = typeof landmark === 'string' ? landmark : null;
  }

  observe(rawPrediction) {
    const prediction = normalizeLearningPrediction(rawPrediction);
    this.history = [...this.history.slice(-(this.thresholds.repeatedChanges + 2)), prediction];
    const reasons = [];
    if (prediction.confidence < this.thresholds.lowConfidence) reasons.push('low_confidence');
    if (prediction.top2 && prediction.confidence - prediction.top2.confidence <= this.thresholds.closeMargin) reasons.push('close_top_two');
    const recentKnown = this.history.slice(-(this.thresholds.repeatedChanges + 1)).filter((item) => item.landmark !== 'unknown');
    const transitions = recentKnown.slice(1).filter((item, index) => item.landmark !== recentKnown[index].landmark).length;
    if (transitions >= this.thresholds.repeatedChanges) reasons.push('repeated_changes');
    const unknownCount = this.history.slice(-this.thresholds.unrecognizedFrames).filter((item) => item.landmark === 'unknown').length;
    if (unknownCount >= this.thresholds.unrecognizedFrames) reasons.push('repeated_unknown');
    if (this.confirmedLandmark && prediction.landmark !== 'unknown' && prediction.landmark !== this.confirmedLandmark) reasons.push('confirmed_conflict');
    const now = Date.now();
    const candidateKey = `${prediction.landmark}:${reasons.join('|')}`;
    const eligible = reasons.length > 0 && candidateKey !== this.lastCandidateKey && now - this.lastCaptureAt >= this.thresholds.captureCooldownMs;
    if (eligible) {
      this.lastCandidateKey = candidateKey;
      this.lastCaptureAt = now;
    }
    return { prediction, uncertain: reasons.length > 0, shouldCapture: eligible, reasons };
  }

  reset() {
    this.history = [];
    this.lastCaptureAt = 0;
    this.lastCandidateKey = null;
  }
}

export { DEFAULT_THRESHOLDS };
export default LandmarkLearningObserver;
