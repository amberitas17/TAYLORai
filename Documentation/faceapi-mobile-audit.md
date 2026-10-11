# FaceAPI mobile route audit

## Baseline before the local-loading fix

Route: `/machine-vision` via `src/components/AIVision.jsx` and `src/services/clientSideFaceAnalysis.js`.

The route loaded these five FaceAPI model families from the GitHub CDN URL:

`https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights`

- `tiny_face_detector_model-weights_manifest.json`: 2,953 bytes
- `tiny_face_detector_model-shard1`: 193,321 bytes
- `face_expression_model-weights_manifest.json`: 6,384 bytes
- `face_expression_model-shard1`: 329,468 bytes
- `age_gender_model-weights_manifest.json`: 7,774 bytes
- `age_gender_model-shard1`: 429,708 bytes
- `faceLandmark68Net` and `faceRecognitionNet` were also requested by the old initializer, but they were not used by this route's inference chain and were not part of the route's required output.

The old code had no bounded model-load timeout, no per-resource cache/source diagnostics, and no reliable load-time measurement. FaceAPI.js itself was bundled by the npm dependency, but all model assets came from the CDN at runtime.

The route's actual inference chain uses `TinyFaceDetector`, `faceExpressionNet`, and `ageGenderNet`. It now loads those six manifest/shard resources from `/models/faceapi/`, with Cache Storage first and network fallback only for missing resources.

## Runtime measurement

The service records the completed model initialization duration as `modelsLoadTime` and each inference duration/rate in the temporary `?faceDebug=1` panel. Desktop preview/build validation cannot represent iPhone Safari or Android Chrome/PWA timing.

## Hardware-test boundary

iPhone Safari/PWA and Android Chrome/PWA tests for camera lifecycle, suspension, lock/unlock, permission recovery, memory pressure, and offline reopening require physical devices. They are not claimed from desktop browser validation.

## Avatar audit

The `/machine-vision` avatar is React Three Fiber with `three`, `@react-three/fiber`, and `@react-three/drei`. `Hologram` loads `/sarah-avatar.glb` and `/sarah-idle.glb` through `useGLTF`, creates a WebGL canvas, animation mixer, morph-target updates, lights, and orbit controls. It uses browser speech synthesis for the greeting; the current ElevenLabs path is disabled, so no voice API request is made by this route.

Before optimization, both GLBs were requested even with `assetPreset="avatar"`:

- `sarah-avatar.glb`: 11,173,696 bytes
- `sarah-idle.glb`: 11,373,520 bytes
- Avatar model transfer when both are downloaded: 22,547,216 bytes
- The production avatar JavaScript chunk after lazy splitting: approximately 958 KB minified, 261 KB gzip.

The route now lazy-loads the avatar module, prefetches only `sarah-avatar.glb` into `taylor-avatar-assets-v1`, and shows camera/FaceAPI independently while avatar loading proceeds. Routes that explicitly request `assetPreset="idle"` still load `sarah-idle.glb`; `/machine-vision` requests `assetPreset="avatar"` and does not request it. The diagnostics panel records cache hits/misses, source, download time, initialization time, first scene-render time, and errors. Physical-device network, parse, GPU, memory, and first-render timings remain unmeasured here.

The two GLBs are not lightweight animation-only files. Both duplicate the same 11 meshes, 11 materials, 33 textures, 27 embedded images, 2 skins, and 132 nodes. All 27 image payloads are byte-identical. Each contains one `mixamo.com` clip with 362 channels across 121 bones. `/machine-vision` therefore requires one `sarah-avatar.glb` (11,173,696 bytes); the idle duplicate is not loaded for that route. The avatar mode retains its animation clip, skeleton, morph targets, and materials.
