const normalizePrediction = (prediction) => {
    if (!prediction || typeof prediction !== 'object') {
        return { landmark: 'unknown', confidence: 0 };
    }

    return {
        landmark: typeof prediction.landmark === 'string' ? prediction.landmark : 'unknown',
        confidence: Number.isFinite(prediction.confidence) ? prediction.confidence : 0,
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
