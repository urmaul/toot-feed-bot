import { logger, moduled } from "./logger";
import { InstanceRef } from "./types";

export interface BackoffConfig {
    // Backoff interval in seconds
    cirquitBreakerInterval: number,
}

function stringify(instanceRef: InstanceRef): string {
    return `${instanceRef.sns}/${instanceRef.hostname}`;
}

export class CirquitBreaker {
    private _isClosed: boolean = true;
    // The time when cirquit breaker closes
    private closeAt: number = 0;
    private readonly interval: number;

    constructor(interval: number) {
        this.interval = interval;
    }

    isClosed(): boolean {
        if (!this._isClosed && Date.now() > this.closeAt) {
            this._isClosed = true;
        }

        return this._isClosed;
    }

    open() {
        this.closeAt = Date.now() + this.interval * 1000;
        this._isClosed = false;
    }
}


export class Backoff {
    readonly config: BackoffConfig;
    cirquitBreakers: Map<string, CirquitBreaker>;

    constructor(config: BackoffConfig) {
        this.config = config;
        this.cirquitBreakers = new Map();
    }

    instanceBlocked(instanceRef: InstanceRef): boolean {
        return !this.getBreaker(instanceRef).isClosed();
    }

    blockInstance(instanceRef: InstanceRef) {
        moduled('Backoff', () => logger.info(`Blocking instance ${stringify(instanceRef)}`));
        return this.getBreaker(instanceRef).open();
    }

    getBreaker(instanceRef: InstanceRef): CirquitBreaker {
        const key = stringify(instanceRef);
        const existingBreaker = this.cirquitBreakers.get(key)
        if (existingBreaker !== undefined) {
            return existingBreaker;
        }

        const newBreaker = new CirquitBreaker(this.config.cirquitBreakerInterval);
        this.cirquitBreakers.set(key, newBreaker)
        
        return newBreaker;
    }
}