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

## Why This Comes First

A detector needs bounding-box annotations. You do not currently have annotation files in this repo, so the fastest reliable first version is a binary classifier gate:

```text
Frame -> exhibit/background gate -> primary classifier -> specialist model
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

## Later Upgrade

When you have time, annotate exhibit bounding boxes and train a YOLO detector. That upgraded gate can crop the exhibit ROI before passing it to the primary classifier.
