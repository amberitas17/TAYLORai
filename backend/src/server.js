import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createServer } from 'http';

import { ModelManager } from './models/ModelManager.js';
import { setupRoutes } from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { memoryMonitor } from './utils/memoryMonitor.js';
import { logger } from './utils/logger.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class SSCPersonDetectionServer {
    constructor() {
        this.app = express();
        this.server = null;
        this.modelManager = null;
        this.port = process.env.PORT || 3000;
        this.isShuttingDown = false;
    }

    async initialize() {
        try {
            logger.info('🚀 Initializing SSC Person Detection Backend...');

            // Configure Express middleware
            this.setupMiddleware();

            // Initialize model manager
            logger.info('📊 Loading AI models...');
            this.modelManager = new ModelManager();
            await this.modelManager.initializeModels();

            // Make model manager available to routes
            this.app.locals.modelManager = this.modelManager;

            // Setup routes
            setupRoutes(this.app);

            // Setup error handling
            this.setupErrorHandling();

            // Start memory monitoring
            memoryMonitor.start();

            logger.info('✅ Server initialization complete');

        } catch (error) {
            logger.error('❌ Server initialization failed:', error);
            throw error;
        }
    }

    setupMiddleware() {
        // Security middleware
        this.app.use(helmet({
            crossOriginResourcePolicy: { policy: "cross-origin" }
        }));

        // CORS configuration
        const corsOptions = {
            origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
            credentials: true
        };
        this.app.use(cors(corsOptions));

        // Compression
        this.app.use(compression());

        // Request logging
        if (process.env.NODE_ENV !== 'test') {
            this.app.use(morgan('combined', {
                stream: { write: message => logger.info(message.trim()) }
            }));
        }

        // Body parsing
        this.app.use(express.json({ limit: '50mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));

        // Health check endpoint (before other routes)
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memory: {
                    used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                    total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
                    limit: process.env.MAX_MEMORY_MB || 1024
                },
                models: this.modelManager ? this.modelManager.getModelStatus() : 'not initialized'
            });
        });
    }

    setupErrorHandling() {
        // 404 handler
        this.app.use(notFoundHandler);

        // Global error handler
        this.app.use(errorHandler);

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception:', error);
            this.gracefulShutdown('uncaughtException');
        });

        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
            this.gracefulShutdown('unhandledRejection');
        });

        // Handle process signals
        process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    }

    async start() {
        try {
            await this.initialize();

            this.server = createServer(this.app);

            this.server.listen(this.port, '0.0.0.0', () => {
                logger.info(`🌐 SSC Person Detection Backend running on http://0.0.0.0:${this.port}`);
                logger.info(`📊 Model Status: ${JSON.stringify(this.modelManager.getModelStatus())}`);
                logger.info(`🎯 Environment: ${process.env.NODE_ENV}`);
                logger.info(`💾 Memory Limit: ${process.env.MAX_MEMORY_MB || 1024}MB`);
            });

            // Handle server errors
            this.server.on('error', (error) => {
                if (error.code === 'EADDRINUSE') {
                    logger.error(`❌ Port ${this.port} is already in use`);
                } else {
                    logger.error('❌ Server error:', error);
                }
                process.exit(1);
            });

        } catch (error) {
            logger.error('❌ Failed to start server:', error);
            process.exit(1);
        }
    }

    async gracefulShutdown(signal) {
        if (this.isShuttingDown) {
            logger.warn('⚠️  Shutdown already in progress...');
            return;
        }

        this.isShuttingDown = true;
        logger.info(`🛑 Received ${signal}. Starting graceful shutdown...`);

        try {
            // Stop accepting new connections
            if (this.server) {
                this.server.close(() => {
                    logger.info('✅ HTTP server closed');
                });
            }

            // Stop memory monitor
            memoryMonitor.stop();

            // Cleanup models
            if (this.modelManager) {
                await this.modelManager.cleanup();
                logger.info('✅ Models cleaned up');
            }

            // Force exit after timeout
            setTimeout(() => {
                logger.error('❌ Forced shutdown due to timeout');
                process.exit(1);
            }, 10000);

            logger.info('✅ Graceful shutdown complete');
            process.exit(0);

        } catch (error) {
            logger.error('❌ Error during shutdown:', error);
            process.exit(1);
        }
    }
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const server = new SSCPersonDetectionServer();
    server.start().catch(error => {
        logger.error('❌ Failed to start server:', error);
        process.exit(1);
    });
}

export { SSCPersonDetectionServer };