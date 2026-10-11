import * as ort from 'onnxruntime-web';
import { loadApprovedLandmarkModel } from './landmarkModelRegistry.js';

const DEFAULT_PREPROCESSING = { width: 224, height: 224, mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225], channelOrder: 'RGB' };

function imageTensor(video, preprocessing = DEFAULT_PREPROCESSING) {
  const canvas = document.createElement('canvas');
  canvas.width = preprocessing.width;
  canvas.height = preprocessing.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const values = new Float32Array(3 * canvas.width * canvas.height);
  for (let index = 0; index < canvas.width * canvas.height; index += 1) {
    const pixel = index * 4;
    const red = (pixels[pixel] / 255 - preprocessing.mean[0]) / preprocessing.std[0];
    const green = (pixels[pixel + 1] / 255 - preprocessing.mean[1]) / preprocessing.std[1];
    const blue = (pixels[pixel + 2] / 255 - preprocessing.mean[2]) / preprocessing.std[2];
    values[index] = red;
    values[canvas.width * canvas.height + index] = green;
    values[2 * canvas.width * canvas.height + index] = blue;
  }
  return new ort.Tensor('float32', values, [1, 3, canvas.height, canvas.width]);
}

function outputScores(output) {
  const tensor = Object.values(output)[0];
  if (!tensor?.data) throw new Error('Approved landmark model returned no tensor output.');
  return Array.from(tensor.data, Number);
}

export async function createApprovedLandmarkClassifier(options = {}) {
  const model = await loadApprovedLandmarkModel(options);
  if (!model) return null;
  const metadata = model.metadata || {};
  const classes = metadata.classes || model.classes;
  const preprocessing = { ...DEFAULT_PREPROCESSING, ...(metadata.preprocessing || {}) };
  if (!Array.isArray(classes) || classes.length === 0) throw new Error('Approved landmark model metadata has no class mapping.');
  const session = await ort.InferenceSession.create(model.model, { executionProviders: ['wasm'] });
  const inputName = metadata.inputName || session.inputNames[0];
  return {
    modelVersion: model.id,
    async predict(video) {
      const output = await session.run({ [inputName]: imageTensor(video, preprocessing) });
      const scores = outputScores(output);
      const probabilities = scores.every((score) => score >= 0 && score <= 1) && Math.abs(scores.reduce((sum, score) => sum + score, 0) - 1) < 0.02
        ? scores
        : (() => { const max = Math.max(...scores); const exps = scores.map((score) => Math.exp(score - max)); const total = exps.reduce((sum, score) => sum + score, 0); return exps.map((score) => score / total); })();
      const ranked = probabilities.map((confidence, index) => ({ landmark: classes[index] || 'unknown', confidence })).sort((left, right) => right.confidence - left.confidence);
      return { predictions: ranked, landmark: ranked[0]?.landmark || 'unknown', confidence: ranked[0]?.confidence || 0, rawScores: scores };
    },
  };
}
