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
