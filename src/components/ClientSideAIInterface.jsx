import React, { useState, useRef, useEffect } from 'react';
import { clientSideAI } from '../services/clientSideAI.js';

const ClientSideAIInterface = () => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [analysis, setAnalysis] = useState(null);
    const [cameraActive, setCameraActive] = useState(false);
    const [modelStatus, setModelStatus] = useState({});

    useEffect(() => {
        initializeModels();
    }, []);

    const initializeModels = async () => {
        setIsLoading(true);
        try {
            console.log('🚀 Initializing client-side AI models...');
            const success = await clientSideAI.initialize();
            setIsModelLoaded(success);
            setModelStatus(clientSideAI.getStatus());

            if (success) {
                console.log('✅ Models loaded successfully!');
            } else {
                console.error('❌ Failed to load models');
            }
        } catch (error) {
            console.error('❌ Model initialization error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480 }
            });
            videoRef.current.srcObject = stream;
            setCameraActive(true);
        } catch (error) {
            console.error('❌ Camera access error:', error);
            alert('Camera access denied. Please allow camera permissions.');
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const tracks = videoRef.current.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            videoRef.current.srcObject = null;
            setCameraActive(false);
        }
    };

    const captureAndAnalyze = async () => {
        if (!isModelLoaded) {
            alert('Models not loaded yet. Please wait.');
            return;
        }

        if (!videoRef.current || !canvasRef.current) {
            alert('Camera not ready');
            return;
        }

        setIsLoading(true);
        setAnalysis(null);

        try {
            const canvas = canvasRef.current;
            const video = videoRef.current;
            const ctx = canvas.getContext('2d');

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.putImageData(imageData, 0, 0);

            const result = await clientSideAI.analyzeImage(tempCanvas);
            setAnalysis(result);

        } catch (error) {
            console.error('❌ Analysis error:', error);
            setAnalysis({
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
            <h2>🧠 Client-Side AI Analysis</h2>
            <p>Real-time emotion and age detection using TensorFlow.js in your browser</p>

            <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
                <h3>📊 Model Status</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                    <div>
                        <strong>Emotion Model:</strong> {modelStatus.emotionModel ? '✅ Loaded' : '❌ Not Loaded'}
                    </div>
                    <div>
                        <strong>Age Model:</strong> {modelStatus.ageModel ? '✅ Loaded' : '❌ Not Loaded'}
                    </div>
                    <div>
                        <strong>Backend:</strong> {modelStatus.backend || 'client-side-tfjs'}
                    </div>
                    <div>
                        <strong>Ready:</strong> {isModelLoaded ? '✅ Yes' : '❌ No'}
                    </div>
                </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
                <button
                    onClick={initializeModels}
                    disabled={isLoading}
                    style={{
                        marginRight: '10px',
                        padding: '10px 20px',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: isLoading ? 'not-allowed' : 'pointer'
                    }}
                >
                    {isLoading ? '🔄 Loading Models...' : '🚀 Initialize Models'}
                </button>

                {!cameraActive ? (
                    <button
                        onClick={startCamera}
                        style={{
                            marginRight: '10px',
                            padding: '10px 20px',
                            backgroundColor: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer'
                        }}
                    >
                        📹 Start Camera
                    </button>
                ) : (
                    <button
                        onClick={stopCamera}
                        style={{
                            marginRight: '10px',
                            padding: '10px 20px',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer'
                        }}
                    >
                        ⏹️ Stop Camera
                    </button>
                )}

                <button
                    onClick={captureAndAnalyze}
                    disabled={!isModelLoaded || !cameraActive || isLoading}
                    style={{
                        padding: '10px 20px',
                        backgroundColor: isModelLoaded && cameraActive ? '#ffc107' : '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: (isModelLoaded && cameraActive && !isLoading) ? 'pointer' : 'not-allowed'
                    }}
                >
                    {isLoading ? '🧠 Analyzing...' : '📸 Capture & Analyze'}
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                    <h3>📹 Camera Feed</h3>
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        style={{
                            width: '100%',
                            maxWidth: '400px',
                            border: '2px solid #ddd',
                            borderRadius: '8px'
                        }}
                    />
                    <canvas
                        ref={canvasRef}
                        style={{ display: 'none' }}
                    />
                </div>

                <div>
                    <h3>🧠 Analysis Results</h3>
                    {analysis ? (
                        <div style={{
                            padding: '15px',
                            backgroundColor: analysis.success ? '#d4edda' : '#f8d7da',
                            border: `1px solid ${analysis.success ? '#c3e6cb' : '#f5c6cb'}`,
                            borderRadius: '8px'
                        }}>
                            {analysis.success ? (
                                <div>
                                    <p><strong>😊 Emotion:</strong> {analysis.emotion} ({(analysis.emotionConfidence * 100).toFixed(1)}%)</p>
                                    <p><strong>👨‍👩‍👧‍👦 Age:</strong> {analysis.age} years ({analysis.ageGroup})</p>
                                    <p><strong>⏱️ Processing Time:</strong> {analysis.processingTime}ms</p>
                                    <p><strong>🕒 Timestamp:</strong> {new Date(analysis.timestamp).toLocaleTimeString()}</p>

                                    <details style={{ marginTop: '10px' }}>
                                        <summary><strong>📊 All Emotions</strong></summary>
                                        <div style={{ marginTop: '5px' }}>
                                            {Object.entries(analysis.allEmotions).map(([emotion, confidence]) => (
                                                <div key={emotion} style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    marginBottom: '2px'
                                                }}>
                                                    <span>{emotion}:</span>
                                                    <span>{(confidence * 100).toFixed(1)}%</span>
                                                </div>
                                            ))}
                                        </div>
                                    </details>
                                </div>
                            ) : (
                                <div>
                                    <p><strong>❌ Error:</strong> {analysis.error || analysis.message}</p>
                                    <p><strong>🕒 Timestamp:</strong> {new Date(analysis.timestamp).toLocaleTimeString()}</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{
                            padding: '15px',
                            backgroundColor: '#e2e3e5',
                            border: '1px solid #d6d8db',
                            borderRadius: '8px',
                            textAlign: 'center'
                        }}>
                            <p>📸 Capture an image to see analysis results</p>
                        </div>
                    )}
                </div>
            </div>

            <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e9ecef', borderRadius: '8px' }}>
                <h4>ℹ️ How it works:</h4>
                <ul>
                    <li>🧠 Models run entirely in your browser using TensorFlow.js</li>
                    <li>📡 No data sent to external servers - complete privacy</li>
                    <li>😊 Emotion detection: 7 classes (Angry, Disgust, Fear, Happy, Neutral, Sad, Surprise)</li>
                    <li>👨‍👩‍👧‍👦 Age prediction with confidence scores</li>
                    <li>⚡ Real-time inference on client-side hardware</li>
                </ul>
            </div>
        </div>
    );
};

export default ClientSideAIInterface;