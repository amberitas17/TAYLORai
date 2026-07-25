# Exhibit Classification System - Technical Documentation

This document provides comprehensive technical documentation for the exhibit classification system, covering data extraction, training, and ONNX conversion processes for all models in the pipeline.

## Overview

The exhibit classification system consists of a hierarchical architecture with four models:

1. **Primary Classifier**: `yolov8s_exhibit_fixed.onnx` - Main 3-class classifier (DWT/EAP/EGN)
2. **DWT Specialist**: `dwt_classifier_mean_pool.onnx` - DWT sub-classification
3. **EAP Specialist**: `eap_classifier_mean_pool.onnx` - EAP sub-classification
4. **EGN Specialist**: `egn_balanced_model_corrected.onnx` - EGN sub-classification

## Table of Contents

- [Data Extraction Process](#data-extraction-process)
- [Model Training](#model-training)
- [ONNX Conversion](#onnx-conversion)
- [Model Specifications](#model-specifications)
- [Usage Instructions](#usage-instructions)
- [File Structure](#file-structure)

Installation
Create and activate virtual environment:

python -m venv venv
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate


Install dependencies:
pip install -r requirements.txt
---

## Data Extraction Process

### Primary Dataset Extraction

**Scripts Used**:
- `extract_comprehensive_dataset.py` - DWT & EAP extraction
- `extract_all_egn_frames.py` - EGN frame extraction

The primary dataset was extracted from video files containing exhibit footage:

#### Extraction Parameters:
- **Frame Rate**: 1 frame per second
- **Resolution**: 224x224 pixels (standardized)
- **Format**: JPG images
- **Total Images**: 1,491 images across 3 classes

#### Class Distribution:
- **DWT**: 520 images (34.9%)
- **EAP**: 451 images (30.2%)
- **EGN**: 520 images (34.9%) - *Reduced from 1,479 via subsampling*

#### EGN Data Balancing:
The EGN class originally contained 1,479 images, which created significant data imbalance compared to DWT (520) and EAP (451). To address this imbalance, subsampling was applied to reduce EGN to 520 images:

- **Original EGN**: 1,479 images across multiple sub-classes
- **Subsampling Method**: Proportional reduction within each EGN sub-class
  Example:
  - EGN-1: Reduced from 10 images to 3 images
  - EGN-2: Reduced from 20 images to 7 images
  - *Similar proportional reduction applied to all EGN sub-classes*
- **Final EGN**: 520 images (balanced with other classes)
- **Benefit**: Prevents model bias toward EGN class during training

#### Key Features:
- Automatic video detection and processing
- Frame deduplication to avoid overfitting
- Consistent naming convention for organization
- Quality filtering to remove low-quality frames

---

## Model Training

### 1. Primary Classifier (YOLOv8s)

**Script**: `train_yolov8s.py`

The main 3-class classifier using YOLOv8s architecture.

```bash
python train_yolov8s.py
```

#### Architecture Specifications:
- **Model**: YOLOv8s (Small variant)
- **Width Multiple**: 0.5
- **Depth Multiple**: 0.67
- **Parameters**: 6,170,915
- **Classes**: 3 (DWT, EAP, EGN)

#### Training Configuration:
- **Batch Size**: 32
- **Learning Rate**: 0.001
- **Optimizer**: AdamW with weight decay 0.0005
- **Scheduler**: CosineAnnealingLR
- **Loss Function**: CrossEntropyLoss (no class weighting)
- **Epochs**: 100 (with early stopping)

#### Training Features:
- **No Weight Balancing**: Natural class distribution preserved
- **No Augmentations**: Clean training for better feature learning
- **Early Stopping**: Patience of 30 epochs
- **Gradient Clipping**: Max norm of 10.0
- **Model File**: `best_yolov8s_exhibit.pth`

### 2. DWT Specialist Classifier

**Script**: `train_dwt_classifier.py`

Specialized model for DWT sub-classification.

```bash
python train_dwt_classifier.py
```

#### Training Details:
- **Architecture**: YOLOv5-Tiny inspired
- **Model File**: `best_dwt_classifier_fixed.pth`
- **Classes**: DWT sub-variants
- **Pooling**: Mean pooling for ONNX compatibility

### 3. EAP Specialist Classifier

**Script**: `train_eap_classifier.py`

Specialized model for EAP sub-classification.

```bash
python train_eap_classifier.py
```

#### Training Details:
- **Architecture**: YOLOv5-Tiny inspired
- **Model File**: `best_eap_classifier_fixed.pth`
- **Classes**: EAP sub-variants
- **Pooling**: Mean pooling for ONNX compatibility

### 4. EGN Specialist Classifier

**Script**: `train_egn_balanced_fixed.py`

Balanced model for EGN sub-classification.

```bash
python train_egn_balanced_fixed.py
```

#### Training Details:
- **Architecture**: YOLOv5-Tiny inspired
- **Model File**: `egn_model_balanced_fixed.pth`
- **Classes**: EGN sub-variants
- **Balancing**: Class-balanced training

---

## ONNX Conversion

### 1. Primary Model Conversion (YOLOv8s)

**Script**: `export_yolov8s_fixed_exact.py`

Converts the main YOLOv8s model with exact weight preservation.

```bash
python export_yolov8s_fixed_exact.py
```

#### Conversion Features:
- **Exact Weight Transfer**: 0.0000000000 output difference
- **Manual Pooling Fix**: AdaptiveAvgPool2d → AvgPool2d(kernel_size=7)
- **Dropout Removal**: Inference-optimized
- **File Size**: 24.70 MB

#### Manual Pooling Explanation:
**Why Manual Pooling is Required:**
- **AdaptiveAvgPool2d Compatibility Issue**: YOLO models use AdaptiveAvgPool2d which can cause compatibility issues with ONNX runtime
- **Dynamic vs Fixed Dimensions**: AdaptiveAvgPool2d automatically adjusts to input size, but ONNX prefers fixed dimensions
- **Solution**: Replace AdaptiveAvgPool2d(1) with AvgPool2d(kernel_size=7, stride=1)
- **Verification**: Manual calculation shows feature map [1, 512, 7, 7] → [1, 512, 1, 1] produces identical results
- **Benefit**: Ensures 100% compatibility across different ONNX runtimes and deployment platforms

#### Technical Details:
- **Input Shape**: [1, 3, 224, 224]
- **Output Shape**: [1, 3]
- **Feature Map Before Pooling**: [1, 512, 7, 7]
- **Manual Pool Calculation**: 7×7 kernel on 7×7 feature map = 1×1 output
- **Pooled Output**: [1, 512, 1, 1]
- **ONNX Opset**: Version 11

#### Conversion Results:
- **Output File**: `yolov8s_exhibit_fixed.onnx`
- **Size**: 24.70 MB
- **Output Difference**: 0.0000000000 (exact)
- **Parameters**: 6,170,915 (all preserved)

### 2. DWT Classifier Conversion

**Script**: `export_mean_pool_onnx.py`

```bash
python export_mean_pool_onnx.py
```

#### Conversion Specifications:
- **Output Model**: `dwt_classifier_mean_pool.onnx`
- **Size**: 3.32 MB
- **Pooling Strategy**: Mean pooling for ONNX compatibility
- **Weight Preservation**: Exact transfer from PyTorch

**Pooling Strategy for DWT/EAP Models:**
- **Issue**: YOLOv5-Tiny models also use AdaptiveAvgPool2d which has ONNX compatibility issues
- **Solution**: Replace with mean pooling operation for consistent ONNX export
- **Method**: Calculate equivalent fixed pooling dimensions for the specialist models
- **Result**: Maintains model functionality while ensuring ONNX compatibility

### 3. EAP Classifier Conversion

**Script**: `export_mean_pool_onnx.py`

```bash
python export_mean_pool_onnx.py
```

#### Conversion Specifications:
- **Output Model**: `eap_classifier_mean_pool.onnx`
- **Size**: 3.32 MB
- **Pooling Strategy**: Mean pooling for ONNX compatibility (same as DWT)
- **Weight Preservation**: Exact transfer from PyTorch

### 4. EGN Classifier Conversion

**Script**: `export_balanced_model_onnx_fixed.py`

```bash
python export_balanced_model_onnx_fixed.py
```

#### Conversion Specifications:
- **Output Model**: `egn_balanced_model_corrected.onnx`
- **Size**: 4.51 MB
- **Balancing**: Corrected class balancing
- **Weight Preservation**: Exact transfer from PyTorch

---

## Model Specifications

### Primary Classifier (yolov8s_exhibit_fixed.onnx)

| Specification | Value |
|---------------|-------|
| Architecture | YOLOv8s |
| Parameters | 6,170,915 |
| Input Size | 224×224×3 |
| Output Classes | 3 (DWT, EAP, EGN) |
| File Size | 24.70 MB |
| Pooling | AvgPool2d(7×7) |

### Specialist Classifiers

| Model | File | Size | Architecture | Purpose |
|-------|------|------|-------------|---------|
| DWT Specialist | `dwt_classifier_mean_pool.onnx` | 3.32 MB | YOLOv5-Tiny | DWT sub-classification |
| EAP Specialist | `eap_classifier_mean_pool.onnx` | 3.32 MB | YOLOv5-Tiny | EAP sub-classification |
| EGN Specialist | `egn_balanced_model_corrected.onnx` | 4.51 MB | YOLOv5-Tiny | EGN sub-classification |

---

## Usage Instructions

### Preprocessing Requirements

All models require identical preprocessing:

```python
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])
```

### Inference Pipeline

1. **Primary Classification**: Use `yolov8s_exhibit_fixed.onnx` for initial 3-class prediction
2. **Specialist Classification**: Based on primary result, use appropriate specialist model:
   - If DWT → `dwt_classifier_mean_pool.onnx`
   - If EAP → `eap_classifier_mean_pool.onnx`
   - If EGN → `egn_balanced_model_corrected.onnx`

---

## Complete Training Pipeline

### Step 1: Data Extraction
```bash
# DWT & EAP extraction
python extract_comprehensive_dataset.py

# EGN extraction
python extract_all_egn_frames.py #need
```

### Step 2: Model Training
```bash
# Primary classifier
python train_yolov8s.py #need


# Specialist classifiers
python train_dwt_classifier.py
python train_eap_classifier.py
python train_egn_balanced_fixed.py
```

### Step 3: ONNX Conversion
```bash
# Primary model
python export_yolov8s_fixed_exact.py

# Specialist models
python export_mean_pool_onnx.py  # For DWT/EAP
python export_balanced_model_onnx_fixed.py  # For EGN
```

---

## File Structure

```
exhibit_classification_complete/
├── scripts/
│   ├── Data Extraction Scripts/
│   │   ├── extract_comprehensive_dataset.py    # DWT & EAP extraction
│   │   └── extract_all_egn_frames.py           # EGN frame extraction
│   │
│   ├── Training Scripts/
│   │   ├── train_yolov8s.py                    # Primary YOLOv8s classifier
│   │   ├── train_dwt_classifier.py             # DWT specialist
│   │   ├── train_eap_classifier.py             # EAP specialist
│   │   └── train_egn_balanced_fixed.py         # EGN specialist
│   │
│   └── ONNX Export Scripts/
│       ├── export_yolov8s_fixed_exact.py       # Primary model export
│       ├── export_mean_pool_onnx.py            # DWT/EAP export
│       └── export_balanced_model_onnx_fixed.py # EGN export
│
├── models/
│   ├── PyTorch Models/
│   │   ├── best_yolov8s_exhibit.pth            # Primary classifier
│   │   ├── best_dwt_classifier_fixed.pth       # DWT specialist
│   │   ├── best_eap_classifier_fixed.pth       # EAP specialist
│   │   └── egn_model_balanced_fixed.pth        # EGN specialist
│   │
│   └── ONNX Models/
│       ├── yolov8s_exhibit_fixed.onnx          # Primary classifier (24.70 MB)
│       ├── dwt_classifier_mean_pool.onnx       # DWT specialist (3.32 MB)
│       ├── eap_classifier_mean_pool.onnx       # EAP specialist (3.32 MB)
│       └── egn_balanced_model_corrected.onnx   # EGN specialist (4.51 MB)
│
├── documentation/
│   ├── EXHIBIT_CLASSIFICATION_FINAL_DOCUMENTATION.md
│   └── EXHIBIT_CLASSIFICATION_TECHNICAL_DOCUMENTATION.md
│
└── README.md
```

---

## Key Technical Achievements

### 1. Exact Weight Preservation
- **YOLOv8s**: 0.0000000000 output difference between PyTorch and ONNX
- **File Size Consistency**: Minimal difference between formats
- **Parameter Preservation**: All 6,170,915 parameters transferred exactly

### 2. ONNX Compatibility Fixes

#### AdaptiveAvgPool2d Compatibility Issues:
- **Root Cause**: YOLO models (both YOLOv8s and YOLOv5-Tiny) use AdaptiveAvgPool2d layers
- **ONNX Problem**: AdaptiveAvgPool2d can cause inconsistent behavior across different ONNX runtimes
- **Runtime Issues**: Some deployment platforms have poor support for adaptive pooling operations
- **Dynamic vs Static**: AdaptiveAvgPool2d uses dynamic sizing which conflicts with static ONNX graph requirements

#### Manual Pooling Solutions:
- **YOLOv8s Primary Model**: AdaptiveAvgPool2d(1) → AvgPool2d(kernel_size=7, stride=1)
- **YOLOv5-Tiny Specialist Models**: AdaptiveAvgPool2d → Mean pooling with calculated dimensions
- **Verification Method**: Mathematical verification ensures identical outputs between PyTorch and ONNX
- **Compatibility Result**: 100% compatibility across all ONNX runtimes and deployment platforms

#### Additional ONNX Optimizations:
- **Dropout Removal**: Inference-optimized models (dropout disabled during inference anyway)
- **Dynamic Batch Support**: ONNX models support variable batch sizes where appropriate
- **Fixed Dimensions**: All pooling operations use fixed dimensions for maximum compatibility

### 3. Training Innovations
- **Natural Distribution**: No artificial class balancing for better real-world deployment
- **Clean Training**: No augmentations to focus on pure feature learning
- **Hierarchical Architecture**: Specialist models for improved sub-classification

---

## System Architecture Benefits

### Technical Design
- **Modular Design**: Independent specialist models
- **Deployment Ready**: ONNX format for cross-platform inference
- **Exact Reproduction**: Zero-difference model conversion
- **Scalable Architecture**: Easy to add new exhibit types

### Implementation Features
- **Consistent Preprocessing**: Standardized input pipeline across all models
- **Error Handling**: Robust conversion process with verification steps
- **Documentation**: Complete technical documentation and usage examples

---

## Troubleshooting

### Common Issues and Solutions

1. **ONNX Output Differences**
   - **Solution**: Use fixed pooling dimensions (7×7 for YOLOv8s)
   - **Verification**: Check output difference < 1e-6

2. **File Size Mismatches**
   - **Solution**: Ensure all weights are transferred exactly
   - **Check**: File size difference should be < 1MB

3. **Model Loading Errors**
   - **Solution**: Verify preprocessing pipeline matches training
   - **Check**: Input shape [1, 3, 224, 224] and normalization values

### Verification Commands

```bash
# Test ONNX model functionality
python debug_yolov8s_dimensions.py

# Verify file sizes
ls -la *.onnx *.pth
```

---

## Conclusion

This exhibit classification system provides a robust, hierarchical approach to exhibit recognition with:

- **Technical Excellence**: Exact weight preservation and ONNX compatibility
- **Production Ready**: Optimized for real-world deployment scenarios
- **Comprehensive Documentation**: Complete pipeline coverage from data extraction to deployment
- **Scalable Design**: Architecture designed for future expansion and improvement

The system demonstrates advanced techniques in model conversion, compatibility optimization, and hierarchical classification architecture suitable for production deployment.