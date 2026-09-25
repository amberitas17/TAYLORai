# Singapore Science Centre - Client-Side AI Emotion Detection

## Overview
This is a **completely client-side** React.js application that provides real-time emotion detection, age estimation, and gender prediction using face-api.js. No backend server required!

## 🌟 Features
- **7-Emotion Detection**: Angry, Disgusted, Fearful, Happy, Neutral, Sad, Surprised
- **Age & Gender Prediction** with confidence scores
- **68-Point Facial Landmark Detection**
- **Real-time Camera Feed** with capture functionality
- **Complete Client-Side Processing** - no data sent to servers
- **Professional UI** with Singapore Science Centre branding

## 🚀 Quick Start

### Prerequisites
- Node.js (version 14 or higher)
- npm or yarn
- Web browser with camera access

### Installation & Setup

1. **Clone and navigate to the project:**
   ```bash
   cd singaporesciencecenterpwa
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   - Navigate to `http://localhost:5173` (or the port shown in terminal)
   - Allow camera permissions when prompted

### How TAYLOR Runs

- Vite serves the React application during development.
- React mounts the interface from `src/main.jsx` into the `#root` element in `index.html`.
- Face detection, age estimation, gender prediction, and emotion analysis run in the browser using face-api.js and TensorFlow.js.
- The browser loads the face-api.js models from the configured model location or CDN, so the first model load can take longer.
- The chat feature sends requests to `/api/chat`. In a Vercel deployment, this is handled by `api/chat.js` and requires the `OPENROUTER_API_KEY` environment variable.
- Vercel serves the built static files from `dist`. The rewrite in `vercel.json` sends application routes such as `/face-api` back to `index.html` so React Router can load them.

## Train RECON Center Exhibit Data

RECON uses a separate five-class classifier because its documented exhibits are
different from the ARICC taxonomy:

- Industrial Measurement Instrumentation
- Food and Thermal Processing Machinery
- Unmanned Aerial Systems
- Renewable Energy Training Systems
- Fluid Transfer Systems

Labels are assigned from verified exhibit placard OCR, not source filenames.
The OCR evidence and normalized class for each source are stored in:

```text
Documentation/datasets/RECON/ocr_labels.json
```

Each manifest entry must contain non-empty `text` and `label` fields. The
trainer fails when a source is missing from the manifest or has an unsupported
label, so an unverified recording cannot silently enter the wrong class.

### UNKNOWN category

UNKNOWN is an abstention category shared by ARICC and RECON. It is not added
to either classifier's trained class list. The application returns UNKNOWN
when the binary gate rejects the frame or the active classifier cannot make a
confident class decision, then displays:

```text
No exhibit detected
```

UNKNOWN includes:

- Background scenes
- Random museum frames
- Floors
- Walls
- People
- Empty rooms
- Blurred images
- Noise samples
- Non-exhibit environments

Some room objects and visually similar backgrounds may still be classified as
exhibits. More real-world background examples in the gate validation data can
improve rejection performance.

### How exhibit detection works

For each camera frame, TAYLOR follows this sequence:

1. The selected route chooses one specialist model: ARICC or RECON. The two
   classifiers are kept separate and do not fall back to one another.
2. A person check runs first when the local face detector is available. A
   person-only frame is rejected as UNKNOWN.
3. The binary exhibit/background gate checks whether the frame looks like an
   exhibit. The similarity index then checks whether it is visually close to
   known exhibit examples.
4. Only a frame that passes both gate checks reaches the selected classifier.
5. The classifier result is accepted only when its confidence and separation
   from the next-best class meet the configured thresholds.
6. Rejected, uncertain, or unsupported frames return UNKNOWN and the interface
   displays `No exhibit detected`.

The face-detector asset is an additional rejection layer, not a replacement
for the exhibit gate. If that asset cannot load, the application logs the
failure and continues using the binary gate and similarity index so exhibit
recognition remains available.

Build the dataset, train, and export the RECON model with:

```powershell
.venv\Scripts\python.exe scripts\train_recon_from_documentation.py `
   --epochs 30 `
   --batch 8 `
   --imgsz 224 `
   --frame-step 10 `
   --max-frames 120 `
   --run-name recon_documentation_ocr_v1
```

The source-level split and limitations are recorded in
`runs/recon_documentation_dataset_ocr_v1/dataset_summary.json`, including the
OCR text used for each source. The PyTorch checkpoint and ONNX export are
written under `runs/classify/recon_documentation_ocr_v1`.
This model is not copied into the deployed ARICC directory; wire it into a
RECON-specific inference route only after independent camera validation.

## Train Additional ARICC Exhibit Data

The ARICC webcam workflow uses an eight-class image classifier. Additional exhibit recordings must be added to the source dataset and included in a training run; placing a video in a playback directory does not train the model.

### Add Source Videos

Put recordings in:

```text
Documentation/datasets/ARICC/ARICC/
```

The filename determines the existing class. Use one of these class prefixes:

```text
3D Printer
Collaborative Robot
FDAS
Industrial Robot
Pick & Place Machine
Robotic Arm
Smart Systems
Speech Home Automation
```

Examples:

```text
3D Printer 3.MOV
Collaborative Robot 3.MOV
Smart Systems 6.MOV
```

Do not create a new numbered class for another recording of an existing exhibit. The class mapping is fixed:

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

### Prepare and Train

Use the project Python environment, which contains OpenCV, PyTorch, and Ultralytics:

```powershell
cd E:\TAYLORai
.\.venv\Scripts\Activate.ps1
```

Build a new dataset and train without deploying it first:

```powershell
python scripts\train_aricc_from_documentation.py `
   --dataset-dir runs\aricc_documentation_dataset_new `
   --run-name aricc_documentation_new `
   --epochs 40 `
   --batch 8 `
   --imgsz 224 `
   --frame-step 10 `
   --max-frames 120
```

The script extracts frames into `train/<class>` and `val/<class>`, writes `dataset_summary.json`, trains a YOLOv8 classification checkpoint, and exports an ONNX candidate under `runs/classify/<run-name>/weights/`.

When a newly uploaded recording must be learned by the model, force it into the training split:

```powershell
python scripts\train_aricc_from_documentation.py `
   --dataset-dir runs\aricc_documentation_dataset_new `
   --run-name aricc_documentation_new `
   --always-train-video "3D Printer 3.MOV" `
   --always-train-video "Collaborative Robot 3.MOV"
```

The remaining recordings are split at the video level where possible, so frames from one recording do not appear in both training and validation. Inspect `dataset_summary.json` and confirm the new filename is under `videos.<class>.train`.

Optional training-data cleanup can remove exact duplicate frames and low-detail frames based on a Laplacian blur score:

```powershell
python scripts\train_aricc_from_documentation.py `
   --dataset-dir runs\aricc_documentation_dataset_new `
   --reuse-dataset `
   --run-name aricc_documentation_filtered `
   --min-blur-score 25
```

Use this only for a candidate run. Compare its metrics with the unfiltered model before deployment.

### Verify Before Deployment

Audit the PyTorch checkpoint against its ONNX export:

```powershell
python scripts\audit_aricc_model.py `
   --checkpoint runs\classify\aricc_documentation_new\weights\best.pt `
   --onnx runs\classify\aricc_documentation_new\weights\best.onnx `
   --dataset runs\aricc_documentation_dataset_new
```

Confirm the report shows:

- `pytorch_onnx_prediction_agreement` close to `1.0`
- a small `max_absolute_logit_delta`
- the expected eight class names and indices
- per-class accuracy and the confusion matrix

Test at least one separate image from every class. Do not manually swap labels to improve a result. If a known training image works but a held-out recording fails, the issue is usually viewpoint, lighting, class imbalance, or insufficient independent recordings rather than ONNX label order.

### Deploy the Verified Candidate

Deploy only after comparing the candidate with the current model:

```powershell
python scripts\train_aricc_from_documentation.py `
   --dataset-dir runs\aricc_documentation_dataset_new `
   --reuse-dataset `
   --run-name aricc_documentation_new `
   --deploy
```

Deployment replaces:

```text
public/models/aricc/aricc_classifier.onnx
public/models/aricc/aricc_classifier_metadata.json
```

The metadata must retain input shape `[1, 3, 224, 224]`, logits output, RGB preprocessing with pixels divided by `255`, and the fixed class order above. Build and verify the browser artifact:

```powershell
npm run build
```

Restart Vite, hard-refresh with `Ctrl+Shift+R`, and check the browser console for the model name, eight classes, `mean=[0, 0, 0]`, and `std=[1, 1, 1]`. Clear the service worker cache if the browser still reports an older model name.

## ☁️ Deploy to Vercel

### Deploy from the Vercel Dashboard

1. Push the project to GitHub, GitLab, or Bitbucket.
2. In Vercel, select **Add New > Project** and import the repository.
3. Use these project settings:
   - **Framework Preset:** `Vite`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
4. Add the environment variable:
   - **Name:** `OPENROUTER_API_KEY`
   - **Value:** your OpenRouter API key
   - **Environments:** Production, Preview, and Development as needed
5. Click **Deploy**.

### Deploy with the Vercel CLI

```powershell
npm install -g vercel
cd E:\TAYLORai
vercel login
vercel
```

For a production deployment:

```powershell
vercel --prod
```

Add the chat API key through the Vercel dashboard or CLI. Do not commit it to the repository:

```powershell
vercel env add OPENROUTER_API_KEY production
vercel env add OPENROUTER_API_KEY preview
vercel --prod
```

### Verify the Vercel Deployment

1. Open the deployment URL over `https://` and confirm the landing page loads.
2. Test a direct client route such as `/face-api` and reload that page. It should still load because of `vercel.json`.
3. Allow camera access. Camera access generally requires HTTPS outside localhost.
4. Open DevTools and confirm model requests succeed.
5. Test the chat feature. If it returns an invalid-key response, check **Vercel > Project > Settings > Environment Variables**, then redeploy after changing the variable.
6. Check **Vercel > Project > Deployments > Functions** and **Logs** for `/api/chat` errors.

### Vercel Deployment Troubleshooting

- **Build fails:** Run `npm run build` locally and fix the first reported error.
- **Page is white after deployment:** Check the browser Console and Network tabs, confirm the deployment used `npm run build`, and verify `dist/index.html` was generated.
- **Refreshing `/face-api` returns 404:** Confirm the current deployment includes `vercel.json` with the SPA rewrite.
- **Chat does not work:** Confirm `OPENROUTER_API_KEY` is configured for the same environment as the deployment and redeploy.
- **Camera does not start:** Use the HTTPS Vercel URL and allow camera permission for that domain.

## 🎯 How to Use

### Main App Flow (RECOMMENDED)
1. **Landing Page**: Go to `http://localhost:5173/`
2. **Click "Get Started"** - Takes you to the working face-api.js interface
3. **Initialize Models** - Click "🚀 Initialize Models" and wait for loading
4. **Start Camera** - Click "📹 Start Camera" and allow permissions
5. **Analyze** - Click "📸 Capture & Analyze" to detect emotions

### Direct Access Options
- **Face-API Interface**: `http://localhost:5173/face-api` ⭐ **WORKING & RECOMMENDED**
- **Original Backend Test**: `http://localhost:5173/ai-vision` (requires backend server)
- **Alternative Client-Side**: `http://localhost:5173/client-ai` (experimental)

### ⭐ Production Ready Version
The **face-api.js interface** (`/face-api`) is the production-ready version that:
- Works completely client-side (no backend required)
- Uses proven face-api.js library with TensorFlow.js 1.7.4
- Provides real-time emotion detection with 7 emotions
- Includes age and gender prediction
- Has enhanced face detection sensitivity
- Thoroughly tested and working reliably

## 🔧 Technical Implementation

### Dependencies
- **React.js** - Frontend framework
- **TensorFlow.js 1.7.4** - Machine learning library
- **face-api.js 0.22.2** - Face detection and analysis
- **Vite** - Build tool and dev server

### Architecture
```
src/
├── components/
│   ├── FaceApiInterface.jsx      # Main emotion detection UI
│   └── ClientSideAIInterface.jsx # Alternative TensorFlow.js implementation
├── services/
│   ├── faceApiAI.js             # Face-api.js service (RECOMMENDED)
│   └── clientSideAI.js          # Custom TensorFlow.js service
└── App.jsx                       # Main app with routing
```

### Model Loading
- **CDN-hosted models** from face-api.js official repository
- **Automatic initialization** with retry mechanisms
- **Enhanced sensitivity** for better face detection in various lighting conditions

## 📊 Performance Features

### Face Detection Enhancements
- **Dual sensitivity levels**: Initial detection + retry with higher sensitivity
- **Input size optimization**: 416px and 512px for better accuracy
- **Score threshold tuning**: 0.3 and 0.1 for comprehensive detection
- **Debug logging**: Detailed console output for troubleshooting

### Results Processing
- **Real-time analysis** with processing time tracking
- **Confidence scores** for all emotions, age, and gender predictions
- **Age group classification**: Child (≤18), Adult (19-64), Senior (≥65)
- **Comprehensive emotion breakdown** showing all 7 emotion probabilities

## 🛠️ Troubleshooting

### White Screen or Blank TAYLOR Page

Use these steps when `http://localhost:5173` shows only a white page.

1. **Check whether React mounted**
   - Open browser developer tools with `F12` and select the **Console** tab.
   - Run:
     ```javascript
     document.getElementById('root')?.innerHTML
     ```
   - If the result is an empty string, React did not mount. Check the first red error in the Console.
   - If the result contains markup, the app mounted and the issue is likely a CSS or component error.

2. **Check the browser Network tab**
   - Reload the page with `Ctrl+Shift+R`.
   - Confirm that `/src/main.jsx` and `/@vite/client` return status `200`.
   - A failed request, `ERR_CONNECTION_REFUSED`, or a module syntax error indicates a dev-server problem.

3. **Stop duplicate Node/Vite processes on Windows**
   - In PowerShell, run:
     ```powershell
     Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
     ```
   - This is useful when Vite says `Port 5173 is in use` and starts on `5174` instead. Multiple Vite processes can leave the browser connected to a stale blank page.

4. **Start one clean frontend server**
   ```powershell
   cd E:\TAYLORai
   npm run dev -- --host 127.0.0.1 --port 5173
   ```
   - Open the exact URL printed by Vite. If it chooses another port, use that port instead of assuming `5173`.

5. **Clear stale service-worker content**
   - In DevTools, open **Application > Service Workers** and click **Unregister** for the TAYLOR origin.
   - Open **Application > Storage**, click **Clear site data**, then reload the page.

6. **Check for build or import errors**
   ```powershell
   npm run build
   ```
   - If the build fails, fix the reported import or syntax error first.
   - If the build succeeds but development is still blank, restart Vite and inspect the browser Console again.

### Camera Issues
- **Permission denied**: Check browser camera permissions
- **No camera detected**: Ensure camera is connected and not used by other apps
- **Poor detection**: Improve lighting and face positioning

### Model Loading Issues
- **Slow loading**: CDN models may take time on first load
- **Loading failures**: Check internet connection for CDN access
- **Console errors**: Check browser console for detailed error messages

### Face Detection Issues
- **No faces detected**:
  - Ensure face is clearly visible and well-lit
  - Try moving closer/further from camera
  - Check console logs for detailed detection info
  - System automatically retries with higher sensitivity

## 🌐 Browser Compatibility
- **Chrome**: Full support (recommended)
- **Firefox**: Full support
- **Safari**: Full support (requires HTTPS in production)
- **Edge**: Full support

## 📝 Development Notes

### Version Compatibility
- **Critical**: Uses TensorFlow.js 1.7.4 + face-api.js 0.22.2 for compatibility
- **Do not upgrade** TensorFlow.js without testing compatibility
- **Model format**: Uses graph-model format for face-api.js

### Deployment Considerations
- **HTTPS required** for camera access in production
- **Model caching**: CDN models are cached by browser
- **Performance**: Client-side processing, no server load

## 🔗 API Reference

### FaceApiAI Service
```javascript
import { faceApiAI } from './services/faceApiAI.js';

// Initialize models
await faceApiAI.initialize();

// Analyze image
const result = await faceApiAI.analyzeImage(imageElement);

// Check status
const status = faceApiAI.getStatus();
```

### Result Format
```javascript
{
  success: true,
  emotion: "Happy",                    // Dominant emotion
  emotionConfidence: 0.89,            // Confidence (0-1)
  allEmotions: {                      // All emotion probabilities
    "Angry": 0.02,
    "Disgusted": 0.01,
    "Fearful": 0.03,
    "Happy": 0.89,
    "Neutral": 0.03,
    "Sad": 0.01,
    "Surprised": 0.01
  },
  age: 25,                            // Estimated age
  ageGroup: "Adult",                  // Age category
  gender: "female",                   // Predicted gender
  genderConfidence: 0.94,             // Gender confidence
  processingTime: 245,                // Processing time (ms)
  timestamp: "2024-01-01T12:00:00Z",  // Analysis timestamp
  source: "face-api.js"               // Analysis engine
}
```

## 📄 License
This project is developed for Singapore Science Centre educational purposes.

## 🤝 Support
For technical support or questions, check the browser console for detailed logs and error messages.
