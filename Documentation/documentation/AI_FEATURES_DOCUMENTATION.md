# AI Features Documentation
## Singapore Science Centre PWA

### Overview

This Progressive Web Application (PWA) integrates three advanced AI-powered features to enhance visitor experience at the Singapore Science Centre:

1. **🎭 Emotion Recognition** - Real-time facial emotion analysis
2. **🏛️ Exhibit Recognition** - Computer vision-based exhibit identification
3. **🗺️ AI Navigation Map** - Sensor-based pathway tracking and navigation

---

## 🎭 Emotion Recognition System

### **Technology Stack**
- **Frontend:** Face-api.js in browser
- **Models:** Pre-trained face detection and emotion recognition models
- **Processing:** 100% client-side, no backend required
- **Privacy:** All analysis happens locally in the browser

### **Features**
- **Real-time emotion detection** from camera feed or uploaded images
- **7 emotion categories:** Angry, Disgusted, Fearful, Happy, Neutral, Sad, Surprised
- **Face detection** with bounding boxes and landmarks
- **Age and gender estimation**
- **100% client-side processing** - no data leaves the browser
- **Face-api.js models** loaded from CDN or local files

### **Architecture**
```
Camera Feed → Face Detection → Feature Extraction → Emotion Classification → Results
```

### **Implementation Details**

#### **Client-Side Service** (`src/services/clientSideFaceAnalysis.js`)
```javascript
// 100% browser-based face analysis with face-api.js
import * as faceapi from 'face-api.js';

class ClientSideFaceAnalysisService {
  async initialize() {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(modelPath),
      faceapi.nets.faceExpressionNet.loadFromUri(modelPath),
      faceapi.nets.ageGenderNet.loadFromUri(modelPath)
    ]);
  }

  async analyzeFaceFromImage(imageElement) {
    const detections = await faceapi
      .detectAllFaces(imageElement, new faceapi.TinyFaceDetectorOptions())
      .withFaceExpressions()
      .withAgeAndGender();
    return detections;
  }
}
```

#### **Available Route**
- `/client-side-face-analysis` - Face-api.js browser-only analysis

### **Usage Example**
```javascript
const faceService = new ClientSideFaceAnalysisService();
await faceService.initialize();
const detections = await faceService.analyzeFaceFromImage(imageElement);

// Result format (per detected face):
{
  detection: {
    box: { x: 100, y: 50, width: 150, height: 200 },
    score: 0.99
  },
  expressions: {
    angry: 0.01,
    disgusted: 0.02,
    fearful: 0.03,
    happy: 0.85,
    neutral: 0.05,
    sad: 0.02,
    surprised: 0.02
  },
  age: 25.3,
  gender: 'female',
  genderProbability: 0.92
}
```

### **Performance**
- **Model loading:** ~2-5 seconds initial load
- **Analysis time:** ~50-200ms per face
- **Memory usage:** ~100-200MB for models
- **Accuracy:** 80-90% for emotions, 85-95% for face detection
- **Browser compatibility:** Chrome, Firefox, Safari, Edge (WebGL required)

---

## 🏛️ Exhibit Recognition System

### **Technology Stack**
- **Models:** ONNX Runtime Web with YOLOv8 variants
- **Architecture:** Hierarchical detection system
- **Processing:** Client-side inference with TensorFlow.js
- **Confidence filtering:** 95% threshold for high accuracy

### **Model Architecture**

#### **Hierarchical Detection System**
1. **Frame Clarity Gate**
   - Variance-based sharpness detection
   - Filters poor quality frames before classification
   - Improves accuracy by rejecting blurry images

2. **Main Model** (`yolov8s_exhibit_exact.onnx`)
   - Identifies exhibit zones: DWT, EAP, EGN
   - 95% confidence threshold
   - Real-time processing

3. **Zone-Specific Models**
   - **DWT Model:** 22 specific exhibits in Dialogue with Time zone
   - **EAP Model:** 24 specific exhibits in Earth Alive Planet zone
   - **EGN Model:** 24 specific exhibits in Energy zone

### **Features**
- **Frame clarity gate** to filter poor quality frames before inference
- **Real-time exhibit detection** from camera feed
- **Multi-level classification** (zone → specific exhibit)
- **Confidence-based filtering** to reduce false positives
- **Rich exhibit metadata** with descriptions and images
- **Progressive enhancement** from basic to specific identification

### **Implementation Details**

#### **Detection Service** (`src/services/exhibitDetectionService.js`)
```javascript
class ExhibitDetectionService {
  async detectHierarchical(imageElement) {
    // 1. Check frame clarity
    const clarityCheck = await this.checkFrameClarity(imageElement);
    if (!clarityCheck.isClear) return null;

    // 2. Main model detection (zone level)
    const mainResult = await this.detectWithMainModel(imageElement);
    if (mainResult.confidence < 0.95) return null;

    // 3. Zone-specific detection
    const specificResult = await this.detectWithZoneModel(imageElement, mainResult.zone);

    return {
      zone: mainResult.zone,
      exhibit: specificResult.exhibit,
      confidence: mainResult.confidence,
      metadata: specificResult.metadata
    };
  }
}
```

#### **Frame Clarity Gate**
```javascript
async checkFrameClarity(imageElement) {
  // Calculate image variance as measure of sharpness
  const variance = tf.mean(tf.square(tf.sub(gray2d, meanGray))).dataSync()[0];
  const brightness = tf.mean(gray).dataSync()[0];

  return {
    isClear: variance >= 0.01 && brightness >= 0.15 && brightness <= 0.95,
    sharpness: variance,
    brightness: brightness
  };
}
```

### **Supported Exhibits**

**Dialogue with Time (DWT) - 22 Exhibits**
**Earth Alive Planet (EAP) - 24 Exhibits**
**Energy (EGN) - Multiple Exhibits**

### **Performance Metrics**
- **Accuracy:** 99.04% (main model)
- **Processing time:** ~100-300ms per frame
- **Model sizes:** 6-40MB per ONNX model
- **Memory usage:** ~200-500MB during inference

---

## 🗺️ AI Navigation Map System

### **Technology Stack**
- **Sensors:** Device accelerometer, gyroscope, compass
- **Mapping:** SVG-based pathway visualization
- **Tracking:** Real-time step detection and direction analysis
- **Navigation:** Point-based pathway progression

### **Features**
- **Real-time movement tracking** using device motion sensors
- **Pathway-based navigation** with predefined routes
- **Direction comparison** (on track vs off track indicators)
- **Visual feedback** with interactive map display
- **Step counting** and distance estimation
- **Automatic exhibit detection** integration

### **Sensor Integration**

#### **Motion Detection** (Mobile devices)
```javascript
// Enhanced step detection algorithm
const handleDeviceMotion = (event) => {
  const { x, y, z } = event.accelerationIncludingGravity;
  const magnitude = Math.sqrt(x * x + y * y + z * z);

  // Step detection with threshold and cooldown
  if (magnitude > stepThreshold &&
      now - lastStepTime > stepCooldown) {
    registerStep();
    updatePathwayProgress();
  }
};

// Direction tracking via compass
const handleDeviceOrientation = (event) => {
  let heading = event.alpha; // Compass heading
  setCurrentDirection(degreesToCardinal(heading));
};
```

#### **Pathway System**
- **Predefined routes** between major exhibit zones
- **160 steps** = 100% pathway completion (120m average)
- **Dynamic progress calculation** based on step count
- **Direction validation** (±45° tolerance for "on track")

### **Navigation Features**

#### **Visual Map Display**
- **SVG-based floor plan** with exhibit locations
- **Pathway visualization** with blue route lines
- **Real-time position indicator:**
  - 🔵 Blue dot = User on correct path
  - 🟠 Orange dot = User off path
- **Direction arrow** showing user's current heading
- **Progress indicators** showing completion percentage

#### **Pathway Types**
1. **DWT_to_EAP** - Dialogue with Time → Earth Alive Planet
2. **EAP_to_EGN** - Earth Alive Planet → Energy
3. **EGN_to_DWT** - Energy → Dialogue with Time
4. **DWT_to_EGN** - Direct route to Energy

### **Implementation Details**

#### **Movement Tracking** (`src/ai-exhibit.jsx`)
```javascript
const updatePathwayProgress = (newStepCount) => {
  const currentPath = pathCoordinates[currentPathway];
  const progress = Math.min(newStepCount / 160, 1); // 160 total steps

  // Calculate expected vs actual direction
  const expectedBearing = calculateBearing(currentPoint, nextPoint);
  const userBearing = directionToDegrees(currentDirection);
  const isOnTrack = Math.abs(expectedBearing - userBearing) <= 45;

  setIsMovingTowardsTarget(isOnTrack);
  setPathwayProgress(progress);
};
```

#### **Fallback for Desktop**
```javascript
const startSimulatedTracking = () => {
  // Random movement simulation for desktop testing
  const interval = setInterval(() => {
    if (Math.random() > 0.8) {
      setStepCount(prev => prev + 1);
      setTotalDistance(prev => prev + 0.75); // 0.75m per step
    }
  }, 1000);
};
```

### **Integration Points**
- **Camera feed** for exhibit recognition
- **Motion sensors** for movement tracking
- **Map visualization** for navigation guidance
- **Real-time feedback** for user guidance

---

## 🚀 Getting Started

### **Prerequisites**
```bash
Node.js 18+
npm or yarn
Modern browser with camera/sensor support
```

### **Installation**
```bash
# Clone repository
git clone https://github.com/aiboxsg/singaporesciencecenterpwa.git
cd singaporesciencecenterpwa

# Install dependencies
npm install

# Start development server
npm run dev
```

### **Available Routes**
```
/                           - Landing page
/machine-vision-exhibit    - Exhibit recognition + Navigation
/client-side-face-analysis - Face-api.js emotion recognition
```


---

## 📱 Browser Compatibility

### **Camera Access Requirements**
- **HTTPS required** for network access (mobile devices)
- **Camera permissions** must be granted
- **Motion sensors** (iOS requires explicit permission)

### **Supported Browsers**
- ✅ **Chrome 90+** (Full feature support)
- ✅ **Firefox 88+** (Full feature support)
- ✅ **Safari 14+** (iOS motion permission required)
- ✅ **Edge 90+** (Full feature support)
- ⚠️ **Mobile browsers** (HTTPS required for camera)

---

## 🔧 Development & Testing

### **Local Development**
```bash
# Start frontend
npm run dev

# Start emotion analysis backend (optional)
cd backend && npm start

# Access application
http://localhost:5173
```

### **Mobile Testing**
```bash
# Enable network access
npm run dev -- --host 0.0.0.0

# Access from mobile device
https://YOUR_IP:5173
```

### **Model Updates**
```bash
# Models location
public/models/              # ONNX models for exhibit detection
backend/models/             # TensorFlow models for emotions

# Update model paths in:
src/services/exhibitDetectionService.js
```

---




---

*This documentation covers the AI features implementation as of the latest version. For technical support or feature requests, please refer to the development team.*