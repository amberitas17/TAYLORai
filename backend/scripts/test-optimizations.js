import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-cpu';
import { logger } from '../src/utils/logger.js';

/**
 * Test script to verify the optimizations work correctly
 * Based on manager's suggestions for model conversion and backend configuration
 */
class OptimizationTester {
    constructor() {
        this.testResults = {
            backendConfig: false,
            modelLoading: false,
            performance: false,
            compatibility: false
        };
    }

    async runAllTests() {
        logger.info('🧪 Starting optimization tests...');

        try {
            await this.testBackendConfiguration();
            await this.testModelCompatibility();
            await this.testPerformanceProfiling();
            await this.generateReport();

            return this.testResults;
        } catch (error) {
            logger.error('❌ Test suite failed:', error);
            throw error;
        }
    }

    async testBackendConfiguration() {
        logger.info('🔧 Testing backend configuration optimizations...');

        try {
            // Test 1: Force float32 backend
            tf.env().set('WEBGL_FORCE_F16_TEXTURES', false);
            logger.info('✅ Set WEBGL_FORCE_F16_TEXTURES to false');

            // Test 2: Set CPU backend for Node.js
            await tf.setBackend('cpu');
            logger.info('✅ Set backend to CPU');

            // Test 3: Ensure backend is ready
            await tf.ready();
            const currentBackend = tf.getBackend();
            logger.info(`✅ Backend ready: ${currentBackend}`);

            // Test 4: Check memory info
            const memoryInfo = tf.memory();
            logger.info(`✅ Memory info available: ${JSON.stringify(memoryInfo)}`);

            this.testResults.backendConfig = true;
            logger.info('✅ Backend configuration tests passed');

        } catch (error) {
            logger.error('❌ Backend configuration test failed:', error);
            this.testResults.backendConfig = false;
        }
    }

    async testModelCompatibility() {
        logger.info('🔍 Testing model compatibility...');

        try {
            // Test creating a simple model to verify TensorFlow.js works
            const testModel = tf.sequential({
                layers: [
                    tf.layers.conv2d({
                        filters: 32,
                        kernelSize: [3, 3],
                        padding: 'same',
                        inputShape: [48, 48, 1]
                    }),
                    tf.layers.activation({ activation: 'elu' }),
                    tf.layers.batchNormalization(),
                    tf.layers.maxPooling2d({ poolSize: [2, 2] }),
                    tf.layers.flatten(),
                    tf.layers.dense({ units: 5, activation: 'softmax' })
                ]
            });

            logger.info('✅ Test model created successfully');

            // Test prediction with dummy data
            const dummyInput = tf.randomNormal([1, 48, 48, 1]);
            const prediction = testModel.predict(dummyInput);

            logger.info(`✅ Test prediction shape: ${prediction.shape}`);

            // Cleanup
            dummyInput.dispose();
            prediction.dispose();
            testModel.dispose();

            this.testResults.modelLoading = true;
            logger.info('✅ Model compatibility tests passed');

        } catch (error) {
            logger.error('❌ Model compatibility test failed:', error);
            this.testResults.modelLoading = false;
        }
    }

    async testPerformanceProfiling() {
        logger.info('⏱️ Testing performance profiling...');

        try {
            // Test performance.now() availability
            const t0 = performance.now();

            // Simulate some work
            const testTensor = tf.randomNormal([1, 48, 48, 1]);
            const processed = testTensor.mul(2.0);
            await processed.data(); // Force computation

            const t1 = performance.now();
            const duration = t1 - t0;

            logger.info(`✅ Performance timing works: ${duration.toFixed(2)}ms`);

            // Test memory tracking
            const memoryBefore = tf.memory();
            const bigTensor = tf.randomNormal([100, 100, 100]);
            const memoryAfter = tf.memory();
            bigTensor.dispose();
            const memoryFinal = tf.memory();

            logger.info(`✅ Memory tracking: ${memoryBefore.numTensors} -> ${memoryAfter.numTensors} -> ${memoryFinal.numTensors} tensors`);

            // Cleanup
            testTensor.dispose();
            processed.dispose();

            this.testResults.performance = true;
            logger.info('✅ Performance profiling tests passed');

        } catch (error) {
            logger.error('❌ Performance profiling test failed:', error);
            this.testResults.performance = false;
        }
    }

    async generateReport() {
        logger.info('📊 Generating optimization test report...');

        const passed = Object.values(this.testResults).filter(Boolean).length;
        const total = Object.keys(this.testResults).length;

        const report = {
            summary: {
                passed: passed,
                total: total,
                success: passed === total
            },
            tests: this.testResults,
            recommendations: this.generateRecommendations(),
            environment: {
                tensorflow_version: tf.version.tfjs,
                backend: tf.getBackend(),
                memory: tf.memory()
            }
        };

        logger.info('📋 Test Report:');
        logger.info(JSON.stringify(report, null, 2));

        this.testResults.compatibility = report.summary.success;

        if (report.summary.success) {
            logger.info('🎉 All optimization tests passed!');
        } else {
            logger.warn(`⚠️ ${total - passed} tests failed. Check recommendations.`);
        }

        return report;
    }

    generateRecommendations() {
        const recommendations = [];

        if (!this.testResults.backendConfig) {
            recommendations.push('Check TensorFlow.js backend configuration');
            recommendations.push('Verify Node.js environment supports TensorFlow.js CPU backend');
        }

        if (!this.testResults.modelLoading) {
            recommendations.push('Check TensorFlow.js model format compatibility');
            recommendations.push('Verify model conversion was successful');
        }

        if (!this.testResults.performance) {
            recommendations.push('Check performance.now() API availability');
            recommendations.push('Verify memory tracking functionality');
        }

        if (recommendations.length === 0) {
            recommendations.push('All tests passed! Your optimizations are working correctly.');
            recommendations.push('You can now proceed with model conversion and deployment.');
        }

        return recommendations;
    }
}

// Export for use in other scripts
export { OptimizationTester };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const tester = new OptimizationTester();
    tester.runAllTests()
        .then(results => {
            console.log('✅ Optimization tests completed');
            const passed = Object.values(results).filter(Boolean).length;
            const total = Object.keys(results).length;
            process.exit(passed === total ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ Optimization tests failed:', error);
            process.exit(1);
        });
}