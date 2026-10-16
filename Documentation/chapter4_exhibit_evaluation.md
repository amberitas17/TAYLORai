# Chapter 4 Exhibit Recognition Evaluation

Generated: `2026-10-13T14:54:24.404955+00:00`  
Branch: `optimize/video-route-transition-mobile`  
Commit used: `7292f70dd8be17f3df89c200e1994445a186f4f2`  

This report evaluates the deployed local ONNX assets without retraining or changing them. Accuracy claims are restricted to labeled evidence identified as approved or source-disjoint in repository artifacts. Filename-derived smoke tests are reported as execution evidence only.

## Summary

| Center | Status | Test images | Correct | Incorrect | UNKNOWN | Application accuracy | Raw top-1 accuracy | Macro precision | Macro recall | Macro F1 |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| ARICC | NOT VALIDATED | 3 | 3 | 0 | 0 | 1.0000 | N/A | N/A | N/A | N/A |
| RECON | VALIDATED SUBSET | 9 | 9 | 0 | 0 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| FABLAB | NOT VALIDATED | 3 | 3 | 0 | 0 | 1.0000 | N/A | N/A | N/A | N/A |
| CAESAR | PARTIAL VALIDATION | 24 | 12 | 0 | 12 | 0.5000 | 0.9167 | N/A | N/A | N/A |

Application accuracy counts an accepted prediction equal to the labeled target. A rejected prediction is reported as UNKNOWN. Raw top-1 accuracy ignores the acceptance threshold and is included only where the source artifact recorded raw predictions.

## Models

| Center | Model name | ONNX asset | ONNX SHA-256 | Metadata SHA-256 | Classes |
|---|---|---|---|---|---:|
| ARICC | `aricc_documentation_v10` | `public/models/aricc/aricc_classifier.onnx` | `7dd7ff0a39bace149c7a225ff5db544eb76dea6d4a50b668dfee2fb7daf0a7eb` | `7dd1eaf502e9bb9d59466b52dcd42b370de6104996d623b51b3bb6fb9794f1fd` | 8 |
| RECON | `recon_unified_mobilenet_v2` | `public/models/recon/recon_classifier.onnx` | `56289d8b0f2e4c5e4c0817a296f666be853c25b1d37537c87640735d0f89bdad` | `4a621b916c17d073bf27d359c4cc44b78b2a851b5a10aeb3228a0ecb5e2396dd` | 13 |
| FABLAB | `fablab_documentation_v1` | `public/models/fablab/fablab_classifier.onnx` | `36c0c47b2d2787d9e16b9b890dcf4383cb15a9dab2e6b5cd87b3e70841fa2805` | `8eaaec2c503dadf123b11c8b2af183990a9f05865a7bbf346d16a1e4e3d556c4` | 7 |
| CAESAR | `caesar_filename_v1` | `public/models/caesar/caesar_classifier.onnx` | `fa3157fe3fd81bfe03fee938836fc31130770f4a18828013a9167d5ba95213d2` | `513733dd32e54f78e46a36cbcfdc9774eac144d3732da29b80d54c75e1a0f79b` | 19 |

All four specialist assets use the runtime cache/version identifier `20261010-recon-13class-v1`. The per-model metadata is the authoritative class and preprocessing declaration.

## Confusion Matrices

### RECON approved subset

Rows are expected labels and columns are raw top-1 labels; the subset contains three Fluke 971 frames and six Fluke 2042 frames/crops.

| Expected \ Predicted | fluke_2042_cable_tracer | fluke_971_temperature_humidity_meter |
|---|---:|---:|
| fluke_2042_cable_tracer | 6 | 0 |
| fluke_971_temperature_humidity_meter | 0 | 3 |

### CAESAR source-disjoint run

The source artifact reports 24 validation images from six covered classes and raw top-1 accuracy of 22/24. Its stored per-row predictions do not reconcile to that aggregate accuracy, so a detailed raw confusion matrix is intentionally not exported. The application-level outcome remains 12 accepted correct results and 12 UNKNOWN results.

Confusion matrix: **not available from the recorded artifact**. Exporting a diagonal matrix would be misleading.

## Dataset And Evaluation Scope

- RECON: `Documentation/video_detection_qa_results.json`; nine approved samples, including three approved spatial crops. This is a labeled sampled subset, not a full-video estimate.
- CAESAR: `runs/caesar_controlled_experiment_v4/evaluation.json`; 24 source-disjoint validation images, six of 19 model classes represented. The recorded raw accuracy is 22/24 (0.9167), with 12/24 accepted and zero false acceptances.
- ARICC: three current harness frames matched the filename-derived `Robotic Arm` label, but the selected source is not an approved independent test set. No accuracy claim is made.
- FABLAB: three current harness frames matched the filename-derived `BCN3d` label, but the selected source is not independent of training. No accuracy claim is made.
- No approved labeled UNKNOWN/background set was found for these four specialist classifiers; UNKNOWN rejection precision/recall and false-acceptance rate cannot be completed.

## QA Coverage

| QA area | Evidence | Result |
|---|---|---|
| Model loading | `Documentation/TAYLOR_VIDEO_DETECTION_QA.md`, current harness run | PASS locally for all four ONNX assets; no model changes |
| Recognition confidence | Current harness JSON records confidence, margin, acceptance, and latency per sample | PASS locally; CAESAR smoke samples were rejected below the 0.80 confidence threshold |
| Error handling | `src/services/exhibitDetectionService.js` and QA report | Local load timeout/retry/cache/error states are implemented and exercised; production upload accuracy remains untested due to asset mismatch |
| Mobile compatibility | `Documentation/MOBILE_DEVICE_TEST_PLAN.md` | NOT COMPLETED; physical Android/iPhone evidence is absent |
| Production parity | `Documentation/TAYLOR_VIDEO_DETECTION_QA.md` | BLOCKED; production RECON asset metadata differs from local Fluke 971 model |

## Limitations

No deployed model, metadata, threshold, or training artifact was modified. The report does not replace the missing independent ARICC/FABLAB/CAESAR full-class test manifests or physical-device QA. The repository’s recorded RECON metadata includes prior training/validation metrics, but this report uses only the independently executed current harness subset for its RECON result.
