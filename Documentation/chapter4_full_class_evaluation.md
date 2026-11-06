# Chapter 4 Full-Class Exhibit Evaluation

Generated: `2026-10-13T15:06:05.115041+00:00`  
Branch: `optimize/video-route-transition-mobile`  
Commit used before testing: `7292f70dd8be17f3df89c200e1994445a186f4f2`  

This run uses the deployed local ONNX assets without retraining. Each sample uses the TAYLOR center-crop, RGB, `/255`, metadata mean/std, NCHW preprocessing and acceptance thresholds confidence >= 0.80 and top-1 margin >= 0.15. Rejected samples are reported as UNKNOWN.

## Model Class Mappings

| Center | Model | Classes |
|---|---|---:|
| ARICC | `aricc_documentation_v10` | 8 |

0: 3D Printer; 1: Collaborative Robot; 2: FDAS; 3: Industrial Robot; 4: Pick & Place Machine; 5: Robotic Arm; 6: Smart Systems; 7: Speech Home Automation
| RECON | `recon_unified_mobilenet_v2` | 13 |

0: charcoal_oven_machine; 1: festo_solar_wind_training_system; 2: fluke_2042_cable_tracer; 3: fluke_355_clamp_meter; 4: fluke_922_air_flow_meter; 5: fluke_930_non_contact_tachometer; 6: fluke_971_temperature_humidity_meter; 7: ip_display_area; 8: quadruple_suction_single_discharge_cooking_oil_transfer_device; 9: root_crop_slicing_machine; 10: testo_420_volume_flow_hood; 11: testo_440_air_velocity_iaq; 12: unmanned_aerial_system
| FABLAB | `fablab_documentation_v1` | 7 |

0: 3D Outputs; 1: BCN3d; 2: Crealty Ender 3D Printer; 3: Digital Embroidery Machine; 4: Leapfrog Bolt Pro; 5: STRATASYS; 6: VAQUFORM
| CAESAR | `caesar_filename_v1` | 19 |

0: analytical_balance; 1: benchtop_multi_parameter_meter; 2: biobase_vortex_mixer; 3: chemical_testing_area; 4: digital_dry_bath_incubator; 5: ducted_fumehood; 6: gravimetrics; 7: hot_plate_with_stirrer; 8: img; 9: incubator; 10: laboratory_glassware; 11: microprocessor_centrifuge; 12: microscope; 13: nichipet_ex_ii; 14: nichipet_ex_ii_and_biobase_vortex_mixer; 15: preparation_area; 16: shaker_incubator; 17: spectrophotometer; 18: velocity_18r_pro_centrifuge

## Center Summary

| Center | Samples | Correct | Incorrect | UNKNOWN | Raw top-1 accuracy | Application accuracy | Evidence |
|---|---:|---:|---:|---:|---:|---:|---|
| ARICC | 40 | 24 | 9 | 7 | 0.6500 | 0.6000 | source-disjoint validation |
| RECON | 2 | 1 | 0 | 1 | 1.0000 | 0.5000 | labeled images; independence unverified |
| FABLAB | 40 | 29 | 3 | 8 | 0.8500 | 0.7250 | source-disjoint validation |
| CAESAR | 60 | 31 | 0 | 29 | 0.8667 | 0.5167 | source-disjoint validation |

## Per-Class Metrics And Missing Classes

### ARICC

| Class | Samples | Precision | Recall | F1 | Status |
|---|---:|---:|---:|---:|---|
| 3D Printer | 10 | 0.5263 | 1.0000 | 0.6897 | VALIDATED |
| Collaborative Robot | 10 | 1.0000 | 0.4000 | 0.5714 | VALIDATED |
| FDAS | 0 | N/A | N/A | N/A | MISSING INDEPENDENT TEST SAMPLES |
| Industrial Robot | 10 | N/A | 0.0000 | N/A | VALIDATED |
| Pick & Place Machine | 0 | N/A | N/A | N/A | MISSING INDEPENDENT TEST SAMPLES |
| Robotic Arm | 0 | N/A | N/A | N/A | MISSING INDEPENDENT TEST SAMPLES |
| Smart Systems | 10 | 1.0000 | 1.0000 | 1.0000 | VALIDATED |
| Speech Home Automation | 0 | N/A | N/A | N/A | MISSING INDEPENDENT TEST SAMPLES |

Confusion matrix: `Documentation/chapter4_full_class_confusion_aricc.csv` (columns include UNKNOWN).

### RECON

| Class | Samples | Precision | Recall | F1 | Status |
|---|---:|---:|---:|---:|---|
| charcoal_oven_machine | 0 | N/A | N/A | N/A | MISSING INDEPENDENT TEST SAMPLES |
| festo_solar_wind_training_system | 0 | N/A | N/A | N/A | MISSING INDEPENDENT TEST SAMPLES |
| fluke_2042_cable_tracer | 0 | N/A | N/A | N/A | MISSING INDEPENDENT TEST SAMPLES |
| fluke_355_clamp_meter | 0 | N/A | N/A | N/A | MISSING INDEPENDENT TEST SAMPLES |
| fluke_922_air_flow_meter | 0 | N/A | N/A | N/A | MISSING INDEPENDENT TEST SAMPLES |
| fluke_930_non_contact_tachometer | 1 | 1.0000 | 1.0000 | 1.0000 | INDEPENDENCE UNVERIFIED |
| fluke_971_temperature_humidity_meter | 1 | N/A | 0.0000 | N/A | INDEPENDENCE UNVERIFIED |
| ip_display_area | 0 | N/A | N/A | N/A | MISSING INDEPENDENT TEST SAMPLES |
| quadruple_suction_single_discharge_cooking_oil_transfer_device | 0 | N/A | N/A | N/A | MISSING INDEPENDENT TEST SAMPLES |
| root_crop_slicing_machine | 0 | N/A | N/A | N/A | MISSING INDEPENDENT TEST SAMPLES |
| testo_420_volume_flow_hood | 0 | N/A | N/A | N/A | MISSING INDEPENDENT TEST SAMPLES |
| testo_440_air_velocity_iaq | 0 | N/A | N/A | N/A | MISSING INDEPENDENT TEST SAMPLES |
| unmanned_aerial_system | 0 | N/A | N/A | N/A | MISSING INDEPENDENT TEST SAMPLES |

Confusion matrix: `Documentation/chapter4_full_class_confusion_recon.csv` (columns include UNKNOWN).

### FABLAB

| Class | Samples | Precision | Recall | F1 | Status |
|---|---:|---:|---:|---:|---|
| 3D Outputs | 0 | N/A | N/A | N/A | MISSING INDEPENDENT TEST SAMPLES |
| BCN3d | 0 | 0.0000 | N/A | N/A | MISSING INDEPENDENT TEST SAMPLES |
| Crealty Ender 3D Printer | 10 | 1.0000 | 0.8000 | 0.8889 | VALIDATED |
| Digital Embroidery Machine | 10 | 1.0000 | 1.0000 | 1.0000 | VALIDATED |
| Leapfrog Bolt Pro | 10 | 1.0000 | 1.0000 | 1.0000 | VALIDATED |
| STRATASYS | 10 | 1.0000 | 0.1000 | 0.1818 | VALIDATED |
| VAQUFORM | 0 | N/A | N/A | N/A | MISSING INDEPENDENT TEST SAMPLES |

Confusion matrix: `Documentation/chapter4_full_class_confusion_fablab.csv` (columns include UNKNOWN).

### CAESAR

| Class | Samples | Precision | Recall | F1 | Status |
|---|---:|---:|---:|---:|---|
| analytical_balance | 10 | N/A | 0.0000 | N/A | VALIDATED |
| benchtop_multi_parameter_meter | 10 | N/A | 0.0000 | N/A | VALIDATED |
| biobase_vortex_mixer | 0 | N/A | N/A | N/A | MISSING INDEPENDENT TEST SAMPLES |
| chemical_testing_area | 0 | N/A | N/A | N/A | MISSING INDEPENDENT TEST SAMPLES |
| digital_dry_bath_incubator | 10 | 1.0000 | 0.9000 | 0.9474 | VALIDATED |
| ducted_fumehood | 10 | 1.0000 | 1.0000 | 1.0000 | VALIDATED |
| gravimetrics | 0 | N/A | N/A | N/A | MISSING INDEPENDENT TEST SAMPLES |
| hot_plate_with_stirrer | 0 | N/A | N/A | N/A | MISSING INDEPENDENT TEST SAMPLES |
| img | 0 | N/A | N/A | N/A | MISSING INDEPENDENT TEST SAMPLES |
| incubator | 10 | 1.0000 | 1.0000 | 1.0000 | VALIDATED |
| laboratory_glassware | 10 | 1.0000 | 0.2000 | 0.3333 | VALIDATED |
| microprocessor_centrifuge | 0 | N/A | N/A | N/A | MISSING INDEPENDENT TEST SAMPLES |
| microscope | 0 | N/A | N/A | N/A | MISSING INDEPENDENT TEST SAMPLES |
| nichipet_ex_ii | 0 | N/A | N/A | N/A | MISSING INDEPENDENT TEST SAMPLES |
| nichipet_ex_ii_and_biobase_vortex_mixer | 0 | N/A | N/A | N/A | MISSING INDEPENDENT TEST SAMPLES |
| preparation_area | 0 | N/A | N/A | N/A | MISSING INDEPENDENT TEST SAMPLES |
| shaker_incubator | 0 | N/A | N/A | N/A | MISSING INDEPENDENT TEST SAMPLES |
| spectrophotometer | 0 | N/A | N/A | N/A | MISSING INDEPENDENT TEST SAMPLES |
| velocity_18r_pro_centrifuge | 0 | N/A | N/A | N/A | MISSING INDEPENDENT TEST SAMPLES |

Confusion matrix: `Documentation/chapter4_full_class_confusion_caesar.csv` (columns include UNKNOWN).

## UNKNOWN/Background Rejection

No independently labeled negative/background image manifest was found for these four specialist classifiers. UNKNOWN rejection precision, recall, F1, and false-acceptance rate are therefore **NOT COMPLETED**. The UNKNOWN column in each matrix reflects only threshold rejection on labeled positive samples.

## Loading, Latency, And Production Consistency

- All four local ONNX sessions loaded with CPU ONNX Runtime and produced inference rows where eligible data decoded.
- Per-sample inference latency is recorded in the CSV `latency_ms` column.
- Current production metadata endpoints were checked and their class mappings, shapes, and preprocessing declarations match the local JSON metadata. Production ONNX binary hashes were not available from metadata-only HTTP inspection, so binary parity is **UNVERIFIED**.
- Physical mobile-device compatibility is not completed; see `Documentation/MOBILE_DEVICE_TEST_PLAN.md`.

## Limitations

- ARICC: 4/8 classes have source-disjoint validation videos; 4 classes are missing independent source videos.
- FABLAB: 4/7 classes have independent validation videos; 3 classes are missing.
- CAESAR: 6/19 classes have source-disjoint validation videos; 13 classes are missing.
- RECON: labeled images are available, but no repository split proves independence from training/validation; results are explicitly unverified for independence.
- No training images, augmented duplicates, or same-source training frames were used as independent evidence by this script.
