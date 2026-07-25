import cv2
import os
import glob
from PIL import Image
import numpy as np
from pathlib import Path
import hashlib
import time
import json

class ComprehensiveExtractor:
    def __init__(self):
        self.extracted_hashes = set()  # Track duplicates
        self.extraction_log = []
        self.start_time = time.time()

    def calculate_image_hash(self, image_array):
        """Calculate hash of image to detect duplicates"""
        # Convert to grayscale for hash calculation
        if len(image_array.shape) == 3:
            gray = cv2.cvtColor(image_array, cv2.COLOR_BGR2GRAY)
        else:
            gray = image_array

        # Resize to standard size for consistent hashing
        small = cv2.resize(gray, (64, 64))

        # Calculate hash
        image_hash = hashlib.md5(small.tobytes()).hexdigest()
        return image_hash

    def is_duplicate(self, image_array):
        """Check if image is duplicate"""
        image_hash = self.calculate_image_hash(image_array)

        if image_hash in self.extracted_hashes:
            return True

        self.extracted_hashes.add(image_hash)
        return False

    def log_progress(self, message):
        """Log progress with timestamp"""
        elapsed = time.time() - self.start_time
        log_entry = f"[{elapsed/60:.1f}m] {message}"
        print(log_entry)
        self.extraction_log.append(log_entry)

    def extract_frames_from_video(self, video_path, output_dir, prefix, fps=1):
        """Extract frames with duplicate detection"""
        self.log_progress(f"Processing video: {os.path.basename(video_path)}")

        frames_extracted = 0
        frames_skipped = 0

        try:
            cap = cv2.VideoCapture(video_path)
            if not cap.isOpened():
                self.log_progress(f"  ERROR: Cannot open {video_path}")
                return 0, 0

            # Get video properties
            original_fps = cap.get(cv2.CAP_PROP_FPS)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            duration = total_frames / original_fps if original_fps > 0 else 0

            self.log_progress(f"  Duration: {duration:.1f}s, FPS: {original_fps:.1f}")

            # Calculate frame interval
            if original_fps <= 0:
                frame_interval = 30  # Default
            else:
                frame_interval = max(1, int(original_fps / fps))

            frame_count = 0
            processed_count = 0

            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                # Extract frame at specified intervals
                if frame_count % frame_interval == 0:
                    # Resize to 224x224 first
                    frame_resized = cv2.resize(frame, (224, 224))

                    # Check for duplicates
                    if not self.is_duplicate(frame_resized):
                        # Save frame
                        frame_filename = f"{prefix}_{processed_count:05d}.jpg"
                        frame_path = os.path.join(output_dir, frame_filename)

                        # Save with high quality
                        cv2.imwrite(frame_path, frame_resized, [cv2.IMWRITE_JPEG_QUALITY, 95])
                        frames_extracted += 1
                    else:
                        frames_skipped += 1

                    processed_count += 1

                frame_count += 1

                # Progress update every 1000 frames
                if frame_count % 1000 == 0:
                    elapsed = time.time() - self.start_time
                    self.log_progress(f"    Processed {frame_count}/{total_frames} frames ({elapsed/60:.1f}m)")

            cap.release()
            self.log_progress(f"  Extracted: {frames_extracted}, Skipped duplicates: {frames_skipped}")

        except Exception as e:
            self.log_progress(f"  ERROR processing {video_path}: {e}")

        return frames_extracted, frames_skipped

    def resize_existing_images(self, source_dir, output_dir, prefix):
        """Resize existing images with duplicate detection"""
        self.log_progress(f"Processing existing images in {source_dir}")

        image_extensions = ['*.jpg', '*.jpeg', '*.png', '*.bmp', '*.tiff']
        image_files = []

        for ext in image_extensions:
            image_files.extend(glob.glob(os.path.join(source_dir, "**", ext), recursive=True))

        self.log_progress(f"  Found {len(image_files)} image files")

        resized_count = 0
        skipped_count = 0

        for i, image_path in enumerate(image_files):
            try:
                # Load and resize image
                image = Image.open(image_path).convert('RGB')
                image_resized = image.resize((224, 224), Image.Resampling.LANCZOS)

                # Convert to array for duplicate checking
                image_array = np.array(image_resized)
                image_bgr = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)

                # Check for duplicates
                if not self.is_duplicate(image_bgr):
                    # Save image
                    output_filename = f"{prefix}_img_{i:05d}.jpg"
                    output_path = os.path.join(output_dir, output_filename)
                    image_resized.save(output_path, 'JPEG', quality=95)
                    resized_count += 1
                else:
                    skipped_count += 1

                # Progress update
                if (i + 1) % 50 == 0:
                    self.log_progress(f"    Processed {i+1}/{len(image_files)} images")

            except Exception as e:
                self.log_progress(f"    ERROR with {image_path}: {e}")

        self.log_progress(f"  Images processed: {resized_count}, Skipped duplicates: {skipped_count}")
        return resized_count, skipped_count

    def extract_class_data(self, source_dir, output_dir, class_name, target_fps=1):
        """Comprehensive extraction for a class"""
        self.log_progress(f"\n{'='*70}")
        self.log_progress(f"EXTRACTING {class_name} DATA")
        self.log_progress(f"Source: {source_dir}")
        self.log_progress(f"Output: {output_dir}")
        self.log_progress(f"Target FPS: {target_fps}")
        self.log_progress('='*70)

        # Create output directory
        os.makedirs(output_dir, exist_ok=True)

        # Clear existing data
        existing_files = glob.glob(os.path.join(output_dir, "*"))
        if existing_files:
            self.log_progress(f"Clearing {len(existing_files)} existing files...")
            for file in existing_files:
                try:
                    os.remove(file)
                except:
                    pass

        total_extracted = 0
        total_skipped = 0

        # Phase 1: Find and process video files
        video_extensions = ['*.mp4', '*.avi', '*.mov', '*.mkv', '*.wmv']
        video_files = []

        for ext in video_extensions:
            video_files.extend(glob.glob(os.path.join(source_dir, "**", ext), recursive=True))

        self.log_progress(f"\nPhase 1: Processing {len(video_files)} video files")

        for i, video_path in enumerate(video_files):
            video_name = Path(video_path).stem
            # Clean filename for prefix
            clean_name = "".join(c for c in video_name if c.isalnum() or c in '_-')[:20]
            prefix = f"{class_name}_{i+1:03d}_{clean_name}"

            extracted, skipped = self.extract_frames_from_video(
                video_path, output_dir, prefix, fps=target_fps
            )
            total_extracted += extracted
            total_skipped += skipped

        # Phase 2: Process existing images
        self.log_progress(f"\nPhase 2: Processing existing images")

        img_extracted, img_skipped = self.resize_existing_images(
            source_dir, output_dir, f"{class_name}_static"
        )
        total_extracted += img_extracted
        total_skipped += img_skipped

        # Final count verification
        final_files = [f for f in os.listdir(output_dir)
                      if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
        actual_count = len(final_files)

        self.log_progress(f"\n{class_name} EXTRACTION SUMMARY:")
        self.log_progress(f"  Total extracted: {total_extracted}")
        self.log_progress(f"  Duplicates skipped: {total_skipped}")
        self.log_progress(f"  Files in directory: {actual_count}")
        self.log_progress(f"  Unique hashes tracked: {len(self.extracted_hashes)}")

        return actual_count

def main():
    print("=" * 80)
    print(" " * 20 + "COMPREHENSIVE DATASET EXTRACTION")
    print(" " * 15 + "High Quality, No Duplicates, Balanced Dataset")
    print("=" * 80)

    extractor = ComprehensiveExtractor()

    # Source directories
    dwt_source = "DWT Dialogue with Time-20250923T142728Z-1-001/DWT Dialogue with Time"
    eap_source = "EAP Earth Alive Planet-20250923T142727Z-1-001/EAP Earth Alive Planet"

    # Output directories
    dwt_output = "extracted_dataset/DWT"
    eap_output = "extracted_dataset/EAP"
    egn_output = "extracted_dataset/EGN"

    # Check source directories
    if not os.path.exists(dwt_source):
        extractor.log_progress(f"ERROR: DWT source not found: {dwt_source}")
        return

    if not os.path.exists(eap_source):
        extractor.log_progress(f"ERROR: EAP source not found: {eap_source}")
        return

    extractor.log_progress("Starting comprehensive extraction...")
    extractor.log_progress(f"DWT Source: {dwt_source}")
    extractor.log_progress(f"EAP Source: {eap_source}")

    # Extract DWT data (1 FPS to get good coverage)
    extractor.log_progress("\n" + "="*80)
    extractor.log_progress("STARTING DWT EXTRACTION")
    extractor.log_progress("="*80)

    dwt_count = extractor.extract_class_data(dwt_source, dwt_output, "DWT", target_fps=1)

    # Clear hash set between classes to allow similar images across classes
    extractor.extracted_hashes.clear()
    extractor.log_progress("Cleared duplicate hash set for next class")

    # Extract EAP data
    extractor.log_progress("\n" + "="*80)
    extractor.log_progress("STARTING EAP EXTRACTION")
    extractor.log_progress("="*80)

    eap_count = extractor.extract_class_data(eap_source, eap_output, "EAP", target_fps=1)

    # Check EGN count (existing)
    egn_files = [f for f in os.listdir(egn_output)
                if f.lower().endswith(('.jpg', '.jpeg', '.png'))] if os.path.exists(egn_output) else []
    egn_count = len(egn_files)

    # Final comprehensive summary
    total_time = time.time() - extractor.start_time

    extractor.log_progress("\n" + "=" * 80)
    extractor.log_progress(" " * 25 + "EXTRACTION COMPLETED")
    extractor.log_progress("=" * 80)
    extractor.log_progress(f"Total extraction time: {total_time/60:.1f} minutes")
    extractor.log_progress("")
    extractor.log_progress("FINAL DATASET COMPOSITION:")
    extractor.log_progress("-" * 50)
    extractor.log_progress(f"DWT: {dwt_count:,} images")
    extractor.log_progress(f"EAP: {eap_count:,} images")
    extractor.log_progress(f"EGN: {egn_count:,} images (existing)")
    extractor.log_progress("-" * 50)

    total_images = dwt_count + eap_count + egn_count
    extractor.log_progress(f"TOTAL: {total_images:,} images")

    # Balance analysis
    min_count = min(dwt_count, eap_count, egn_count)
    max_count = max(dwt_count, eap_count, egn_count)
    balance_ratio = min_count / max_count if max_count > 0 else 0

    extractor.log_progress(f"\nDataset Balance Analysis:")
    extractor.log_progress(f"  Minimum class size: {min_count:,}")
    extractor.log_progress(f"  Maximum class size: {max_count:,}")
    extractor.log_progress(f"  Balance ratio: {balance_ratio:.2f}")

    if balance_ratio >= 0.7:
        extractor.log_progress("  ✓ Dataset is well balanced!")
    elif balance_ratio >= 0.5:
        extractor.log_progress("  ⚠ Dataset is moderately balanced")
    else:
        extractor.log_progress("  ⚠ Dataset imbalance detected")

    # Save extraction report
    report = {
        'extraction_completed': time.strftime('%Y-%m-%d %H:%M:%S'),
        'total_time_minutes': total_time / 60,
        'dataset_counts': {
            'DWT': dwt_count,
            'EAP': eap_count,
            'EGN': egn_count,
            'total': total_images
        },
        'balance_metrics': {
            'min_count': min_count,
            'max_count': max_count,
            'balance_ratio': balance_ratio
        },
        'extraction_settings': {
            'fps': 1,
            'image_size': '224x224',
            'duplicate_detection': True,
            'quality': 95
        },
        'sources': {
            'dwt_source': dwt_source,
            'eap_source': eap_source
        },
        'extraction_log': extractor.extraction_log
    }

    with open('comprehensive_extraction_report.json', 'w') as f:
        json.dump(report, f, indent=2)

    extractor.log_progress(f"\nExtraction report saved: comprehensive_extraction_report.json")
    extractor.log_progress("Dataset ready for training!")

    return dwt_count, eap_count, egn_count

if __name__ == "__main__":
    try:
        dwt_count, eap_count, egn_count = main()
        print(f"\nSUCCESS! Final counts: DWT={dwt_count}, EAP={eap_count}, EGN={egn_count}")
    except KeyboardInterrupt:
        print("\nExtraction interrupted by user")
    except Exception as e:
        print(f"\nExtraction failed: {e}")
        import traceback
        traceback.print_exc()