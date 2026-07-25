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
import matplotlib.pyplot as plt

class YOLOv5Tiny(nn.Module):
    """Ultra-lightweight YOLOv5-tiny inspired model for exhibit classification"""

    def __init__(self, num_classes=2, width_multiple=0.3, depth_multiple=0.33):
        super(YOLOv5Tiny, self).__init__()

        # Calculate channel sizes
        self.c1 = max(16, int(64 * width_multiple))
        self.c2 = max(32, int(128 * width_multiple))
        self.c3 = max(64, int(256 * width_multiple))
        self.c4 = max(128, int(512 * width_multiple))

        # Backbone - Ultra-compact feature extractor
        self.backbone = nn.Sequential(
            # Focus layer - reduce spatial, increase channels
            nn.Conv2d(3, self.c1, 6, 2, 2, bias=False),
            nn.BatchNorm2d(self.c1),
            nn.SiLU(inplace=True),

            # C3 block 1
            self._make_c3_block(self.c1, self.c2, max(1, int(3 * depth_multiple))),
            nn.Conv2d(self.c2, self.c2, 3, 2, 1, bias=False),  # Downsample
            nn.BatchNorm2d(self.c2),
            nn.SiLU(inplace=True),

            # C3 block 2
            self._make_c3_block(self.c2, self.c3, max(1, int(6 * depth_multiple))),
            nn.Conv2d(self.c3, self.c3, 3, 2, 1, bias=False),  # Downsample
            nn.BatchNorm2d(self.c3),
            nn.SiLU(inplace=True),

            # C3 block 3
            self._make_c3_block(self.c3, self.c4, max(1, int(9 * depth_multiple))),
            nn.Conv2d(self.c4, self.c4, 3, 2, 1, bias=False),  # Downsample
            nn.BatchNorm2d(self.c4),
            nn.SiLU(inplace=True),

            # Final feature extraction
            nn.AdaptiveAvgPool2d((4, 4))
        )

        # Classification head
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Dropout(0.2),
            nn.Linear(self.c4 * 16, max(64, self.c4 // 2)),
            nn.SiLU(inplace=True),
            nn.Dropout(0.1),
            nn.Linear(max(64, self.c4 // 2), num_classes)
        )

        # Initialize weights
        self._initialize_weights()

    def _make_c3_block(self, in_channels, out_channels, n_blocks):
        """Create C3 block (CSP Bottleneck with 3 convolutions)"""
        layers = []

        # Initial conv
        layers.extend([
            nn.Conv2d(in_channels, out_channels // 2, 1, 1, 0, bias=False),
            nn.BatchNorm2d(out_channels // 2),
            nn.SiLU(inplace=True)
        ])

        # Bottleneck blocks
        for _ in range(n_blocks):
            layers.extend([
                nn.Conv2d(out_channels // 2, out_channels // 4, 1, 1, 0, bias=False),
                nn.BatchNorm2d(out_channels // 4),
                nn.SiLU(inplace=True),
                nn.Conv2d(out_channels // 4, out_channels // 2, 3, 1, 1, bias=False),
                nn.BatchNorm2d(out_channels // 2),
                nn.SiLU(inplace=True)
            ])

        # Final conv to output channels
        layers.extend([
            nn.Conv2d(out_channels // 2, out_channels, 1, 1, 0, bias=False),
            nn.BatchNorm2d(out_channels),
            nn.SiLU(inplace=True)
        ])

        return nn.Sequential(*layers)

    def _initialize_weights(self):
        """Initialize model weights"""
        for m in self.modules():
            if isinstance(m, nn.Conv2d):
                nn.init.kaiming_normal_(m.weight, mode='fan_out', nonlinearity='relu')
                if m.bias is not None:
                    nn.init.constant_(m.bias, 0)
            elif isinstance(m, nn.BatchNorm2d):
                nn.init.constant_(m.weight, 1)
                nn.init.constant_(m.bias, 0)
            elif isinstance(m, nn.Linear):
                nn.init.normal_(m.weight, 0, 0.01)
                if m.bias is not None:
                    nn.init.constant_(m.bias, 0)

    def forward(self, x):
        features = self.backbone(x)
        output = self.classifier(features)
        return output

class ExhibitDataset(Dataset):
    """Dataset for exhibit classification"""

    def __init__(self, data_dir, transform=None, class_names=None):
        self.data_dir = data_dir
        self.transform = transform

        # Auto-detect classes if not provided
        if class_names is None:
            self.classes = sorted([d for d in os.listdir(data_dir)
                                 if os.path.isdir(os.path.join(data_dir, d))])
        else:
            self.classes = class_names

        self.class_to_idx = {cls: idx for idx, cls in enumerate(self.classes)}
        self.num_classes = len(self.classes)

        # Load all image paths and labels
        self.image_paths = []
        self.labels = []

        for class_name in self.classes:
            class_dir = os.path.join(data_dir, class_name)
            if os.path.isdir(class_dir):
                # Get all image files
                extensions = ['*.jpg', '*.jpeg', '*.png']
                for ext in extensions:
                    paths = glob.glob(os.path.join(class_dir, ext))
                    self.image_paths.extend(paths)
                    self.labels.extend([self.class_to_idx[class_name]] * len(paths))

        print(f"Dataset loaded: {len(self.image_paths)} images")
        for i, class_name in enumerate(self.classes):
            count = self.labels.count(i)
            print(f"  {class_name}: {count} images")

    def __len__(self):
        return len(self.image_paths)

    def __getitem__(self, idx):
        image_path = self.image_paths[idx]
        label = self.labels[idx]

        # Load image
        try:
            image = Image.open(image_path).convert('RGB')
        except Exception as e:
            print(f"Error loading {image_path}: {e}")
            # Return a black image as fallback
            image = Image.new('RGB', (224, 224), (0, 0, 0))

        if self.transform:
            image = self.transform(image)

        return image, label

def create_data_transforms(img_size=224):
    """Create training and validation transforms"""

    train_transform = transforms.Compose([
        transforms.Resize((int(img_size * 1.1), int(img_size * 1.1))),
        transforms.RandomCrop(img_size),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomRotation(degrees=15),
        transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.1),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])

    val_transform = transforms.Compose([
        transforms.Resize((img_size, img_size)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])

    return train_transform, val_transform

def train_model(data_dir='extracted_dataset', num_epochs=50, batch_size=32, learning_rate=0.001, img_size=224):
    """Train YOLOv5-tiny model"""

    print("=== YOLOv5-Tiny Exhibit Classifier Training ===")
    print(f"Data directory: {data_dir}")
    print(f"Image size: {img_size}x{img_size}")
    print(f"Batch size: {batch_size}")
    print(f"Learning rate: {learning_rate}")
    print(f"Epochs: {num_epochs}")

    # Check CUDA
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    if torch.cuda.is_available():
        print(f"GPU: {torch.cuda.get_device_name()}")

    # Create transforms
    train_transform, val_transform = create_data_transforms(img_size)

    # Load dataset
    dataset = ExhibitDataset(data_dir, transform=train_transform)

    # Use ALL data for training (exhibits are static)
    train_dataset = ExhibitDataset(data_dir, transform=train_transform)
    val_dataset = ExhibitDataset(data_dir, transform=val_transform)  # Same data for validation

    # Create data loaders
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=0)

    print(f"Training samples: {len(train_dataset)} (using ALL data)")
    print(f"Validation samples: {len(val_dataset)} (same as training - exhibits are static)")

    # Create model
    model = YOLOv5Tiny(num_classes=dataset.num_classes, width_multiple=0.25, depth_multiple=0.33).to(device)

    # Count parameters
    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"Model parameters: {total_params:,} total, {trainable_params:,} trainable")

    # Loss and optimizer
    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
    optimizer = optim.AdamW(model.parameters(), lr=learning_rate, weight_decay=0.01)

    # Learning rate scheduler
    scheduler = optim.lr_scheduler.OneCycleLR(
        optimizer,
        max_lr=learning_rate,
        epochs=num_epochs,
        steps_per_epoch=len(train_loader),
        pct_start=0.3
    )

    # Training history
    train_losses = []
    train_accs = []
    val_losses = []
    val_accs = []
    best_val_acc = 0.0

    print("\nStarting training...")
    print("=" * 60)

    for epoch in range(num_epochs):
        start_time = time.time()

        # Training phase
        model.train()
        train_loss = 0.0
        train_correct = 0
        train_total = 0

        for batch_idx, (inputs, labels) in enumerate(train_loader):
            inputs, labels = inputs.to(device), labels.to(device)

            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, labels)
            loss.backward()

            # Gradient clipping
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)

            optimizer.step()
            scheduler.step()

            train_loss += loss.item()
            _, predicted = torch.max(outputs.data, 1)
            train_total += labels.size(0)
            train_correct += (predicted == labels).sum().item()

        # Validation phase
        model.eval()
        val_loss = 0.0
        val_correct = 0
        val_total = 0

        with torch.no_grad():
            for inputs, labels in val_loader:
                inputs, labels = inputs.to(device), labels.to(device)
                outputs = model(inputs)
                loss = criterion(outputs, labels)

                val_loss += loss.item()
                _, predicted = torch.max(outputs.data, 1)
                val_total += labels.size(0)
                val_correct += (predicted == labels).sum().item()

        # Calculate metrics
        train_loss_avg = train_loss / len(train_loader)
        train_acc = 100 * train_correct / train_total
        val_loss_avg = val_loss / len(val_loader)
        val_acc = 100 * val_correct / val_total

        # Store history
        train_losses.append(train_loss_avg)
        train_accs.append(train_acc)
        val_losses.append(val_loss_avg)
        val_accs.append(val_acc)

        # Save best model
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save(model.state_dict(), 'best_yolo_tiny_exhibit.pth')

        # Print progress
        epoch_time = time.time() - start_time
        current_lr = scheduler.get_last_lr()[0]

        print(f"Epoch [{epoch+1:2d}/{num_epochs}] "
              f"Train: {train_loss_avg:.4f}/{train_acc:.1f}% "
              f"Val: {val_loss_avg:.4f}/{val_acc:.1f}% "
              f"LR: {current_lr:.6f} "
              f"Time: {epoch_time:.1f}s")

        # Early stopping check
        if epoch > 10 and val_acc < best_val_acc - 10:
            print("Early stopping triggered - validation accuracy not improving")
            break

    # Save final model
    torch.save(model.state_dict(), 'final_yolo_tiny_exhibit.pth')

    # Save model info
    model_info = {
        'classes': dataset.classes,
        'class_to_idx': dataset.class_to_idx,
        'num_classes': dataset.num_classes,
        'img_size': img_size,
        'best_val_acc': best_val_acc
    }
    torch.save(model_info, 'yolo_tiny_exhibit_info.pth')

    # Plot training history
    plt.figure(figsize=(12, 4))

    plt.subplot(1, 2, 1)
    plt.plot(train_losses, label='Train Loss')
    plt.plot(val_losses, label='Val Loss')
    plt.title('Training and Validation Loss')
    plt.xlabel('Epoch')
    plt.ylabel('Loss')
    plt.legend()
    plt.grid(True)

    plt.subplot(1, 2, 2)
    plt.plot(train_accs, label='Train Acc')
    plt.plot(val_accs, label='Val Acc')
    plt.title('Training and Validation Accuracy')
    plt.xlabel('Epoch')
    plt.ylabel('Accuracy (%)')
    plt.legend()
    plt.grid(True)

    plt.tight_layout()
    plt.savefig('yolo_tiny_training_history.png', dpi=150, bbox_inches='tight')
    plt.show()

    print(f"\nTraining completed!")
    print(f"Best validation accuracy: {best_val_acc:.2f}%")
    print(f"Models saved: best_yolo_tiny_exhibit.pth, final_yolo_tiny_exhibit.pth")
    print(f"Model info saved: yolo_tiny_exhibit_info.pth")

if __name__ == "__main__":
    train_model(
        data_dir='extracted_dataset',
        num_epochs=50,
        batch_size=16,  # Reduced for better performance on limited data
        learning_rate=0.001,
        img_size=224
    )