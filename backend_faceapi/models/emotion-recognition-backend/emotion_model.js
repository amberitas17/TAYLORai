const tf = require('@tensorflow/tfjs');
// Set platform to use CPU backend
tf.setBackend('cpu');
const fs = require('fs');

class EmotionRecognitionModel {
    constructor() {
        this.model = null;
        this.classLabels = ["Angry", "Happy", "Neutral", "Sad", "Surprise"];
        this.weights = null;
        this.architecture = null;
        this.isInitialized = false;
    }

    async loadData() {
        try {
            const weightsPath = './model_weights/weights.json';
            const archPath = './model_weights/architecture.json';

            if (!fs.existsSync(weightsPath) || !fs.existsSync(archPath)) {
                throw new Error('Model files not found. Ensure model_weights/ directory exists.');
            }

            this.weights = JSON.parse(fs.readFileSync(weightsPath, 'utf8'));
            this.architecture = JSON.parse(fs.readFileSync(archPath, 'utf8'));

            console.log('✓ Weights and architecture loaded successfully');
            console.log(`✓ Found ${Object.keys(this.weights).length} weight tensors`);
            return true;
        } catch (error) {
            console.error('Error loading data:', error.message);
            return false;
        }
    }

    createModel() {
        try {
            // Create the model architecture based on the extracted architecture
            const input = tf.input({shape: [48, 48, 1]});
            let x = input;

            // First conv block (32 filters)
            x = tf.layers.conv2d({
                filters: 32,
                kernelSize: [3, 3],
                activation: 'elu',
                padding: 'same',
                name: 'conv2d_1'
            }).apply(x);

            x = tf.layers.batchNormalization({name: 'batch_normalization_1'}).apply(x);

            x = tf.layers.conv2d({
                filters: 32,
                kernelSize: [3, 3],
                activation: 'elu',
                padding: 'same',
                name: 'conv2d_2'
            }).apply(x);

            x = tf.layers.batchNormalization({name: 'batch_normalization_2'}).apply(x);
            x = tf.layers.maxPooling2d({poolSize: [2, 2]}).apply(x);
            x = tf.layers.dropout({rate: 0.2}).apply(x);

            // Second conv block (64 filters)
            x = tf.layers.conv2d({
                filters: 64,
                kernelSize: [3, 3],
                activation: 'elu',
                padding: 'same',
                name: 'conv2d_3'
            }).apply(x);

            x = tf.layers.batchNormalization({name: 'batch_normalization_3'}).apply(x);

            x = tf.layers.conv2d({
                filters: 64,
                kernelSize: [3, 3],
                activation: 'elu',
                padding: 'same',
                name: 'conv2d_4'
            }).apply(x);

            x = tf.layers.batchNormalization({name: 'batch_normalization_4'}).apply(x);
            x = tf.layers.maxPooling2d({poolSize: [2, 2]}).apply(x);
            x = tf.layers.dropout({rate: 0.2}).apply(x);

            // Third conv block (128 filters)
            x = tf.layers.conv2d({
                filters: 128,
                kernelSize: [3, 3],
                activation: 'elu',
                padding: 'same',
                name: 'conv2d_5'
            }).apply(x);

            x = tf.layers.batchNormalization({name: 'batch_normalization_5'}).apply(x);

            x = tf.layers.conv2d({
                filters: 128,
                kernelSize: [3, 3],
                activation: 'elu',
                padding: 'same',
                name: 'conv2d_6'
            }).apply(x);

            x = tf.layers.batchNormalization({name: 'batch_normalization_6'}).apply(x);
            x = tf.layers.maxPooling2d({poolSize: [2, 2]}).apply(x);
            x = tf.layers.dropout({rate: 0.2}).apply(x);

            // Fourth conv block (256 filters)
            x = tf.layers.conv2d({
                filters: 256,
                kernelSize: [3, 3],
                activation: 'elu',
                padding: 'same',
                name: 'conv2d_7'
            }).apply(x);

            x = tf.layers.batchNormalization({name: 'batch_normalization_7'}).apply(x);

            x = tf.layers.conv2d({
                filters: 256,
                kernelSize: [3, 3],
                activation: 'elu',
                padding: 'same',
                name: 'conv2d_8'
            }).apply(x);

            x = tf.layers.batchNormalization({name: 'batch_normalization_8'}).apply(x);
            x = tf.layers.maxPooling2d({poolSize: [2, 2]}).apply(x);
            x = tf.layers.dropout({rate: 0.2}).apply(x);

            // Dense layers
            x = tf.layers.flatten().apply(x);

            x = tf.layers.dense({
                units: 64,
                activation: 'elu',
                name: 'dense_1'
            }).apply(x);

            x = tf.layers.batchNormalization({name: 'batch_normalization_9'}).apply(x);
            x = tf.layers.dropout({rate: 0.5}).apply(x);

            x = tf.layers.dense({
                units: 64,
                activation: 'elu',
                name: 'dense_2'
            }).apply(x);

            x = tf.layers.batchNormalization({name: 'batch_normalization_10'}).apply(x);
            x = tf.layers.dropout({rate: 0.5}).apply(x);

            const output = tf.layers.dense({
                units: 5,
                activation: 'softmax',
                name: 'dense_3'
            }).apply(x);

            this.model = tf.model({inputs: input, outputs: output});
            console.log('✓ Model architecture created');
            return true;

        } catch (error) {
            console.error('Error creating model:', error.message);
            return false;
        }
    }

    setWeights() {
        if (!this.model || !this.weights) {
            console.error('Model or weights not loaded');
            return false;
        }

        try {
            // Set weights for each layer
            const layers = this.model.layers;

            for (let layer of layers) {
                const layerName = layer.name;

                // Conv2D layers
                if (layerName.startsWith('conv2d_')) {
                    const kernelKey = `${layerName}_kernel`;
                    const biasKey = `${layerName}_bias`;

                    if (this.weights[kernelKey] && this.weights[biasKey]) {
                        const kernel = tf.tensor(this.weights[kernelKey]);
                        const bias = tf.tensor(this.weights[biasKey]);
                        layer.setWeights([kernel, bias]);
                        console.log(`✓ Set weights for ${layerName}`);
                    }
                }

                // Dense layers
                if (layerName.startsWith('dense_')) {
                    const kernelKey = `${layerName}_kernel`;
                    const biasKey = `${layerName}_bias`;

                    if (this.weights[kernelKey] && this.weights[biasKey]) {
                        const kernel = tf.tensor(this.weights[kernelKey]);
                        const bias = tf.tensor(this.weights[biasKey]);
                        layer.setWeights([kernel, bias]);
                        console.log(`✓ Set weights for ${layerName}`);
                    }
                }

                // BatchNormalization layers
                if (layerName.startsWith('batch_normalization_')) {
                    const gammaKey = `${layerName}_gamma`;
                    const betaKey = `${layerName}_beta`;
                    const meanKey = `${layerName}_moving_mean`;
                    const varKey = `${layerName}_moving_variance`;

                    if (this.weights[gammaKey] && this.weights[betaKey] &&
                        this.weights[meanKey] && this.weights[varKey]) {
                        const gamma = tf.tensor(this.weights[gammaKey]);
                        const beta = tf.tensor(this.weights[betaKey]);
                        const mean = tf.tensor(this.weights[meanKey]);
                        const variance = tf.tensor(this.weights[varKey]);
                        layer.setWeights([gamma, beta, mean, variance]);
                        console.log(`✓ Set weights for ${layerName}`);
                    }
                }
            }

            console.log('✓ All weights set successfully');
            return true;

        } catch (error) {
            console.error('Error setting weights:', error.message);
            return false;
        }
    }

    async initialize() {
        if (this.isInitialized) {
            return true;
        }

        console.log('Initializing Emotion Recognition Model...');

        const dataLoaded = await this.loadData();
        if (!dataLoaded) return false;

        const modelCreated = this.createModel();
        if (!modelCreated) return false;

        const weightsSet = this.setWeights();
        if (!weightsSet) return false;

        this.isInitialized = true;
        console.log('✓ Model initialized successfully!');
        return true;
    }

    preprocessImage(imageData) {
        // Ensure image is 48x48x1 and normalized to [0,1]
        let tensor;

        if (Array.isArray(imageData)) {
            // Convert array to tensor
            tensor = tf.tensor(imageData).reshape([1, 48, 48, 1]);
        } else if (imageData.shape) {
            // Already a tensor
            tensor = imageData.reshape([1, 48, 48, 1]);
        } else {
            throw new Error('Invalid image data format');
        }

        // Normalize to [0, 1] range (same as /255.0 in Python)
        tensor = tensor.div(255.0);

        return tensor;
    }

    async predict(imageData) {
        if (!this.isInitialized) {
            throw new Error('Model not initialized. Call initialize() first.');
        }

        const inputTensor = this.preprocessImage(imageData);
        const prediction = this.model.predict(inputTensor);
        const probabilities = await prediction.data();

        // Find the class with highest probability
        const maxIndex = probabilities.indexOf(Math.max(...probabilities));
        const confidence = probabilities[maxIndex];

        // Clean up tensors
        inputTensor.dispose();
        prediction.dispose();

        return {
            emotion: this.classLabels[maxIndex],
            confidence: confidence,
            probabilities: Array.from(probabilities),
            allPredictions: this.classLabels.map((label, i) => ({
                emotion: label,
                probability: probabilities[i]
            }))
        };
    }

    dispose() {
        if (this.model) {
            this.model.dispose();
            this.model = null;
        }
        this.isInitialized = false;
    }
}

module.exports = EmotionRecognitionModel;