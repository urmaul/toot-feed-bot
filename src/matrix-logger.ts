import { ILogger } from 'matrix-bot-sdk';
import { logger, moduled } from './logger';

export class MatrixLogger implements ILogger {
    info(module: string, ...messageOrObject: any[]) {
        moduled(`Matrix/${module}`, () => logger.info(...messageOrObject, module));
    }
    warn(module: string, ...messageOrObject: any[]) {
        moduled(`Matrix/${module}`, () => logger.warn(...messageOrObject, module));
    }
    error(module: string, ...messageOrObject: any[]) {
        moduled(`Matrix/${module}`, () => logger.error(...messageOrObject));
    }
    debug(module: string, ...messageOrObject: any[]) {
        moduled(`Matrix/${module}`, () => logger.debug(...messageOrObject, module));
    }
    trace(module: string, ...messageOrObject: any[]) {
        moduled(`Matrix/${module}`, () => logger.trace(...messageOrObject, module));
    }
}