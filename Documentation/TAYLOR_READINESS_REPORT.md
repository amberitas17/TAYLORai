# TAYLOR Readiness Report

## Status

**Overall: BLOCKED for production accuracy and mobile-readiness sign-off.**

The local browser pipeline is operational, but CAESAR class/source robustness and a local-versus-production RECON mismatch remain unresolved. No retraining, deployment, or physical Android/iPhone test has been performed.

## Ready

- Local browser upload and video QA pipeline runs with ONNX Runtime Web.
- RECON, ARICC, and FABLAB local recognition paths remain available.
- Face detector assets load from `/models/faceapi/` and the observer call is non-blocking.
- CAESAR evaluation covers all 27 available videos and 19 metadata classes.
- Specialist acceptance policy is unchanged: confidence >= 0.80 and margin >= 0.15.
- CAESAR ONNX bytes match the deployed CAESAR model (`FA3157FE3F...` SHA-256).
- Local and deployed face-detector shard bytes match (`B7503CE7DF...` SHA-256).

## CAESAR evidence

The read-only evaluator sampled four timestamps per video using the production-style center crop and RGB/NCHW preprocessing. The model output is already normalized probability output; no additional softmax is applied.

Analytical Balance is a source/domain-shift failure, not a universal inference failure:

- `Analytical Balance 2.MOV`: full center-crop confidence about 0.999; accepted.
- `Analytical Balance.MOV`: full center-crop confidence falls from about 0.661 to 0.240; rejected.
- Approved object-focused crops on the rejected recording remained about 0.265 to 0.302 and did not pass.

The inspected successful training frame shows an uncovered, front-facing balance. The rejected recording shows the balance largely obscured by a translucent plastic bag, with oblique framing, glare, a yellow wall, neighboring weights, and another balance entering the scene. This supports recording/source shift and uneven coverage. It does not, by itself, prove background reliance; a controlled mask/background ablation is still the appropriate next diagnostic.

Other observed weak areas include Benchtop Multi-Parameter Meter, Laboratory Glassware, BIOBASE Vortex Mixer, Nichipet, and the combined Nichipet/Vortex class. Several other classes are strong across the sampled videos. Therefore the result is not a CAESAR-wide runtime or preprocessing failure.

## Controlled candidate experiment

Experiment artifacts are in `runs/caesar_controlled_experiment_v4/`. The audit covers 27 MOV sources. The candidate excludes the ambiguous `IMG_*.HEIC` filename-derived `img` class, keeps `nichipet_ex_ii` and `nichipet_ex_ii_and_biobase_vortex_mixer` distinct, and uses the existing source-atomic split. Six independent validation videos were evaluated identically at four timestamps each.

| Metric | Current model | Candidate |
|---|---:|---:|
| Raw top-1 accuracy | 91.7% | 70.8% |
| Accepted samples | 12/24 | 14/24 |
| False acceptances | 0 | 1 |
| Mean CPU latency | 5.10 ms | 5.53 ms |

The candidate is rejected. It does not demonstrate meaningful improvement without regression, so no production model or metadata was changed. Per-class regression remains in Analytical Balance, Benchtop Multi-Parameter Meter, and Laboratory Glassware. The training log also reports only six validation classes because the available source-disjoint validation recordings do not cover all 18 candidate classes; this is an additional reason not to treat the experiment as a promotion candidate.

Additional recordings are still needed for every single-source class, especially `nichipet_ex_ii`, `nichipet_ex_ii_and_biobase_vortex_mixer`, `biobase_vortex_mixer`, and the other classes listed in `label_audit.json`. Record each from multiple angles, distances, lighting conditions, occlusion states, and backgrounds, with verified object labels or boxes.

## Blockers

1. **CAESAR generalization:** do not claim all-class production accuracy. Retraining should wait for the crop/background ablation and should split by source video, use annotation-based object crops where available, and include hard negatives/background variation.
2. **RECON synchronization:** the local ONNX and metadata are a structurally matching pair (`[1,3,224,224]` input, 13-class output, class indices aligned) and the intended local class is `fluke_971_temperature_humidity_meter` at index 6. Production still exposes `fluke_941_temperature_humidity_meter`, so the production pair and frontend bundle require a coordinated future synchronization. No deployment was made.
3. **Mobile verification:** service-worker CacheFirst behavior and local WASM/model assets are configured, but no physical Android Chrome or iPhone Safari test has been completed. Follow [MOBILE_DEVICE_TEST_PLAN.md](MOBILE_DEVICE_TEST_PLAN.md) before claiming device readiness.

## Exact synchronization boundary

Before any deployment, compare and update as one change set:

- `public/models/recon/recon_classifier.onnx`
- `public/models/recon/recon_classifier_metadata.json`
- the RECON class labels consumed by `src/ai-exhibit.jsx` and the detection service
- frontend build output and the model cache/version identifier
- face-detector manifest/shard only if the asset hashes change

Do not deploy this synchronization set until the intended Fluke label is confirmed and a production smoke test verifies the resulting class name.

## Not claimed

- Production video accuracy.
- Retrained CAESAR performance.
- Physical-device readiness.
- Offline operation after a partially completed first download.
