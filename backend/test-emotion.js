import fetch from 'node-fetch';
import fs from 'fs';

// Create a better test image (base64 encoded 48x48 black square)
const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const testFaceAnalysis = async () => {
    try {
        console.log('🧪 Testing face analysis with TensorFlow.js model...');

        const response = await fetch('http://localhost:3007/api/v1/face-analysis', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image: testImageBase64
            })
        });

        const result = await response.json();
        console.log('📊 Test Result:', JSON.stringify(result, null, 2));

        if (result.success) {
            console.log('✅ Face analysis working!');
            console.log(`😊 Predicted emotion: ${result.predictions.emotion.label}`);
            console.log(`📈 Confidence: ${(result.predictions.emotion.confidence * 100).toFixed(1)}%`);
        } else {
            console.log('❌ Face analysis failed:', result.error);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
};

testFaceAnalysis();