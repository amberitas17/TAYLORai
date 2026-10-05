/**
 * Frontend exhibit detection service using REAL TensorFlow.js model CLIENT-SIDE
 * Uses the actual yolo_tiny_tfjs model converted from your PyTorch model
 */

import * as tf from '@tensorflow/tfjs';
import * as ort from 'onnxruntime-web';
import * as faceapi from 'face-api.js';

export const EXHIBIT_MODEL_STATES = Object.freeze({
    CAMERA_READY: 'CAMERA_READY',
    MODEL_LOADING: 'MODEL_LOADING',
    MODEL_READY: 'MODEL_READY',
    OFFLINE_MODEL_READY: 'OFFLINE_MODEL_READY',
    MODEL_DOWNLOAD_REQUIRED: 'MODEL_DOWNLOAD_REQUIRED',
    MODEL_LOAD_ERROR: 'MODEL_LOAD_ERROR'
});

export const EXHIBIT_ZONE_STATES = Object.freeze({
    FABLAB_READY: 'FABLAB_READY',
    ARICC_READY: 'ARICC_READY',
    RECON_READY: 'RECON_READY',
    CAESAR_READY: 'CAESAR_READY'
});

const MODEL_ASSET_VERSION = '20261004-recon-unified-v1';
const MODEL_CACHE_NAME = `taylor-model-resources-${MODEL_ASSET_VERSION}`;
const MODEL_REQUEST_TIMEOUT_MS = 8000;
const MODEL_RETRY_DELAYS_MS = [500, 1500, 3500];
const RECOGNITION_MIN_CONFIDENCE = 0.80;
const RECOGNITION_MIN_MARGIN = 0.15;
const RUNTIME_ASSETS = [
    '/ort/ort-wasm.wasm',
    '/ort/ort-wasm-simd.wasm',
    '/ort/ort-wasm-simd-threaded.wasm',
    '/ort/ort-wasm-simd-threaded.jsep.wasm'
];
const ZONE_RESOURCES = Object.freeze({
    fablab: [
        ['/models/fablab/fablab_classifier.onnx', 'fablab_classifier.onnx'],
        ['/models/fablab/fablab_classifier_metadata.json', 'fablab_classifier_metadata.json']
    ],
    aricc: [
        ['/models/aricc/aricc_classifier.onnx', 'aricc_classifier.onnx'],
        ['/models/aricc/aricc_classifier_metadata.json', 'aricc_classifier_metadata.json']
    ],
    recon: [
        ['/models/recon/recon_classifier.onnx', 'recon_classifier.onnx'],
        ['/models/recon/recon_classifier_metadata.json', 'recon_classifier_metadata.json']
    ],
    caesar: [
        ['/models/caesar/caesar_classifier.onnx', 'caesar_classifier.onnx'],
        ['/models/caesar/caesar_classifier_metadata.json', 'caesar_classifier_metadata.json']
    ]
});
const SHARED_RESOURCES = [
    ['/models/exhibit_gate/exhibit_gate.onnx', 'exhibit_gate.onnx'],
    ['/models/exhibit_gate/exhibit_gate_metadata.json', 'exhibit_gate_metadata.json'],
    ['/models/exhibit_gate/gate_similarity_index.json', 'gate_similarity_index.json'],
    ['/models/tiny_face_detector_model-weights_manifest.json', 'tiny_face_detector_model-weights_manifest.json'],
    ['/models/tiny_face_detector_model-shard1.bin', 'tiny_face_detector_model-shard1.bin']
];

// Configure ORT-Web to use matching WASM files (OpenAI solution)
console.log('🔧 Configuring ORT-Web with matching WASM files...');

// Keep the inference runtime local so a cached model does not depend on WAN access.
ort.env.wasm.wasmPaths = '/ort/';
console.log('wasmPaths:', ort.env.wasm.wasmPaths);

// Keep SIMD on; disable threads unless you have COOP/COEP
ort.env.wasm.simd = true;
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;

console.log('✅ ORT-Web configuration complete');

class ExhibitDetectionService {
    constructor() {
        this.gateModel = null; // Binary exhibit/background gate
        this.gateMetadata = null;
        this.gateSimilarityIndex = null;
        this.gateOnlyMode = false;
        this.model = null;  // Main exhibit/background label model
        // Zone-specific classifiers
        this.atModel = null;   // Atrium classifier
        this.btnModel = null;  // Bioethics classifier
        this.ccpModel = null;  // Climate Changed classifier
        this.dwtModel = null;  // Dialogue with Time classifier
        this.eapModel = null;  // Earth Alive Planet classifier
        this.egnModel = null;  // Energy Story classifier
        this.ariccModel = null; // ARICC exhibit classifier
        this.reconModel = null; // RECON Center exhibit classifier
        this.fablabModel = null; // FABLAB equipment classifier
        this.caesarModel = null; // CAESAR equipment classifier
        this.macModel = null;  // Mechanics Alive classifier
        this.mepModel = null;  // Mind Eye classifier
        this.qsModel = null;   // Quanta School classifier
        this.umpModel = null;  // Urban Mutations classifier
        this.svModel = null;   // Savage Garden classifier
        this.kypModel = null;   // Savage Garden classifier
        this.esModel = null;   // Everyday Science classifier
        this.gvModel = null;   // Going Viral classifier
        this.scsModel = null;   // Some Call It Science classifier
        this.fmModel = null;   // Future Makers classifier
        this.pbModel = null;   // Phobias classifier
        this.mmModel = null;   // Mirror maze classifier
        this.tsModel = null;   // Tinkering Studio classifier
        this.snpModel = null;  // Smart Nation Playscape classifier
        this.kgModel = null;   // Kinetic Garden classifier
        this.lmgiModel = null; // Lazer Maze + Giant Isotrope classifier
        this.egModel = null;   // Ecogarden classifier
        this.wwModel = null;   // Waterworks classifier

        // Metadata for all models
        this.metadata = null;
        this.atMetadata = null;
        this.btnMetadata = null;
        this.ccpMetadata = null;
        this.dwtMetadata = null;
        this.eapMetadata = null;
        this.egnMetadata = null;
        this.ariccMetadata = null;
        this.reconMetadata = null;
        this.fablabMetadata = null;
        this.caesarMetadata = null;
        this.macMetadata = null;
        this.mepMetadata = null;
        this.qsMetadata = null;
        this.umpMetadata = null;
        this.svMetadata = null;   // Savage Garden classifier
        this.kypMetadata = null;   // Savage Garden classifier
        this.esMetadata = null;   // Everyday Science classifier
        this.gvMetadata = null;   // Going Viral classifier
        this.scsMetadata = null;   // Some Call It Science classifier
        this.fmMetadata = null;   // Future Makers classifier
        this.pbMetadata = null;   // Phobias classifier
        this.mmMetadata = null;   // Mirror maze classifier
        this.tsMetadata = null;   // Tinkering Studio classifier
        this.snpMetadata = null;  // Smart Nation Playscape classifier
        this.kgMetadata = null;   // Kinetic Garden classifier
        this.lmgiMetadata = null; // Lazer Maze + Giant Isotrope classifier
        this.egMetadata = null;   // Ecogarden classifier
        this.wwMetadata = null;   // Waterworks classifier
        this.isInitialized = false;
        this.backendUrl = 'http://localhost:5000';
        this.realMetadataPath = '/models/exhibit_metadata.json';
        this.useSimilarityGate = true;
        this.gateConfig = {
            inputSize: 224,
            threshold: 0.5,
            classes: ['background', 'exhibit'],
            exhibitClassIndex: 1
        };
        this.rejectedFrameLogKey = 'scienceCentreRejectedFrames';
        this.rejectedFrameLogLimit = 50;
        this.classifierMode = 'aricc';
        this.initializedMode = null;
        this.faceDetectorReady = false;
        this.faceDetectorLoad = null;
        this.firstInferenceLogged = false;
        this.modelState = EXHIBIT_MODEL_STATES.CAMERA_READY;
        this.modelLoadStartedAt = 0;
        this.modelLoadTimeMs = 0;
        this.modelCacheHits = 0;
        this.modelNetworkDownloads = 0;
        this.runtimeState = 'RUNTIME_LOADING';
        this.zoneStates = {
            fablab: 'MODEL_LOADING',
            aricc: 'MODEL_LOADING',
            recon: 'MODEL_LOADING',
            caesar: 'MODEL_LOADING'
        };
        this.resourceDiagnostics = {};
        this.runtimeReadyPromise = null;
        this.zoneLoadPromises = new Map();
        this.prefetchPromise = null;
        this.cacheOnly = false;

        // Model configuration (will be updated from real metadata)
        this.config = {
            inputSize: 224,
            scoreThreshold: 0.7,
            classes: ['AT', 'BTN', 'CCP', 'DWT', 'EAP', 'EGN', 'MAC', 'MEP', 'QS', 'UMP', 'SV', 'KYP', 'ES', 'GV', 'SCS', 'FM', 'PB', 'MM', 'TS', 'SNP', 'KG', 'LMGI', 'EG', 'WW'],
            exhibitMapping: {
                'AT': 'Atrium',
                'BTN': 'Bioethics',
                'CCP': 'Climate Changed',
                'DWT': 'Dialogue with Time',
                'EAP': 'Earth Alive Planet',
                'EGN': 'Energy Story',
                'MAC': 'Mechanics Alive',
                'MEP': 'Mind Eye',
                'QS': 'Quanta School',
                'UMP': 'Urban Mutations',
                'SV': "Savage Garden",
                'KYP': 'Know Your Poo',
                'ES': 'Everyday Science',
                'GV': 'Going Viral',
                'SCS': 'Some Call it Science',
                'FM': 'Future Makers',
                'PB': 'Phobia',
                'MM': 'Mirror Maze',
                'TS': 'Tinkering Studio',
                'SNP': 'Smart Nation Playscape',
                'KG': 'Kinetic Garden',
                'LMGI': 'Lazer Maze + Giant Isotrope',
                'EG': 'Ecogarden',
                'WW': 'Waterworks'
            },
            accuracy: 0.9772, 
            useRealModel: true
        };
    }
    /**
 * Draws a bounding box given actual coordinates (for ROI/focused detection)
 * @param {HTMLCanvasElement|CanvasRenderingContext2D} canvasOrCtx
 * @param {Object} box {x, y, width, height}
 * @param {Object} options {boxColor, label}
 */
drawFocusBoundingBox(canvasOrCtx, box, options = {}) {
    const ctx = canvasOrCtx instanceof CanvasRenderingContext2D
        ? canvasOrCtx
        : canvasOrCtx.getContext('2d');
    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = options.boxColor || 'orange';
    ctx.globalAlpha = 0.9;
    ctx.strokeRect(box.x, box.y, box.width, box.height);

    if (options.label) {
        ctx.font = '16px Arial';
        ctx.fillStyle = options.boxColor || 'orange';
        ctx.fillText(options.label, box.x + 6, box.y - 12);
    }
    ctx.restore();
}

    async initialize(options = {}) {
        const requestedMode = options.classifier || 'aricc';
        if (this.isInitialized && this.initializedMode === requestedMode) {
            return;
        }
        this.classifierMode = requestedMode;
        const initializationStartedAt = performance.now();
        this.modelState = EXHIBIT_MODEL_STATES.MODEL_LOADING;
        this.modelLoadStartedAt = initializationStartedAt;
        this.modelCacheHits = 0;
        this.modelNetworkDownloads = 0;
        this.cacheOnly = Boolean(options.cacheOnly);
        try {
            console.log('🎯 Model initialization start', {
                modelVersion: MODEL_ASSET_VERSION,
                classifier: requestedMode,
                modelState: this.modelState,
                wasmPath: ort.env.wasm.wasmPaths
            });

            console.log('🔄 Loading shared runtime, exhibit gate, and current zone model');

            await this.ensureRuntimeReady();

            if (!this.gateModel) {
                await this.loadExhibitGateModel();
            }

            await this.loadFaceDetector();

            if (requestedMode === 'recon') {
                await this.loadReconModel();
                this.zoneStates.recon = EXHIBIT_ZONE_STATES.RECON_READY;
                this.gateOnlyMode = false;
            } else if (requestedMode === 'aricc') {
                this.gateOnlyMode = false;
                await this.loadSpecialistModels({ labels: ['ARICC'] });
                this.zoneStates.aricc = EXHIBIT_ZONE_STATES.ARICC_READY;
            } else if (requestedMode === 'fablab') {
                this.gateOnlyMode = false;
                await this.loadFablabModel();
                this.zoneStates.fablab = EXHIBIT_ZONE_STATES.FABLAB_READY;
            } else if (requestedMode === 'caesar') {
                this.gateOnlyMode = false;
                await this.loadCaesarModel();
                this.zoneStates.caesar = EXHIBIT_ZONE_STATES.CAESAR_READY;
            } else {
                try {
                    if (!this.model) {
                        await this.loadMainModel();
                    }
                    this.gateOnlyMode = false;
                    await this.loadSpecialistModels();
                } catch (mainModelError) {
                    console.warn('Main exhibit classifier failed to load; continuing in gate-only mode:', mainModelError.message);
                    this.gateOnlyMode = true;
                }
            }

            this.isInitialized = true;
            this.initializedMode = requestedMode;
            this.modelState = this.modelNetworkDownloads === 0
                ? EXHIBIT_MODEL_STATES.OFFLINE_MODEL_READY
                : EXHIBIT_MODEL_STATES.MODEL_READY;
            this.modelLoadTimeMs = performance.now() - initializationStartedAt;
            console.log(`✅ Model initialization end in ${(performance.now() - initializationStartedAt).toFixed(0)}ms`, {
                modelVersion: MODEL_ASSET_VERSION,
                modelState: this.modelState,
                loadTimeMs: Math.round(this.modelLoadTimeMs),
                cacheHits: this.modelCacheHits,
                networkDownloads: this.modelNetworkDownloads
            });
            if (!this.cacheOnly) {
                void this.prefetchAllZoneModels();
            }

        } catch (error) {
            let initializationError = error;
            this.zoneStates[requestedMode] = this.modelState === EXHIBIT_MODEL_STATES.MODEL_DOWNLOAD_REQUIRED
                ? EXHIBIT_MODEL_STATES.MODEL_DOWNLOAD_REQUIRED
                : EXHIBIT_MODEL_STATES.MODEL_LOAD_ERROR;
            if (!options.cacheOnly && !options.retry) {
                console.warn('⚠️ Retrying recognition initialization from local cache', error.message);
                try {
                    return await this.initialize({ ...options, retry: true, cacheOnly: true });
                } catch (cacheRetryError) {
                    initializationError = cacheRetryError;
                }
            }
            this.modelState = initializationError.code === 'MODEL_DOWNLOAD_REQUIRED' ||
                (this.modelNetworkDownloads === 0 && this.modelCacheHits === 0)
                ? EXHIBIT_MODEL_STATES.MODEL_DOWNLOAD_REQUIRED
                : EXHIBIT_MODEL_STATES.MODEL_LOAD_ERROR;
            this.zoneStates[requestedMode] = this.modelState;
            console.error('❌ ONNX model initialization failed:', initializationError);
            console.error('❌ Model-loading error', {
                modelVersion: MODEL_ASSET_VERSION,
                modelState: this.modelState,
                cacheHits: this.modelCacheHits,
                networkDownloads: this.modelNetworkDownloads,
                elapsedMs: Math.round(performance.now() - initializationStartedAt),
                message: initializationError.message
            });
            throw initializationError;
        }
    }

    async ensureRuntimeReady() {
        if (this.runtimeReadyPromise) return this.runtimeReadyPromise;
        this.runtimeReadyPromise = (async () => {
            console.log('🔧 Runtime initialization start', { wasmPath: ort.env.wasm.wasmPaths });
            await Promise.all(RUNTIME_ASSETS.map((url) => this.fetchModelResource(url, { cacheKey: url })));
            this.runtimeState = 'RUNTIME_READY';
            console.log('✅ Runtime initialization end', { runtimeState: this.runtimeState });
        })().catch((error) => {
            this.runtimeState = 'RUNTIME_LOAD_ERROR';
            this.runtimeReadyPromise = null;
            throw error;
        });
        return this.runtimeReadyPromise;
    }

    getZoneState(zone) {
        return this.zoneStates[zone] || 'MODEL_LOAD_ERROR';
    }

    async prefetchAllZoneModels() {
        if (this.prefetchPromise) return this.prefetchPromise;
        this.prefetchPromise = (async () => {
            console.log('📦 Background recognition prefetch start', { zones: Object.keys(ZONE_RESOURCES) });
            const resources = [...SHARED_RESOURCES, ...Object.values(ZONE_RESOURCES).flat()];
            await Promise.all(resources.map(async ([url, label]) => {
                try {
                    await this.fetchModelResource(url, { cacheKey: url, prefetch: true });
                    console.log(`[CACHE] ${label} READY`);
                } catch (error) {
                    console.warn(`[CACHE] ${label} PREFETCH_FAILED`, error.message);
                }
            }));
            console.log('✅ Background recognition prefetch end');
        })().finally(() => {
            this.prefetchPromise = null;
        });
        return this.prefetchPromise;
    }

    async loadFaceDetector() {
        if (this.faceDetectorReady) return;
        if (!this.faceDetectorLoad) {
            this.faceDetectorLoad = faceapi.nets.tinyFaceDetector.loadFromUri('/models')
                .then(() => {
                    this.faceDetectorReady = true;
                    console.log('✅ Tiny face detector loaded for UNKNOWN person rejection');
                })
                .catch(error => {
                    this.faceDetectorLoad = null;
                        console.warn('⚠️ Tiny face detector unavailable; person rejection is disabled:', error.message);
                });
        }
        await this.faceDetectorLoad;
    }

    async detectPersonOnlyFrame(imageElement) {
        if (!this.faceDetectorReady) return false;
        try {
            const detections = await faceapi.detectAllFaces(
                imageElement,
                new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.6 })
            );
            return detections.length > 0;
        } catch (error) {
            console.warn('⚠️ Person frame check failed; continuing with exhibit gate:', error.message);
            return false;
        }
    }

    async createCachedONNXSession(modelPath, sessionOptions) {
        const createSession = (source) => ort.InferenceSession.create(source, sessionOptions);
        const versionedPath = `${modelPath}${modelPath.includes('?') ? '&' : '?'}v=${MODEL_ASSET_VERSION}`;
        const logResponse = async (response, source) => {
            const buffer = await response.arrayBuffer();
            const contentType = response.headers.get('content-type') || '(missing)';
            const declaredLength = response.headers.get('content-length');
            const prefix = new TextDecoder().decode(buffer.slice(0, 128)).trimStart();
            console.log('ONNX model response:', {
                modelPath,
                source,
                url: response.url || versionedPath,
                status: response.status,
                contentType,
                declaredLength,
                actualByteLength: buffer.byteLength
            });
            if (!response.ok) {
                throw new Error(`Model request failed: ${response.status} ${modelPath}`);
            }
            if (buffer.byteLength < 1024 || prefix.startsWith('<!DOCTYPE') || prefix.startsWith('<html') || prefix.startsWith('{') || prefix.startsWith('version https://git-lfs.github.com/spec')) {
                throw new Error(`Invalid ONNX response for ${modelPath}: received ${contentType}, ${buffer.byteLength} bytes`);
            }
            if (declaredLength && Number(declaredLength) !== buffer.byteLength) {
                throw new Error(`Truncated ONNX response for ${modelPath}: declared ${declaredLength} bytes, received ${buffer.byteLength}`);
            }
            return buffer;
        };
        const response = await this.fetchModelResource(versionedPath);
        const source = response.headers.get('x-taylor-cache-hit') === '1' ? 'cache' : 'network';
        return createSession(await logResponse(response, source));
    }

    async fetchModelResource(url, options = {}) {
        const cacheKey = options.cacheKey || url;
        const normalizedCacheKey = cacheKey.includes('.onnx') && !cacheKey.includes('?')
            ? `${cacheKey}?v=${MODEL_ASSET_VERSION}`
            : cacheKey;
        const requestOptions = { ...options };
        delete requestOptions.cacheKey;
        delete requestOptions.prefetch;

        if (typeof caches !== 'undefined') {
            const cache = await caches.open(MODEL_CACHE_NAME);
            const cached = await cache.match(normalizedCacheKey);
            if (cached) {
                this.modelCacheHits += 1;
                this.resourceDiagnostics[url] = { source: 'CACHE', status: 'HIT' };
                console.log(`[CACHE] ${url.split('/').pop()} HIT`, { modelVersion: MODEL_ASSET_VERSION });
                return cached;
            }
            this.resourceDiagnostics[url] = { source: 'NETWORK', status: 'MISS' };
            console.log(`[CACHE] ${url.split('/').pop()} MISS`, { modelVersion: MODEL_ASSET_VERSION });
            if (this.cacheOnly) {
                const cacheError = new Error(`Required model resource is not cached: ${url}`);
                cacheError.code = 'MODEL_DOWNLOAD_REQUIRED';
                throw cacheError;
            }
        }

        let lastError;
        for (let attempt = 0; attempt <= MODEL_RETRY_DELAYS_MS.length; attempt += 1) {
            const controller = new AbortController();
            const timeout = window.setTimeout(() => controller.abort(), MODEL_REQUEST_TIMEOUT_MS);
            const startedAt = performance.now();
            try {
                console.log(`📥 Model download start: ${url}`, {
                    modelVersion: MODEL_ASSET_VERSION,
                    attempt: attempt + 1
                });
                const response = await fetch(url, {
                    ...requestOptions,
                    cache: 'no-store',
                    signal: controller.signal
                });
                if (!response.ok) throw new Error(`Model resource request failed: ${response.status} ${url}`);
                if (typeof caches !== 'undefined') {
                    const cache = await caches.open(MODEL_CACHE_NAME);
                    await cache.put(normalizedCacheKey, response.clone());
                }
                this.modelNetworkDownloads += 1;
                this.resourceDiagnostics[url] = { source: 'NETWORK', status: 'DOWNLOADED' };
                console.log(`📥 Model download end in ${(performance.now() - startedAt).toFixed(0)}ms: ${url}`, {
                    modelVersion: MODEL_ASSET_VERSION
                });
                return response;
            } catch (error) {
                lastError = error;
                if (attempt === MODEL_RETRY_DELAYS_MS.length) break;
                const delay = MODEL_RETRY_DELAYS_MS[attempt];
                console.warn(`⚠️ Model resource attempt ${attempt + 1} failed; retrying in ${delay}ms: ${url}`, error.message);
                await new Promise((resolve) => window.setTimeout(resolve, delay));
            } finally {
                window.clearTimeout(timeout);
            }
        }
        throw lastError;
    }

    async fetchModelJson(url) {
        const response = await this.fetchModelResource(url);
        const data = await response.json();
        return data;
    }

    async loadReconModel() {
        if (this.reconModel && this.reconMetadata) {
            return;
        }
        const sessionOptions = {
            executionProviders: ['wasm'],
            graphOptimizationLevel: 'all',
            logSeverityLevel: 0
        };
        const modelPath = '/models/recon/recon_classifier.onnx';
        const metadataPath = '/models/recon/recon_classifier_metadata.json';
        console.log('Loading cached RECON Center classifier...');
        this.reconModel = await this.createCachedONNXSession(modelPath, sessionOptions);
        this.reconMetadata = await this.fetchModelJson(metadataPath);
        console.log('RECON classifier loaded:', this.reconMetadata.displayNames);
    }

    async loadFablabModel() {
        if (this.fablabModel && this.fablabMetadata) {
            return;
        }
        const sessionOptions = {
            executionProviders: ['wasm'],
            graphOptimizationLevel: 'all',
            logSeverityLevel: 0
        };
        const modelPath = '/models/fablab/fablab_classifier.onnx';
        const metadataPath = '/models/fablab/fablab_classifier_metadata.json';
        console.log('Loading FABLAB equipment classifier...');
        this.fablabModel = await this.createCachedONNXSession(modelPath, sessionOptions);
        this.fablabMetadata = await this.fetchModelJson(metadataPath);
        console.log('FABLAB classifier loaded:', this.fablabMetadata.displayNames);
    }

    async loadCaesarModel() {
        if (this.caesarModel && this.caesarMetadata) {
            return;
        }
        const sessionOptions = {
            executionProviders: ['wasm'],
            graphOptimizationLevel: 'all',
            logSeverityLevel: 0
        };
        const modelPath = '/models/caesar/caesar_classifier.onnx';
        const metadataPath = '/models/caesar/caesar_classifier_metadata.json';
        console.log('Loading CAESAR equipment classifier...');
        this.caesarModel = await this.createCachedONNXSession(modelPath, sessionOptions);
        this.caesarMetadata = await this.fetchModelJson(metadataPath);
        console.log('CAESAR classifier loaded:', this.caesarMetadata.displayNames);
    }

    async loadExhibitGateModel() {
        console.log('Loading binary exhibit/background gate model...');

        try {
            const sessionOptions = {
                executionProviders: ['wasm'],
                graphOptimizationLevel: 'all',
                logSeverityLevel: 0
            };

            this.gateModel = await this.createCachedONNXSession('/models/exhibit_gate/exhibit_gate.onnx', sessionOptions);

            try {
                this.gateMetadata = await this.fetchModelJson('/models/exhibit_gate/exhibit_gate_metadata.json');
                this.gateConfig = {
                    ...this.gateConfig,
                    inputSize: this.gateMetadata.inputSize || this.gateConfig.inputSize,
                    threshold: this.gateMetadata.threshold || this.gateConfig.threshold,
                    classes: this.gateMetadata.classes || this.gateConfig.classes,
                    exhibitClassIndex: this.gateMetadata.classToIdx?.exhibit ?? this.gateConfig.exhibitClassIndex
                };
            } catch (metadataError) {
                console.warn('Gate metadata load failed, using defaults:', metadataError.message);
            }

            if (this.useSimilarityGate) {
                try {
                    this.gateSimilarityIndex = await this.fetchModelJson('/models/exhibit_gate/gate_similarity_index.json');
                    console.log('Gate similarity index loaded:', this.gateSimilarityIndex.stats);
                } catch (similarityError) {
                    console.warn('Gate similarity index load failed; using YOLO gate only:', similarityError.message);
                }
            } else {
                this.gateSimilarityIndex = null;
                console.log('Gate similarity check disabled; using YOLO gate probabilities only');
            }

            console.log('Binary exhibit/background gate loaded');
            console.log('Gate input names:', this.gateModel.inputNames);
            console.log('Gate output names:', this.gateModel.outputNames);
        } catch (error) {
            console.error('Binary gate loading failed:', error);
            throw error;
        }
    }

    async connectToBackend() {
        console.log('🎯 Connecting to YOUR REAL PyTorch model backend (99.04% accuracy)...');
        console.log('🔧 Backend initialization start', { backendUrl: this.backendUrl });
        const backendStartedAt = performance.now();

        try {
            // Test backend connection
            const healthResponse = await fetch(`${this.backendUrl}/health`);

            if (!healthResponse.ok) {
                throw new Error(`Backend not available: ${healthResponse.status}`);
            }

            const healthData = await healthResponse.json();
            console.log(`✅ Backend connection successful in ${(performance.now() - backendStartedAt).toFixed(0)}ms`);
            console.log(`🏆 Model loaded: ${healthData.model_loaded}`);
            console.log(`📊 Accuracy: ${healthData.accuracy}%`);

            // Mark as real model
            this.model = {
                isRealModel: true,
                isBackend: true,
                accuracy: healthData.accuracy,
                predict: this.predictViaBackend.bind(this)
            };

        } catch (error) {
            console.error('❌ Backend connection failed:', error);
            console.error('💡 Make sure Python backend is running:');
            console.error('   cd backend_model && python server.py');
            throw new Error('YOUR REAL MODEL backend is not available - please start Python server');
        }
    }

    async loadMainModel() {
        console.log('🎯 Loading YOLOv8 exhibit label classifier...');

        try {
            const deviceMemory = navigator.deviceMemory || 0;
            const hwConcurrency = navigator.hardwareConcurrency || 0;
            const isLowEnd = deviceMemory > 0 ? deviceMemory <= 1 : hwConcurrency <= 2;

            // Create session with wasm execution provider only
            const sessionOptions = {
                executionProviders: ['wasm'],
                graphOptimizationLevel: isLowEnd ? 'basic' : 'all',   // basic = faster on low-end devices
                logSeverityLevel: 0
            };

            console.log('📦 Loading YOLOv8s exhibit/background classifier...');
            const onnxModelPath = '/models/exhibit_models_onnx/main_model/yolov8s_exhibit_fixed.onnx';
            console.log('🎯 Model path:', onnxModelPath);
            console.log('🏆 Using regenerated YOLOv8s for 28-class exhibit/background prediction');
            const t0 = performance.now();
            console.log('⏳ Creating ONNX inference session...');
                this.model = await this.createCachedONNXSession(onnxModelPath, sessionOptions);
            console.log(`✅ Main model loaded in ${(performance.now() - t0).toFixed(1)}ms`);
            console.log('✅ YOLOv8s main model loaded successfully!');
            console.log('🔧 Session execution providers:', this.model.executionProviders);

            // Load metadata for main model
            try {
                const metadataPath = '/models/exhibit_models_onnx/main_model/yolov8s_exhibit_fixed_metadata.json';
                console.log('📋 Loading main model metadata...');
                const metadataResponse = await this.fetchModelJson(metadataPath);
                if (metadataResponse) {
                    this.metadata = metadataResponse;
                    console.log('✅ Main model metadata loaded successfully!');
                    console.log('📊 Model info:', {
                        architecture: this.metadata.architecture || this.metadata.model_name || 'YOLOv8 classifier',
                        bestAccuracy: this.metadata.accuracy?.top1
                            ? `${(this.metadata.accuracy.top1 * 100).toFixed(2)}% top1`
                            : (this.metadata.performance?.bestAccuracy || 'TBD'),
                        classes: this.metadata.classes?.length || 28
                    });
                } else {
                    console.warn('⚠️ Main model metadata not found, using defaults');
                    this.metadata = null;
                }
            } catch (error) {
                console.warn('⚠️ Failed to load main model metadata:', error.message);
                this.metadata = null;
            }

            // Update config for regenerated metadata-driven main classifier.
            this.config = {
                ...this.config,
                numClasses: this.metadata?.classes?.length || 3,
                classes: this.metadata?.classes || ['DWT', 'EAP', 'EGN'],
                backgroundClass: this.metadata?.backgroundClass || 'background',
                exhibitMapping: {
                    ...this.config.exhibitMapping,
                    ...(this.metadata?.displayNames || {
                        'DWT': 'Dialogue with Time',
                        'EAP': 'Earth Alive Planet',
                        'EGN': 'Energy Story'
                    })
                },
                classToIdx: this.metadata?.classToIdx || {
                    'DWT': 0, 'EAP': 1, 'EGN': 2
                }
            };

            console.log('🏆 Main model ready for exhibit/background inference');
            console.log('📊 Input names:', this.model.inputNames);
            console.log('📊 Output names:', this.model.outputNames);

            // Add metadata to model
            this.model.isRealModel = true;
            this.model.isONNX = true;
            this.model.accuracy = this.config.accuracy;

            // Test the model with a dummy input
            console.log('🧪 Testing YOLOv8 exhibit classifier...');
            const testInput = new ort.Tensor('float32', new Float32Array(1 * 3 * 224 * 224), [1, 3, 224, 224]);
            const testResult = await this.model.run({ [this.model.inputNames[0]]: testInput });
            console.log('✅ Main model test successful!');
            console.log('📊 Test output shape:', testResult[this.model.outputNames[0]].dims);

        } catch (error) {
            console.error('❌ Main model loading failed:', error);
            console.error('🔍 Error details:', error.message);
            throw error;
        }
    }

    // Generic function to load zone-specific classifiers
    async loadZoneClassifier(zone, zoneName) {
        console.log(`🎯 Loading ${zoneName} classifier...`);
        try {
            const sessionOptions = {
                executionProviders: ['wasm'],
                logSeverityLevel: 0
            };

            const modelPath = `/models/exhibit_models_onnx/classifiers_model/${zone.toLowerCase()}_exhibit_classifier.onnx`;
            const metadataPath = `/models/exhibit_models_onnx/classifiers_model/${zone.toLowerCase()}_metadata.json`;

            // Load model
            const model = await this.createCachedONNXSession(modelPath, sessionOptions);
            console.log(`✅ ${zoneName} classifier loaded successfully!`);

            // Load metadata
            let metadata = null;
            try {
                const metadataResponse = await this.fetchModelJson(metadataPath);
                if (metadataResponse) {
                    metadata = metadataResponse;
                    console.log(`📊 ${zoneName} metadata loaded: ${metadata.num_classes} exhibits`);
                }
            } catch (metadataError) {
                console.warn(`⚠️ Could not load ${zoneName} metadata:`, metadataError.message);
            }

            return { model, metadata };
        } catch (error) {
            console.error(`❌ Failed to load ${zoneName} classifier:`, error);
            throw error;
        }
    }

    // Zone-specific classifier loaders
    async loadATModel() {
        const result = await this.loadZoneClassifier('at', 'Atrium');
        this.atModel = result.model;
        this.atMetadata = result.metadata;
    }

    async loadBTNModel() {
        const result = await this.loadZoneClassifier('btn', 'Bioethics');
        this.btnModel = result.model;
        this.btnMetadata = result.metadata;
    }

    async loadCCPModel() {
        const result = await this.loadZoneClassifier('ccp', 'Climate Changed');
        this.ccpModel = result.model;
        this.ccpMetadata = result.metadata;
    }

    async loadDWTModel() {
        const result = await this.loadZoneClassifier('dwt', 'Dialogue with Time');
        this.dwtModel = result.model;
        this.dwtMetadata = result.metadata;
    }

    async loadEAPModel() {
        const result = await this.loadZoneClassifier('eap', 'Earth Alive Planet');
        this.eapModel = result.model;
        this.eapMetadata = result.metadata;
    }

    async loadEGNModel() {
        const result = await this.loadZoneClassifier('egn', 'Energy Story');
        this.egnModel = result.model;
        this.egnMetadata = result.metadata;
    }

    async loadMACModel() {
        const result = await this.loadZoneClassifier('mac', 'Mechanics Alive');
        this.macModel = result.model;
        this.macMetadata = result.metadata;
    }

    async loadMEPModel() {
        const result = await this.loadZoneClassifier('mep', 'Mind Eye');
        this.mepModel = result.model;
        this.mepMetadata = result.metadata;
    }

    async loadQSModel() {
        const result = await this.loadZoneClassifier('qs', 'Quanta School');
        this.qsModel = result.model;
        this.qsMetadata = result.metadata;
    }

    async loadUMPModel() {
        const result = await this.loadZoneClassifier('ump', 'Urban Mutations');
        this.umpModel = result.model;
        this.umpMetadata = result.metadata;
    }

    async loadSpecialistModels({ labels } = {}) {
        const sessionOptions = {
            executionProviders: ['wasm'],
            logSeverityLevel: 0
        };

        const specialists = [
            {
                label: 'DWT',
                modelPath: '/models/dwt_classifier_mean_pool.onnx',
                metadataPath: '/models/dwt_classifier_mean_pool_metadata.json',
                assignModel: (model) => { this.dwtModel = model; },
                assignMetadata: (metadata) => { this.dwtMetadata = metadata; }
            },
            {
                label: 'EAP',
                modelPath: '/models/eap_classifier_mean_pool.onnx',
                metadataPath: '/models/eap_classifier_mean_pool_metadata.json',
                assignModel: (model) => { this.eapModel = model; },
                assignMetadata: (metadata) => { this.eapMetadata = metadata; }
            },
            {
                label: 'ARICC',
                modelPath: '/models/aricc/aricc_classifier.onnx',
                metadataPath: '/models/aricc/aricc_classifier_metadata.json',
                assignModel: (model) => { this.ariccModel = model; },
                assignMetadata: (metadata) => { this.ariccMetadata = metadata; }
            }
        ];

        const specialistsToLoad = labels
            ? specialists.filter((specialist) => labels.includes(specialist.label))
            : specialists;
        for (const specialist of specialistsToLoad) {
            try {
                console.log(`Loading ${specialist.label} specialist classifier...`);
                const model = await this.createCachedONNXSession(specialist.modelPath, sessionOptions);
                specialist.assignModel(model);
                console.log(`${specialist.label} ONNX input metadata:`, {
                    inputNames: model.inputNames,
                    inputMetadata: model.inputNames.map(inputName => model.inputMetadata?.[inputName] || null),
                    outputNames: model.outputNames
                });

                try {
                    const metadataResponse = await this.fetchModelJson(specialist.metadataPath);
                    if (metadataResponse) {
                        specialist.assignMetadata(metadataResponse);
                        console.log(`✅ ${specialist.label} specialist metadata loaded`);
                        if (specialist.label === 'ARICC') {
                            console.log('🧾 ARICC runtime configuration:', {
                                modelPath: specialist.modelPath,
                                modelOutput: model.outputNames,
                                classes: specialist.metadata?.displayNames,
                                mean: specialist.metadata?.mean,
                                std: specialist.metadata?.std,
                                outputType: specialist.metadata?.output_type
                            });
                        }
                    }
                } catch (metadataError) {
                    console.warn(`⚠️ ${specialist.label} metadata not loaded:`, metadataError.message);
                }

                console.log(`✅ ${specialist.label} specialist classifier loaded`);
            } catch (error) {
                console.warn(`⚠️ ${specialist.label} specialist failed to load:`, error.message);
            }
        }
    }

    async loadTensorFlowJSModel() {
        console.log('🎯 Loading TensorFlow.js version of your model...');

        try {
            // First try the regular tfjs model
            let modelPath = '/models/yolo_tiny_tfjs/model.json';
            console.log('🔄 Trying regular TensorFlow.js model...');

            try {
                this.model = await tf.loadLayersModel(modelPath);
                console.log('✅ YOUR REAL model loaded via TensorFlow.js (regular)!');
            } catch (regularError) {
                console.warn('⚠️ Regular TensorFlow.js model failed:', regularError.message);

                // Fallback to sharded version
                console.log('🔄 Trying sharded TensorFlow.js model...');
                modelPath = '/models/yolo_tiny_precise_tfjs_sharded/model.json';
                this.model = await tf.loadLayersModel(modelPath);
                console.log('✅ YOUR REAL model loaded via TensorFlow.js (sharded)!');
            }

            console.log('🏆 Model accuracy: 99.04%');
            console.log('📊 Input shape:', this.model.inputs[0].shape);
            console.log('📊 Output shape:', this.model.outputs[0].shape);

            this.model.isRealModel = true;
            this.model.isTensorFlow = true;
            this.model.accuracy = this.metadata?.bestAccuracy || this.config.accuracy || 95.0;

        } catch (error) {
            console.error('❌ TensorFlow.js model loading failed:', error);
            throw error;
        }
    }

    async detectExhibitPresence(imageElement) {
        console.log('🔍 Running simple confidence-based background detection...');

        try {
            // Use the main classifier but analyze the confidence distribution.
            const canvas = document.createElement('canvas');
            canvas.width = 160;
            canvas.height = 160;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);

            // Prepare input tensor
            const preprocessed = tf.browser.fromPixels(canvas)
                .resizeNearestNeighbor([224, 224])
                .expandDims(0)
                .div(255.0);

            // Run through main model to get class probabilities
            const predictions = await this.model.run({
                [this.model.inputNames[0]]: this.convertToONNXTensor(preprocessed)
            });

            const predictionData = await predictions[this.model.outputNames[0]].data;
            const probabilities = Array.from(predictionData);

            // Apply softmax to ensure proper probabilities
            const logitsTensor = tf.tensor1d(probabilities);
            const probabilitiesTensor = tf.softmax(logitsTensor);
            const finalProbs = await probabilitiesTensor.data();

            // Simple confidence-based background detection
            const maxConfidence = Math.max(...finalProbs);

            // Very simple threshold: if max confidence is too low, it's probably background
            const MIN_CONFIDENCE = 0.85; // 75% minimum confidence for any class
            const isKnownClass = maxConfidence >= MIN_CONFIDENCE;

            console.log(`📊 Simple confidence-based detection:`);
            console.log(`   Max confidence: ${(maxConfidence * 100).toFixed(1)}% (min: ${(MIN_CONFIDENCE * 100).toFixed(0)}%)`);
            console.log(`   Classification: ${isKnownClass ? 'KNOWN CLASS (EXHIBIT)' : 'BACKGROUND'}`);
            console.log(`   Probability distribution: [${finalProbs.map(p => (p * 100).toFixed(1) + '%').join(', ')}]`);

            // Cleanup
            preprocessed.dispose();
            logitsTensor.dispose();
            probabilitiesTensor.dispose();

            return {
                isExhibit: isKnownClass,
                confidence: isKnownClass ? maxConfidence : (1 - maxConfidence),
                maxConfidence,
                classDistribution: finalProbs
            };

        } catch (error) {
            console.error('❌ Confidence-based detection failed:', error);
            // Default to allowing detection if the filter fails
            return {
                isExhibit: true,
                confidence: 0.5,
                error: error.message
            };
        }
    }

    calculateEntropy(probabilities) {
        // Calculate Shannon entropy: H = -Σ(p * log2(p))
        // Higher entropy = more uncertain = likely unknown class
        let entropy = 0;
        for (const prob of probabilities) {
            if (prob > 0) {
                entropy -= prob * Math.log2(prob);
            }
        }
        return entropy;
    }

    // ...existing code...
    async checkFrameClarity(imageElement) {
        console.log('🎥 Running frame clarity gate (blur/darkness detection)...');

        try {
            // Ensure video/image has dimensions - wait briefly for video to provide them
            let originalWidth = imageElement.videoWidth || imageElement.width || 0;
            let originalHeight = imageElement.videoHeight || imageElement.height || 0;
            if (originalWidth === 0 || originalHeight === 0) {
                await new Promise(resolve => {
                    let handled = false;
                    const onLoaded = () => { if (!handled) { handled = true; resolve(); } };
                    imageElement.addEventListener && imageElement.addEventListener('loadeddata', onLoaded, { once: true });
                    // fallback timeout
                    setTimeout(() => { if (!handled) { handled = true; resolve(); } }, 300);
                });
                originalWidth = imageElement.videoWidth || imageElement.width || 0;
                originalHeight = imageElement.videoHeight || imageElement.height || 0;
            }

            // Fallback to 224 if still zero (avoid zero-size canvas)
            if (originalWidth === 0 || originalHeight === 0) {
                originalWidth = 224;
                originalHeight = 224;
            }

            const canvas = document.createElement('canvas');
            canvas.width = originalWidth;
            canvas.height = originalHeight;
            const ctx = canvas.getContext('2d');

            try {
                ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
            } catch (err) {
                console.warn('⚠️ drawImage failed (possibly not ready or cross-origin):', err.message);
                // If drawImage fails, allow detection (do not block)
                return { isClear: true, reason: 'drawImage_failed_allow' };
            }

            // Try to read pixels; handle security/cross-origin errors
            let imageData;
            try {
                imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            } catch (err) {
                console.warn('⚠️ getImageData failed (canvas tainted or security):', err.message);
                return { isClear: true, reason: 'canvas_tainted_allow' };
            }

            const data = imageData.data;
            const pxCount = canvas.width * canvas.height;
            let sum = 0;
            let sumSq = 0;

            // Compute luminance per pixel (0..1) and basic variance/brightness
            for (let i = 0, j = 0; i < data.length; i += 4, j++) {
                // sRGB luminance approximation
                const r = data[i], g = data[i + 1], b = data[i + 2];
                const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; // normalized 0..1
                sum += lum;
                sumSq += lum * lum;
            }

            const mean = sum / pxCount;
            let variance = (sumSq / pxCount) - (mean * mean);
            // numerical safety
            variance = Math.max(0, variance);
            const contrast = Math.sqrt(variance);
            let brightness = mean;

            // If we read a totally black frame (likely camera warmup or placeholder), retry once quickly
            if (variance === 0 && brightness === 0) {
                await new Promise(r => setTimeout(r, 80));
                try {
                    ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
                    imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const d = imageData.data;
                    let s = 0, ss = 0;
                    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
                        const r = d[i], g = d[i + 1], b = d[i + 2];
                        const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
                        s += lum; ss += lum * lum;
                    }
                    const m = s / pxCount;
                    variance = Math.max(0, (ss / pxCount) - (m * m));
                    brightness = m;
                } catch {
                    // ignore and fall through to treat as poor-quality
                }
            }

            // Adapt thresholds for low-end devices
            const deviceMemory = navigator.deviceMemory || 0;
            const hwConcurrency = navigator.hardwareConcurrency || 0;
            const isLowEnd = deviceMemory > 0 ? deviceMemory <= 1 : hwConcurrency <= 2;

            const MIN_EDGE_VARIANCE = isLowEnd ? 0.0015 : 0.005;
            const MIN_BRIGHTNESS = isLowEnd ? 0.06 : 0.10;
            const MAX_BRIGHTNESS = 0.98;
            const MIN_CONTRAST = isLowEnd ? 0.015 : 0.03;

            const isSharp = variance >= MIN_EDGE_VARIANCE;
            const isBrightEnough = brightness >= MIN_BRIGHTNESS && brightness <= MAX_BRIGHTNESS;
            const hasContrast = contrast >= MIN_CONTRAST;

            const failedChecks = [!isSharp, !isBrightEnough, !hasContrast].filter(x => x).length;
            const isClear = failedChecks <= 1; // allow one failure

            console.log(`🎥 Frame clarity analysis:`);
            console.log(`   Pixel variance: ${variance.toFixed(6)} (min: ${MIN_EDGE_VARIANCE})`);
            console.log(`   Brightness: ${brightness.toFixed(3)} (range: ${MIN_BRIGHTNESS}-${MAX_BRIGHTNESS})`);
            console.log(`   Contrast: ${contrast.toFixed(4)} (min: ${MIN_CONTRAST})`);
            console.log(`   Checks: Sharp=${isSharp}, Bright=${isBrightEnough}, Contrast=${hasContrast}`);
            console.log(`   Result: ${isClear ? 'CLEAR FRAME' : 'POOR QUALITY FRAME'}`);

            return {
                isClear,
                edgeVariance: variance,
                brightness,
                contrast,
                reason: isClear ? 'Clear' :
                    (!isSharp ? 'Blurry/Low Detail' :
                     !isBrightEnough ? (brightness < MIN_BRIGHTNESS ? 'Too Dark' : 'Overexposed') :
                     'Low Contrast')
            };

        } catch (error) {
            console.error('❌ Frame clarity check failed (unexpected):', error);
            // Default to allowing detection if clarity check fails catastrophically
            return {
                isClear: true,
                error: error.message,
                reason: 'Clarity check unexpected failure - allowing detection'
            };
        }
    }
// ...existing code...




    async detectHierarchical(imageElement) {
        if (this.modelState !== EXHIBIT_MODEL_STATES.MODEL_READY &&
            this.modelState !== EXHIBIT_MODEL_STATES.OFFLINE_MODEL_READY) {
            console.warn('⏸️ Inference skipped: exhibit model is not ready', {
                modelState: this.modelState,
                modelVersion: MODEL_ASSET_VERSION
            });
            return {
                success: false,
                reason: 'model_not_ready',
                modelState: this.modelState,
                message: this.modelState === EXHIBIT_MODEL_STATES.MODEL_DOWNLOAD_REQUIRED
                    ? 'Internet required to download recognition model'
                    : 'Recognition model is still loading'
            };
        }
        if (!this.firstInferenceLogged) {
            console.log('⏱️ Inference start', {
                modelState: this.modelState,
                modelVersion: MODEL_ASSET_VERSION
            });
            this.firstInferenceLogged = true;
        }
        console.log('🔄 Starting hierarchical detection (v6 with clarity gate + confidence filter)...');
        try {
            // Step -1: Frame clarity gate (optional but recommended)
            const USE_CLARITY_GATE = false;

            if (USE_CLARITY_GATE) {
                console.log('🎥 Step -1: Frame clarity gate...');
                const clarity = await this.checkFrameClarity(imageElement);

                if (!clarity.isClear) {
                    console.log(`🚫 Poor quality frame detected (${clarity.reason}) - stopping detection`);
                    return {
                        success: false,
                        reason: 'poor_frame_quality',
                        clarityReason: clarity.reason,
                        brightness: clarity.brightness,
                        edgeVariance: clarity.edgeVariance,
                        contrast: clarity.contrast,
                        message: `Frame quality too poor: ${clarity.reason}`
                    };
                }

                console.log(`✅ Frame quality check passed - proceeding with detection`);
            } else {
                console.log('⏭️ Skipping clarity gate - proceeding to confidence filter');
            }

            const personDetected = await this.detectPersonOnlyFrame(imageElement);
            if (personDetected) {
                await this.logRejectedFrame(imageElement, 'unknown_exhibit', {
                    classifier: this.classifierMode,
                    reason: 'person_detected'
                });
                return {
                    success: false,
                    reason: 'unknown_exhibit',
                    zone: this.classifierMode === 'aricc'
                        ? 'ARICC'
                        : this.classifierMode === 'fablab' ? 'FABLAB' : 'RECON',
                    exhibit: 'Unknown / Unrecognized Exhibit',
                    message: 'No exhibit detected',
                    classifier: this.classifierMode
                };
            }

            // Stage 1: Binary exhibit/background gate
            console.log('Stage 1: Running binary exhibit/background gate...');
            const gateResult = await this.detectExhibitGate(imageElement);

            const exactRejectionCondition = !gateResult.classifierAccepted && !gateResult.similarityAccepted;
            if (exactRejectionCondition) {
                console.log(`Gate rejected frame as noise/background (${(gateResult.exhibitConfidence * 100).toFixed(1)}% exhibit confidence)`);
                await this.logRejectedFrame(imageElement, 'noise_rejected', {
                    gateClass: gateResult.predictedClass,
                    gateConfidence: gateResult.confidence,
                    exhibitConfidence: gateResult.exhibitConfidence,
                    backgroundConfidence: gateResult.backgroundConfidence,
                    requiredConfidence: gateResult.threshold,
                    classifierAccepted: gateResult.classifierAccepted,
                    similarityAccepted: gateResult.similarityAccepted,
                    finalGateDecision: gateResult.finalGateDecision,
                    exactRejectionCondition
                });
                return {
                    success: false,
                    reason: 'noise_rejected',
                    gateClass: gateResult.predictedClass,
                    gateConfidence: gateResult.confidence,
                    exhibitConfidence: gateResult.exhibitConfidence,
                    backgroundConfidence: gateResult.backgroundConfidence,
                    requiredConfidence: gateResult.threshold,
                    classifierAccepted: gateResult.classifierAccepted,
                    similarityAccepted: gateResult.similarityAccepted,
                    finalGateDecision: gateResult.finalGateDecision,
                    exactRejectionCondition,
                    similarity: gateResult.similarity,
                    message: gateResult.isModelExhibit && !gateResult.isSimilarityExhibit
                        ? 'Frame rejected because it does not look similar to exhibit dataset examples'
                        : 'No exhibit detected in frame',
                    gate: gateResult
                };
            }

            console.log('Gate decision:', {
                classifierAccepted: gateResult.classifierAccepted,
                similarityAccepted: gateResult.similarityAccepted,
                finalGateDecision: gateResult.finalGateDecision,
                exactRejectionCondition
            });
            console.log(`Gate accepted frame (${(gateResult.exhibitConfidence * 100).toFixed(1)}% exhibit confidence)`);

            const hasRequestedClassifier = this.classifierMode === 'recon'
                ? Boolean(this.reconModel && this.reconMetadata)
                : this.classifierMode === 'aricc'
                    ? Boolean(this.ariccModel && this.ariccMetadata)
                    : this.classifierMode === 'fablab'
                        ? Boolean(this.fablabModel && this.fablabMetadata)
                        : this.classifierMode === 'caesar'
                            ? Boolean(this.caesarModel && this.caesarMetadata)
                        : Boolean(this.model);
            if (!hasRequestedClassifier || (this.gateOnlyMode && !hasRequestedClassifier)) {
                await this.logRejectedFrame(imageElement, 'main_classifier_unavailable', {
                    exhibitConfidence: gateResult.exhibitConfidence
                });
                return {
                    success: false,
                    gateOnly: true,
                    reason: 'main_classifier_unavailable',
                    exhibitConfidence: gateResult.exhibitConfidence,
                    message: 'Gate accepted the frame, but no label classifier is available',
                    gate: gateResult
                };
            }

            // RECON and ARICC are mutually exclusive: only the model matching the
            // active classifierMode may produce a result. A model left over from a
            // different mode on this singleton service must never be used here.
            const SPECIALIST_MIN_CONFIDENCE = 0.60;
            const isUnknownSpecialistResult = result =>
                result.confidence < SPECIALIST_MIN_CONFIDENCE || result.isLikelyBackground;

            if (this.classifierMode === 'recon') {
                if (!this.reconModel || !this.reconMetadata) {
                    await this.logRejectedFrame(imageElement, 'main_classifier_unavailable', {
                        exhibitConfidence: gateResult.exhibitConfidence
                    });
                    return {
                        success: false,
                        gateOnly: true,
                        reason: 'main_classifier_unavailable',
                        exhibitConfidence: gateResult.exhibitConfidence,
                        message: 'Gate accepted the frame, but the RECON classifier is not available',
                        gate: gateResult
                    };
                }
                const reconResult = await this.runZoneSpecificInference(imageElement, 'RECON');
                const displayName = reconResult.displayName || reconResult.exhibit;
                const code = reconResult.classCode || 'RECON-1';
                if (isUnknownSpecialistResult(reconResult)) {
                    await this.logRejectedFrame(imageElement, 'unknown_exhibit', {
                        classifier: 'recon',
                        predictedClass: displayName,
                        confidence: reconResult.confidence,
                        confidenceGap: reconResult.confidenceGap,
                        requiredConfidence: SPECIALIST_MIN_CONFIDENCE
                    });
                    return {
                        success: false,
                        reason: 'unknown_exhibit',
                        zone: 'RECON',
                        exhibit: 'Unknown / Unrecognized Exhibit',
                        exhibitConfidence: reconResult.confidence,
                        specificConfidenceGap: reconResult.confidenceGap,
                        message: 'Exhibit is outside the confident RECON classes',
                        gate: gateResult,
                        classifier: 'recon'
                    };
                }
                return {
                    success: true,
                    zone: 'RECON',
                    zoneConfidence: reconResult.confidence,
                    exhibit: reconResult.exhibit,
                    exhibitConfidence: reconResult.confidence,
                    combinedConfidence: reconResult.confidence,
                    exhibitInfo: { displayName, code, number: code.replace('RECON-', '') },
                    coordinates: this.getExhibitCoordinates(code, 'default'),
                    detectionTime: new Date().toISOString(),
                    isLikelyBackground: reconResult.isLikelyBackground,
                    isRecognized: reconResult.isRecognized || (
                        reconResult.confidence >= SPECIALIST_MIN_CONFIDENCE &&
                        !reconResult.isLikelyBackground
                    ),
                    mainConfidenceGap: reconResult.confidenceGap,
                    specificConfidenceGap: reconResult.confidenceGap,
                    gate: gateResult,
                    classifier: 'recon'
                };
            }

            // ARICC is the trained exhibit classifier for the ARICC webcam workflow.
            // Run it directly after the noise gate so the legacy 28-class model
            // cannot replace an ARICC result with labels such as Phobia.
            if (this.classifierMode === 'aricc' && this.ariccModel && this.ariccMetadata) {
                const ariccResult = await this.runZoneSpecificInference(imageElement, 'ARICC');
                const ariccDisplayName = ariccResult.displayName || ariccResult.exhibit;
                if (isUnknownSpecialistResult(ariccResult)) {
                    await this.logRejectedFrame(imageElement, 'unknown_exhibit', {
                        classifier: 'aricc',
                        predictedClass: ariccDisplayName,
                        confidence: ariccResult.confidence,
                        confidenceGap: ariccResult.confidenceGap,
                        requiredConfidence: SPECIALIST_MIN_CONFIDENCE
                    });
                    return {
                        success: false,
                        reason: 'unknown_exhibit',
                        zone: 'ARICC',
                        exhibit: 'Unknown / Unrecognized Exhibit',
                        exhibitConfidence: ariccResult.confidence,
                        specificConfidenceGap: ariccResult.confidenceGap,
                        message: 'Exhibit is outside the confident ARICC classes',
                        gate: gateResult,
                        classifier: 'aricc'
                    };
                }
                return {
                    success: true,
                    zone: 'ARICC',
                    zoneConfidence: ariccResult.confidence,
                    exhibit: ariccResult.exhibit,
                    exhibitConfidence: ariccResult.confidence,
                    combinedConfidence: ariccResult.confidence,
                    exhibitInfo: {
                        displayName: ariccDisplayName,
                        code: ariccResult.exhibit,
                        number: ariccResult.exhibit.replace('ARICC-', '')
                    },
                    coordinates: this.getExhibitCoordinates(ariccResult.exhibit, 'default'),
                    detectionTime: new Date().toISOString(),
                    isLikelyBackground: ariccResult.isLikelyBackground,
                    mainConfidenceGap: ariccResult.confidenceGap,
                    specificConfidenceGap: ariccResult.confidenceGap,
                    gate: gateResult,
                    classifier: 'aricc'
                };
            }

            if (this.classifierMode === 'fablab' && this.fablabModel && this.fablabMetadata) {
                const fablabResult = await this.runZoneSpecificInference(imageElement, 'FABLAB');
                const fablabDisplayName = fablabResult.displayName || fablabResult.exhibit;
                if (isUnknownSpecialistResult(fablabResult)) {
                    await this.logRejectedFrame(imageElement, 'unknown_exhibit', {
                        classifier: 'fablab',
                        predictedClass: fablabDisplayName,
                        confidence: fablabResult.confidence,
                        confidenceGap: fablabResult.confidenceGap,
                        requiredConfidence: SPECIALIST_MIN_CONFIDENCE
                    });
                    return {
                        success: false,
                        reason: 'unknown_exhibit',
                        zone: 'FABLAB',
                        exhibit: 'Unknown / Unrecognized Equipment',
                        exhibitConfidence: fablabResult.confidence,
                        specificConfidenceGap: fablabResult.confidenceGap,
                        message: 'Frame is outside the confident FABLAB classes',
                        gate: gateResult,
                        classifier: 'fablab'
                    };
                }
                return {
                    success: true,
                    zone: 'FABLAB',
                    zoneConfidence: fablabResult.confidence,
                    exhibit: fablabResult.exhibit,
                    exhibitConfidence: fablabResult.confidence,
                    combinedConfidence: fablabResult.confidence,
                    exhibitInfo: {
                        displayName: fablabDisplayName,
                        code: fablabResult.exhibit,
                        number: fablabResult.exhibit
                    },
                    coordinates: this.getExhibitCoordinates('default', 'default'),
                    detectionTime: new Date().toISOString(),
                    isLikelyBackground: fablabResult.isLikelyBackground,
                    mainConfidenceGap: fablabResult.confidenceGap,
                    specificConfidenceGap: fablabResult.confidenceGap,
                    gate: gateResult,
                    classifier: 'fablab'
                };
            }

            if (this.classifierMode === 'caesar' && this.caesarModel && this.caesarMetadata) {
                const caesarResult = await this.runZoneSpecificInference(imageElement, 'CAESAR');
                const caesarDisplayName = caesarResult.displayName || caesarResult.exhibit;
                if (isUnknownSpecialistResult(caesarResult)) {
                    return {
                        success: false,
                        reason: 'unknown_exhibit',
                        zone: 'CAESAR',
                        exhibit: 'Unknown / Unrecognized Equipment',
                        exhibitConfidence: caesarResult.confidence,
                        specificConfidenceGap: caesarResult.confidenceGap,
                        message: 'Equipment is outside the confident CAESAR classes',
                        gate: gateResult,
                        classifier: 'caesar'
                    };
                }
                return {
                    success: true,
                    zone: 'CAESAR',
                    zoneConfidence: caesarResult.confidence,
                    exhibit: caesarResult.exhibit,
                    exhibitConfidence: caesarResult.confidence,
                    combinedConfidence: caesarResult.confidence,
                    exhibitInfo: {
                        displayName: caesarDisplayName,
                        code: caesarResult.exhibit,
                        number: caesarResult.exhibit
                    },
                    coordinates: this.getExhibitCoordinates('default', 'default'),
                    detectionTime: new Date().toISOString(),
                    isLikelyBackground: caesarResult.isLikelyBackground,
                    mainConfidenceGap: caesarResult.confidenceGap,
                    specificConfidenceGap: caesarResult.confidenceGap,
                    gate: gateResult,
                    classifier: 'caesar'
                };
            }

            if (this.classifierMode === 'aricc') {
                await this.logRejectedFrame(imageElement, 'unknown_exhibit', {
                    classifier: 'aricc',
                    reason: 'ARICC classifier unavailable'
                });
                return {
                    success: false,
                    reason: 'unknown_exhibit',
                    zone: 'ARICC',
                    exhibit: 'Unknown / Unrecognized Exhibit',
                    message: 'No exhibit detected',
                    gate: gateResult,
                    classifier: 'aricc'
                };
            }

            // Option to bypass confidence pre-filter for testing (set to false to disable filter)
            const USE_CONFIDENCE_PREFILTER = false;

            if (USE_CONFIDENCE_PREFILTER) {
                // Step 0: Simple confidence-based exhibit detection
                console.log('🚪 Step 0: Simple confidence-based exhibit detection...');
                const exhibitPresent = await this.detectExhibitPresence(imageElement);

                if (!exhibitPresent.isExhibit) {
                    console.log(`🚫 No exhibit detected in frame (${(exhibitPresent.confidence * 100).toFixed(1)}% background) - stopping detection`);
                    return {
                        success: false,
                        reason: 'no_exhibit_detected',
                        backgroundConfidence: exhibitPresent.confidence,
                        maxConfidence: exhibitPresent.maxConfidence,
                        message: 'No exhibit detected in frame'
                    };
                }

                console.log(`✅ Exhibit detected in frame (${(exhibitPresent.confidence * 100).toFixed(1)}% exhibit confidence) - proceeding with zone detection`);
            } else {
                console.log('⏭️ Skipping confidence pre-filter - proceeding directly to zone detection');
            }

            // Step 2: Main model - YOLOv8s 28-class exhibit/background classification.
            console.log('🎯 Step 2: Running exhibit label classification...');
            const mainResult = await this.detectExhibit(imageElement);

            if (!mainResult.success) {
                return mainResult;
            }

            if (!mainResult.isRecognized) {
                console.log(`🚫 Main model rejected: ${(mainResult.confidence * 100).toFixed(1)}% top confidence, ${(mainResult.confidenceGap * 100).toFixed(1)}% margin`);
                await this.logRejectedFrame(imageElement, 'low_main_confidence', {
                    predictedClass: mainResult.class,
                    mainConfidence: mainResult.confidence,
                    requiredConfidence: RECOGNITION_MIN_CONFIDENCE,
                    confidenceGap: mainResult.confidenceGap
                });
                return {
                    success: false,
                    reason: mainResult.confidence < RECOGNITION_MIN_CONFIDENCE ? 'low_main_confidence' : 'low_main_confidence_gap',
                    class: 'UNKNOWN',
                    exhibit: 'UNKNOWN',
                    mainConfidence: mainResult.confidence,
                    mainConfidenceGap: mainResult.confidenceGap,
                    requiredConfidence: RECOGNITION_MIN_CONFIDENCE,
                    requiredConfidenceGap: RECOGNITION_MIN_MARGIN,
                    top1: mainResult.top1,
                    top2: mainResult.top2,
                    message: 'UNKNOWN: classifier confidence or margin was insufficient',
                    gate: gateResult
                };
            }

            const detectedZone = mainResult.class;
            console.log(`✅ Step 1 completed: ${detectedZone} (${(mainResult.confidence * 100).toFixed(1)}%)`);

            if (detectedZone === this.config.backgroundClass) {
                await this.logRejectedFrame(imageElement, 'background_class', {
                    predictedClass: detectedZone,
                    mainConfidence: mainResult.confidence,
                    confidenceGap: mainResult.confidenceGap
                });
                return {
                    success: false,
                    reason: 'background_class',
                    mainConfidence: mainResult.confidence,
                    message: 'Background detected',
                    gate: gateResult
                };
            }

            // Step 2: Zone-specific exhibit classification (DWT / EAP / EGN specialists)
            console.log(`🎯 Step 2: Running ${detectedZone}-specific detection...`);

            const zoneModels = {
                'DWT': { model: this.dwtModel, metadata: this.dwtMetadata, name: 'Dialogue with Time', emoji: '🧠' },
                'EAP': { model: this.eapModel, metadata: this.eapMetadata, name: 'Earth Alive Planet', emoji: '🌍' },
                'EGN': { model: this.egnModel, metadata: this.egnMetadata, name: 'Energy Story', emoji: '⚙️' }
            };

            const zoneInfo = zoneModels[detectedZone];
            let specificResult;

            if (!zoneInfo || !zoneInfo.model || !zoneInfo.metadata) {
                console.warn(`⚠️ ${detectedZone} specialist not available, using zone-level result only`);
                specificResult = {
                    exhibit: mainResult.exhibit,
                    confidence: mainResult.confidence,
                    confidenceGap: mainResult.confidenceGap,
                    isLikelyBackground: mainResult.isLikelyBackground,
                    isRecognized: mainResult.isRecognized,
                    top1: mainResult.top1,
                    top2: mainResult.top2
                };
            } else {
                console.log(`${zoneInfo.emoji} Running ${zoneInfo.name} specialist...`);
                specificResult = await this.runZoneSpecificInference(imageElement, detectedZone);
                console.log(`✅ Step 2 completed: ${specificResult.exhibit} (${(specificResult.confidence * 100).toFixed(1)}%)`);
            }

            const SPECIFIC_MIN_CONFIDENCE = RECOGNITION_MIN_CONFIDENCE;
            if (!specificResult.isRecognized || specificResult.confidence < SPECIFIC_MIN_CONFIDENCE) {
                return {
                    success: false,
                    reason: specificResult.confidence < SPECIFIC_MIN_CONFIDENCE ? 'low_specific_confidence' : 'low_specific_confidence_gap',
                    class: 'UNKNOWN',
                    exhibit: 'UNKNOWN',
                    zone: detectedZone,
                    zoneConfidence: mainResult.confidence,
                    exhibitConfidence: specificResult.confidence,
                    specificConfidenceGap: specificResult.confidenceGap,
                    top1: specificResult.top1,
                    top2: specificResult.top2,
                    requiredConfidence: SPECIFIC_MIN_CONFIDENCE,
                    requiredConfidenceGap: RECOGNITION_MIN_MARGIN,
                    message: 'UNKNOWN: exhibit classifier confidence or margin was insufficient',
                    gate: gateResult
                };
            }

            const exhibitInfo = this.parseExhibitInfo(specificResult.exhibit);
            const combinedConfidence = mainResult.confidence * specificResult.confidence;
            const isBackground = mainResult.isLikelyBackground || specificResult.isLikelyBackground;

            return {
                success: !isBackground && specificResult.isRecognized,
                zone: detectedZone,
                zoneConfidence: mainResult.confidence,
                exhibit: specificResult.exhibit,
                exhibitConfidence: specificResult.confidence,
                combinedConfidence,
                exhibitInfo,
                coordinates: this.getExhibitCoordinates(detectedZone, exhibitInfo.number || 'default'),
                detectionTime: new Date().toISOString(),
                isLikelyBackground: isBackground,
                mainConfidenceGap: mainResult.confidenceGap,
                specificConfidenceGap: specificResult.confidenceGap,
                isRecognized: mainResult.isRecognized && specificResult.isRecognized,
                top1: specificResult.top1 || mainResult.top1,
                top2: specificResult.top2 || mainResult.top2,
                processingTime: (mainResult.processingTime || 0) + (specificResult.processingTime || 0),
                gate: gateResult
            };

        } catch (error) {
            console.error('❌ Hierarchical detection failed:', error);
            return { success: false, error: error.message };
        }
    }

    async detectExhibitGate(imageElement) {
        if (!this.gateModel) {
            throw new Error('Binary exhibit/background gate is not loaded');
        }

        const input = await this.preprocessImageForONNX(imageElement, this.gateConfig.inputSize);
        const similarity = this.gateSimilarityIndex ? await this.checkGateSimilarity(imageElement) : null;

        try {
            const inputData = await input.data();
            const inputTensor = new ort.Tensor('float32', new Float32Array(inputData), input.shape);
            const results = await this.gateModel.run({ [this.gateModel.inputNames[0]]: inputTensor });
            const output = results[this.gateModel.outputNames[0]];
            const rawOutput = Array.from(output.data);
            const rawSum = rawOutput.reduce((sum, value) => sum + value, 0);
            const rawLooksLikeProbabilities = rawOutput.every(value => value >= 0 && value <= 1) && Math.abs(rawSum - 1) < 0.01;
            let probabilities;

            if (rawLooksLikeProbabilities) {
                probabilities = rawOutput;
            } else {
                probabilities = this.softmax(rawOutput);
            }

            const maxProb = Math.max(...probabilities);
            const predictedIndex = probabilities.indexOf(maxProb);
            const predictedClass = this.gateConfig.classes[predictedIndex] || `class_${predictedIndex}`;
            const exhibitConfidence = probabilities[this.gateConfig.exhibitClassIndex] || 0;
            const backgroundConfidence = probabilities[0] || 0;
            const isModelExhibit = exhibitConfidence >= this.gateConfig.threshold;
            const classifierAccepted = predictedClass === 'exhibit' && maxProb >= this.gateConfig.threshold;
            const similarityAccepted = !similarity || similarity.isSimilarToExhibit;
            const finalGateDecision = classifierAccepted || (maxProb < this.gateConfig.threshold && similarityAccepted)
                ? 'accepted'
                : 'noise_rejected';
            const isSimilarityExhibit = similarityAccepted;
            const isExhibit = finalGateDecision === 'accepted';

            if (classifierAccepted && finalGateDecision === 'noise_rejected') {
                console.error('GATE LOGIC ERROR: high-confidence exhibit was rejected');
            }

            console.log('Gate decision details:', {
                gateClass: predictedClass,
                gateConfidence: maxProb,
                requiredConfidence: this.gateConfig.threshold,
                classifierAccepted,
                similarityAccepted,
                finalGateDecision,
                exactRejectionCondition: !classifierAccepted && !similarityAccepted
            });

            console.log('Gate raw output:', rawOutput.map(value => value.toFixed(4)).join(', '));
            console.log('Gate probabilities:',
                this.gateConfig.classes.map((cls, idx) => `${cls}: ${((probabilities[idx] || 0) * 100).toFixed(1)}%`).join(' | '));

            return {
                isExhibit,
                isModelExhibit,
                isSimilarityExhibit,
                classifierAccepted,
                similarityAccepted,
                finalGateDecision,
                predictedClass,
                confidence: maxProb,
                exhibitConfidence,
                backgroundConfidence,
                threshold: this.gateConfig.threshold,
                probabilities,
                rawOutput,
                similarity
            };
        } finally {
            input.dispose();
        }
    }

    async logRejectedFrame(imageElement, reason, details = {}) {
        try {
            if (typeof window === 'undefined' || !window.localStorage || !imageElement) {
                return;
            }

            const size = 96;
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const width = imageElement.videoWidth || imageElement.width || size;
            const height = imageElement.videoHeight || imageElement.height || size;
            canvas.width = size;
            canvas.height = size;
            ctx.drawImage(imageElement, 0, 0, width, height, 0, 0, size, size);

            const existing = JSON.parse(window.localStorage.getItem(this.rejectedFrameLogKey) || '[]');
            const entry = {
                timestamp: new Date().toISOString(),
                reason,
                details,
                thumbnail: canvas.toDataURL('image/jpeg', 0.45)
            };
            const next = [entry, ...existing].slice(0, this.rejectedFrameLogLimit);
            window.localStorage.setItem(this.rejectedFrameLogKey, JSON.stringify(next));
        } catch (error) {
            console.warn('Rejected frame logging failed:', error.message);
        }
    }

    getRejectedFrameLogs() {
        try {
            if (typeof window === 'undefined' || !window.localStorage) {
                return [];
            }
            return JSON.parse(window.localStorage.getItem(this.rejectedFrameLogKey) || '[]');
        } catch {
            return [];
        }
    }

    downloadRejectedFrameLogs(filename = 'rejected-frame-logs.json') {
        try {
            if (typeof window === 'undefined' || typeof document === 'undefined') {
                return false;
            }
            const logs = this.getRejectedFrameLogs();
            const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            return true;
        } catch (error) {
            console.warn('Rejected frame log download failed:', error.message);
            return false;
        }
    }

    clearRejectedFrameLogs() {
        try {
            if (typeof window === 'undefined' || !window.localStorage) {
                return false;
            }
            window.localStorage.removeItem(this.rejectedFrameLogKey);
            return true;
        } catch {
            return false;
        }
    }

    async checkGateSimilarity(imageElement) {
        const vector = await this.extractSimilarityFeature(imageElement);
        const exhibitNearest = this.findNearestFeature(vector, this.gateSimilarityIndex.exhibit || []);
        const backgroundNearest = this.findNearestFeature(vector, this.gateSimilarityIndex.background || []);
        const baseMaxDistance = this.gateSimilarityIndex.maxNearestExhibitDistance || 0.22;
        const maxDistance = Math.min(baseMaxDistance, 0.24);
        const distanceMargin = 1.15;
        const isSimilarToExhibit =
            exhibitNearest.distance <= maxDistance &&
            exhibitNearest.distance <= backgroundNearest.distance * distanceMargin;

        console.log(
            `Gate similarity: exhibit=${exhibitNearest.distance.toFixed(4)} background=${backgroundNearest.distance.toFixed(4)} threshold=${maxDistance.toFixed(4)} accepted=${isSimilarToExhibit}`
        );

        return {
            isSimilarToExhibit,
            exhibitDistance: exhibitNearest.distance,
            backgroundDistance: backgroundNearest.distance,
            maxExhibitDistance: maxDistance,
            nearestExhibit: exhibitNearest.file,
            nearestBackground: backgroundNearest.file
        };
    }

    async extractSimilarityFeature(imageElement) {
        const size = this.gateSimilarityIndex?.imageSize || 64;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(imageElement, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;
        const total = size * size;

        const rgbHist = new Array(24).fill(0);
        const grayHist = new Array(12).fill(0);
        const grayValues = new Array(total);
        let saturationSum = 0;
        let brightnessSum = 0;

        for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            rgbHist[Math.min(7, Math.floor(r / 32))] += 1;
            rgbHist[8 + Math.min(7, Math.floor(g / 32))] += 1;
            rgbHist[16 + Math.min(7, Math.floor(b / 32))] += 1;

            const gray = Math.floor(0.299 * r + 0.587 * g + 0.114 * b);
            grayValues[p] = gray;
            grayHist[Math.min(11, Math.floor(gray / 22))] += 1;
            brightnessSum += gray / 255;

            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            saturationSum += max === 0 ? 0 : (max - min) / max;
        }

        const rgbNorm = rgbHist.map(value => value / (total * 3));
        const grayNorm = grayHist.map(value => value / total);
        const brightness = brightnessSum / total;
        const saturation = saturationSum / total;
        const grayMean = grayValues.reduce((sum, value) => sum + value, 0) / total;
        const contrast = Math.sqrt(grayValues.reduce((sum, value) => sum + (value - grayMean) ** 2, 0) / total) / 255;

        let edgeSum = 0;
        let edgeCount = 0;
        for (let y = 1; y < size - 1; y += 1) {
            for (let x = 1; x < size - 1; x += 1) {
                const idx = y * size + x;
                const gx = grayValues[idx + 1] - grayValues[idx - 1];
                const gy = grayValues[idx + size] - grayValues[idx - size];
                edgeSum += Math.min(255, Math.sqrt(gx * gx + gy * gy)) / 255;
                edgeCount += 1;
            }
        }
        const edgeMean = edgeCount ? edgeSum / edgeCount : 0;

        return [...rgbNorm, ...grayNorm, brightness, saturation, edgeMean, contrast];
    }

    findNearestFeature(vector, bank) {
        let best = { distance: Number.POSITIVE_INFINITY, file: null };
        for (const item of bank) {
            let sum = 0;
            for (let i = 0; i < vector.length; i += 1) {
                const diff = vector[i] - item.vector[i];
                sum += diff * diff;
            }
            const distance = Math.sqrt(sum);
            if (distance < best.distance) {
                best = { distance, file: item.file };
            }
        }
        return best;
    }

    async preprocessImageForONNX(imageElement, inputSize = 224, cropScale = 1) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const originalWidth = imageElement.videoWidth || imageElement.width || inputSize;
        const originalHeight = imageElement.videoHeight || imageElement.height || inputSize;
        canvas.width = originalWidth;
        canvas.height = originalHeight;
        ctx.drawImage(imageElement, 0, 0, originalWidth, originalHeight);

        const resizeCanvas = document.createElement('canvas');
        const resizeCtx = resizeCanvas.getContext('2d');
        resizeCanvas.width = inputSize;
        resizeCanvas.height = inputSize;
        const boundedCropScale = Math.max(0.35, Math.min(1, cropScale));
        const cropWidth = originalWidth * boundedCropScale;
        const cropHeight = originalHeight * boundedCropScale;
        const cropX = (originalWidth - cropWidth) / 2;
        const cropY = (originalHeight - cropHeight) / 2;
        resizeCtx.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, inputSize, inputSize);

        let imageTensor = tf.browser.fromPixels(resizeCanvas);
        if (imageTensor.shape[2] === 4) {
            imageTensor = imageTensor.slice([0, 0, 0], [-1, -1, 3]);
        }

        const float32 = imageTensor.cast('float32').div(255.0);
        const transposed = float32.transpose([2, 0, 1]);
        const batched = transposed.expandDims(0);

        imageTensor.dispose();
        float32.dispose();
        transposed.dispose();

        return batched;
    }

    async detectExhibit(imageElement) {
        const inferenceStartedAt = performance.now();
        try {
            if (!this.isInitialized) {
                throw new Error('Exhibit detection service not initialized');
            }

            console.log('🎯 Running exhibit classifier inference...');
            const startTime = performance.now();

            const input = this.model?.isONNX
                ? await this.preprocessImageForONNX(imageElement, this.config.inputSize || 224, 0.72)
                : await this.preprocessImage(imageElement);

            let predictions;
            if (this.model.isBackend) {
                console.log('✅ Using Python backend exhibit classifier');
                predictions = await this.model.predict(imageElement);
            } else if (this.model.isONNX) {
                console.log('✅ Using browser ONNX exhibit classifier');
                predictions = await this.runONNXInference(input);
            } else if (this.model.isTensorFlow) {
                console.log('✅ Using TensorFlow.js exhibit classifier');
                predictions = await this.model.predict(input);
            } else {
                throw new Error('No exhibit classifier model loaded');
            }

            let result;
            if (this.model.isBackend) {
                // Backend already returns processed results
                console.log('🏆 Using backend exhibit classifier');

                // Log top predictions dynamically based on actual predictions length
                const predictionEntries = Object.entries(predictions.predictions || {})
                    .map(([zone, conf]) => `${zone}: ${(conf * 100).toFixed(2)}%`)
                    .slice(0, 3); // Show top 3
                console.log(`🏆 MODEL RESULTS - ${predictionEntries.join(' | ')}`);

                // Create allDetections dynamically for all zones
                const allDetections = this.config.classes.map((cls, index) => ({
                    exhibit: this.config.exhibitMapping[cls] || cls.toLowerCase(),
                    class: cls,
                    confidence: predictions.predictions[index] || 0,
                    classId: index
                })).sort((a, b) => b.confidence - a.confidence);

                result = {
                    exhibit: predictions.exhibit,
                    class: predictions.class,
                    confidence: predictions.confidence,
                    classId: this.config.classes.indexOf(predictions.class),
                    allDetections,
                    metadata: {
                        model: 'backend_exhibit_classifier',
                        inputSize: this.config.inputSize,
                        classes: this.config.classes,
                        framework: 'PyTorch TorchScript (Backend)',
                        modelFile: 'exhibit_yolo_tiny.pt',
                        modelSize: 'Original PyTorch model',
                        realModel: true,
                        clientSide: false,
                        webCompatible: true,
                        inputFormat: 'RGB',
                        outputFormat: 'probabilities',
                        modelAccuracy: `${predictions.metadata?.accuracy || this.config.accuracy || 95.0}%`,
                        originalModel: this.metadata?.model_name || 'backend_exhibit_classifier',
                        modelType: this.metadata?.modelType || 'exhibit_classification'
                    }
                };
            } else {
                // Handle ONNX/TensorFlow.js predictions
                const rawPredictions = this.model.isONNX ? predictions : await predictions.data();
                console.log('🔍 Raw model predictions (logits):', Array.from(rawPredictions).map(p => p.toFixed(6)));
                console.log('🏆 Using exhibit classifier model');

                // ONNX model outputs raw logits, always apply softmax
                console.log('🎯 Converting logits to probabilities with softmax...');
                const rawPredictionArray = Array.from(rawPredictions);
                const rawSum = rawPredictionArray.reduce((sum, value) => sum + value, 0);
                const rawLooksLikeProbabilities =
                    rawPredictionArray.every(value => value >= 0 && value <= 1) &&
                    Math.abs(rawSum - 1) < 0.01;
                let probabilities;
                let logitsTensor = null;
                let probabilitiesTensor = null;

                if (rawLooksLikeProbabilities) {
                    probabilities = rawPredictionArray;
                } else {
                    logitsTensor = tf.tensor1d(rawPredictionArray);
                    probabilitiesTensor = tf.softmax(logitsTensor);
                    probabilities = Array.from(await probabilitiesTensor.data());
                }
                const numClasses = this.config.numClasses || rawPredictionArray.length;
                const finalPredictions = tf.tensor2d([probabilities], [1, numClasses]); // Updated for 10-class model

                // Cleanup intermediate tensors
                logitsTensor?.dispose();
                probabilitiesTensor?.dispose();

                // Log top 3 predictions for 10-class model
                const topPredictions = Array.from(probabilities)
                    .map((prob, idx) => ({ class: this.config.classes[idx], confidence: prob, idx }))
                    .sort((a, b) => b.confidence - a.confidence)
                    .slice(0, 3);

                console.log('🏆 Top 3 exhibit predictions:',
                    topPredictions.map(p => `${p.class}: ${(p.confidence * 100).toFixed(2)}%`).join(' | '));

                result = await this.postprocessPredictions(finalPredictions);

                // Cleanup final tensor
                finalPredictions.dispose();
            }

            // Cleanup (only for non-backend predictions)
            if (!this.model.isBackend) {
                input.dispose();
            }

            const processingTime = performance.now() - startTime;
            console.log(`🏆 Exhibit classifier inference complete in ${processingTime.toFixed(2)}ms`);

            const detectionResult = {
                ...result,
                success: true,
                processingTime,
                timestamp: Date.now()
            };

            if (!this.firstInferenceLogged) {
                this.firstInferenceLogged = true;
                console.log(`⏱️ First inference completed in ${(performance.now() - inferenceStartedAt).toFixed(0)}ms`);
            }
            return detectionResult;

        } catch (error) {
            console.error('❌ Exhibit classifier inference failed:', error);
            throw error;
        }
    }

    async runONNXInference(input) {
        try {
            // Convert TensorFlow.js tensor to ONNX format
            const inputData = await input.data();
            const inputArray = new Float32Array(inputData);

            // Get tensor shape from TensorFlow.js input
            const tensorShape = input.shape; // Should be [1, 3, 224, 224] for ONNX
            console.log('🔍 Input tensor shape:', tensorShape);

            // Create ONNX tensor
            const inputTensor = new ort.Tensor('float32', inputArray, tensorShape);

            // Get the actual input names from the model
            const inputNames = this.model.inputNames;
            const inputName = inputNames[0]; // Use the first (and likely only) input name

            console.log('🔍 ONNX model input names:', inputNames);
            console.log('🔍 Using input name:', inputName);
            console.log('🔍 Input tensor dims:', inputTensor.dims);

            // Run inference with correct input name
            const feeds = { [inputName]: inputTensor };
            const results = await this.model.run(feeds);

            // Extract output (assuming single output)
            const outputKey = Object.keys(results)[0];
            const outputTensor = results[outputKey];

            console.log('🎯 ONNX inference completed');
            console.log('🔍 Output tensor shape:', outputTensor.dims);
            console.log('🔍 Output data length:', outputTensor.data.length);

            return Array.from(outputTensor.data);

        } catch (error) {
            console.error('❌ ONNX inference failed:', error);
            console.error('🔍 Error details:', error.message);
            console.error('🔍 Input shape was:', input.shape);
            throw error;
        }
    }

    async predictViaBackend(imageElement) {
        try {
            // Convert image element to base64
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Get original frame size
            const originalWidth = imageElement.videoWidth || imageElement.width;
            const originalHeight = imageElement.videoHeight || imageElement.height;
            canvas.width = originalWidth;
            canvas.height = originalHeight;

            // Draw image to canvas
            ctx.drawImage(imageElement, 0, 0);

            // Convert to base64 (JPEG format for better performance)
            const base64Image = canvas.toDataURL('image/jpeg', 0.9);

            console.log('🌐 Sending image to backend...');

            // Send to backend
            const response = await fetch(`${this.backendUrl}/predict`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    image: base64Image
                })
            });

            if (!response.ok) {
                throw new Error(`Backend prediction failed: ${response.status}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(`Prediction error: ${result.error}`);
            }

            console.log('🎯 Backend prediction received');
            console.log(`🏆 Result: ${result.class} (${(result.confidence * 100).toFixed(1)}%)`);

            // Return in the format expected by the frontend
            return {
                success: true,
                predictions: [result.predictions.DWT, result.predictions.EAP],
                exhibit: result.exhibit,
                class: result.class,
                confidence: result.confidence,
                raw_outputs: result.raw_outputs,
                metadata: result.metadata
            };

        } catch (error) {
            console.error('❌ Backend prediction failed:', error);
            throw error;
        }
    }


    getModelInputSpec(model, metadata, modelName) {
        const inputName = model?.inputNames?.[0];
        const runtimeInput = inputName && model?.inputMetadata
            ? model.inputMetadata[inputName]
            : null;
        const rawShape = runtimeInput?.dimensions || runtimeInput?.shape ||
            metadata?.input_shape || metadata?.inputShape ||
            (modelName === 'CAESAR' ? [1, 3, 224, 224] : null);
        const shape = Array.isArray(rawShape)
            ? rawShape.map(dimension => Number.isFinite(Number(dimension)) ? Number(dimension) : null)
            : null;
        const isNCHW = shape?.length === 4 && shape[1] === 3 && shape[3] !== 3;
        const isNHWC = shape?.length === 4 && shape[3] === 3 && shape[1] !== 3;

        if (!shape || (!isNCHW && !isNHWC)) {
            throw new Error(`${modelName} input shape/layout is unavailable or unsupported: ${JSON.stringify(rawShape)}`);
        }

        return {
            inputName,
            shape,
            layout: isNCHW ? 'NCHW' : 'NHWC',
            inputSize: isNCHW ? shape[2] : shape[1]
        };
    }

    createValidatedONNXTensor(input, model, modelName, inputSpec, preprocessingConfig) {
        const actualShape = Array.from(input.shape, Number);
        const actualLength = input.size;
        const expectedLength = inputSpec.shape.reduce((total, dimension) =>
            dimension && dimension > 0 ? total * dimension : total, 1);
        const shapeMatches = actualShape.length === inputSpec.shape.length &&
            inputSpec.shape.every((dimension, index) => !dimension || dimension === actualShape[index]);

        console.log(`${modelName} preprocessing:`, {
            inputName: inputSpec.inputName,
            expectedShape: inputSpec.shape,
            actualShape,
            layout: inputSpec.layout,
            dataLength: actualLength,
            expectedDataLength: expectedLength,
            preprocessing: preprocessingConfig
        });

        if (!shapeMatches || actualLength !== expectedLength) {
            throw new Error(`${modelName} input validation failed: expected ${JSON.stringify(inputSpec.shape)} with ${expectedLength} values, got ${JSON.stringify(actualShape)} with ${actualLength} values`);
        }

        return new ort.Tensor('float32', new Float32Array(input.dataSync()), actualShape);
    }

    async preprocessImage(imageElement, preprocessing = null, layout = null, inputSize = 224) {
        try {
            console.log('🔄 Starting preprocessing pipeline (EXACT match to Python webcam_record.py)...');

            // Step 1: Convert video element to canvas (this gives us BGR-like format from video)
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Get original frame size
            const originalWidth = imageElement.videoWidth || imageElement.width;
            const originalHeight = imageElement.videoHeight || imageElement.height;
            canvas.width = originalWidth;
            canvas.height = originalHeight;

            console.log(`📷 Original frame size: ${originalWidth}x${originalHeight}`);
            ctx.drawImage(imageElement, 0, 0);

            // Step 2: Get image data and convert to RGB (matching Python: cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            // Note: HTML5 canvas already gives RGB, no conversion needed

            // Step 3: Match Ultralytics classify_transforms: resize the shortest
            // edge to 224, then take a centered 224x224 crop.
            const resizeCanvas = document.createElement('canvas');
            const resizeCtx = resizeCanvas.getContext('2d');
            resizeCanvas.width = inputSize;
            resizeCanvas.height = inputSize;
            const scale = inputSize / Math.min(originalWidth, originalHeight);
            const resizedWidth = Math.round(originalWidth * scale);
            const resizedHeight = Math.round(originalHeight * scale);
            const offsetX = (resizedWidth - 224) / 2;
            const offsetY = (resizedHeight - 224) / 2;
            resizeCtx.drawImage(canvas, -offsetX, -offsetY, resizedWidth, resizedHeight);
            console.log(`📐 Resized shortest edge to ${inputSize} and center-cropped to ${inputSize}x${inputSize}`);

            // Step 4: Convert to tensor in RGB format.
            let imageTensor = tf.browser.fromPixels(resizeCanvas);

            // Ensure 3 channels (RGB)
            if (imageTensor.shape[2] === 4) {
                imageTensor = imageTensor.slice([0, 0, 0], [-1, -1, 3]);
            }

            console.log(`🔍 Image tensor shape after fromPixels: ${imageTensor.shape}`);

            // Step 8: Convert to float32 and normalize to [0, 1] (matching Python: ToTensor())
            const float32 = imageTensor.cast('float32').div(255.0);

            // Debug: Check raw pixel values before normalization
            const rawSample = await float32.slice([0, 0, 0], [1, 1, 3]).data();
            console.log(`🔍 Raw pixel values [0-1]: [${Array.from(rawSample).map(v => v.toFixed(3)).join(', ')}]`);

            // Step 9: Apply the normalization declared by the deployed model metadata.
            console.log('🎯 Applying model-declared normalization...');

            const meanValues = preprocessing?.preprocessing?.mean || preprocessing?.mean || [0, 0, 0];
            const stdValues = preprocessing?.preprocessing?.std || preprocessing?.std || [1, 1, 1];

            console.log(`📊 Using normalization: mean=[${meanValues.join(', ')}], std=[${stdValues.join(', ')}]`);

            // Create tensors with the same shape as the image [224, 224, 3]
            const meanTensor = tf.tensor(meanValues).reshape([1, 1, 3]);
            const stdTensor = tf.tensor(stdValues).reshape([1, 1, 3]);
            const normalized = float32.sub(meanTensor).div(stdTensor);

            meanTensor.dispose();
            stdTensor.dispose();

            // Debug: check tensor values after normalization
            const normalizedSample = await normalized.slice([0, 0, 0], [1, 1, 3]).data();
            console.log(`🔍 Normalized values: [${Array.from(normalizedSample).map(v => v.toFixed(3)).join(', ')}]`);

            // Debug: Check tensor shape and value ranges
            console.log(`🔍 Normalized tensor shape: ${normalized.shape}`);
            const [minVal, maxVal] = await Promise.all([
                normalized.min().data(),
                normalized.max().data()
            ]);
            console.log(`🔍 Normalized value range: ${minVal[0].toFixed(3)} to ${maxVal[0].toFixed(3)}`);

            // Step 10: Add batch dimension and handle format based on model type
            let batched;
            if (layout === 'NCHW' || (!layout && this.model && this.model.isONNX)) {
                // For ONNX models, we need NCHW format [1, 3, 224, 224]
                const transposed = normalized.transpose([2, 0, 1]); // HWC -> CHW
                batched = transposed.expandDims(0); // Add batch dimension -> NCHW
                console.log(`✅ Final tensor shape: ${batched.shape} (NCHW format for ONNX)`);
                transposed.dispose();
            } else {
                // For TensorFlow.js models, use NHWC format [1, 224, 224, 3]
                batched = normalized.expandDims(0);
                console.log(`✅ Final tensor shape: ${batched.shape} (NHWC format for TensorFlow.js)`);
            }

            console.log('✅ Preprocessing pipeline complete - format matched to model requirements');

            // Cleanup intermediate tensors
            imageTensor.dispose();
            float32.dispose();
            normalized.dispose();

            return batched;

        } catch (error) {
            console.error('❌ Image preprocessing failed:', error);
            throw error;
        }
    }

    async postprocessPredictions(predictions) {
        try {
            const predictionData = await predictions.data();
            const probabilities = Array.from(predictionData);

            // Find the class with highest probability
            const maxProbIndex = probabilities.indexOf(Math.max(...probabilities));
            const predictedClass = this.config.classes[maxProbIndex];
            const confidence = probabilities[maxProbIndex];

            const sortedProbs = [...probabilities].sort((a, b) => b - a);
            const secondHighest = sortedProbs[1] || 0;
            const confidenceGap = confidence - secondHighest;
            const isLikelyBackground = confidenceGap < RECOGNITION_MIN_MARGIN;
            const isRecognized = confidence >= RECOGNITION_MIN_CONFIDENCE &&
                confidenceGap >= RECOGNITION_MIN_MARGIN &&
                predictedClass !== this.config.backgroundClass &&
                predictedClass !== 'UNKNOWN' &&
                predictedClass !== 'OTHER';
            const rankedIndices = probabilities
                .map((probability, index) => ({ probability, index }))
                .sort((first, second) => second.probability - first.probability);
            const secondIndex = rankedIndices[1]?.index;
            const top1 = {
                class: predictedClass,
                exhibit: this.config.exhibitMapping[predictedClass] || predictedClass,
                confidence
            };
            const top2Class = this.config.classes[secondIndex] || 'UNKNOWN';
            const top2 = {
                class: top2Class,
                exhibit: this.config.exhibitMapping[top2Class] || 'UNKNOWN',
                confidence: secondHighest
            };

            console.log(`🔍 Confidence analysis: Top: ${(confidence * 100).toFixed(1)}%, Second: ${(secondHighest * 100).toFixed(1)}%, Gap: ${(confidenceGap * 100).toFixed(1)}%`);

            if (isLikelyBackground) {
                console.log(`⚠️ Low confidence gap (${(confidenceGap * 100).toFixed(1)}%) - likely background/noise`);
            }

            // Map to exhibit key
            const exhibitKey = this.config.exhibitMapping[predictedClass] || 'unknown';

            // Create all detections array
            const allDetections = this.config.classes.map((cls, index) => ({
                exhibit: this.config.exhibitMapping[cls] || 'unknown',
                class: cls,
                confidence: probabilities[index] || 0,
                classId: index
            })).sort((a, b) => b.confidence - a.confidence);

            return {
                exhibit: isRecognized ? exhibitKey : 'UNKNOWN',
                class: isRecognized ? predictedClass : 'UNKNOWN',
                confidence,
                classId: maxProbIndex,
                allDetections,
                isLikelyBackground,
                isRecognized,
                top1,
                top2,
                confidenceGap,
                metadata: {
                    model: this.model.isONNX ?
                        (this.metadata?.model_name || 'YOLOv8s_exhibit_background_classifier_ONNX') :
                        (this.model.isTensorFlow ?
                            'TensorFlow.js_exhibit_classifier' :
                            'UNKNOWN_MODEL'),
                    inputSize: this.config.inputSize,
                    classes: this.config.classes,
                    framework: this.model.isONNX ? 'ONNX.js' : (this.model.isTensorFlow ? 'TensorFlow.js' : 'Unknown'),
                    modelFile: this.model.isONNX ? 'yolov8s_exhibit_fixed.onnx' : 'exhibit_classifier_tfjs',
                    modelSize: 'Browser model',
                    realModel: true,
                    clientSide: true,
                    webCompatible: true,
                    inputFormat: 'RGB',
                    outputFormat: 'probabilities',
                    modelAccuracy: this.metadata?.accuracy?.top1
                        ? `${(this.metadata.accuracy.top1 * 100).toFixed(2)}% top1`
                        : `${this.config.accuracy || 95.0}%`,
                    originalModel: this.model.isONNX ? 'yolov8s_exhibit_fixed.onnx' : 'exhibit_classifier_tfjs',
                    modelType: this.metadata?.modelType || 'exhibit_background_classification'
                }
            };

        } catch (error) {
            console.error('❌ Prediction postprocessing failed:', error);
            throw error;
        }
    }

    getExhibitDetails(exhibitKey) {
        const exhibitMap = {
            'dialogue_with_time': {
                id: 2,
                name: "Dialogue with Time",
                key: 'dialogue_with_time',
                description: "Dialogue with Time is an interactive exhibition that shows ageing from an original perspective. By 2030, one third of the world's population will be over the age of 65. As this is an important social issue, we aim for individuals to experience and understand more about the ageing process and reconsider their perception of ageing.",
                image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/dialogue-with-time/teasers/dialoguewithtime-teaser.jpg",
                hall: 'hall_b',
                mapPosition: { x: 35, y: 25 }
            },
            'earth_alive': {
                id: 4,
                name: "Earth Alive",
                key: 'earth_alive',
                description: "The Earth is constantly changing. Some changes are incremental, some are split-second, but both can result in violent events that devastate human communities. Experience Earth Alive, where you can encounter forces and processes that underlie Earth's changes.",
                image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/earth-alive/teaser-image/earth-alive-web-teaser.jpg",
                hall: 'hall_b',
                mapPosition: { x: 75, y: 35 }
            }
        };

        return exhibitMap[exhibitKey] || null;
    }

    async runZoneSpecificInference(imageElement, zone) {
        console.log(`🎯 Running zone-specific inference for ${zone}...`);
        const inferenceStartedAt = performance.now();
        // Get zone-specific model and metadata
        const zoneMap = {
            'AT': { model: this.atModel, metadata: this.atMetadata, name: 'Atrium', emoji: '🏛️' },
            'BTN': { model: this.btnModel, metadata: this.btnMetadata, name: 'Bioethics', emoji: '🧬' },
            'CCP': { model: this.ccpModel, metadata: this.ccpMetadata, name: 'Climate Changed', emoji: '🌡️' },
            'DWT': { model: this.dwtModel, metadata: this.dwtMetadata, name: 'Dialogue with Time', emoji: '🧠' },
            'EAP': { model: this.eapModel, metadata: this.eapMetadata, name: 'Earth Alive Planet', emoji: '🌍' },
            'EGN': { model: this.egnModel, metadata: this.egnMetadata, name: 'Energy Story', emoji: '⚙️' },
            'ARICC': { model: this.ariccModel, metadata: this.ariccMetadata, name: 'ARICC', emoji: '🏭' },
            'RECON': { model: this.reconModel, metadata: this.reconMetadata, name: 'RECON Center', emoji: '🔬' },
            'FABLAB': { model: this.fablabModel, metadata: this.fablabMetadata, name: 'FABLAB', emoji: '🛠️' },
            'CAESAR': { model: this.caesarModel, metadata: this.caesarMetadata, name: 'CAESAR', emoji: '🧪' },
            'MAC': { model: this.macModel, metadata: this.macMetadata, name: 'Mechanics Alive', emoji: '🔧' },
            'MEP': { model: this.mepModel, metadata: this.mepMetadata, name: 'Mind Eye', emoji: '👁️' },
            'QS': { model: this.qsModel, metadata: this.qsMetadata, name: 'Quanta School', emoji: '🎓' },
            'UMP': { model: this.umpModel, metadata: this.umpMetadata, name: 'Urban Mutations', emoji: '🏙️' }
        };

        const zoneInfo = zoneMap[zone];
        if (!zoneInfo) {
            throw new Error(`Unknown zone: ${zone}`);
        }

        const model = zoneInfo.model;
        const metadata = zoneInfo.metadata;
        console.log(`${zoneInfo.emoji} Using ${zoneInfo.name} model with ${metadata?.num_classes || metadata?.classes?.length || 'unknown'} classes`);

        const inputSpec = this.getModelInputSpec(model, metadata, zoneInfo.name);
        const input = await this.preprocessImage(
            imageElement,
            metadata,
            inputSpec.layout,
            inputSpec.inputSize || 224
        );
        console.log('🔍 Preprocessed input shape:', input.shape);
        const actualFormat = input.shape.length === 4 && input.shape[1] === 3 && input.shape[3] !== 3
            ? 'NCHW'
            : input.shape.length === 4 && input.shape[3] === 3 && input.shape[1] !== 3
                ? 'NHWC'
                : 'UNKNOWN';
        console.log('🔍 Input tensor format check:', actualFormat);
        const inputTensor = this.createValidatedONNXTensor(
            input,
            model,
            zoneInfo.name,
            inputSpec,
            {
                layout: inputSpec.layout,
                inputSize: inputSpec.inputSize,
                mean: metadata?.preprocessing?.mean || metadata?.mean || [0, 0, 0],
                std: metadata?.preprocessing?.std || metadata?.std || [1, 1, 1]
            }
        );
        console.log('🔍 Zone-specific input tensor shape:', inputTensor.dims);

        // Run inference
        console.log(`⚡ Running ${zone} model inference...`);
        const results = await model.run({ [model.inputNames[0]]: inputTensor });
        const rawOutput = results[model.outputNames[0]]?.data;
        const outputValues = rawOutput ? Array.from(rawOutput, Number) : [];
        const expectedClassCount = metadata?.displayNames?.length || metadata?.classes?.length;
        if (!expectedClassCount || outputValues.length !== expectedClassCount || outputValues.some(value => !Number.isFinite(value))) {
            throw new Error(`${zone} model returned invalid output values: expected ${expectedClassCount || 'known'} finite values, received ${outputValues.length}`);
        }
        console.log(`📊 ${zone} model raw output:`, outputValues.slice(0, 5), '...'); // Show first 5 values

        // Classifier exports may return logits or probabilities. Preserve probabilities
        // that already sum to one; only apply softmax to finite logits.
        const outputSum = outputValues.reduce((sum, value) => sum + value, 0);
        const looksLikeProbabilities = outputValues.every(value => value >= 0 && value <= 1) &&
            Math.abs(outputSum - 1) < 0.01;
        const probabilities = looksLikeProbabilities ? outputValues : this.softmax(outputValues);
        if (probabilities.some(value => !Number.isFinite(value))) {
            throw new Error(`${zone} model produced non-finite probabilities`);
        }
        const predictedIdx = probabilities.indexOf(Math.max(...probabilities));
        const confidence = probabilities[predictedIdx];
        // Handle different metadata formats (classes vs class_names)
        const displayNames = metadata.displayNames || metadata.display_names || [];
        const classNames = metadata.class_names || metadata.classes || displayNames;
        const exhibit = displayNames[predictedIdx] || classNames[predictedIdx];

        if (!exhibit) {
            console.error(`❌ No class name found for index ${predictedIdx} in ${zone} metadata`);
            console.error('Available classes:', classNames);
            throw new Error(`Invalid class index ${predictedIdx} for zone ${zone}`);
        }

        // Add confidence validation for zone-specific models too
        const sortedProbs = [...probabilities].sort((a, b) => b - a);
        const secondHighest = sortedProbs[1];
        const confidenceGap = Number.isFinite(secondHighest) && Number.isFinite(confidence)
            ? Math.max(0, confidence - secondHighest)
            : 0;
        const isUnknownBackground = exhibit.trim().toLowerCase().replace(/[\s-]+/g, '_') === 'unknown_background';
        const isLikelyBackground = isUnknownBackground || confidenceGap < RECOGNITION_MIN_MARGIN;
        const isRecognized = confidence >= RECOGNITION_MIN_CONFIDENCE &&
            confidenceGap >= RECOGNITION_MIN_MARGIN &&
            exhibit !== 'UNKNOWN' && exhibit !== 'OTHER' &&
            exhibit.toLowerCase() !== 'unknown_background';
        const rankedPredictions = probabilities
            .map((probability, index) => ({
                class: classNames[index] || `Unknown_${index}`,
                exhibit: displayNames[index] || classNames[index] || 'UNKNOWN',
                confidence: probability
            }))
            .sort((first, second) => second.confidence - first.confidence);

        console.log(`✅ ${zone} model result: ${exhibit} (${(confidence * 100).toFixed(1)}% confidence)`);
        console.log(`🔍 ${zone} confidence gap: ${(confidenceGap * 100).toFixed(1)}%`);
        console.log(`🏆 Top 3 ${zone} predictions:`,
            probabilities.map((prob, idx) => ({ exhibit: classNames[idx] || `Unknown_${idx}`, confidence: prob }))
                .sort((a, b) => b.confidence - a.confidence)
                .slice(0, 3)
                .map(p => `${p.exhibit}: ${(p.confidence * 100).toFixed(1)}%`)
        );

        if (isLikelyBackground) {
            console.log(`⚠️ ${zone} model: Low or unavailable confidence gap - likely background/noise`);
        }

        return {
            exhibit,
            displayName: isRecognized ? (displayNames[predictedIdx] || exhibit) : 'UNKNOWN',
            classCode: zone === 'RECON' ? `RECON-${predictedIdx + 1}` : classNames[predictedIdx],
            confidence,
            isLikelyBackground,
            confidenceGap,
            isRecognized,
            top1: rankedPredictions[0],
            top2: rankedPredictions[1] || { class: 'UNKNOWN', exhibit: 'UNKNOWN', confidence: 0 },
            processingTime: performance.now() - inferenceStartedAt
        };
    }

    convertToONNXTensor(tensorflowTensor) {
        // TensorFlow.js gives us [1, 224, 224, 3] (NHWC)
        // ONNX expects [1, 3, 224, 224] (NCHW)
        const data = tensorflowTensor.dataSync();
        const [batch, height, width, channels] = tensorflowTensor.shape;

        // Reshape from NHWC to NCHW
        const reshapedData = new Float32Array(batch * channels * height * width);
        for (let b = 0; b < batch; b++) {
            for (let c = 0; c < channels; c++) {
                for (let h = 0; h < height; h++) {
                    for (let w = 0; w < width; w++) {
                        const nhwcIndex = b * height * width * channels + h * width * channels + w * channels + c;
                        const nchwIndex = b * channels * height * width + c * height * width + h * width + w;
                        reshapedData[nchwIndex] = data[nhwcIndex];
                    }
                }
            }
        }

        const onnxShape = [batch, channels, height, width];
        return new ort.Tensor('float32', reshapedData, onnxShape);
    }

    parseExhibitInfo(exhibitName) {
        const codeMatch = exhibitName.match(/^(DWT|EAP|EGN)-(\d+)[_\s](.+)$/i);
        if (codeMatch) {
            const [, zone, number, name] = codeMatch;
            return {
                zone: zone.toUpperCase(),
                number,
                displayName: name.replace(/_/g, ' ').trim(),
                code: exhibitName
            };
        }

        const zoneOnly = this.config.exhibitMapping[exhibitName] || exhibitName;
        return {
            zone: exhibitName,
            number: '00',
            displayName: zoneOnly,
            code: exhibitName
        };
    }

    getExhibitCoordinates(zone, exhibitNumber) {
        // Basic coordinate mapping - can be enhanced with real coordinates
        const coordinates = {
            DWT: {
                default: { x: 45, y: 55, area: "Dialogue with Time Zone" }
            },
            EAP: {
                default: { x: 55, y: 45, area: "Earth & Planetary Zone" }
            }
        };
        return coordinates[zone]?.[exhibitNumber] || coordinates[zone]?.default || { x: 50, y: 50, area: "Unknown" };
    }

    softmax(logits) {
        // Apply softmax to convert logits to probabilities
        const maxLogit = Math.max(...logits);
        const expValues = logits.map(logit => Math.exp(logit - maxLogit));
        const sumExp = expValues.reduce((sum, exp) => sum + exp, 0);
        return expValues.map(exp => exp / sumExp);
    }

    dispose() {
        if (this.model && typeof this.model.dispose === 'function') {
            try {
                this.model.dispose();
                console.log('🗑️ TensorFlow.js model disposed');
            } catch (error) {
                console.warn('⚠️ Error disposing TensorFlow.js model:', error);
            }
        }
        this.model = null;
        this.metadata = null;
        this.isInitialized = false;
        console.log('🏛️ Exhibit detection service disposed');
    }
}

// Create singleton instance
const exhibitDetectionService = new ExhibitDetectionService();

export default exhibitDetectionService;
