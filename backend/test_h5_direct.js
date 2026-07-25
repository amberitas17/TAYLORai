import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-node';
import { readFileSync } from 'fs';
import { join } from 'path';

async function testH5DirectLoad() {
    console.log('🧠 Testing direct H5 model loading with TensorFlow.js Node...');
    console.log('📊 TensorFlow.js version:', tf.version.tfjs);
    console.log('📊 Backend:', tf.getBackend());

    try {
        // Try to load H5 model directly with tfjs-node
        const modelPath = './models/emotion_vgg.h5';
        console.log('📁 Loading H5 model from:', modelPath);

        // Load the model directly
        const model = await tf.loadLayersModel(`file://${join(process.cwd(), modelPath)}`);
        console.log('✅ H5 model loaded successfully with tfjs-node!');
        console.log('📊 Input shape:', model.inputs[0].shape);
        console.log('📊 Output shape:', model.outputs[0].shape);

        // Test prediction with random input
        console.log('\n🧪 Testing model prediction...');
        const testInput = tf.randomNormal([1, 48, 48, 1]);
        const prediction = model.predict(testInput);
        const predData = await prediction.data();

        console.log('📊 Prediction shape:', prediction.shape);
        console.log('📊 Prediction values:', Array.from(predData));
        console.log('📊 Sum of probabilities:', Array.from(predData).reduce((a, b) => a + b, 0));

        // Clean up
        testInput.dispose();
        prediction.dispose();

        return true;
    } catch (error) {
        console.error('❌ Direct H5 loading failed:', error.message);
        return false;
    }
}

// Run the test
testH5DirectLoad().then(success => {
    if (success) {
        console.log('\n✅ Direct H5 loading works! This approach should preserve full accuracy.');
        console.log('💡 Recommendation: Use tfjs-node backend for direct H5 loading');
    } else {
        console.log('\n❌ Direct H5 loading failed');
    }
    process.exit(success ? 0 : 1);
});