import { logger } from '../utils/logger.js';
import { memoryMonitor } from '../utils/memoryMonitor.js';

// 404 Not Found handler
export function notFoundHandler(req, res, next) {
    const error = {
        success: false,
        error: 'Endpoint not found',
        message: `The requested endpoint ${req.method} ${req.path} was not found`,
        timestamp: new Date().toISOString(),
        requestId: req.requestId
    };

    logger.warn(`🔍 404 Not Found: ${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        requestId: req.requestId
    });

    res.status(404).json(error);
}

// Global error handler
export function errorHandler(err, req, res, next) {
    // Log the error
    logger.error('❌ Unhandled error:', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        requestId: req.requestId,
        body: req.body ? Object.keys(req.body) : undefined
    });

    // Check memory usage after error
    const memoryUsage = memoryMonitor.getMemoryUsage();
    if (memoryUsage.heapUsed > 800) {
        logger.warn('⚠️  High memory usage detected after error, triggering cleanup');
        memoryMonitor.performCleanup();
    }

    // Determine error type and status code
    let statusCode = 500;
    let errorMessage = 'Internal server error';
    let errorType = 'ServerError';

    if (err.name === 'ValidationError') {
        statusCode = 400;
        errorMessage = 'Validation failed';
        errorType = 'ValidationError';
    } else if (err.name === 'CastError') {
        statusCode = 400;
        errorMessage = 'Invalid data format';
        errorType = 'CastError';
    } else if (err.message.includes('timeout')) {
        statusCode = 504;
        errorMessage = 'Request timeout';
        errorType = 'TimeoutError';
    } else if (err.message.includes('not found')) {
        statusCode = 404;
        errorMessage = 'Resource not found';
        errorType = 'NotFoundError';
    } else if (err.message.includes('unauthorized')) {
        statusCode = 401;
        errorMessage = 'Unauthorized access';
        errorType = 'AuthError';
    } else if (err.message.includes('forbidden')) {
        statusCode = 403;
        errorMessage = 'Access forbidden';
        errorType = 'ForbiddenError';
    } else if (err.code === 'ECONNREFUSED') {
        statusCode = 503;
        errorMessage = 'Service unavailable';
        errorType = 'ServiceError';
    } else if (err.code === 'ENOTFOUND') {
        statusCode = 502;
        errorMessage = 'External service not found';
        errorType = 'ExternalServiceError';
    }

    // Handle specific AI model errors
    if (err.message.includes('model not initialized') || err.message.includes('model not available')) {
        statusCode = 503;
        errorMessage = 'AI service temporarily unavailable';
        errorType = 'ModelError';
    }

    // Handle file upload errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        statusCode = 413;
        errorMessage = 'File too large';
        errorType = 'FileUploadError';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        statusCode = 400;
        errorMessage = 'Unexpected file in upload';
        errorType = 'FileUploadError';
    }

    // Prepare error response
    const errorResponse = {
        success: false,
        error: errorMessage,
        type: errorType,
        timestamp: new Date().toISOString(),
        requestId: req.requestId
    };

    // Add additional details in development mode
    if (process.env.NODE_ENV === 'development') {
        errorResponse.details = {
            message: err.message,
            stack: err.stack?.split('\n').slice(0, 5), // First 5 lines of stack trace
            path: req.path,
            method: req.method
        };
    }

    // Add specific error details based on error type
    if (errorType === 'ValidationError' && err.errors) {
        errorResponse.validationErrors = Object.keys(err.errors).map(field => ({
            field,
            message: err.errors[field].message
        }));
    }

    if (errorType === 'ModelError') {
        errorResponse.suggestion = 'The AI models are currently loading or unavailable. Please try again in a few moments.';
    }

    if (errorType === 'FileUploadError') {
        errorResponse.maxFileSize = '50MB';
        errorResponse.allowedTypes = ['image/jpeg', 'image/png', 'audio/mpeg', 'audio/wav'];
    }

    // Send error response
    res.status(statusCode).json(errorResponse);
}

// Async error wrapper for route handlers
export function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

// Memory error handler
export function handleMemoryError(err, req, res, next) {
    if (err.message.includes('out of memory') || err.code === 'ERR_MEMORY_ALLOCATION_FAILED') {
        logger.error('🚨 Memory allocation error detected');

        // Trigger emergency cleanup
        memoryMonitor.emergencyCleanup();

        return res.status(507).json({
            success: false,
            error: 'Insufficient memory',
            message: 'The server is currently experiencing high memory usage. Please try again later.',
            type: 'MemoryError',
            timestamp: new Date().toISOString(),
            requestId: req.requestId,
            suggestion: 'Try reducing the image size or number of concurrent requests'
        });
    }

    next(err);
}

// TensorFlow error handler
export function handleTensorFlowError(err, req, res, next) {
    if (err.message.includes('tensor') || err.message.includes('TensorFlow') || err.name === 'DataLossError') {
        logger.error('🤖 TensorFlow error detected:', err.message);

        return res.status(503).json({
            success: false,
            error: 'AI model processing error',
            message: 'There was an error processing your request with the AI models. Please try again.',
            type: 'TensorFlowError',
            timestamp: new Date().toISOString(),
            requestId: req.requestId,
            suggestion: 'Check that the image is valid and try again. If the problem persists, contact support.'
        });
    }

    next(err);
}

// API rate limit error handler
export function handleRateLimitError(err, req, res, next) {
    if (err.type === 'RateLimitError') {
        return res.status(429).json({
            success: false,
            error: 'Rate limit exceeded',
            message: 'Too many requests from this client. Please slow down.',
            type: 'RateLimitError',
            timestamp: new Date().toISOString(),
            requestId: req.requestId,
            retryAfter: err.retryAfter || 60
        });
    }

    next(err);
}

// External service error handler (for AssemblyAI, etc.)
export function handleExternalServiceError(err, req, res, next) {
    if (err.response && err.response.status >= 400) {
        logger.error('🌐 External service error:', {
            service: err.config?.baseURL || 'Unknown',
            status: err.response.status,
            message: err.message
        });

        return res.status(502).json({
            success: false,
            error: 'External service error',
            message: 'An external service required for this request is currently unavailable.',
            type: 'ExternalServiceError',
            timestamp: new Date().toISOString(),
            requestId: req.requestId,
            suggestion: 'Please try again later. If the problem persists, contact support.'
        });
    }

    next(err);
}

// Create comprehensive error handling middleware stack
export function createErrorHandlingMiddleware() {
    return [
        handleMemoryError,
        handleTensorFlowError,
        handleRateLimitError,
        handleExternalServiceError,
        errorHandler
    ];
}