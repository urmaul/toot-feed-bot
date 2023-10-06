function is_object(x: unknown): x is object {
    return typeof x === 'object';
}

// Check if the error contains properties path.
// If yes, return the last element.
export function extractFromError(value: unknown, ...path: string[]): string|undefined {
    const head = path.shift();
    if (head === undefined) {
        return `${value}`;
    } else {
        return is_object(value) && head in value ? extractFromError(value[head], ...path) : undefined;
    }
}