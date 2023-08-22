import { InstanceRef } from "./types";

export interface BackoffConfig {
    // Backoff interval in seconds
    cirquitBreakerInterval: number,
}

export class CirquitBreaker {
    private _isClosed: boolean = true;
    // The time when cirquit breaker closes
    private closeAt: number = 0;
    private readonly interval: number;

    constructor(interval: number) {
        const now = Date.now()
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
    cirquitBreakers: Map<InstanceRef, CirquitBreaker>;

    constructor(config: BackoffConfig) {
        this.config = config;
        this.cirquitBreakers = new Map();
    }

    isClosed(instanceRef: InstanceRef): boolean {
        return this.getBreaker(instanceRef).isClosed();
    }

    open(instanceRef: InstanceRef) {
        return this.getBreaker(instanceRef).open();
    }

    getBreaker(instanceRef: InstanceRef): CirquitBreaker {
        const existingBreaker = this.cirquitBreakers.get(instanceRef)
        if (existingBreaker !== undefined) {
            return existingBreaker;
        }

        const newBreaker = new CirquitBreaker(this.config.cirquitBreakerInterval);
        this.cirquitBreakers.set(instanceRef, newBreaker)
        
        return newBreaker;
    }
}