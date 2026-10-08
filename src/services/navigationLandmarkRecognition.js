const normalizePrediction = (prediction) => {
    if (!prediction || typeof prediction !== 'object') {
        return { landmark: 'unknown', confidence: 0, top1: { landmark: 'unknown', confidence: 0 }, top2: null };
    }
    const ranked = Array.isArray(prediction.predictions) ? prediction.predictions : [];
    const first = ranked[0] || {};
    const landmark = typeof prediction.landmark === 'string' ? prediction.landmark : typeof first.landmark === 'string' ? first.landmark : 'unknown';
    const confidence = Number.isFinite(prediction.confidence) ? prediction.confidence : Number.isFinite(first.confidence) ? first.confidence : 0;
    const alternatives = Array.isArray(prediction.top2)
        ? prediction.top2
        : ranked.slice(1, 2);
    const top2 = alternatives[0] && typeof alternatives[0].landmark === 'string'
        ? { landmark: alternatives[0].landmark, confidence: Number.isFinite(alternatives[0].confidence) ? alternatives[0].confidence : 0 }
        : null;
    return {
        landmark,
        confidence,
        top1: { landmark, confidence },
        top2,
        rawScores: prediction.rawScores || prediction.scores || null,
        mode: prediction.mode,
        similarity: prediction.similarity,
        margin: prediction.margin,
        bestLabel: prediction.bestLabel,
        evidenceSufficient: prediction.evidenceSufficient,
        embedding: prediction.embedding,
        referenceId: prediction.referenceId,
    };
};

export async function recognizeNavigationLandmark(video, classifier = globalThis.taylorLandmarkClassifier) {
    if (!classifier || !video) {
        return { landmark: 'unknown', confidence: 0 };
    }

    const prediction = typeof classifier === 'function'
        ? await classifier(video)
        : await classifier.predict(video);
    return normalizePrediction(prediction);
}

export default recognizeNavigationLandmark;
