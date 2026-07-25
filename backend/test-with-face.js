import fetch from 'node-fetch';
import fs from 'fs';

// Create a simple synthetic face-like pattern (48x48 grayscale)
function createFacePattern() {
    const canvas = new Array(48 * 48 * 4).fill(255); // RGBA

    // Add simple face features
    // Eyes (dark spots)
    for (let y = 15; y < 20; y++) {
        for (let x = 12; x < 17; x++) {
            const idx = (y * 48 + x) * 4;
            canvas[idx] = 50;     // R
            canvas[idx + 1] = 50; // G
            canvas[idx + 2] = 50; // B
        }
        for (let x = 31; x < 36; x++) {
            const idx = (y * 48 + x) * 4;
            canvas[idx] = 50;
            canvas[idx + 1] = 50;
            canvas[idx + 2] = 50;
        }
    }

    // Mouth (dark line - neutral expression)
    for (let x = 18; x < 30; x++) {
        const idx = (32 * 48 + x) * 4;
        canvas[idx] = 80;
        canvas[idx + 1] = 80;
        canvas[idx + 2] = 80;
    }

    return Buffer.from(canvas);
}

// Convert buffer to base64 PNG
function bufferToPng(buffer, width, height) {
    // Simple PNG creation (mock - for testing we'll use a different approach)
    return Buffer.from(buffer).toString('base64');
}

const testWithFacePattern = async () => {
    try {
        console.log('🧪 Testing emotion model with synthetic face pattern...');

        // Create different "emotional" patterns
        const testCases = [
            {
                name: 'Neutral Face',
                description: 'Basic face pattern with neutral expression',
                // Simple base64 encoded small image
                image: '/9j/4AAQSkZJRgABAQEAAAAAAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwC7AB+p/9k='
            }
        ];

        for (const testCase of testCases) {
            console.log(`\n🔬 Testing: ${testCase.name}`);
            console.log(`📝 Description: ${testCase.description}`);

            const response = await fetch('http://localhost:3005/api/v1/face-analysis', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    image: testCase.image
                })
            });

            const result = await response.json();
            console.log('📊 Full Result:', JSON.stringify(result, null, 2));

            if (result.success && result.predictions) {
                console.log('✅ Analysis successful!');

                if (result.predictions.emotion) {
                    const emotion = result.predictions.emotion;
                    console.log(`😊 Emotion: ${emotion.label || emotion.predicted}`);
                    console.log(`📈 Confidence: ${(emotion.confidence * 100).toFixed(1)}%`);

                    if (emotion.probabilities || emotion.all) {
                        const probs = emotion.probabilities || emotion.all;
                        console.log('🎭 All emotions:');
                        Object.entries(probs)
                            .sort(([,a], [,b]) => b - a)
                            .forEach(([emo, prob]) => {
                                console.log(`   ${emo}: ${(prob * 100).toFixed(1)}%`);
                            });
                    }
                }

                if (result.predictions.faces) {
                    console.log(`👥 Faces detected: ${result.predictions.faces.length}`);
                    result.predictions.faces.forEach((face, i) => {
                        console.log(`   Face ${i + 1}: confidence ${(face.confidence * 100).toFixed(1)}%`);
                    });
                }
            } else {
                console.log('❌ Analysis failed:', result.error || 'Unknown error');
            }
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
};

// Run the test
testWithFacePattern();