// Conservative performance defaults for mobile browsers.
export function getPerformanceMode() {
  try {
    const saved = window.localStorage.getItem('taylorPerformanceMode');
    if (['lite', 'balanced', 'full'].includes(saved)) return saved;
  } catch { /* Storage may be unavailable. */ }
  if (typeof navigator === 'undefined') return 'balanced';
  const ram = Number(navigator.deviceMemory);
  const cores = Number(navigator.hardwareConcurrency);
  if ((ram > 0 && ram <= 2) || (cores > 0 && cores <= 2)) return 'lite';
  if ((ram > 0 && ram <= 4) || (cores > 0 && cores <= 4)) return 'balanced';
  if (!ram || !cores) return 'balanced';
  return 'full';
}
export const PERFORMANCE_SETTINGS = Object.freeze({
  lite: { avatar3D: false, pixelRatio: 1, inferenceInterval: 2500, cameraWidth: 640, cameraHeight: 480 },
  balanced: { avatar3D: true, pixelRatio: 1, inferenceInterval: 1500, cameraWidth: 1280, cameraHeight: 720 },
  full: { avatar3D: true, pixelRatio: 1.25, inferenceInterval: 1500, cameraWidth: 1920, cameraHeight: 1080 },
});
export function getPerformanceSettings() {
  return PERFORMANCE_SETTINGS[getPerformanceMode()];
}
