import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms
from PIL import Image
import os
import glob
import time
import numpy as np
from pathlib import Path
import json
from collections import Counter

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


class YOLOv8s(nn.Module):
    """YOLOv8s (small) backbone adapted for classification"""

    def __init__(self, num_classes=3, width_multiple=0.5, depth_multiple=0.67):
        super().__init__()

        # YOLOv8s channel sizes (larger than YOLOv8n)
        self.ch = [int(64 * width_multiple), int(128 * width_multiple),
                   int(256 * width_multiple), int(512 * width_multiple), int(1024 * width_multiple)]

        # YOLOv8s depth (more layers than YOLOv8n)
        self.depth = [max(1, round(3 * depth_multiple)), max(1, round(6 * depth_multiple)),
                      max(1, round(9 * depth_multiple)), max(1, round(3 * depth_multiple))]

        # Backbone
        self.backbone = nn.Sequential(
            # P1/2
            ConvBlock(3, self.ch[0], 3, 2),
            # P2/4
            ConvBlock(self.ch[0], self.ch[1], 3, 2),
            C2f(self.ch[1], self.ch[1], self.depth[0], True),
            # P3/8
            ConvBlock(self.ch[1], self.ch[2], 3, 2),
            C2f(self.ch[2], self.ch[2], self.depth[1], True),
            # P4/16
            ConvBlock(self.ch[2], self.ch[3], 3, 2),
            C2f(self.ch[3], self.ch[3], self.depth[2], True),
            # P5/32
            ConvBlock(self.ch[3], self.ch[4], 3, 2),
            C2f(self.ch[4], self.ch[4], self.depth[3], True),
            SPPF(self.ch[4], self.ch[4], 5),
        )

        # Enhanced classification head for YOLOv8s
        self.classifier = nn.Sequential(
            nn.AdaptiveAvgPool2d(1),
            nn.Flatten(),
            nn.Dropout(0.2),
            nn.Linear(self.ch[4], 512),
            nn.SiLU(inplace=True),
            nn.Dropout(0.1),
            nn.Linear(512, num_classes)
        )

        self._initialize_weights()

    def _initialize_weights(self):
        for m in self.modules():
            if isinstance(m, nn.Conv2d):
                nn.init.kaiming_normal_(m.weight, mode='fan_out', nonlinearity='relu')
            elif isinstance(m, nn.BatchNorm2d):
                nn.init.constant_(m.weight, 1)
                nn.init.constant_(m.bias, 0)
            elif isinstance(m, nn.Linear):
                nn.init.normal_(m.weight, 0, 0.01)
                nn.init.constant_(m.bias, 0)

    def forward(self, x):
        x = self.backbone(x)
        x = self.classifier(x)
        return x


class ExhibitDataset(Dataset):
    """Simple dataset for exhibit classification - NO WEIGHT BALANCING"""

    def __init__(self, data_dir, transform=None):
        self.data_dir = data_dir
        self.transform = transform
        self.images = []
        self.labels = []
        self.classes = ['DWT', 'EAP', 'EGN']
        self.class_to_idx = {cls: idx for idx, cls in enumerate(self.classes)}

        self._load_data()

    def _load_data(self):
        print("\nLoading ALL available images for YOLOv8s training...")
        class_counts = {}

        for class_idx, class_name in enumerate(self.classes):
            class_dir = os.path.join(self.data_dir, class_name)
            if not os.path.exists(class_dir):
                print(f"Warning: {class_dir} does not exist")
                continue

            # Find all image files
            image_patterns = ['*.jpg', '*.jpeg', '*.png', '*.bmp']
            class_images = []
            for pattern in image_patterns:
                class_images.extend(glob.glob(os.path.join(class_dir, pattern)))

            class_counts[class_name] = len(class_images)
            print(f"  {class_name}: {len(class_images)} images")

            for img_path in class_images:
                self.images.append(img_path)
                self.labels.append(class_idx)

        total_images = len(self.images)
        print(f"\nTotal dataset: {total_images} images")

        # Show class distribution
        print("Dataset class distribution:")
        for idx, class_name in enumerate(self.classes):
            count = self.labels.count(idx)
            percentage = count/total_images*100
            print(f"  {class_name}: {count} images ({percentage:.1f}%)")

        print("\n✓ NO weight balancing - using natural class distribution")

    def __len__(self):
        return len(self.images)

    def __getitem__(self, idx):
        img_path = self.images[idx]
        label = self.labels[idx]

        # Load image
        image = Image.open(img_path).convert('RGB')

        if self.transform:
            image = self.transform(image)

        return image, label


def save_checkpoint(state, filename='checkpoint_yolov8s.pth'):
    """Save training checkpoint"""
    torch.save(state, filename)
    print(f"  Checkpoint saved: {filename}")


def load_checkpoint(filename, model, optimizer, scheduler=None):
    """Load training checkpoint if it exists"""
    if os.path.exists(filename):
        print(f"Loading checkpoint: {filename}")
        try:
            checkpoint = torch.load(filename, map_location='cpu')
            model.load_state_dict(checkpoint['model_state_dict'])
            optimizer.load_state_dict(checkpoint['optimizer_state_dict'])
            if scheduler and 'scheduler_state_dict' in checkpoint:
                scheduler.load_state_dict(checkpoint['scheduler_state_dict'])
            return checkpoint.get('epoch', 0), checkpoint.get('best_acc', 0.0)
        except Exception as e:
            print(f"Error loading checkpoint: {e}")
            print("Starting fresh instead...")
            return 0, 0.0
    else:
        print("No checkpoint found. Starting fresh...")
        return 0, 0.0


def train_model(data_dir='extracted_dataset', num_epochs=100, batch_size=32, learning_rate=0.001, img_size=224):
    """Train YOLOv8s model - NO WEIGHT BALANCING"""

    print("=" * 80)
    print(" " * 18 + "YOLOv8s EXHIBIT CLASSIFICATION")
    print(" " * 15 + "Natural Distribution - No Weight Balancing")
    print("=" * 80)

    # Check if CUDA is available
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Device: {device}")

    # Simple clean transform - no augmentations
    transform = transforms.Compose([
        transforms.Resize((img_size, img_size)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])

    # Create dataset
    dataset = ExhibitDataset(data_dir, transform=transform)

    # Create data loaders - NO WEIGHTED SAMPLING
    train_loader = DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=True,  # Simple shuffle, no weighted sampling
        num_workers=0,
        pin_memory=False
    )

    # Evaluation loader (same data, sequential for consistency)
    eval_loader = DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=0,
        pin_memory=False
    )

    # Initialize YOLOv8s model
    num_classes = len(dataset.classes)
    model = YOLOv8s(num_classes=num_classes, width_multiple=0.5, depth_multiple=0.67).to(device)

    # Count parameters
    total_params = sum(p.numel() for p in model.parameters())
    print(f"\nYOLOv8s Model parameters: {total_params:,}")

    # Simple CrossEntropy loss - NO CLASS WEIGHTS
    criterion = nn.CrossEntropyLoss()

    # Optimizer - using AdamW with YOLOv8 learning rate
    optimizer = optim.AdamW(model.parameters(), lr=learning_rate, weight_decay=0.0005)

    # Learning rate scheduler - cosine annealing like YOLOv8
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=num_epochs, eta_min=learning_rate*0.01)

    # Try to load checkpoint
    start_epoch, best_acc = load_checkpoint('checkpoint_yolov8s.pth', model, optimizer, scheduler)

    if start_epoch == 0:
        print(f"\nFRESH START - Training YOLOv8s from epoch 1")
    else:
        print(f"\nRESUMING - Training from epoch {start_epoch + 1}")
        print(f"Previous best accuracy: {best_acc:.2f}%")

    print(f"Training samples: {len(dataset)}")
    print(f"Architecture: YOLOv8s with natural class distribution")
    print("No weight balancing - letting model learn natural patterns")
    print("=" * 80)

    # Training loop
    patience = 30
    patience_counter = 0
    min_delta = 0.01

    for epoch in range(start_epoch, num_epochs):
        epoch_start_time = time.time()

        # Training phase
        model.train()
        running_loss = 0.0
        correct = 0
        total = 0
        train_class_correct = [0] * num_classes
        train_class_total = [0] * num_classes

        for batch_idx, (inputs, labels) in enumerate(train_loader):
            inputs, labels = inputs.to(device), labels.to(device)

            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, labels)

            loss.backward()
            # Gradient clipping
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=10.0)
            optimizer.step()

            running_loss += loss.item()

            # Calculate accuracy
            _, predicted = torch.max(outputs.data, 1)
            total += labels.size(0)
            correct += (predicted == labels).sum().item()

            # Per-class accuracy
            for i in range(labels.size(0)):
                label = labels[i]
                train_class_correct[label] += (predicted[i] == label).item()
                train_class_total[label] += 1

        train_loss = running_loss / len(train_loader)
        train_acc = 100 * correct / total

        # Evaluation phase
        model.eval()
        eval_correct = 0
        eval_total = 0
        eval_class_correct = [0] * num_classes
        eval_class_total = [0] * num_classes
        confusion_matrix = torch.zeros(num_classes, num_classes)

        with torch.no_grad():
            for inputs, labels in eval_loader:
                inputs, labels = inputs.to(device), labels.to(device)
                outputs = model(inputs)

                _, predicted = torch.max(outputs, 1)
                eval_total += labels.size(0)
                eval_correct += (predicted == labels).sum().item()

                # Per-class accuracy
                for i in range(labels.size(0)):
                    label = labels[i]
                    eval_class_correct[label] += (predicted[i] == label).item()
                    eval_class_total[label] += 1
                    confusion_matrix[label, predicted[i]] += 1

        eval_acc = 100 * eval_correct / eval_total

        # Print results
        print(f"Epoch [{epoch+1}/{num_epochs}]")
        print(f"  Training:   Loss: {train_loss:.4f}, Acc: {train_acc:.2f}%")
        print(f"  Evaluation: Acc: {eval_acc:.2f}%")

        # Per-class evaluation accuracies
        print("  Per-class Evaluation:")
        eval_class_accs = []
        for idx, class_name in enumerate(dataset.classes):
            if eval_class_total[idx] > 0:
                class_acc = 100 * eval_class_correct[idx] / eval_class_total[idx]
                eval_class_accs.append(class_acc)
                status = "✓" if class_acc > 90 else "⚠" if class_acc > 80 else "✗"
                print(f"    {class_name}: {class_acc:.2f}% {status}")

        # Calculate class balance in performance
        if len(eval_class_accs) > 0:
            min_class_acc = min(eval_class_accs)
            max_class_acc = max(eval_class_accs)
            class_balance = min_class_acc / max_class_acc if max_class_acc > 0 else 0
            print(f"  Class performance balance: {class_balance:.2f}")

        # Save best model based on evaluation accuracy
        if eval_acc > best_acc + min_delta:
            best_acc = eval_acc
            torch.save({
                'model_state_dict': model.state_dict(),
                'eval_accuracy': best_acc,
                'train_accuracy': train_acc,
                'confusion_matrix': confusion_matrix,
                'epoch': epoch + 1,
                'classes': dataset.classes,
                'eval_class_accuracies': {
                    dataset.classes[i]: 100 * eval_class_correct[i] / eval_class_total[i]
                    if eval_class_total[i] > 0 else 0
                    for i in range(num_classes)
                },
                'class_balance': class_balance if len(eval_class_accs) > 0 else 0,
                'architecture': 'YOLOv8s',
                'no_weight_balancing': True
            }, 'best_yolov8s_exhibit.pth')
            print(f"  ✓ New best YOLOv8s model saved! Accuracy: {best_acc:.2f}%")
            patience_counter = 0
        else:
            patience_counter += 1

        # Early stopping
        if patience_counter >= patience:
            print(f"\nEarly stopping triggered after {epoch+1} epochs")
            break

        # Save checkpoint every 10 epochs
        if (epoch + 1) % 10 == 0:
            checkpoint = {
                'epoch': epoch + 1,
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'scheduler_state_dict': scheduler.state_dict(),
                'best_acc': best_acc
            }
            save_checkpoint(checkpoint, 'checkpoint_yolov8s.pth')

        # Update learning rate
        scheduler.step()
        current_lr = optimizer.param_groups[0]['lr']

        # Print timing
        epoch_time = time.time() - epoch_start_time
        print(f"  LR: {current_lr:.8f}, Time: {epoch_time:.1f}s")
        print("-" * 60)

    print("\n" + "=" * 80)
    print(" " * 20 + "YOLOv8s TRAINING COMPLETE!")
    print("=" * 80)
    print(f"Best Accuracy: {best_acc:.2f}%")

    # Save model info
    model_info = {
        'classes': dataset.classes,
        'num_classes': num_classes,
        'img_size': img_size,
        'best_accuracy': best_acc,
        'total_epochs': epoch + 1,
        'model_architecture': 'YOLOv8s',
        'width_multiple': 0.5,
        'depth_multiple': 0.67,
        'total_parameters': total_params,
        'dataset_info': {
            'total_images': len(dataset),
            'all_images_used': True,
            'weighted_sampling': False,
            'class_balancing': False,
            'natural_distribution': True
        },
        'training_config': {
            'batch_size': batch_size,
            'learning_rate': learning_rate,
            'optimizer': 'AdamW',
            'scheduler': 'CosineAnnealingLR',
            'loss': 'CrossEntropyLoss',
            'no_augmentation': True,
            'no_weight_balancing': True
        }
    }

    with open("yolov8s_exhibit_model_info.json", "w") as f:
        json.dump(model_info, f, indent=2)

    print(f"Model info saved: yolov8s_exhibit_model_info.json")
    print(f"Best model saved: best_yolov8s_exhibit.pth")
    print("YOLOv8s model trained with natural class distribution!")

    return model, best_acc


if __name__ == "__main__":
    print("YOLOv8s EXHIBIT CLASSIFICATION TRAINING")
    print("Larger model with natural class distribution")
    print("No weight balancing - pure natural learning")
    print()

    # Train the model
    trained_model, final_accuracy = train_model(
        data_dir='extracted_dataset',
        num_epochs=100,
        batch_size=32,
        learning_rate=0.001,
        img_size=224
    )

    print(f"\nFinal YOLOv8s accuracy: {final_accuracy:.2f}%")