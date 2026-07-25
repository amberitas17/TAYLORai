import fetch from 'node-fetch';
import fs from 'fs';
import { EmotionModel } from './src/models/EmotionModel.js';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-cpu';
import { logger } from './src/utils/logger.js';

class EmotionModelValidator {
    constructor() {
        this.model = new EmotionModel();
        this.testImages = [];
        this.results = [];
    }

    async validateModel() {
        try {
            console.log('🧪 Starting emotion model validation...');

            // Initialize model
            await this.model.initialize();

            // Create test cases
            await this.generateTestCases();

            // Run validation tests
            await this.runValidationTests();

            // Generate validation report
            this.generateReport();

            console.log('✅ Model validation completed successfully');

        } catch (error) {
            console.error('❌ Model validation failed:', error);
            throw error;
        }
    }

    async generateTestCases() {
        console.log('📋 Generating test cases...');

        // Test case 1: Simple solid color images
        this.testImages.push({
            name: 'black_square',
            description: 'Black 48x48 square',
            tensor: tf.zeros([1, 48, 48, 1]),
            expectedBehavior: 'Should return valid emotion probabilities'
        });

        // Test case 2: White square
        this.testImages.push({
            name: 'white_square',
            description: 'White 48x48 square',
            tensor: tf.ones([1, 48, 48, 1]),
            expectedBehavior: 'Should return valid emotion probabilities'
        });

        // Test case 3: Random noise
        this.testImages.push({
            name: 'random_noise',
            description: 'Random noise 48x48',
            tensor: tf.randomNormal([1, 48, 48, 1]),
            expectedBehavior: 'Should return normalized probabilities'
        });

        // Test case 4: Gaussian noise (centered)
        this.testImages.push({
            name: 'gaussian_centered',
            description: 'Gaussian noise centered at 0.5',
            tensor: tf.randomNormal([1, 48, 48, 1], 0.5, 0.2),
            expectedBehavior: 'Should handle centered input properly'
        });

        console.log(`✅ Generated ${this.testImages.length} test cases`);
    }

    async runValidationTests() {
        console.log('🔍 Running validation tests...');

        for (const testCase of this.testImages) {
            try {
                console.log(`\n🧪 Testing: ${testCase.name}`);
                console.log(`📝 Description: ${testCase.description}`);

                // Create mock face detection result
                const mockFace = {
                    box: { x: 0, y: 0, width: 48, height: 48 },
                    confidence: 0.9
                };

                // Run prediction
                const startTime = Date.now();
                const result = await this.model.predict(testCase.tensor, [mockFace]);
                const endTime = Date.now();

                // Validate result structure
                const validation = this.validateResult(result, testCase);

                // Store results
                this.results.push({
                    testCase: testCase.name,
                    description: testCase.description,
                    processingTime: endTime - startTime,
                    result: result,
                    validation: validation,
                    passed: validation.isValid
                });

                // Log immediate results
                console.log(`⏱️  Processing time: ${endTime - startTime}ms`);
                console.log(`😊 Predicted emotion: ${result.emotion.predicted}`);
                console.log(`📈 Confidence: ${(result.emotion.confidence * 100).toFixed(1)}%`);
                console.log(`✅ Validation: ${validation.isValid ? 'PASSED' : 'FAILED'}`);

                if (!validation.isValid) {
                    console.log(`❌ Issues: ${validation.issues.join(', ')}`);
                }

            } catch (error) {
                console.error(`❌ Test ${testCase.name} failed:`, error.message);
                this.results.push({
                    testCase: testCase.name,
                    description: testCase.description,
                    error: error.message,
                    passed: false
                });
            }
        }

        console.log('\n✅ All validation tests completed');
    }

    validateResult(result, testCase) {
        const issues = [];
        let isValid = true;

        // Check result structure
        if (!result || typeof result !== 'object') {
            issues.push('Result is not an object');
            isValid = false;
        }

        if (!result.emotion) {
            issues.push('Missing emotion property');
            isValid = false;
        } else {
            // Check emotion properties
            if (!result.emotion.predicted || typeof result.emotion.predicted !== 'string') {
                issues.push('Invalid predicted emotion');
                isValid = false;
            }

            if (typeof result.emotion.confidence !== 'number' ||
                result.emotion.confidence < 0 || result.emotion.confidence > 1) {
                issues.push('Invalid confidence value');
                isValid = false;
            }

            if (!result.emotion.probabilities || typeof result.emotion.probabilities !== 'object') {
                issues.push('Missing or invalid probabilities');
                isValid = false;
            } else {
                // Check probability sum
                const probSum = Object.values(result.emotion.probabilities).reduce((a, b) => a + b, 0);
                if (Math.abs(probSum - 1.0) > 0.01) {
                    issues.push(`Probabilities don't sum to 1.0 (sum: ${probSum.toFixed(3)})`);
                    isValid = false;
                }

                // Check individual probabilities
                Object.entries(result.emotion.probabilities).forEach(([emotion, prob]) => {
                    if (typeof prob !== 'number' || prob < 0 || prob > 1) {
                        issues.push(`Invalid probability for ${emotion}: ${prob}`);
                        isValid = false;
                    }
                });
            }
        }

        // Check face information
        if (!result.face || !result.face.box) {
            issues.push('Missing face information');
            isValid = false;
        }

        // Check metadata
        if (!result.metadata) {
            issues.push('Missing metadata');
            isValid = false;
        }

        return { isValid, issues };
    }

    generateReport() {
        console.log('\n📊 EMOTION MODEL VALIDATION REPORT');
        console.log('='.repeat(50));

        const totalTests = this.results.length;
        const passedTests = this.results.filter(r => r.passed).length;
        const failedTests = totalTests - passedTests;

        console.log(`📋 Total Tests: ${totalTests}`);
        console.log(`✅ Passed: ${passedTests}`);
        console.log(`❌ Failed: ${failedTests}`);
        console.log(`📈 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

        if (passedTests > 0) {
            const avgProcessingTime = this.results
                .filter(r => r.processingTime)
                .reduce((sum, r) => sum + r.processingTime, 0) / passedTests;
            console.log(`⏱️  Average Processing Time: ${avgProcessingTime.toFixed(1)}ms`);
        }

        console.log('\n📝 Detailed Results:');
        this.results.forEach((result, index) => {
            console.log(`\n${index + 1}. ${result.testCase}`);
            console.log(`   Description: ${result.description}`);
            console.log(`   Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);

            if (result.error) {
                console.log(`   Error: ${result.error}`);
            } else if (result.result) {
                console.log(`   Emotion: ${result.result.emotion.predicted} (${(result.result.emotion.confidence * 100).toFixed(1)}%)`);
                console.log(`   Processing Time: ${result.processingTime}ms`);
            }

            if (result.validation && !result.validation.isValid) {
                console.log(`   Issues: ${result.validation.issues.join(', ')}`);
            }
        });

        console.log('\n🔧 Recommendations:');
        if (failedTests === 0) {
            console.log('✅ Model is working correctly!');
            console.log('✅ All validation tests passed');
            console.log('✅ Output format is consistent');
        } else {
            console.log('⚠️  Some tests failed - check implementation');
            console.log('⚠️  Verify model loading and architecture');
            console.log('⚠️  Check preprocessing pipeline');
        }

        // Save detailed report to file
        const reportData = {
            timestamp: new Date().toISOString(),
            summary: {
                totalTests,
                passedTests,
                failedTests,
                successRate: (passedTests / totalTests) * 100
            },
            results: this.results
        };

        const reportPath = './emotion-model-validation-report.json';
        fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
        console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    }

    async dispose() {
        // Clean up test tensors
        this.testImages.forEach(testImage => {
            if (testImage.tensor) {
                testImage.tensor.dispose();
            }
        });

        // Dispose model
        await this.model.dispose();

        console.log('🧹 Cleanup completed');
    }
}

// Run validation if script is called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const validator = new EmotionModelValidator();

    validator.validateModel()
        .then(() => {
            console.log('\n🎉 Validation completed successfully!');
            return validator.dispose();
        })
        .then(() => {
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Validation failed:', error);
            validator.dispose().finally(() => {
                process.exit(1);
            });
        });
}

export { EmotionModelValidator };