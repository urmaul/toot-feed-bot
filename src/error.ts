import { error } from 'console';
import { logger } from './logger';

function is_object(x: unknown): x is object {
    return typeof x === 'object';
}

// Check if the error contains properties path.
// If yes, return the last element.
export function extractFromError(value: unknown, ...path: string[]): unknown|undefined {
    const head = path.shift();
    if (head === undefined) {
        return value;
    } else {
        return is_object(value) && head in value ? extractFromError(value[head], ...path) : undefined;
    }
}

// Extracts value from error and makes sure it has expected type
export function extractTypedFromError<A>(guard: (x: unknown) => x is A, value: unknown, ...path: string[]): A|undefined {
    const inner = extractFromError(value, ...path);
    if (inner !== undefined) {
        if (guard(inner)) {
            return inner;
        } else {
            logger.debug('Value extracted from error has unexpected type', error, [...path], inner);
            return undefined;
        }

    } else {
        return undefined;
    }
}

const is_string = (x: unknown): x is string => typeof x === 'string';
const is_number = (x: unknown): x is number => typeof x === 'number';

export function extractStringFromError(value: unknown, ...path: string[]): string|undefined {
    return extractTypedFromError(is_string, value, ...path);
}
export function extractNumberFromError(value: unknown, ...path: string[]): number|undefined {
    return extractTypedFromError(is_number, value, ...path);
}