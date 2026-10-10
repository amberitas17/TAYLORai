const HARD_REJECTION_REASONS = new Set([
  'noise_rejected',
  'background_class',
  'no_exhibit_detected',
  'poor_frame_quality',
  'person_detected'
]);

const isUsablePrediction = (prediction) => {
  const label = prediction?.exhibit || prediction?.class;
  return Boolean(label) && !['unknown', 'other', 'unknown_background'].includes(String(label).toLowerCase());
};

const predictionLabel = (prediction) => prediction?.exhibit || prediction?.class || '';
export const RECOGNITION_MIN_CONFIDENCE = 0.80;
export const RECOGNITION_MIN_MARGIN = 0.15;

export function classifyRecognitionPresentation(detection) {
  if (!detection) return { state: 'unknown', label: '', alternatives: [], confidence: 0, margin: 0 };

  const top1 = detection.top1;
  const top2 = detection.top2;
  const confidence = Number(top1?.confidence ?? detection.exhibitConfidence ?? detection.mainConfidence ?? 0);
  const margin = Number(detection.specificConfidenceGap ?? detection.mainConfidenceGap ??
    (confidence - Number(top2?.confidence || 0)));
  const hardRejected = Boolean(detection.personDetector?.detected) ||
    HARD_REJECTION_REASONS.has(detection.reason) ||
    detection.gate?.finalGateDecision === false;

  if (hardRejected || !isUsablePrediction(top1)) {
    return { state: 'unknown', label: '', alternatives: [], confidence, margin };
  }

  const passesAcceptance = confidence >= RECOGNITION_MIN_CONFIDENCE && margin >= RECOGNITION_MIN_MARGIN;
  if (detection.success && detection.isRecognized !== false && passesAcceptance) {
    return { state: 'confirmed', label: predictionLabel(top1), alternatives: [], confidence, margin };
  }

  const alternatives = margin < 0.15 && isUsablePrediction(top2)
    ? [predictionLabel(top1), predictionLabel(top2)]
    : [predictionLabel(top1)];
  return { state: 'tentative', label: alternatives[0], alternatives, confidence, margin };
}