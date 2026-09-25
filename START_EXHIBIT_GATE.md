# Start Here: Exhibit Noise Gate

The current classifier is being forced to choose an exhibit class even when the camera sees noise. Fix that by adding a first-stage gate.

## First Step

Build a binary dataset:

```text
gate_dataset/train/exhibit
gate_dataset/train/background
gate_dataset/val/exhibit
gate_dataset/val/background
```

You do not need bounding boxes for this first version.

## Current Starter Dataset

This repo now has a first balanced starter dataset:

```text
gate_dataset/train/exhibit:      200 images
gate_dataset/train/background:   200 images
gate_dataset/val/exhibit:         50 images
gate_dataset/val/background:      50 images
```

The `exhibit` images were copied from:

```text
C:\Users\Administrator\Desktop\datasets\dataset\stratified_balanced_200
```

The `background` images are a starter mix of augmented lobby/walkway-style images and generated noise/blank/dark frames. This is enough to train a first test gate, but it should be improved later with more real camera frames of walls, floors, ceilings, corridors, blur, and non-exhibit views.

## What Goes Where

`exhibit`:

- clear frames of DWT, EAP, EGN, or other real exhibits
- frames where the exhibit is the main subject
- normal lighting and camera angles

`background`:

- blank walls, ceiling, floor
- blurry camera movement
- dark frames
- overexposed frames
- people or room views without a clear exhibit
- random non-exhibit objects

## UNKNOWN Category

UNKNOWN is the shared rejection outcome for both ARICC and RECON. It is an
abstention result, not an additional neural-network class. It contains:

- background scenes
- random museum frames
- floors
- walls
- people
- empty rooms
- blurred images
- noise samples
- non-exhibit environments

When the model or gate predicts UNKNOWN, the application displays:

```text
No exhibit detected
```

Some room objects and visually similar backgrounds may still occasionally be
classified as exhibits. Additional real-world background examples can further
improve rejection performance.

## Implemented Inference Flow

The browser now uses the trained models in this order:

```text
camera frame
	-> binary exhibit/background gate
	-> ARICC eight-class classifier
	-> human-readable exhibit name
```

The ARICC classifier is used directly for the ARICC webcam workflow. The legacy 28-class classifier is not allowed to replace an ARICC result, so old labels such as `Phobia` cannot leak into this path.

## Why This Comes First

A detector needs bounding-box annotations. You do not currently have annotation files in this repo, so the fastest reliable first version is a binary classifier gate:

```text
Frame -> exhibit/background gate -> primary classifier -> specialist model
```

For the current ARICC workflow, the specialist stage is the trained ARICC classifier:

```text
Frame -> gate -> ARICC-1 ... ARICC-8 -> display name
```

## Training Command

After adding images:

```bash
yolo classify train model=yolov8n-cls.pt data=gate_dataset imgsz=224 epochs=30
```

Training has been run once for the starter dataset. The trained PyTorch gate model is here:

```text
runs/classify/gate_runs/exhibit_gate/weights/best.pt
```

Training summary:

```text
train images: 400
val images:   100
classes:      background, exhibit
val top-1 accuracy: 100% on the starter validation set
```

Important: this high score is only for the current starter validation set. The background data should still be improved with more real camera frames before treating the gate as production-ready.

## Acceptance Rule

Use this threshold first:

```text
exhibit confidence >= 0.60: continue
exhibit confidence < 0.60: reject as noise
```

After testing, adjust the threshold:

- too many noise frames pass through: raise to `0.70`
- too many real exhibits get rejected: lower to `0.50`

The gate is loaded by the browser from:

```text
public/models/exhibit_gate/exhibit_gate.onnx
public/models/exhibit_gate/exhibit_gate_metadata.json
```

The gate threshold in the metadata is currently `0.60`.

## ARICC Classifier

The organized ARICC frames are grouped into eight classes, with numbered variants kept together:

```text
ARICC-1  3D Printer
ARICC-2  Collaborative Robot
ARICC-3  FDAS
ARICC-4  Industrial Robot
ARICC-5  Pick & Place Machine
ARICC-6  Robotic Arm
ARICC-7  Smart Systems
ARICC-8  Speech Home Automation
```

The browser model and metadata are deployed here:

```text
public/models/egn_balanced_model_corrected.onnx
public/models/egn_balanced_model_corrected_metadata.json
```

The metadata contains the eight class IDs and their display names. The frontend loads both files in `src/services/exhibitDetectionService.js` and runs ARICC inference after the gate accepts a frame.

## Display and Rejection Rules

The ARICC classifier returns a prediction only when its result is sufficiently decisive. A low confidence gap between the first and second class is treated as background or an uncertain frame. This prevents the app from displaying a guessed exhibit name.

When an ARICC frame is rejected, the frontend clears any previous label instead of keeping a stale result from an earlier classifier. This prevents old labels, including `Phobia`, from remaining on screen.

The display component is implemented in `src/ai-exhibit.jsx`. It requires a successful detection and a combined confidence of at least `0.60` before showing the exhibit name.

## Verification

Build the frontend after model or inference changes:

```bash
npm run build
```

Then open:

```text
http://127.0.0.1:4173/machine-vision-exhibit
```

The browser console should show messages similar to:

```text
ARICC specialist classifier loaded
Using ARICC model with 8 classes
ARICC model result: Smart Systems
```

If the camera is pointed at a non-exhibit view or an unclear machine image, a low-confidence result is expected and no label should be displayed.

## Current Limitation

The browser is using the existing exported ONNX ARICC model. A planned re-export to preserve the trained pooling layer exactly is not yet complete because the standalone export script is missing its `yolo_tiny_model` dependency. Until that export is repaired, the top class may be directionally correct while confidence remains low.

## Later Upgrade

When you have time, annotate exhibit bounding boxes and train a YOLO detector. That upgraded gate can crop the exhibit ROI before passing it to the primary classifier.

## Train ARICC From Documentation Videos

### Why Separate Environments Were Created

RECON and ARICC are separate Ultralytics/PyTorch video-training workflows. Dedicated environments were created because the application's runtime environment is not guaranteed to contain the video extraction, OpenCV, PyTorch, and Ultralytics versions needed for training and ONNX export.

- `.recon-venv` is for the five-class RECON Center classifier.
- `.aricc-venv` is for the eight-class ARICC classifier.

Keeping them separate prevents training-only packages or incompatible model-tool versions from changing the browser and backend runtime. Both environments are local development tooling only; they are not bundled into the frontend or production deployment.

### RECON Files Modified or Added

- `scripts/train_recon_from_documentation.py` - extracts RECON video frames, trains the five-class model, exports ONNX, and deploys its artifacts.
- `runs/recon_documentation_dataset/` - generated RECON train/validation frames and split metadata.
- `public/models/recon/` - generated RECON browser model and metadata.
- `.recon-venv/` - local Python environment for RECON training.

### ARICC Files Modified or Added

- `scripts/train_aricc_from_documentation.py` - extracts ARICC video frames, trains the eight-class model, exports ONNX, and deploys its artifacts.
- `scripts/audit_aricc_model.py` - compares PyTorch and ONNX predictions.
- `runs/aricc_documentation_dataset/` - generated ARICC train/validation frames and split metadata.
- `public/models/aricc/` - generated ARICC browser model and metadata.
- `.aricc-venv/` - local Python environment for ARICC training.

### Shared Exhibit-Gate Files

- `src/services/exhibitDetectionService.js` - loads the gate and ARICC models and applies rejection rules.
- `src/ai-exhibit.jsx` - displays accepted detections and clears rejected labels.
- `public/models/exhibit_gate/exhibit_gate.onnx` and `public/models/exhibit_gate/exhibit_gate_metadata.json` - browser gate artifacts.
- `public/models/egn_balanced_model_corrected.onnx` and `public/models/egn_balanced_model_corrected_metadata.json` - deployed classifier artifacts.
- `START_EXHIBIT_GATE.md`, `README.md`, and `vite.config.js` - documentation and local model-serving configuration.

Python `__pycache__/` directories are generated files and should not be treated as application source.

The source videos in `Documentation/datasets/ARICC/ARICC` can be converted into an eight-class browser classifier with:

```powershell
.aricc-venv\Scripts\python.exe scripts/train_aricc_from_documentation.py --dataset-dir runs/aricc_documentation_dataset_v2 --epochs 40 --batch 8 --imgsz 224 --frame-step 10 --max-frames 120 --deploy
```

The script splits videos before extracting frames, trains the eight ARICC classes, exports ONNX, writes metadata, and deploys the artifacts to `public/models/aricc`. Use a separate `.aricc-venv` because the application environment may not contain the video and Ultralytics training dependencies.
