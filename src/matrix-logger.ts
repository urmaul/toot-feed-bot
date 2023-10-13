import { ILogger } from 'matrix-bot-sdk';
import { logger, moduled } from './logger';

// Disabling "no-explicit-any" rule here because it's used in an external interface.
/* eslint-disable @typescript-eslint/no-explicit-any */

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