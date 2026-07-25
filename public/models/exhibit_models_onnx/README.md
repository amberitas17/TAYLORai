# Exhibit Classification Models - ONNX Format (Corrected)

This folder contains all 10 specialized exhibit classification models converted to ONNX format using the correct source models.

## Models Overview

| Model | Classes | Accuracy | Source Model | ONNX File | Metadata |
|-------|---------|----------|--------------|-----------|----------|
| **AT** - Atrium | 8 | 90.0% | Corrected (17MB) | `at_exhibit_classifier.onnx` | `at_metadata.json` |
| **BTN** - Between | 11 | 90.0% | Corrected (17MB) | `btn_exhibit_classifier.onnx` | `btn_metadata.json` |
| **CCP** - Climate Changed | 9 | 90.0% | Corrected (17MB) | `ccp_exhibit_classifier.onnx` | `ccp_metadata.json` |
| **DWT** - Dialogue with Time | 22 | 90.0% | Corrected (17MB) | `dwt_exhibit_classifier.onnx` | `dwt_metadata.json` |
| **EAP** - Earth Alive Planet | 16 | 90.0% | Corrected (17MB) | `eap_exhibit_classifier.onnx` | `eap_metadata.json` |
| **EGN** - Energy Story | 37 | 100.0% | **Balanced (51MB)** | `egn_exhibit_classifier.onnx` | `egn_metadata.json` |
| **MAC** - Mechanics Alive | 6 | 90.0% | Corrected (17MB) | `mac_exhibit_classifier.onnx` | `mac_metadata.json` |
| **MEP** - Mind Eye | 26 | 90.0% | Corrected (17MB) | `mep_exhibit_classifier.onnx` | `mep_metadata.json` |
| **QS** - Quanta School | 8 | 90.0% | Corrected (17MB) | `qs_exhibit_classifier.onnx` | `qs_metadata.json` |
| **UMP** - Urban Mutations | 61 | 99.5% | **Balanced (51MB)** | `ump_exhibit_classifier.onnx` | `ump_metadata.json` |

## Source Models Used

**EGN & UMP**: Used balanced models (51MB) for best performance
- `balanced_egn_checkpoints/best_balanced_egn.pth` (100.0% accuracy)
- `balanced_ump_checkpoints/best_balanced_ump.pth` (99.5% accuracy)

**All Others**: Used corrected models (17MB)
- `*_corrected_checkpoints/best_*_corrected.pth` (90.0% accuracy)

## File Structure

For each exhibit model, you'll find:
- **`.onnx` file**: The optimized model for inference (~17MB each)
- **`_metadata.json`**: Contains class names, input shape, and model information

## Model Specifications

- **Architecture**: EfficientNet-B0 based classifiers with 256 hidden units
- **Input Shape**: `[batch_size, 3, 224, 224]` (RGB images, 224x224 pixels)
- **Framework**: PyTorch converted to ONNX (opset version 11)
- **Dynamic Axes**: Supports variable batch sizes
- **Consistent Size**: All ONNX models are ~17MB (architecture normalized)

## Usage Example

```python
import onnxruntime as ort
import numpy as np
import json
from PIL import Image
import torchvision.transforms as transforms

# Load model
session = ort.InferenceSession("dwt_exhibit_classifier.onnx")

# Load metadata for class names
with open("dwt_metadata.json", "r") as f:
    metadata = json.load(f)
    class_names = metadata["class_names"]

# Preprocess image
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

# Load and preprocess image
image = Image.open("your_image.jpg")
input_tensor = transform(image).unsqueeze(0).numpy()

# Run inference
outputs = session.run(None, {"input": input_tensor})
prediction = np.argmax(outputs[0])
predicted_class = class_names[prediction]

print(f"Prediction: {predicted_class}")
```

## Class Examples

### DWT - Dialogue with Time (22 classes)
- DWT-02 Kopi Talk
- DWT-03 Experiencing Dementia
- DWT-04 Brain
- DWT-21 Retirement Bench

### EGN - Energy Story (37 classes) - Best Performance
- EGN-1, EGN-2, EGN-3...
- EGN-Entrance

### UMP - Urban Mutations (61 classes) - High Performance
- UMP-02 Urban Melody
- UMP-08 Homeless
- UMP-15 Urban Data Centres
- UMP-40 Detroit Medellin Copenhagen Songdo

## Performance Summary

- **Total Models**: 10
- **Total File Size**: ~170 MB
- **Average Model Size**: ~17 MB per model (consistent)
- **Best Accuracy**: EGN (100.0%), UMP (99.5%)
- **Architecture**: All models use identical EfficientNet-B0 + 256 hidden units

## Quality Assurance

✅ **Correct source models used**:
- EGN & UMP from balanced training (best performance)
- Others from corrected training (consistent architecture)

✅ **Consistent ONNX sizes**: All models ~17MB (architecture normalized)

✅ **Verified class names**: Based on actual Single_Classifier_DSet subfolders

## Deployment

These ONNX models can be used with:
- ONNX Runtime (Python, C++, C#, Java)
- TensorRT (NVIDIA GPUs)
- OpenVINO (Intel hardware)
- Web browsers (ONNX.js)
- Mobile devices (ONNX Runtime Mobile)

Generated on: November 9, 2024 (Corrected Version)