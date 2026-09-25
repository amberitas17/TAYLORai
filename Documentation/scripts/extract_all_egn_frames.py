import cv2
import os
import glob
from pathlib import Path

def extract_all_egn_frames():
    """
    Extract ALL frames from ALL ARICC videos in subdirectories
    This will give you the full dataset to manually clean up
    """

    print("=" * 80)
    print("EXTRACTING ALL ARICC FRAMES - COMPLETE DATASET")
    print("You will manually delete bad frames after extraction")
    print("=" * 80)

    video_base_dir = "../datasets/ARICC"
    output_dir = video_base_dir  # Extract directly to EGN folder

    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)

    # Find all video files in EGN subdirectories
    video_extensions = ['*.MOV', '*.mov', '*.mp4', '*.avi', '*.MP4']
    video_files = []

    print(f"Searching for videos in: {video_base_dir}")

    for ext in video_extensions:
        pattern = os.path.join(video_base_dir, f"**/{ext}")
        found_files = glob.glob(pattern, recursive=True)
        video_files.extend(found_files)
        print(f"  Found {len(found_files)} {ext} files")

    if not video_files:
        print("ERROR: No video files found!")
        return False

    print(f"\nTotal videos found: {len(video_files)}")
    print("\nProcessing videos...")

    total_frames_extracted = 0
    successful_videos = 0
    failed_videos = 0

    for i, video_path in enumerate(video_files, 1):
        video_name = Path(video_path).stem
        folder_name = Path(video_path).parent.name

        print(f"\n[{i}/{len(video_files)}] Processing: {folder_name}/{video_name}")

        try:
            # Open video
            cap = cv2.VideoCapture(video_path)
            if not cap.isOpened():
                print(f"  ERROR: Could not open video")
                failed_videos += 1
                continue

            # Get video properties
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps = int(cap.get(cv2.CAP_PROP_FPS))
            duration = total_frames / fps if fps > 0 else 0

            print(f"  Video info: {total_frames} frames, {fps} FPS, {duration:.1f}s")

            frame_count = 0
            extracted_count = 0

            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                # Extract every frame (no skipping)
                frame_filename = f"ARICC_{folder_name}_{video_name}_{frame_count:06d}.jpg"
                frame_path = os.path.join(output_dir, frame_filename)

                # Resize to 224x224 to match other classes
                resized_frame = cv2.resize(frame, (224, 224), interpolation=cv2.INTER_LANCZOS4)

                # Save frame
                success = cv2.imwrite(frame_path, resized_frame, [cv2.IMWRITE_JPEG_QUALITY, 95])

                if success:
                    extracted_count += 1
                    total_frames_extracted += 1
                else:
                    print(f"    ERROR: Could not save frame {frame_count}")

                frame_count += 1

                # Progress update every 100 frames
                if frame_count % 100 == 0:
                    print(f"    Extracted {extracted_count} frames...")

            cap.release()

            print(f"  SUCCESS: Extracted {extracted_count} frames from {video_name}")
            successful_videos += 1

        except Exception as e:
            print(f"  ERROR processing {video_name}: {e}")
            failed_videos += 1

    print("\n" + "=" * 80)
    print("EXTRACTION COMPLETE!")
    print(f"Videos processed: {successful_videos} successful, {failed_videos} failed")
    print(f"Total frames extracted: {total_frames_extracted}")
    print(f"Output directory: {output_dir}")
    print("\nNext steps:")
    print("1. Review all extracted frames")
    print("2. Manually delete low-quality/irrelevant images")
    print("3. Keep only clear, representative EGN exhibit images")
    print("4. Retrain the model with cleaned dataset")
    print("=" * 80)

    return total_frames_extracted > 0

if __name__ == "__main__":
    print("ARICC Complete Frame Extraction Tool")
    print("This will extract EVERY frame from EVERY ARICC video")
    print("You can then manually select the best frames for training")
    print()

    success = extract_all_egn_frames()

    if success:
        print("\nSUCCESS! All frames extracted.")
        print("Navigate to extracted_dataset/ARICC/ to review and clean up images")
        print("Delete blurry, dark, or irrelevant frames manually")
        print("Keep clear images showing ARICC exhibits")
    else:
        print("\nFAILED! Could not extract frames.")