import torch
import torch.nn as nn
import json
import os

class ConvBlock(nn.Module):
    """Standard convolution block with BatchNorm and SiLU"""
    def __init__(self, in_channels, out_channels, kernel_size=1, stride=1, padding=None, groups=1):
        super().__init__()
        if padding is None:
            padding = kernel_size // 2
        self.conv = nn.Conv2d(in_channels, out_channels, kernel_size, stride, padding, groups=groups, bias=False)
        self.bn = nn.BatchNorm2d(out_channels)
        self.act = nn.SiLU(inplace=True)

    def forward(self, x):
        return self.act(self.bn(self.conv(x)))


class Bottleneck(nn.Module):
    """Bottleneck block for YOLOv8"""
    def __init__(self, in_channels, out_channels, shortcut=True, groups=1, expansion=0.5):
        super().__init__()
        hidden_channels = int(out_channels * expansion)
        self.conv1 = ConvBlock(in_channels, hidden_channels, 1)
        self.conv2 = ConvBlock(hidden_channels, out_channels, 3, groups=groups)
        self.add = shortcut and in_channels == out_channels

    def forward(self, x):
        return x + self.conv2(self.conv1(x)) if self.add else self.conv2(self.conv1(x))


class C2f(nn.Module):
    """CSP Bottleneck with 2 convolutions for YOLOv8"""
    def __init__(self, in_channels, out_channels, n=1, shortcut=False, groups=1, expansion=0.5):
        super().__init__()
        self.hidden_channels = int(out_channels * expansion)
        self.conv1 = ConvBlock(in_channels, 2 * self.hidden_channels, 1)
        self.conv2 = ConvBlock((2 + n) * self.hidden_channels, out_channels, 1)
        self.bottlenecks = nn.ModuleList(Bottleneck(self.hidden_channels, self.hidden_channels, shortcut, groups, 1.0) for _ in range(n))

    def forward(self, x):
        y = list(self.conv1(x).chunk(2, 1))
        y.extend(m(y[-1]) for m in self.bottlenecks)
        return self.conv2(torch.cat(y, 1))


class SPPF(nn.Module):
    """Spatial Pyramid Pooling - Fast"""
    def __init__(self, in_channels, out_channels, kernel_size=5):
        super().__init__()
        hidden_channels = in_channels // 2
        self.conv1 = ConvBlock(in_channels, hidden_channels, 1)
        self.conv2 = ConvBlock(hidden_channels * 4, out_channels, 1)
        self.maxpool = nn.MaxPool2d(kernel_size=kernel_size, stride=1, padding=kernel_size // 2)

    def forward(self, x):
        x = self.conv1(x)
        y1 = self.maxpool(x)
        y2 = self.maxpool(y1)
        return self.conv2(torch.cat((x, y1, y2, self.maxpool(y2)), 1))


class YOLOv8sONNXFixed(nn.Module):
    """YOLOv8s ONNX model with EXACT weight transfer - fixed pooling dimensions"""

    def __init__(self, original_model):
        super().__init__()

        # Copy backbone exactly, but replace AdaptiveAvgPool2d
        backbone_layers = []
        for layer in original_model.backbone:
            if isinstance(layer, nn.AdaptiveAvgPool2d):
                # The feature map is [B, 512, 7, 7] so we need AvgPool2d(7, 7) to get [B, 512, 1, 1]
                backbone_layers.append(nn.AvgPool2d(kernel_size=7, stride=1))
                print("Replaced AdaptiveAvgPool2d(1) with AvgPool2d(kernel_size=7, stride=1)")
            else:
                backbone_layers.append(layer)

        self.backbone = nn.Sequential(*backbone_layers)

        # Copy classifier exactly, skipping only dropout layers
        classifier_layers = []
        for layer in original_model.classifier:
            if isinstance(layer, nn.Dropout):
                print(f"Skipping dropout layer: {layer}")
            else:
                classifier_layers.append(layer)

        self.classifier = nn.Sequential(*classifier_layers)

    def forward(self, x):
        x = self.backbone(x)
        x = self.classifier(x)
        return x


def create_onnx_model_with_exact_weights():
    """Create ONNX model and transfer exact weights"""
    print("Creating ONNX model with exact weight transfer...")

    model_path = "best_yolov8s_exhibit.pth"

    # Load original model
    from train_yolov8s import YOLOv8s
    checkpoint = torch.load(model_path, map_location='cpu')
    original_model = YOLOv8s(num_classes=3, width_multiple=0.5, depth_multiple=0.67)
    original_model.load_state_dict(checkpoint['model_state_dict'])
    original_model.eval()

    print(f"Original model parameters: {sum(p.numel() for p in original_model.parameters()):,}")

    # Create ONNX model
    onnx_model = YOLOv8sONNXFixed(original_model)
    print(f"ONNX model parameters: {sum(p.numel() for p in onnx_model.parameters()):,}")

    # Transfer weights exactly
    onnx_state = onnx_model.state_dict()
    orig_state = original_model.state_dict()

    print("\nTransferring weights...")
    transferred = 0
    skipped = 0

    # Transfer all matching keys
    for onnx_key in onnx_state.keys():
        if onnx_key in orig_state:
            if onnx_state[onnx_key].shape == orig_state[onnx_key].shape:
                onnx_state[onnx_key] = orig_state[onnx_key].clone()
                transferred += 1
            else:
                print(f"Shape mismatch: {onnx_key}")
                skipped += 1
        else:
            # Handle renamed keys (pooling layer replacement)
            if 'backbone.10' in onnx_key:  # This is our new AvgPool2d
                print(f"Skipping new pooling layer: {onnx_key}")
                skipped += 1
            else:
                print(f"Key not found: {onnx_key}")
                skipped += 1

    onnx_model.load_state_dict(onnx_state, strict=False)

    print(f"Weight transfer: {transferred} transferred, {skipped} skipped")

    # Test model equivalence
    print("\nTesting model equivalence...")
    test_input = torch.randn(1, 3, 224, 224)

    with torch.no_grad():
        orig_output = original_model(test_input)
        onnx_output = onnx_model(test_input)

    max_diff = torch.abs(orig_output - onnx_output).max().item()
    mean_diff = torch.abs(orig_output - onnx_output).mean().item()

    print(f"Original output: {orig_output}")
    print(f"ONNX output: {onnx_output}")
    print(f"Max difference: {max_diff:.10f}")
    print(f"Mean difference: {mean_diff:.10f}")

    if max_diff < 1e-6:
        print("PERFECT: Outputs are nearly identical")
    elif max_diff < 1e-4:
        print("GOOD: Very small differences")
    else:
        print("WARNING: Significant differences detected")

    return onnx_model, checkpoint, max_diff


def export_yolov8s_fixed_onnx():
    """Export YOLOv8s with exact weight preservation and correct pooling"""
    print("=" * 80)
    print("YOLOv8s FIXED ONNX EXPORT - CORRECT POOLING DIMENSIONS")
    print("=" * 80)

    model_path = "best_yolov8s_exhibit.pth"
    onnx_path = "yolov8s_exhibit_fixed.onnx"

    if not os.path.exists(model_path):
        print(f"ERROR: {model_path} not found!")
        return False

    try:
        # Create ONNX model with exact weights
        onnx_model, checkpoint, output_diff = create_onnx_model_with_exact_weights()

        # Export to ONNX
        print(f"\nExporting to {onnx_path}...")
        dummy_input = torch.randn(1, 3, 224, 224)

        torch.onnx.export(
            onnx_model,
            dummy_input,
            onnx_path,
            export_params=True,
            opset_version=11,
            do_constant_folding=True,
            input_names=['input'],
            output_names=['output'],
            dynamic_axes={
                'input': {0: 'batch_size'},
                'output': {0: 'batch_size'}
            },
            verbose=False
        )

        # Check file sizes
        pytorch_size = os.path.getsize(model_path) / (1024 * 1024)
        onnx_size = os.path.getsize(onnx_path) / (1024 * 1024)
        size_diff = abs(pytorch_size - onnx_size)

        print("\n" + "=" * 80)
        print("EXPORT COMPLETE!")
        print("=" * 80)
        print(f"PyTorch model: {pytorch_size:.2f} MB")
        print(f"ONNX model: {onnx_size:.2f} MB")
        print(f"Size difference: {size_diff:.2f} MB")
        print(f"Output difference: {output_diff:.10f}")
        print(f"Original accuracy: {checkpoint.get('eval_accuracy', 'Unknown'):.2f}%")

        # Create metadata
        metadata = {
            'model_name': 'YOLOv8s Fixed ONNX',
            'classes': ['DWT', 'EAP', 'EGN'],
            'original_accuracy': checkpoint.get('eval_accuracy', 'Unknown'),
            'output_difference': float(output_diff),
            'file_size_difference_mb': float(size_diff),
            'pooling_fix': 'AdaptiveAvgPool2d(1) -> AvgPool2d(kernel_size=7, stride=1)',
            'feature_map_before_pooling': '[1, 512, 7, 7]',
            'pooled_output': '[1, 512, 1, 1]',
            'flattened_features': 512,
            'exact_weight_preservation': output_diff < 1e-6,
            'preprocessing': {
                'resize': [224, 224],
                'normalize': {
                    'mean': [0.485, 0.456, 0.406],
                    'std': [0.229, 0.224, 0.225]
                }
            }
        }

        with open("yolov8s_fixed_onnx_metadata.json", 'w') as f:
            json.dump(metadata, f, indent=2)

        if output_diff < 1e-6:
            print("SUCCESS: ONNX model produces identical outputs!")
        elif output_diff < 1e-4:
            print("SUCCESS: ONNX model has minimal differences")
        else:
            print("WARNING: ONNX model has significant differences")

        if size_diff < 1.0:
            print("File sizes are very close")
        else:
            print(f"File size difference: {size_diff:.2f} MB")

        return True

    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = export_yolov8s_fixed_onnx()

    if success:
        print("\nFixed ONNX export completed successfully!")
        print("The ONNX model should now have identical predictions to PyTorch!")
    else:
        print("\nONNX export failed.")