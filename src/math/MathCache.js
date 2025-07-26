/**
 * High-performance mathematical caching and memoization utilities.
 * Provides optimized caching for expensive mathematical computations.
 */

/**
 * LRU Cache with performance optimizations for mathematical functions.
 */
export class MathCache {
    constructor(maxSize = 1000) {
        this.maxSize = maxSize;
        this.cache = new Map();
        this.accessOrder = [];
    }

    /**
     * Gets a cached value or computes and caches it.
     */
    getOrCompute(key, computeFn) {
        if (this.cache.has(key)) {
            // Move to front for LRU
            const index = this.accessOrder.indexOf(key);
            if (index > -1) {
                this.accessOrder.splice(index, 1);
            }
            this.accessOrder.unshift(key);
            return this.cache.get(key);
        }

        // Compute and cache
        const value = computeFn();
        this.set(key, value);
        return value;
    }

    /**
     * Sets a value in cache with LRU eviction.
     */
    set(key, value) {
        // Remove oldest if cache is full
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            const oldest = this.accessOrder.pop();
            if (oldest !== undefined) {
                this.cache.delete(oldest);
            }
        }

        // Add/update entry
        if (this.cache.has(key)) {
            const index = this.accessOrder.indexOf(key);
            if (index > -1) {
                this.accessOrder.splice(index, 1);
            }
        }

        this.cache.set(key, value);
        this.accessOrder.unshift(key);
    }

    /**
     * Checks if key exists in cache.
     */
    has(key) {
        return this.cache.has(key);
    }

    /**
     * Clears the cache.
     */
    clear() {
        this.cache.clear();
        this.accessOrder = [];
    }

    /**
     * Gets cache statistics.
     */
    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hitRate: this.hits / Math.max(this.requests, 1)
        };
    }
}

/**
 * Specialized cache for exponential functions with precision rounding.
 */
export class ExponentialCache extends MathCache {
    constructor(maxSize = 2000, precision = 6) {
        super(maxSize);
        this.precision = precision;
        this.hits = 0;
        this.requests = 0;
    }

    /**
     * Creates a cache key for exponential functions with precision rounding.
     */
    createExpKey(value) {
        this.requests++;
        // Round to specified precision to increase cache hits
        const rounded = Math.round(value * Math.pow(10, this.precision)) / Math.pow(10, this.precision);
        return `exp_${rounded}`;
    }

    /**
     * Cached Math.exp with precision rounding.
     */
    exp(value) {
        const key = this.createExpKey(value);
        return this.getOrCompute(key, () => {
            this.hits++;
            return Math.exp(value);
        });
    }

    /**
     * Cached Math.pow with precision rounding.
     */
    pow(base, exponent) {
        this.requests++;
        const baseRounded = Math.round(base * Math.pow(10, this.precision)) / Math.pow(10, this.precision);
        const expRounded = Math.round(exponent * Math.pow(10, this.precision)) / Math.pow(10, this.precision);
        const key = `pow_${baseRounded}_${expRounded}`;
        
        return this.getOrCompute(key, () => {
            this.hits++;
            return Math.pow(base, exponent);
        });
    }

    /**
     * Cached Math.log with precision rounding.
     */
    log(value) {
        this.requests++;
        const rounded = Math.round(value * Math.pow(10, this.precision)) / Math.pow(10, this.precision);
        const key = `log_${rounded}`;
        
        return this.getOrCompute(key, () => {
            this.hits++;
            return Math.log(value);
        });
    }
}

/**
 * Cache for complex mathematical expressions with parameter-based keys.
 */
export class ParameterCache extends MathCache {
    constructor(maxSize = 500) {
        super(maxSize);
        this.hits = 0;
        this.requests = 0;
    }

    /**
     * Creates a stable cache key from parameters with precision rounding.
     */
    createParameterKey(prefix, params, precision = 4) {
        this.requests++;
        const rounded = {};
        for (const [key, value] of Object.entries(params)) {
            if (typeof value === 'number') {
                rounded[key] = Math.round(value * Math.pow(10, precision)) / Math.pow(10, precision);
            } else {
                rounded[key] = value;
            }
        }
        return `${prefix}_${JSON.stringify(rounded)}`;
    }

    /**
     * Gets or computes a value with parameter-based caching.
     */
    getOrComputeWithParams(prefix, params, computeFn) {
        const key = this.createParameterKey(prefix, params);
        return this.getOrCompute(key, () => {
            this.hits++;
            return computeFn();
        });
    }
}

/**
 * Global cache instances for mathematical functions.
 */
export const mathCache = new MathCache(1000);
export const expCache = new ExponentialCache(2000, 6);
export const paramCache = new ParameterCache(500);

/**
 * Memoized mathematical functions using global caches.
 */
export const MemoizedMath = {
    exp: (value) => expCache.exp(value),
    pow: (base, exponent) => expCache.pow(base, exponent),
    log: (value) => expCache.log(value),
    
    /**
     * Clears all mathematical caches.
     */
    clearAll() {
        mathCache.clear();
        expCache.clear();
        paramCache.clear();
    },

    /**
     * Gets combined cache statistics.
     */
    getStats() {
        return {
            mathCache: mathCache.getStats(),
            expCache: expCache.getStats(),
            paramCache: paramCache.getStats()
        };
    }
};