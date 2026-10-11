export const notifyReconLearningObserver = (observer, detection, onError = () => {}) => {
  if (typeof observer !== 'function') return Promise.resolve();

  try {
    return Promise.resolve(observer(detection)).catch((error) => {
      onError(error);
    });
  } catch (error) {
    onError(error);
    return Promise.resolve();
  }
};
