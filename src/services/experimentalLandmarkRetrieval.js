import * as ort from 'onnxruntime-web';
import { loadExperimentalLandmarkRetrievalModel } from './landmarkModelRegistry.js';
import { listLandmarkRecords } from './landmarkLearningStore.js';

const DEFAULT_PREPROCESSING = { width: 224, height: 224, mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225], channelOrder: 'RGB' };

function imageTensor(video, preprocessing) {
  const canvas = document.createElement('canvas');
  canvas.width = preprocessing.width;
  canvas.height = preprocessing.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const planeSize = canvas.width * canvas.height;
  const values = new Float32Array(planeSize * 3);
  for (let index = 0; index < planeSize; index += 1) {
    const pixel = index * 4;
    values[index] = (pixels[pixel] / 255 - preprocessing.mean[0]) / preprocessing.std[0];
    values[planeSize + index] = (pixels[pixel + 1] / 255 - preprocessing.mean[1]) / preprocessing.std[1];
    values[planeSize * 2 + index] = (pixels[pixel + 2] / 255 - preprocessing.mean[2]) / preprocessing.std[2];
  }
  return new ort.Tensor('float32', values, [1, 3, canvas.height, canvas.width]);
}

function outputEmbedding(output) {
  const tensor = Object.values(output)[0];
  if (!tensor?.data) throw new Error('Retrieval model returned no embedding output.');
  return Array.from(tensor.data, Number);
}

function similarity(first, second) {
  return first.reduce((sum, value, index) => sum + value * second[index], 0);
}

export async function createExperimentalLandmarkRetrieval(options = {}) {
  const model = await loadExperimentalLandmarkRetrievalModel(options);
  if (!model) return null;
  const preprocessing = { ...DEFAULT_PREPROCESSING, ...(model.preprocessing || {}) };
  const session = await ort.InferenceSession.create(model.model, { executionProviders: ['wasm'] });
  const inputName = model.inputName || session.inputNames[0];
  const featureExtractorVersion = model.featureExtractorVersion || model.id;
  const referenceIndex = new Map();
  const maxViewsPerLandmark = Number.isInteger(model.maxViewsPerLandmark) ? model.maxViewsPerLandmark : 12;
  const dedupeSimilarity = Number.isFinite(model.dedupeSimilarity) ? model.dedupeSimilarity : 0.995;
  const stableLandmarkId = (label) => `landmark-${String(label || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const addReference = (reference, source = 'verified-local') => {
    const embedding = reference.modelEmbedding || reference.embedding;
    if (!reference.label || !Array.isArray(embedding) || embedding.length === 0) return false;
    if (reference.embeddingModelVersion && reference.embeddingModelVersion !== featureExtractorVersion) return false;
    const landmarkId = stableLandmarkId(reference.label);
    const views = referenceIndex.get(landmarkId) || [];
    if (views.some((view) => similarity(view.embedding, embedding) >= dedupeSimilarity)) return false;
    if (source === 'verified-local' && views.filter((view) => view.source === 'verified-local').length >= maxViewsPerLandmark) return false;
    views.push({
      referenceId: reference.referenceId || reference.id || `${source}-${landmarkId}-${views.length}`,
      landmarkId,
      landmark: reference.label,
      embedding,
      source,
    });
    referenceIndex.set(landmarkId, views);
    return true;
  };
  model.references.forEach((reference) => addReference({ ...reference, referenceId: reference.referenceId, landmarkId: reference.landmarkId }, 'trained-reference'));
  try {
    const localRecords = (await Promise.all(['confirmed', 'corrected'].map((store) => listLandmarkRecords(store)))).flat();
    localRecords.filter((record) => record.embeddingModelVersion === featureExtractorVersion).forEach((record) => addReference({ ...record, label: record.label, modelEmbedding: record.modelEmbedding }, 'verified-local'));
  } catch (error) {
    console.warn('[taylor] local retrieval references unavailable', error);
  }
  const minimumSimilarity = Number.isFinite(model.similarityThreshold) ? model.similarityThreshold : 0.92;
  const minimumMargin = Number.isFinite(model.minimumMargin) ? model.minimumMargin : 0.015;

  return {
    modelVersion: model.id,
    featureExtractorVersion,
    metadata: model,
    getReferenceSummary() {
      return [...referenceIndex.values()].reduce((summary, views) => {
        summary.total += views.length;
        summary.byLandmark[views[0]?.landmarkId || 'unknown'] = views.length;
        return summary;
      }, { total: 0, byLandmark: {} });
    },
    addVerifiedReference(reference) {
      return addReference({ ...reference, embeddingModelVersion: reference.embeddingModelVersion || featureExtractorVersion }, 'verified-local');
    },
    async reloadVerifiedReferences() {
      const localRecords = (await Promise.all(['confirmed', 'corrected'].map((store) => listLandmarkRecords(store)))).flat();
      localRecords.filter((record) => record.embeddingModelVersion === featureExtractorVersion).forEach((record) => addReference({ ...record, modelEmbedding: record.modelEmbedding }, 'verified-local'));
      return this.getReferenceSummary();
    },
    async predict(video) {
      const output = await session.run({ [inputName]: imageTensor(video, preprocessing) });
      const embedding = outputEmbedding(output);
      const references = [...referenceIndex.values()].flat();
      const rankedReferences = references
        .map((reference) => ({ landmark: reference.landmark || 'unknown', similarity: similarity(embedding, reference.embedding), referenceId: reference.referenceId, landmarkId: reference.landmarkId }))
        .sort((left, right) => right.similarity - left.similarity);
      const best = rankedReferences[0];
      const next = rankedReferences.find((candidate) => candidate.landmark !== best?.landmark) || rankedReferences[1];
      const evidenceSufficient = Boolean(best && best.similarity >= minimumSimilarity && (!next || best.similarity - next.similarity >= minimumMargin));
      const predictions = rankedReferences.slice(0, 5).map((candidate) => ({ landmark: candidate.landmark, confidence: candidate.similarity, similarity: candidate.similarity, referenceId: candidate.referenceId }));
      return {
        mode: 'experimental-retrieval',
        landmark: evidenceSufficient ? best.landmark : 'unknown',
        confidence: evidenceSufficient ? best.similarity : 0,
        similarity: best?.similarity || 0,
        margin: best && next ? best.similarity - next.similarity : best?.similarity || 0,
        evidenceSufficient,
        predictions,
        top1: best ? { landmark: best.landmark, confidence: best.similarity } : { landmark: 'unknown', confidence: 0 },
        top2: next ? { landmark: next.landmark, confidence: next.similarity } : null,
        embedding,
      };
    },
  };
}

export default createExperimentalLandmarkRetrieval;