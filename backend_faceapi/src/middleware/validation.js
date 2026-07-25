import { logger } from '../utils/logger.js';

// Validate image input middleware
export function validateImageInput(req, res, next) {
    try {
        const { image } = req.body;

        if (!image) {
            return res.status(400).json({
                success: false,
                error: 'No image data provided',
                message: 'Please provide a base64 encoded image in the request body'
            });
        }

        if (typeof image !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Invalid image format',
                message: 'Image must be a base64 encoded string'
            });
        }

        // Check if it's a valid base64 image string
        const base64Regex = /^data:image\/(jpeg|jpg|png|webp|gif);base64,/;
        const pureBase64Regex = /^[A-Za-z0-9+/]*={0,2}$/;

        let isValidBase64 = false;
        let cleanedImage = image;

        if (base64Regex.test(image)) {
            // Extract base64 part from data URL
            cleanedImage = image.replace(/^data:image\/[a-z]+;base64,/, '');
            isValidBase64 = pureBase64Regex.test(cleanedImage);
        } else if (pureBase64Regex.test(image)) {
            // Pure base64 string
            isValidBase64 = true;
        }

        if (!isValidBase64) {
            return res.status(400).json({
                success: false,
                error: 'Invalid base64 image format',
                message: 'Please provide a valid base64 encoded image'
            });
        }

        // Check image size (approximate)
        const imageSizeBytes = (cleanedImage.length * 3) / 4;
        const maxSizeMB = 10;
        const maxSizeBytes = maxSizeMB * 1024 * 1024;

        if (imageSizeBytes > maxSizeBytes) {
            return res.status(400).json({
                success: false,
                error: 'Image too large',
                message: `Image must be less than ${maxSizeMB}MB`
            });
        }

        // Add cleaned image to request for downstream processing
        req.cleanedImage = cleanedImage;

        next();

    } catch (error) {
        logger.error('❌ Image validation failed:', error);
        return res.status(400).json({
            success: false,
            error: 'Image validation failed',
            message: error.message
        });
    }
}

// Validate model manager availability
export function validateModelManager(req, res, next) {
    try {
        const modelManager = req.app.locals.modelManager;

        if (!modelManager) {
            return res.status(500).json({
                success: false,
                error: 'Model manager not available',
                message: 'AI models are not initialized. Please try again later.'
            });
        }

        if (!modelManager.isInitialized) {
            return res.status(503).json({
                success: false,
                error: 'Models not initialized',
                message: 'AI models are still loading. Please try again in a few moments.',
                retry_after: 10
            });
        }

        next();

    } catch (error) {
        logger.error('❌ Model manager validation failed:', error);
        return res.status(500).json({
            success: false,
            error: 'Model validation failed',
            message: error.message
        });
    }
}

// API key validation middleware (optional)
export function validateApiKey(req, res, next) {
    try {
        const apiKey = process.env.API_KEY;

        // Skip validation if no API key is configured
        if (!apiKey) {
            return next();
        }

        const clientApiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

        if (!clientApiKey) {
            return res.status(401).json({
                success: false,
                error: 'API key required',
                message: 'Please provide an API key in the X-API-Key header or Authorization header'
            });
        }

        if (clientApiKey !== apiKey) {
            return res.status(403).json({
                success: false,
                error: 'Invalid API key',
                message: 'The provided API key is not valid'
            });
        }

        next();

    } catch (error) {
        logger.error('❌ API key validation failed:', error);
        return res.status(500).json({
            success: false,
            error: 'Authentication failed',
            message: error.message
        });
    }
}

// Rate limiting validation (simple implementation)
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000; // 15 minutes
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;

export function validateRateLimit(req, res, next) {
    try {
        const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
        const now = Date.now();

        // Clean up old entries
        for (const [ip, data] of requestCounts.entries()) {
            if (now - data.firstRequest > RATE_LIMIT_WINDOW) {
                requestCounts.delete(ip);
            }
        }

        // Get or create client data
        let clientData = requestCounts.get(clientIp);
        if (!clientData) {
            clientData = {
                count: 0,
                firstRequest: now
            };
            requestCounts.set(clientIp, clientData);
        }

        // Check if within rate limit
        if (clientData.count >= RATE_LIMIT_MAX) {
            const resetTime = clientData.firstRequest + RATE_LIMIT_WINDOW;
            const retryAfter = Math.ceil((resetTime - now) / 1000);

            return res.status(429).json({
                success: false,
                error: 'Rate limit exceeded',
                message: `Too many requests. Please try again after ${retryAfter} seconds.`,
                retry_after: retryAfter,
                limit: RATE_LIMIT_MAX,
                window: RATE_LIMIT_WINDOW / 1000
            });
        }

        // Increment counter
        clientData.count++;

        // Add rate limit headers
        res.set({
            'X-RateLimit-Limit': RATE_LIMIT_MAX,
            'X-RateLimit-Remaining': Math.max(0, RATE_LIMIT_MAX - clientData.count),
            'X-RateLimit-Reset': new Date(clientData.firstRequest + RATE_LIMIT_WINDOW).toISOString()
        });

        next();

    } catch (error) {
        logger.error('❌ Rate limit validation failed:', error);
        // Don't block on rate limit errors, just log and continue
        next();
    }
}

// Request validation middleware (combines common validations)
export function validateRequest(req, res, next) {
    // Basic request validation
    if (!req.body && req.method === 'POST') {
        return res.status(400).json({
            success: false,
            error: 'Empty request body',
            message: 'POST request must include a request body'
        });
    }

    // Set request ID for tracing
    req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    logger.debug(`📝 Request ${req.requestId}: ${req.method} ${req.path}`);

    next();
}