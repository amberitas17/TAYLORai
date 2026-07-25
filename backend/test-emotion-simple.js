import fetch from 'node-fetch';
import fs from 'fs';

// Simple base64 test image (48x48 black square)
const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const testEmotionModelQuality = async () => {
    try {
        console.log('🧪 Testing improved emotion model quality...');
        console.log('📊 Running multiple tests to compare consistency...');

        const tests = [];
        const numTests = 5;

        // Run multiple predictions with the same image
        for (let i = 0; i < numTests; i++) {
            console.log(`\n🔄 Test ${i + 1}/${numTests}...`);

            const response = await fetch('http://localhost:3009/api/v1/face-analysis', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    image: testImageBase64
                })
            });

            const result = await response.json();

            if (result.success && result.predictions && result.predictions.emotion) {
                const emotion = result.predictions.emotion;
                tests.push({
                    test: i + 1,
                    predicted: emotion.label || emotion.predicted,
                    confidence: emotion.confidence,
                    probabilities: emotion.probabilities || emotion.all || {},
                    processingTime: result.processingTime || 'N/A'
                });

                console.log(`😊 Predicted: ${emotion.label || emotion.predicted}`);
                console.log(`📈 Confidence: ${(emotion.confidence * 100).toFixed(1)}%`);
                console.log(`⏱️  Time: ${result.processingTime || 'N/A'}ms`);

                // Show top 3 emotions
                if (emotion.probabilities || emotion.all) {
                    const probs = emotion.probabilities || emotion.all;
                    const sorted = Object.entries(probs)
                        .sort(([,a], [,b]) => b - a)
                        .slice(0, 3);

                    console.log('🏆 Top 3 emotions:');
                    sorted.forEach(([emo, prob], idx) => {
                        console.log(`   ${idx + 1}. ${emo}: ${(prob * 100).toFixed(1)}%`);
                    });
                }
            } else {
                console.log('❌ Test failed:', result.error || 'Unknown error');
                tests.push({
                    test: i + 1,
                    error: result.error || 'Unknown error'
                });
            }

            // Small delay between tests
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Analyze results
        console.log('\n📊 QUALITY ANALYSIS REPORT');
        console.log('='.repeat(50));

        const successfulTests = tests.filter(t => !t.error);
        const failedTests = tests.filter(t => t.error);

        console.log(`✅ Successful tests: ${successfulTests.length}/${numTests}`);
        console.log(`❌ Failed tests: ${failedTests.length}/${numTests}`);

        if (successfulTests.length > 0) {
            // Check consistency
            const predictions = successfulTests.map(t => t.predicted);
            const uniquePredictions = [...new Set(predictions)];

            console.log(`\n🎯 Prediction Consistency:`);
            console.log(`   Unique predictions: ${uniquePredictions.length}`);
            console.log(`   Most common: ${getMostCommon(predictions)}`);

            // Confidence analysis
            const confidences = successfulTests.map(t => t.confidence);
            const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
            const minConfidence = Math.min(...confidences);
            const maxConfidence = Math.max(...confidences);

            console.log(`\n📈 Confidence Analysis:`);
            console.log(`   Average: ${(avgConfidence * 100).toFixed(1)}%`);
            console.log(`   Range: ${(minConfidence * 100).toFixed(1)}% - ${(maxConfidence * 100).toFixed(1)}%`);
            console.log(`   Std Dev: ${calculateStdDev(confidences).toFixed(3)}`);

            // Quality indicators
            console.log(`\n🔍 Quality Indicators:`);
            console.log(`   Consistency: ${uniquePredictions.length === 1 ? '✅ Perfect' : '⚠️ Variable'}`);
            console.log(`   Confidence: ${avgConfidence > 0.6 ? '✅ High' : avgConfidence > 0.3 ? '⚠️ Medium' : '❌ Low'}`);
            console.log(`   Stability: ${calculateStdDev(confidences) < 0.1 ? '✅ Stable' : '⚠️ Variable'}`);

            // Show detailed results
            console.log(`\n📋 Detailed Results:`);
            successfulTests.forEach(test => {
                console.log(`   Test ${test.test}: ${test.predicted} (${(test.confidence * 100).toFixed(1)}%) - ${test.processingTime}ms`);
            });
        }

        if (failedTests.length > 0) {
            console.log(`\n❌ Failed Tests:`);
            failedTests.forEach(test => {
                console.log(`   Test ${test.test}: ${test.error}`);
            });
        }

        // Overall assessment
        console.log(`\n🎉 OVERALL ASSESSMENT:`);
        if (successfulTests.length === numTests) {
            console.log('✅ Model is working correctly');
            console.log('✅ All tests completed successfully');

            const uniquePredictions = [...new Set(successfulTests.map(t => t.predicted))];
            if (uniquePredictions.length === 1) {
                console.log('✅ Predictions are consistent');
            } else {
                console.log('⚠️ Predictions vary - this might indicate processing issues');
            }

            const avgConfidence = successfulTests.reduce((sum, t) => sum + t.confidence, 0) / successfulTests.length;
            if (avgConfidence > 0.5) {
                console.log('✅ Good confidence levels');
            } else {
                console.log('⚠️ Low confidence - model may need improvement');
            }
        } else {
            console.log('❌ Some tests failed - check server and model');
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
};

function getMostCommon(arr) {
    const counts = {};
    arr.forEach(item => counts[item] = (counts[item] || 0) + 1);
    return Object.entries(counts).sort(([,a], [,b]) => b - a)[0][0];
}

function calculateStdDev(values) {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
    return Math.sqrt(avgSquareDiff);
}

// Check if server is running first
const checkServer = async () => {
    try {
        const response = await fetch('http://localhost:3009/health');
        if (response.ok) {
            console.log('✅ Server is running');
            return true;
        }
    } catch (error) {
        console.log('❌ Server is not running. Please start the server first:');
        console.log('   npm start');
        return false;
    }
};

// Run the test
checkServer().then(serverRunning => {
    if (serverRunning) {
        testEmotionModelQuality();
    }
});