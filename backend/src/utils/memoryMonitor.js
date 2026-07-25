import { logger } from './logger.js';

class MemoryMonitor {
    constructor() {
        this.maxMemoryMB = parseInt(process.env.MAX_MEMORY_MB || '1024');
        this.checkInterval = parseInt(process.env.CLEANUP_INTERVAL_MS || '60000');
        this.intervalId = null;
        this.isMonitoring = false;
    }

    start() {
        if (this.isMonitoring) {
            logger.warn('Memory monitor already running');
            return;
        }

        this.isMonitoring = true;
        logger.info(`📊 Starting memory monitor (limit: ${this.maxMemoryMB}MB, interval: ${this.checkInterval}ms)`);

        this.intervalId = setInterval(() => {
            this.checkMemoryUsage();
        }, this.checkInterval);

        // Initial check
        this.checkMemoryUsage();
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isMonitoring = false;
        logger.info('📊 Memory monitor stopped');
    }

    checkMemoryUsage() {
        const memUsage = process.memoryUsage();
        const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
        const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
        const rssMB = Math.round(memUsage.rss / 1024 / 1024);

        const memoryInfo = {
            heapUsed: heapUsedMB,
            heapTotal: heapTotalMB,
            rss: rssMB,
            external: Math.round(memUsage.external / 1024 / 1024),
            usage: Math.round((heapUsedMB / this.maxMemoryMB) * 100)
        };

        // Log memory usage
        if (memoryInfo.usage > 80) {
            logger.warn(`⚠️  High memory usage: ${JSON.stringify(memoryInfo)}MB`);
        } else if (memoryInfo.usage > 90) {
            logger.error(`🚨 Critical memory usage: ${JSON.stringify(memoryInfo)}MB`);
        } else {
            logger.debug(`📊 Memory usage: ${JSON.stringify(memoryInfo)}MB`);
        }

        // Trigger cleanup if memory usage is high
        if (heapUsedMB > this.maxMemoryMB * 0.8) {
            logger.warn(`🧹 Memory usage (${heapUsedMB}MB) approaching limit (${this.maxMemoryMB}MB), triggering cleanup`);
            this.performCleanup();
        }

        return memoryInfo;
    }

    performCleanup() {
        logger.info('🧹 Performing memory cleanup...');

        // Force garbage collection if available
        if (global.gc) {
            global.gc();
            logger.debug('🗑️  Manual garbage collection performed');
        } else {
            logger.debug('🗑️  Manual garbage collection not available');
        }

        // Additional cleanup can be added here
        // For example, clearing caches, disposing of unused resources, etc.

        // Log memory after cleanup
        setTimeout(() => {
            const afterCleanup = this.getMemoryUsage();
            logger.info(`🧹 Memory after cleanup: ${JSON.stringify(afterCleanup)}MB`);
        }, 1000);
    }

    getMemoryUsage() {
        const memUsage = process.memoryUsage();
        return {
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
            rss: Math.round(memUsage.rss / 1024 / 1024),
            external: Math.round(memUsage.external / 1024 / 1024)
        };
    }

    // Emergency cleanup for critical memory situations
    emergencyCleanup() {
        logger.error('🚨 Emergency memory cleanup initiated');

        // Multiple rounds of garbage collection
        if (global.gc) {
            for (let i = 0; i < 5; i++) {
                global.gc();
                logger.debug(`🗑️  Emergency GC round ${i + 1}`);
            }
        }

        // Log results
        const afterEmergency = this.getMemoryUsage();
        logger.error(`🚨 Memory after emergency cleanup: ${JSON.stringify(afterEmergency)}MB`);

        return afterEmergency;
    }
}

export const memoryMonitor = new MemoryMonitor();