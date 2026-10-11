import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  interpolate,
  withSequence,
} from 'react-native-reanimated';
import { Camera, Shield, CheckCircle, User, Settings, Smile, Upload, Eye, Zap } from 'lucide-react-native';
import { faceAnalysisService, FaceAnalysisResult } from '../src/services/faceAnalysisService.js';
import { useFaceVerification } from '../src/contexts/FaceVerificationContext.jsx';

const { width, height } = Dimensions.get('window');

export default function FaceVerification() {
  const { setVerificationResult } = useFaceVerification();
  const [permission, requestPermission] = useCameraPermissions();
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [detectedProfile, setDetectedProfile] = useState<FaceAnalysisResult | null>(null);
  const [facing, setFacing] = useState<CameraType>('front');
  const [backendStatus, setBackendStatus] = useState<boolean | null>(null);
  const [selectedMode, setSelectedMode] = useState<'camera' | 'upload' | null>(null);
  const [personDetected, setPersonDetected] = useState(false);
  const [detectionActive, setDetectionActive] = useState(true);
  const [avatarReady, setAvatarReady] = useState(false);
  const [entertainmentPhase, setEntertainmentPhase] = useState<'detecting' | 'greeting' | 'analyzing' | 'complete'>('detecting');
  const cameraRef = useRef<CameraView>(null);
  const detectionInterval = useRef<any>(null);
  const faceDetectionLock = useRef(false);
  const emotionInferenceLock = useRef(false);
  const ageInferenceLock = useRef(false);
  const captureLock = useRef(false);
  const recognitionStarted = useRef(false);
  const mountedRef = useRef(true);
  const avatarFirstRendered = useRef(false);
  const pageOpenedAt = useRef(performance.now());

  const fadeValue = useSharedValue(0);
  const pulseValue = useSharedValue(1);
  const scanLineValue = useSharedValue(-1);
  const eyeValue = useSharedValue(1);
  const greetingValue = useSharedValue(0);

  useEffect(() => {
    fadeValue.value = withTiming(1, { duration: 800 });

    eyeValue.value = withRepeat(withSequence(
      withTiming(0.3, { duration: 150 }),
      withTiming(1, { duration: 150 }),
      withTiming(0.3, { duration: 150 }),
      withTiming(1, { duration: 2000 })
    ), -1);

    checkBackendHealth();

    void preloadAvatar();

    return () => {
      mountedRef.current = false;
      stopFaceDetection();
      const timers = (globalThis as any).__sscRecognitionTimers;
      if (timers) {
        clearInterval(timers.emotionTimer);
        clearInterval(timers.ageTimer);
      }
    };
  }, []);

  const preloadAvatar = async () => {
    const startedAt = performance.now();
    if ((globalThis as any).__sscAvatarPreloaded) {
      setAvatarReady(true);
      console.log(`[AI PERF] avatarPreloadTime: ${(performance.now() - startedAt).toFixed(0)}ms (cached)`);
      return;
    }

    // The first avatar surface is bundled with this screen. Resolve it in the
    // background so it never blocks camera startup or face detection.
    await Promise.resolve();
    (globalThis as any).__sscAvatarPreloaded = true;
    if (mountedRef.current) setAvatarReady(true);
    console.log(`[AI PERF] avatarPreloadTime: ${(performance.now() - startedAt).toFixed(0)}ms`);
  };

  const checkBackendHealth = async () => {
    const startedAt = performance.now();
    const isHealthy = await faceAnalysisService.checkHealth();
    setBackendStatus(isHealthy);
    console.log(`[AI PERF] faceModelLoadTime: ${(performance.now() - startedAt).toFixed(0)}ms`);

    if (!isHealthy) {
      console.warn('Flask backend not available. Please check connection.');
    } else {
      console.log('✅ Flask backend models loaded and ready!');
    }
  };

  
  const stopFaceDetection = () => {
    if (detectionInterval.current) {
      clearTimeout(detectionInterval.current);
      detectionInterval.current = null;
    }
  };

  const captureFrame = async (quality: number) => {
    if (captureLock.current || !cameraRef.current) return null;
    captureLock.current = true;
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality });
      return photo.base64 || null;
    } finally {
      captureLock.current = false;
    }
  };

  const startFaceDetection = () => {
    stopFaceDetection();
    const poll = async () => {
      if (!mountedRef.current || !detectionActive || personDetected) return;
      if (!faceDetectionLock.current) {
        faceDetectionLock.current = true;
        const startedAt = performance.now();
        try {
          const base64 = await captureFrame(0.25);
          if (base64) {
            const result = await faceAnalysisService.detectFacesFromBase64(base64);
            console.log(`[AI PERF] faceDetectionTime: ${(performance.now() - startedAt).toFixed(0)}ms`);
            if (result.count > 0 && mountedRef.current) {
              setPersonDetected(true);
              setDetectionActive(false);
              setEntertainmentPhase('analyzing');
              console.log(`[AI PERF] firstFaceDetectedTime: ${(performance.now() - pageOpenedAt.current).toFixed(0)}ms after page open`);
              stopFaceDetection();
              startAsyncRecognition();
              return;
            }
          }
        } catch (error) {
          console.warn('Face detection poll failed:', error);
        } finally {
          faceDetectionLock.current = false;
        }
      }
      if (mountedRef.current && detectionActive && !personDetected) {
        detectionInterval.current = setTimeout(poll, 250);
      }
    };
    poll();
  };

  const startAsyncRecognition = async () => {
    if (recognitionStarted.current) return;
    recognitionStarted.current = true;

    const runEmotion = async () => {
      if (emotionInferenceLock.current || !mountedRef.current) return;
      emotionInferenceLock.current = true;
      const startedAt = performance.now();
      try {
        const base64 = await captureFrame(0.6);
        if (base64) {
          const result = await faceAnalysisService.detectEmotionFromBase64(base64);
          setDetectedProfile(previous => ({ ...(previous || {}), ...result } as FaceAnalysisResult));
        }
      } catch (error) {
        console.warn('Emotion inference failed; avatar remains active:', error);
      } finally {
        emotionInferenceLock.current = false;
        console.log(`[AI PERF] emotionInferenceTime: ${(performance.now() - startedAt).toFixed(0)}ms`);
      }
    };

    const runAge = async () => {
      if (ageInferenceLock.current || !mountedRef.current) return;
      ageInferenceLock.current = true;
      const startedAt = performance.now();
      try {
        const base64 = await captureFrame(0.6);
        if (base64) {
          const result = await faceAnalysisService.detectAgeGenderFromBase64(base64);
          setDetectedProfile(previous => ({ ...(previous || {}), ...result } as FaceAnalysisResult));
        }
      } catch (error) {
        console.warn('Age inference failed; avatar remains active:', error);
      } finally {
        ageInferenceLock.current = false;
        console.log(`[AI PERF] ageInferenceTime: ${(performance.now() - startedAt).toFixed(0)}ms`);
      }
    };

    void runEmotion();
    void runAge();
    const emotionTimer = setInterval(runEmotion, 400);
    const ageTimer = setInterval(runAge, 1500);
    (globalThis as any).__sscRecognitionTimers = { emotionTimer, ageTimer };
  };

  useEffect(() => {
    if (isVerifying) {
      pulseValue.value = withRepeat(withTiming(1.05, { duration: 1000 }), -1, true);
      scanLineValue.value = withRepeat(withTiming(1, { duration: 2000 }), -1, false);
    }
  }, [isVerifying]);

  useEffect(() => {
    if (personDetected && avatarReady && !avatarFirstRendered.current) {
      avatarFirstRendered.current = true;
      console.log(`[AI PERF] avatarFirstRenderTime: ${performance.now().toFixed(0)}ms`);
    }
  }, [personDetected, avatarReady]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fadeValue.value,
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseValue.value }],
  }));

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{
      translateY: interpolate(scanLineValue.value, [-1, 1], [-80, 80])
    }],
    opacity: interpolate(scanLineValue.value, [-1, 0, 1], [0, 1, 0]),
  }));

  const eyeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: eyeValue.value }],
  }));

  const greetingStyle = useAnimatedStyle(() => ({
    opacity: greetingValue.value,
    transform: [{ scale: interpolate(greetingValue.value, [0, 1], [0.8, 1]) }],
  }));

  const handleStartVerification = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission Required', 'Camera access is needed for face verification.');
        return;
      }
    }

    setIsVerifying(true);

    try {
      if (cameraRef.current) {
        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.8,
        });

        if (photo.base64) {
          let analysisResult;

          console.log('🧠 Using Flask backend for analysis');
          analysisResult = await faceAnalysisService.analyzeFaceFromBase64(photo.base64);

          if (!analysisResult.success) {
            if (analysisResult.emotion && analysisResult.emotion !== 'Unknown' && (analysisResult.emotionConfidence || 0) > 0.2) {
              console.log('⚠️ Age prediction failed but emotion detection succeeded:', analysisResult.emotion);
            } else {
              setIsVerifying(false);
              Alert.alert('Face Detection Failed', analysisResult.message || 'Unable to analyze face. Please try again.');
              return;
            }
          } else {
            console.log('✅ Face analysis successful:', analysisResult.emotion);
          }

          setIsVerified(true);
          setIsVerifying(false);
          setDetectedProfile(analysisResult);

          setVerificationResult({
            success: analysisResult.success,
            age: analysisResult.age || 25,
            ageGroup: analysisResult.ageGroup || 'Adult',
            gender: analysisResult.gender || 'Unknown',
            genderConfidence: analysisResult.genderConfidence || 0,
            emotion: analysisResult.emotion || 'Neutral',
            emotionConfidence: analysisResult.emotionConfidence || 0,
            allEmotions: analysisResult.allEmotions || {},
            confidence: analysisResult.confidence || 0,
            timestamp: analysisResult.timestamp || new Date().toISOString(),
            message: analysisResult.message
          });

          setTimeout(() => {
            router.replace('/ai-text');
          }, 1500);
        } else {
          throw new Error('Failed to capture image');
        }
      } else {
        throw new Error('Camera not available');
      }
    } catch (error) {
      console.error('Verification failed:', error);
      setIsVerifying(false);

      setDetectedProfile({
        success: false,
        ageGroup: 'Unknown',
        emotion: 'Unknown',
        emotionConfidence: 0,
        confidence: 0,
        timestamp: new Date().toISOString(),
        message: 'Local analysis failed'
      });

      Alert.alert('Verification Failed', 'Unable to analyze face with Flask backend. Please check your connection and try again.');
    }
  };

  const handleSkip = () => {
    router.replace('/ai-text');
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <LinearGradient colors={['#FF6B35', '#FF8C42']} style={styles.container}>
        <View style={styles.permissionContainer}>
          <Camera color="white" size={60} />
          <Text style={styles.permissionTitle}>Camera Permission Required</Text>
          <Text style={styles.permissionText}>
            We need camera access to provide personalized recommendations based on your age group.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  if (isVerified && detectedProfile) {
    return (
      <LinearGradient colors={['#4CAF50', '#66BB6A']} style={styles.container}>
        <Animated.View style={[styles.content, animatedStyle]}>
          <View style={styles.successContainer}>
            <CheckCircle color="white" size={60} />
            <Text style={styles.successTitle}>Verification Complete!</Text>
            <Text style={styles.successSubtitle}>Welcome to Singapore Science Centre</Text>

            <View style={styles.profileCard}>
              <Text style={styles.profileTitle}>Detected Profile</Text>
              <View style={styles.profileRow}>
                <User color="#4CAF50" size={18} />
                <Text style={styles.profileText}>Age Group: {detectedProfile.ageGroup}</Text>
              </View>

              <View style={styles.profileRow}>
                <Smile color="#4CAF50" size={18} />
                <Text style={styles.profileText}>Emotion: {detectedProfile.emotion}</Text>
              </View>
              <View style={styles.profileRow}>
                <Shield color="#4CAF50" size={18} />
                <Text style={styles.profileText}>Analysis Complete</Text>
              </View>
              {detectedProfile.message && (
                <Text style={styles.profileMessage}>{detectedProfile.message}</Text>
              )}
            </View>

            <Text style={styles.redirectText}>Redirecting to main app...</Text>
          </View>
        </Animated.View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#FF6B35', '#FF8C42']} style={styles.container}>
      <Animated.View style={[styles.content, animatedStyle]}>
        <View style={styles.aiHeader}>
          <Animated.View style={[styles.aiEyeContainer, eyeStyle]}>
            <Eye color="white" size={40} />
          </Animated.View>
          <Text style={styles.aiTitle}>AI Vision System</Text>
          <Text style={styles.aiSubtitle}>
            {entertainmentPhase === 'detecting'
              ? 'Scanning for visitors...'
              : entertainmentPhase === 'analyzing'
                ? 'Analyzing your profile...'
                : 'Welcome to Science Centre!'}
          </Text>
        </View>

        <View style={styles.cameraContainer}>
          <View style={styles.cameraFrame}>
            {(personDetected || isVerifying) && (
              <Animated.View style={[styles.scanningOverlay, pulseStyle]}>
                <View style={styles.scanningBorder} />
                {isVerifying && <Animated.View style={[styles.scanLine, scanLineStyle]} />}
                <View style={styles.scanningContent}>
                  <Zap color="#4CAF50" size={30} />
                  <Text style={styles.scanningText}>
                    {entertainmentPhase === 'analyzing' ? 'Analyzing face...' : 'Processing...'}
                  </Text>
                </View>
              </Animated.View>
            )}

            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing={facing}
              onCameraReady={() => {
                console.log(`[AI PERF] cameraReadyTime: ${(performance.now() - pageOpenedAt.current).toFixed(0)}ms after page open`);
                startFaceDetection();
              }}
            />
          </View>
        </View>

        <View style={styles.statusSection}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: personDetected ? '#4CAF50' : '#FFC107' }]} />
            <Text style={styles.statusText}>
              {personDetected ? 'Visitor detected' : 'Waiting for visitor...'}
            </Text>
          </View>

          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: backendStatus ? '#4CAF50' : '#FF9800' }]} />
            <Text style={styles.statusText}>
              {backendStatus ? 'AI Models Ready' : 'Loading AI...'}
            </Text>
          </View>
          {detectedProfile?.emotion && detectedProfile.emotion !== 'Unknown' && (
            <Text style={styles.statusText}>Emotion: {detectedProfile.emotion}</Text>
          )}
          {detectedProfile?.ageGroup && detectedProfile.ageGroup !== 'Unknown' && (
            <Text style={styles.statusText}>Age group: {detectedProfile.ageGroup}</Text>
          )}
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>🚀 Instant AI Recognition</Text>
          <Text style={styles.infoText}>
            Step into view for automatic face analysis and personalized experience!
          </Text>
        </View>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 20,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginTop: 15,
    lineHeight: 22,
  },
  permissionButton: {
    backgroundColor: 'white',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 30,
    marginTop: 30,
  },
  permissionButtonText: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginTop: 8,
  },
  cameraContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraFrame: {
    width: 250,
    height: 200,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'white',
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  scanningOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  scanningBorder: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    bottom: 10,
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderRadius: 15,
  },
  scanLine: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 2,
    backgroundColor: '#4CAF50',
    borderRadius: 1,
  },
  scanningText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 20,
  },
  controls: {
    alignItems: 'center',
    marginVertical: 20,
  },
  startButton: {
    backgroundColor: 'white',
    borderRadius: 25,
    paddingVertical: 15,
    paddingHorizontal: 40,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  startButtonText: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: 'bold',
  },
  uploadButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 25,
    paddingVertical: 15,
    paddingHorizontal: 40,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  uploadButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  testButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'white',
    borderRadius: 25,
    paddingVertical: 8,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  testButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  skipButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: 'white',
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 25,
  },
  skipButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  infoSection: {
    marginBottom: 30,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    justifyContent: 'center',
  },
  infoText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginLeft: 8,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 20,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginTop: 8,
  },
  profileCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 15,
    padding: 20,
    marginTop: 30,
    width: '90%',
  },
  profileTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    justifyContent: 'center',
  },
  profileText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
  },
  redirectText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginTop: 20,
  },
  profileMessage: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
  profileSubText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  aiHeader: {
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: 10,
  },
  aiEyeContainer: {
    marginBottom: 10,
  },
  aiTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 5,
  },
  aiSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  statusSection: {
    marginVertical: 20,
    paddingHorizontal: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    justifyContent: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  aiGreetingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  aiEye: {
    marginBottom: 30,
  },
  aiGreetingTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 15,
  },
  aiGreetingSubtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 30,
  },
  pulsingDots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  scanningContent: {
    alignItems: 'center',
    gap: 10,
  },
});