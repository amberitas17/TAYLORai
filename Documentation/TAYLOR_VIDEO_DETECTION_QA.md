# TAYLOR Video Detection QA

Date: 2026-10-10

## Scope

This is an execution report for local browser upload tests using repository videos. It does not modify models, labels, navigation, or deployment assets. The tested path was the actual upload flow on the Vite app, through `startRealTimeDetection()` and the local ONNX exhibit service.

## Execution summary

| Area | Result |
| --- | --- |
| Local upload control | PASS: local `.MOV` files attached through `input[type=file]` |
| Local ONNX model loading | PASS: session and local RECON metadata loaded |
| Actual frame inference | PASS: 18 extracted frames were processed by local ONNX models; browser upload tests also processed five videos |
| Cross-zone upload attempts | EXECUTED: ARICC, FABLAB, CAESAR, and RECON uploads were exercised |
| Per-frame metrics | PASS: opt-in browser `FRAME_QA` records now expose top-1/top-2, confidence, margin, acceptance, rejection reason, latency, and person-detector state |
| Local browser bootstrap | PASS: `localhost:5173` mounted the RECON route and initialized runtime, models, and face detector |
| Production bootstrap | PASS: `https://taylorai.vercel.app/machine-vision-recon` reached `RECON_READY` from cache |
| Production upload testing | NOT TESTED: deployed assets remain out of sync with local assets |
| Model changes or retraining | NOT PERFORMED |

## Video results

`PASS` below means actual video frames were processed and the observed label matched the approved expected label. Cross-zone filename labels are provisional because no approved zone-local manifest was found in the searched JSON, JSONL, CSV, or TXT files. The four rendered predictions are therefore execution results, but only the two RECON rows have approved-label correctness status.

| Zone | Video | Expected label | Predicted label | Confidence | Result |
| --- | --- | --- | --- | --- | --- |
| RECON | `Fluke 971 Temperature Humidity Meter (2).MOV` | `fluke_971_temperature_humidity_meter` (approved by `Documentation/datasets/RECON/ocr_labels.json`) | `fluke 971 temperature humidity meter` | Not exposed | PASS / approved label match |
| RECON | `Fluke 2042 Cable Tracer.MOV` | `fluke_2042_cable_tracer` (approved by `Documentation/datasets/RECON/ocr_labels.json`) | `fluke 2042 cable tracer` | Not exposed | PASS / approved label match |
| ARICC | `Robotic Arm.MOV` | `Robotic Arm` (filename provisional) | `Robotic Arm` | Not exposed | EXECUTED / provisional match |
| FABLAB | `BCN3d.MOV` | `BCN3d` (filename provisional) | `BCN3d` | Not exposed | EXECUTED / provisional match |
| CAESAR | `Analytical Balance.MOV` | `Analytical Balance` (filename provisional; example annotation exists but is not approved ground truth) | `UNKNOWN` / rejected | 23.4%-50.9% browser samples | EXECUTED / correctly rejected under threshold |

The selected fixtures were confirmed to exist under `Documentation/datasets/ARICC/ARICC`, `Documentation/datasets/RECON`, `Documentation/datasets/FABLAB`, and `Documentation/datasets/CAESAR`. The RECON manifest also contains spatial/multi-exhibit annotations for `RECON_001.MOV`, `RECON_002.MOV`, and `RECON_003.MOV`; those were not counted as single-label accuracy samples.

## Read-only frame harness results

The local harness is `scripts/video_detection_qa.py`; its machine-readable output is `Documentation/video_detection_qa_results.json`, with 18 saved JPEG evidence frames under `Documentation/video_detection_qa_frames/`. It opened each video with OpenCV, extracted frames at 25%, 50%, and 75% of duration, applied the application classifier preprocessing (shortest-edge resize, centered 224 x 224 crop, RGB, division by 255, metadata mean/std, NCHW), ran the zone ONNX model with CPU ONNX Runtime, and applied the application specialist rejection thresholds of confidence >= 0.80 and top-1 margin >= 0.15. No model or label asset was changed.

The browser Upload Test Video runs exercised the full application route, including its gate and person checks. The harness metrics below are the classifier-stage equivalent. The browser run independently reported the tiny face detector as READY and functional on every tested zone.

| Zone | Frames | Accepted | Correct | Mean latency (ms) | Confidence range | Result |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| ARICC | 3 | 3 | 3 provisional | 3.147 | 1.0000-1.0000 | All predicted `Robotic Arm`; browser upload also passed |
| RECON | 9 | 9 | 9 approved | 3.494 | 0.9936-1.0000 | All Fluke 971/2042 frames and approved 2042 crops correct |
| FABLAB | 3 | 3 | 3 provisional | 5.618 | 0.9999-1.0000 | All predicted `BCN3d`; browser upload also passed |
| CAESAR | 3 | 0 | 0 approved | 2.941 | 0.2328-0.5353 | All rejected; raw top-1 was Analytical Balance twice and Microscope once; browser also rejected |

Measured overall specialist-stage results: 15/18 frames accepted, 15/15 accepted frames matching their expected labels, with 3 CAESAR frames rejected. The approved-ground-truth RECON subset is 9/9 frame matches, including three approved spatial crops. These are sampled frame results, not full-video accuracy.

The browser batch processed continuously for approximately 5.5 seconds per upload. All five videos reached `readyState: 4` and remained `paused: false`. Browser results were: RECON Fluke 971 accepted at 99.9%, RECON Fluke 2042 accepted at 100.0%, ARICC Robotic Arm accepted at 100.0%, FABLAB BCN3d accepted at 100.0%, and CAESAR remained UNKNOWN/rejected. No browser page errors or failed requests were captured during the batch.

## Direct evidence

For `Fluke 971 Temperature Humidity Meter (2).MOV` on `/machine-vision-recon`:

- The upload event fired and the video reached `readyState: 4`.
- The video duration was 17.55 seconds; the video was actively playing during observation.
- The page displayed `EXHIBIT DETECTED` and `fluke 971 temperature humidity meter`.
- The local model resource was `/models/recon/recon_classifier.onnx?v=20261010-recon-13class-v1`.
- The local metadata resource was `/models/recon/recon_classifier_metadata.json`.
- The local model has the intended Fluke 971 class and does not use the stale production Fluke 941 class.

For the five-case execution batch, every uploaded video reached `readyState: 4` and was playing at approximately 7.0 seconds:

| Video | Duration (seconds) | Sample playback time (seconds) | Browser evidence |
| --- | ---: | ---: | --- |
| Fluke 971 Temperature Humidity Meter (2).MOV | 17.547 | 6.971 | Prediction rendered |
| Fluke 2042 Cable Tracer.MOV | 19.482 | 6.980 | Prediction rendered |
| Robotic Arm.MOV | 16.047 | 7.001 | Prediction rendered |
| BCN3d.MOV | 28.557 | 6.981 | Prediction rendered |
| Analytical Balance.MOV | 17.548 | 6.981 | No detection text |

## Resolved runtime defects

- `captureReconLearningCandidate` was scoped inside `handleVideoUpload()` but called from `performDetection()`. It now lives at component scope, and observer failures are non-blocking. Regression coverage is in `tests/reconLearningObserver.test.js`.
- The root tiny-face assets were a 14-byte `404: Not Found` shard. The service now loads the valid `/models/faceapi/` manifest and shard, and records explicit `READY` or `UNAVAILABLE` status. Browser `FRAME_QA` records reported `available: true, status: READY` during all five uploads.
- The local app initially appeared stuck at `Loading TAYLOR...` only because the shared `127.0.0.1:5173` browser page had a dead/reset Vite connection. A fresh `localhost:5173` page mounted normally; production also mounted normally. No code change was needed for bootstrap.

## Production mismatch

The production endpoint `https://taylorai.vercel.app/models/recon/recon_classifier_metadata.json` returned:

- `model_name`: `recon_unified_v1`
- 13 classes including `fluke_941_temperature_humidity_meter`
- No `fluke_971_temperature_humidity_meter`
- preprocessing mean `[0, 0, 0]`, std `[1, 1, 1]`
- input `[1, 3, 224, 224]`, output `[1, 13]`

The local metadata instead identifies `recon_unified_mobilenet_v2`, includes Fluke 971 at class index 6, omits Fluke 941, and uses ImageNet mean/std normalization. This is both a class-mapping mismatch and a preprocessing mismatch; local Fluke 971 success must not be generalized to production. Production browser bootstrap passed, but production video upload testing remains intentionally unperformed until assets are synchronized.

## Observed-result confusion table

This is an execution confusion table, not a statistically valid accuracy matrix. RECON labels are approved; ARICC and FABLAB labels are filename-derived; CAESAR produced no label. `NO_RESULT` is the application's observed outcome.

| Expected label | Observed predicted label | Count |
| --- | --- | ---: |
| fluke_971_temperature_humidity_meter | fluke_971_temperature_humidity_meter | 1 |
| fluke_2042_cable_tracer | fluke_2042_cable_tracer | 1 |
| Robotic Arm (provisional) | Robotic Arm | 1 |
| BCN3d (provisional) | BCN3d | 1 |
| Analytical Balance (provisional) | UNKNOWN / rejected | 1 |

The harness adds the following frame-level observations for the same CAESAR video: `analytical_balance` at 53.53% confidence with 43.60% margin, `analytical_balance` at 35.20% with 16.00% margin, and `microscope` at 23.28% with 1.77% margin. All three are rejected because confidence is below 80%; the final frame also fails the margin threshold.

Approved crop evidence: the RECON manifest specifies normalized box `[0.015, 0.29, 0.445, 0.91]` for `Fluke 2042 Cable Tracer and Fluke 941 Temperature Humidity Meter.MOV`, with validation timestamps 11.0, 13.0, and 15.5 seconds. All three saved crops were accepted as `fluke_2042_cable_tracer` with confidences 0.9996, 0.9990, and 0.9936.

## Metrics status

| Metric | Status |
| --- | --- |
| Sample count | 5 browser videos processed; 18 harness frames extracted and inferred |
| Correct / incorrect | 9/9 approved RECON frames/crops matched; 6/6 provisional ARICC/FABLAB frames matched; 3/3 CAESAR frames rejected |
| Held-out accuracy | Not claimed: selected videos are not an approved independent held-out split |
| Unknown/background rejection | NOT TESTED with approved ground truth |
| False acceptance rate | BLOCKED |
| Confidence and margin | Measured by harness; browser UI does not expose them |
| Inference latency and FPS | Classifier latency measured by harness; browser continuous cycles verified with opt-in `FRAME_QA` records |
| Confusion matrix | Observed-result table above; approved RECON subset is diagonal 3 Fluke 971, 3 full-frame Fluke 2042, and 3 cropped Fluke 2042 frames; full statistical matrix not claimed |
| Production-vs-local accuracy | NOT CLAIMED |

## Follow-up required

1. Synchronize production RECON model, metadata, preprocessing, and face-detector assets with local before deployment or production upload testing.
2. Provide approved ARICC, FABLAB, and CAESAR video-label manifests, including explicit unknown/background and multi-exhibit ground truth.
3. Investigate CAESAR model quality/data coverage; do not lower the 80% confidence threshold. The current filename-trained dataset extracts full video frames, while browser inference applies a shortest-edge resize and centered crop; Ultralytics training transforms are not recorded in the metadata, so crop-distribution mismatch and weak class coverage remain plausible causes. This remains unresolved without retraining or approved data changes.