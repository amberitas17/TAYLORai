import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';

class Logger {
    constructor() {
        this.logLevel = process.env.LOG_LEVEL || 'info';
        this.logFile = process.env.LOG_FILE;
        this.logStream = null;

        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };

        this.initializeFileLogging();
    }

    async initializeFileLogging() {
        if (this.logFile) {
            try {
                await mkdir(dirname(this.logFile), { recursive: true });
                this.logStream = createWriteStream(this.logFile, { flags: 'a' });
            } catch (error) {
                console.error('Failed to initialize file logging:', error);
            }
        }
    }

    shouldLog(level) {
        return this.levels[level] <= this.levels[this.logLevel];
    }

    formatMessage(level, message, ...args) {
        const timestamp = new Date().toISOString();
        const formattedMessage = typeof message === 'string'
            ? message
            : JSON.stringify(message, null, 2);

        const additionalArgs = args.length > 0
            ? ' ' + args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ')
            : '';

        return `[${timestamp}] [${level.toUpperCase()}] ${formattedMessage}${additionalArgs}`;
    }

    log(level, message, ...args) {
        if (!this.shouldLog(level)) return;

        const formattedMessage = this.formatMessage(level, message, ...args);

        // Console output with colors
        const colors = {
            error: '\x1b[31m', // Red
            warn: '\x1b[33m',  // Yellow
            info: '\x1b[36m',  // Cyan
            debug: '\x1b[37m'  // White
        };

        const reset = '\x1b[0m';
        console.log(`${colors[level] || ''}${formattedMessage}${reset}`);

        // File output
        if (this.logStream) {
            this.logStream.write(formattedMessage + '\n');
        }
    }

    error(message, ...args) {
        this.log('error', message, ...args);
    }

    warn(message, ...args) {
        this.log('warn', message, ...args);
    }

    info(message, ...args) {
        this.log('info', message, ...args);
    }

    debug(message, ...args) {
        this.log('debug', message, ...args);
    }

    // Performance logging
    time(label) {
        console.time(label);
    }

    timeEnd(label) {
        console.timeEnd(label);
    }
}

export const logger = new Logger();