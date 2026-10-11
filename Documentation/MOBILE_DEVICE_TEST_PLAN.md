# Android and iPhone Test Plan

This is a preparation checklist, not a completed device-test claim.

## Android Chrome

1. Load the production URL on Android Chrome with network enabled and record time to interactive, model download completion, and first inference.
2. During first load, switch to airplane mode or disable the network. Confirm the UI reports an actionable model-download failure and does not claim recognition.
3. Reload after the model download completes with airplane mode enabled. Confirm cached WASM, ONNX, metadata, and face-detector assets are usable.
4. Restore an unstable network, upload a CAESAR video, and confirm retries do not duplicate model sessions or lose the upload state.
5. Inspect Chrome site storage and confirm the model cache is reused after reload.

## iPhone Safari

Repeat the same five cases in Safari, including backgrounding and returning to the tab during a model download. Watch for memory termination, WASM startup failure, camera permission changes, and stalled CacheFirst requests.

## Acceptance evidence

Record device model, OS, browser version, connection state, cache state, model-state messages, first-inference latency, and whether recognition was correctly withheld during incomplete downloads. Test both a fresh browser profile and a warmed cache. A successful desktop or emulator run does not substitute for these physical-device checks.