// services/logger.ts

export enum LogLevel {
    OFF = 0,
    ERROR = 1,
    WARN = 2,
    INFO = 3,
    DEBUG = 4,
    FINEST = 5,
}

const LOG_LEVEL_NAMES: { [key in LogLevel]: string } = {
    [LogLevel.OFF]: 'OFF',
    [LogLevel.ERROR]: 'ERROR',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.DEBUG]: 'DEBUG',
    [LogLevel.FINEST]: 'FINEST',
};

class Logger {
    private level: LogLevel = LogLevel.INFO;

    constructor() {
        this.configure();
    }

    private configure() {
        const isDevMode = process.env.DEV_MODE === 'true';
        if (!isDevMode) {
            this.level = LogLevel.WARN; // Only show warnings and errors in non-dev mode
            return;
        }

        const debugLevelStr = process.env.DEBUG_LEVEL?.toUpperCase() || 'INFO';
        const levelKey = Object.keys(LogLevel).find(key => key === debugLevelStr);

        if (levelKey && typeof LogLevel[levelKey as keyof typeof LogLevel] === 'number') {
            this.level = LogLevel[levelKey as keyof typeof LogLevel];
        } else {
            this.level = LogLevel.INFO;
        }
        
        console.log(`%c[Logger] DEV_MODE enabled. Logging level set to: ${LOG_LEVEL_NAMES[this.level]}`, 'color: #FFA500; font-weight: bold;');
    }

    private log(level: LogLevel, ...args: any[]) {
        if (level <= this.level) {
            const timestamp = new Date().toISOString();
            const levelName = LOG_LEVEL_NAMES[level];
            const colors: { [key in LogLevel]?: string } = {
                [LogLevel.ERROR]: 'color: #FF4136;',
                [LogLevel.WARN]: 'color: #FFDC00;',
                [LogLevel.INFO]: 'color: #0074D9;',
                [LogLevel.DEBUG]: 'color: #7FDBFF;',
                [LogLevel.FINEST]: 'color: #F012BE;',
            };
            const color = colors[level] || 'color: #FFFFFF;';
            
            console.log(`%c[${timestamp}] [${levelName}]`, color, ...args);
        }
    }

    finest(...args: any[]) {
        this.log(LogLevel.FINEST, ...args);
    }

    debug(...args: any[]) {
        this.log(LogLevel.DEBUG, ...args);
    }

    info(...args: any[]) {
        this.log(LogLevel.INFO, ...args);
    }

    warn(...args: any[]) {
        this.log(LogLevel.WARN, ...args);
    }
    
    error(...args: any[]) {
        this.log(LogLevel.ERROR, ...args);
    }
}

export const logger = new Logger();
