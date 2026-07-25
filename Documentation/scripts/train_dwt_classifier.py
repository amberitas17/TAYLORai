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
import json
from yolo_tiny_model import YOLOv5Tiny

class DWTExhibitDataset(Dataset):
    """Dataset for DWT exhibit classification"""

    def __init__(self, data_dir, transform=None):
        self.data_dir = data_dir
        self.transform = transform

        # Get DWT exhibit classes
        dwt_dir = os.path.join(data_dir, "DWT")
        self.classes = sorted([d for d in os.listdir(dwt_dir)
                             if os.path.isdir(os.path.join(dwt_dir, d))])

        self.class_to_idx = {cls: idx for idx, cls in enumerate(self.classes)}
        self.num_classes = len(self.classes)

        # Load all image paths and labels
        self.image_paths = []
        self.labels = []

        for class_name in self.classes:
            class_dir = os.path.join(dwt_dir, class_name)
            if os.path.isdir(class_dir):
                # Get all image files
                extensions = ['*.jpg', '*.jpeg', '*.png']
                for ext in extensions:
                    paths = glob.glob(os.path.join(class_dir, ext))
                    self.image_paths.extend(paths)
                    self.labels.extend([self.class_to_idx[class_name]] * len(paths))

        print(f"DWT Dataset loaded: {len(self.image_paths)} images")
        print(f"Number of DWT exhibit types: {self.num_classes}")
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
        transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.3, hue=0.1),
        transforms.RandomPerspective(distortion_scale=0.2, p=0.3),
        transforms.ToTensor(),
        transforms.RandomErasing(p=0.2, scale=(0.02, 0.15)),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])

    val_transform = transforms.Compose([
        transforms.Resize((img_size, img_size)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])

    return train_transform, val_transform

def train_dwt_classifier(data_dir='hierarchical_dataset', num_epochs=60, batch_size=16,
                        learning_rate=0.001, img_size=224, use_pretrained=True):
    """Train DWT-specific exhibit classifier"""

    print("=== DWT Exhibit Classifier Training ===")
    print(f"Data directory: {data_dir}")
    print(f"Image size: {img_size}x{img_size}")
    print(f"Batch size: {batch_size}")
    print(f"Learning rate: {learning_rate}")
    print(f"Epochs: {num_epochs}")
    print(f"Use pretrained weights: {use_pretrained}")

    # Check CUDA
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    if torch.cuda.is_available():
        print(f"GPU: {torch.cuda.get_device_name()}")

    # Create transforms
    train_transform, val_transform = create_data_transforms(img_size)

    # Load dataset
    train_dataset = DWTExhibitDataset(data_dir, transform=train_transform)
    val_dataset = DWTExhibitDataset(data_dir, transform=val_transform)

    # Create data loaders
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=0)

    print(f"Training samples: {len(train_dataset)}")
    print(f"Validation samples: {len(val_dataset)}")

    # Create model
    model = YOLOv5Tiny(num_classes=train_dataset.num_classes, width_multiple=0.25, depth_multiple=0.33).to(device)

    # Load pretrained weights from main model if available
    if use_pretrained:
        try:
            main_model_path = "../best_yolo_tiny_exhibit.pth"
            if os.path.exists(main_model_path):
                print("Loading pretrained weights from main DWT/EAP model...")

                # Create temporary model with 2 classes to load weights
                temp_model = YOLOv5Tiny(num_classes=2, width_multiple=0.25, depth_multiple=0.33)
                temp_model.load_state_dict(torch.load(main_model_path, map_location='cpu'))

                # Transfer backbone weights
                model_dict = model.state_dict()
                pretrained_dict = temp_model.state_dict()

                # Filter out classifier weights (keep only backbone)
                pretrained_dict = {k: v for k, v in pretrained_dict.items()
                                 if k in model_dict and 'classifier' not in k}

                model_dict.update(pretrained_dict)
                model.load_state_dict(model_dict)
                print(f"Success: Loaded {len(pretrained_dict)} pretrained layers")
            else:
                print("Warning: Main model not found, training from scratch")
        except Exception as e:
            print(f"Warning: Could not load pretrained weights: {e}")

    # Count parameters
    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"Model parameters: {total_params:,} total, {trainable_params:,} trainable")

    # Loss and optimizer - calculate class weights for balance
    class_counts = [train_dataset.labels.count(i) for i in range(train_dataset.num_classes)]
    total_samples = len(train_dataset.labels)
    class_weights = torch.tensor([total_samples / (len(class_counts) * count) for count in class_counts]).to(device)

    print("Class weights:", [f"{train_dataset.classes[i]}: {class_weights[i]:.2f}" for i in range(len(class_weights))])

    criterion = nn.CrossEntropyLoss(weight=class_weights, label_smoothing=0.1)
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

    print("\nStarting DWT classifier training...")
    print("=" * 80)

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
            torch.save(model.state_dict(), 'best_dwt_classifier.pth')

        # Print progress
        epoch_time = time.time() - start_time
        current_lr = scheduler.get_last_lr()[0]

        print(f"Epoch [{epoch+1:2d}/{num_epochs}] "
              f"Train: {train_loss_avg:.4f}/{train_acc:.1f}% "
              f"Val: {val_loss_avg:.4f}/{val_acc:.1f}% "
              f"LR: {current_lr:.6f} "
              f"Time: {epoch_time:.1f}s")

        # Early stopping check
        if epoch > 15 and val_acc < best_val_acc - 15:
            print("Early stopping triggered - validation accuracy not improving")
            break

    # Save final model
    torch.save(model.state_dict(), 'final_dwt_classifier.pth')

    # Save model info
    model_info = {
        'classes': train_dataset.classes,
        'class_to_idx': train_dataset.class_to_idx,
        'num_classes': train_dataset.num_classes,
        'img_size': img_size,
        'best_val_acc': best_val_acc,
        'model_type': 'DWT_classifier'
    }
    torch.save(model_info, 'dwt_classifier_info.pth')

    # Save as JSON for easy reading
    with open('dwt_classifier_info.json', 'w') as f:
        json.dump(model_info, f, indent=2)

    # Plot training history
    plt.figure(figsize=(12, 4))

    plt.subplot(1, 2, 1)
    plt.plot(train_losses, label='Train Loss')
    plt.plot(val_losses, label='Val Loss')
    plt.title('DWT Classifier Training and Validation Loss')
    plt.xlabel('Epoch')
    plt.ylabel('Loss')
    plt.legend()
    plt.grid(True)

    plt.subplot(1, 2, 2)
    plt.plot(train_accs, label='Train Acc')
    plt.plot(val_accs, label='Val Acc')
    plt.title('DWT Classifier Training and Validation Accuracy')
    plt.xlabel('Epoch')
    plt.ylabel('Accuracy (%)')
    plt.legend()
    plt.grid(True)

    plt.tight_layout()
    plt.savefig('dwt_classifier_training_history.png', dpi=150, bbox_inches='tight')
    plt.show()

    print(f"\nDWT Classifier training completed!")
    print(f"Best validation accuracy: {best_val_acc:.2f}%")
    print(f"Models saved: best_dwt_classifier.pth, final_dwt_classifier.pth")
    print(f"Model info saved: dwt_classifier_info.pth, dwt_classifier_info.json")

    return model, model_info

if __name__ == "__main__":
    train_dwt_classifier(
        data_dir='hierarchical_dataset',
        num_epochs=60,
        batch_size=16,
        learning_rate=0.001,
        img_size=224,
        use_pretrained=True
    )