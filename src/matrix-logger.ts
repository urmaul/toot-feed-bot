import { ILogger } from "matrix-bot-sdk";
import { logger } from './logger';

export class MatrixLogger implements ILogger {
    info(module: string, ...messageOrObject: any[]) {
        logger.info(...messageOrObject, module);
    }
    warn(module: string, ...messageOrObject: any[]) {
        logger.warn(...messageOrObject, module);
    }
    error(module: string, ...messageOrObject: any[]) {
        logger.error(...messageOrObject, module);
    }
    debug(module: string, ...messageOrObject: any[]) {
        logger.debug(...messageOrObject, module);
    }
    trace(module: string, ...messageOrObject: any[]) {
        logger.trace(...messageOrObject, module);
    }
}