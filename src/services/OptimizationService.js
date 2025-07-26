/**
 * Optimization service for finding optimal wealth trajectories.
 * Implements sophisticated caching, warm starting, and error recovery strategies.
 */

import { lifetimeUtility, checkConstraints } from '../math/UtilityFunctions.js';
import { OptimizationError, MathematicalError } from '../errors/ErrorTypes.js';
import { validateParametersOrThrow } from '../utils/ParameterValidator.js';
// import { workerManager } from '../workers/WorkerManager.js'; // Temporarily disabled

// Mock worker manager
const workerManager = {
    getStats: () => ({ workers: { total: 0, busy: 0 }, queue: { length: 0 }, successRate: 0 }),
    clearCaches: async () => {}
};

/**
 * Advanced optimization service with intelligent caching and warm starting.
 */
export class OptimizationService {
    constructor(options = {}) {
        this.options = {
            maxIterations: 1000,
            tolerance: 1e-12,
            gridSteps: 100,
            warmStartEnabled: true,
            cacheSize: 100,
            cacheTTL: 60000, // 1 minute
            useWebWorkers: false, // Disable Web Workers temporarily
            fallbackToMainThread: true, // Fallback if workers fail
            ...options
        };
        
        // LRU cache for optimization results
        this.cache = new Map();
        this.cacheOrder = [];
        
        // Warm start storage
        this.lastOptimalResult = null;
        this.lastParameters = null;
        
        // Performance tracking
        this.performanceStats = {
            workerJobs: 0,
            mainThreadJobs: 0,
            workerTime: 0,
            mainThreadTime: 0
        };
    }

    /**
     * Finds optimal wealth pair (w1, w2) for given parameters.
     * 
     * @param {Object} parameters - Economic parameters
     * @param {Object} options - Additional options like onProgress callback
     * @returns {Object} - {w1, w2, utility, iterations, cacheHit, convergence}
     */
    async findOptimalWealth(parameters, options = {}) {
        validateParametersOrThrow(parameters);
        
        const cacheKey = this.generateCacheKey(parameters);
        
        // Check cache first
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            return { ...cached, cacheHit: true };
        }
        
        try {
            const result = await this.performOptimization(parameters, options);
            
            // Cache the result
            this.addToCache(cacheKey, result);
            
            // Update warm start data
            this.updateWarmStart(parameters, result);
            
            return { ...result, cacheHit: false };
            
        } catch (error) {
            throw new OptimizationError(
                `Optimization failed for parameters: ${error.message}`,
                parameters,
                error
            );
        }
    }

    /**
     * Performs the actual optimization using hybrid grid search + refinement.
     * Decides whether to use Web Workers or main thread based on configuration.
     */
    async performOptimization(parameters, options = {}) {
        const startTime = performance.now();
        
        try {
            let result;
            
            if (this.options.useWebWorkers) {
                try {
                    // Attempt optimization in Web Worker
                    result = await workerManager.optimizeWealth(parameters, {
                        gridSteps: this.options.gridSteps,
                        onProgress: options.onProgress
                    });
                    
                    this.performanceStats.workerJobs++;
                    this.performanceStats.workerTime += performance.now() - startTime;
                    
                } catch (workerError) {
                    console.warn('Worker optimization failed, falling back to main thread:', workerError.message);
                    
                    if (this.options.fallbackToMainThread) {
                        result = await this.performMainThreadOptimization(parameters);
                        this.performanceStats.mainThreadJobs++;
                        this.performanceStats.mainThreadTime += performance.now() - startTime;
                    } else {
                        throw workerError;
                    }
                }
            } else {
                // Use main thread optimization
                result = await this.performMainThreadOptimization(parameters);
                this.performanceStats.mainThreadJobs++;
                this.performanceStats.mainThreadTime += performance.now() - startTime;
            }
            
            return {
                w1: result.w1,
                w2: result.w2,
                utility: result.utility,
                iterations: result.iterations || 0,
                convergence: result.convergence || 'grid_only',
                method: result.method || 'hybrid',
                calculationTime: performance.now() - startTime,
                usedWorker: this.options.useWebWorkers && !result.fallbackUsed
            };
            
        } catch (error) {
            throw new OptimizationError(`Optimization failed: ${error.message}`, parameters, error);
        }
    }

    /**
     * Performs optimization on main thread (original implementation).
     */
    async performMainThreadOptimization(parameters) {
        const { r, rho, gamma, t1, t2, beta, eta, tau, w0 = 1 } = parameters;
        
        // Determine search space
        const searchSpace = this.determineSearchSpace(parameters);
        
        // Phase 1: Grid search for global exploration
        const gridResult = await this.gridSearch(parameters, searchSpace);
        
        if (!gridResult.success) {
            throw new OptimizationError('Grid search failed to find feasible solution');
        }
        
        // Phase 2: Numerical refinement for local optimization
        let finalResult;
        try {
            finalResult = await this.numericalRefinement(parameters, gridResult);
        } catch (error) {
            console.warn('Numerical refinement failed, using grid result:', error.message);
            finalResult = gridResult;
        }
        
        return {
            w1: finalResult.w1,
            w2: finalResult.w2,
            utility: finalResult.utility,
            iterations: finalResult.iterations || 0,
            convergence: finalResult.convergence || 'grid_only',
            method: finalResult.method || 'hybrid',
            fallbackUsed: true
        };
    }

    /**
     * Determines search space based on warm starting and parameter analysis.
     */
    determineSearchSpace(parameters) {
        const { r, t1, t2, tau, w0 = 1 } = parameters;
        const maxW1 = Math.exp(r * t1) * w0;
        
        let centerW1, centerW2, radius;
        
        if (this.options.warmStartEnabled && this.lastOptimalResult && 
            this.isParameterSimilar(parameters, this.lastParameters)) {
            
            // Use warm starting
            centerW1 = this.lastOptimalResult.w1;
            centerW2 = this.lastOptimalResult.w2;
            radius = 0.2; // Smaller search radius for warm starts
            
            // Verify warm start is still feasible
            if (!checkConstraints(centerW1, centerW2, parameters)) {
                // Fall back to default if warm start is infeasible
                centerW1 = maxW1 * 0.6;
                centerW2 = maxW1 * 0.5;
                radius = 0.4;
            }
        } else {
            // Cold start with conservative estimates
            centerW1 = maxW1 * 0.6;
            centerW2 = maxW1 * 0.5;
            radius = 0.4;
        }
        
        return {
            w1Min: Math.max(0.01, centerW1 * (1 - radius)),
            w1Max: Math.min(maxW1 - 0.01, centerW1 * (1 + radius)),
            w2Min: Math.max(0.01, centerW2 * (1 - radius)),
            w2Max: Math.min(centerW2 * (1 + radius * 2), maxW1 * 3),
            centerW1,
            centerW2
        };
    }

    /**
     * Performs grid search over the parameter space.
     */
    async gridSearch(parameters, searchSpace) {
        const { r, rho, gamma, t1, t2, beta, eta, tau, w0 = 1 } = parameters;
        const { w1Min, w1Max, w2Min, w2Max } = searchSpace;
        
        let bestW1 = searchSpace.centerW1;
        let bestW2 = searchSpace.centerW2;
        let bestUtility = -Infinity;
        let evaluations = 0;
        
        const gridSteps = this.options.gridSteps;
        
        for (let i = 0; i <= gridSteps; i++) {
            const w1 = w1Min + (w1Max - w1Min) * i / gridSteps;
            
            for (let j = 0; j <= gridSteps; j++) {
                const w2 = w2Min + (w2Max - w2Min) * j / gridSteps;
                
                evaluations++;
                
                // Check constraints
                if (!checkConstraints(w1, w2, parameters)) {
                    continue;
                }
                
                // Evaluate utility
                try {
                    const utility = lifetimeUtility(r, rho, gamma, t1, t2, beta, eta, tau, w0, w1, w2);
                    
                    if (isFinite(utility) && utility > bestUtility) {
                        bestUtility = utility;
                        bestW1 = w1;
                        bestW2 = w2;
                    }
                } catch (error) {
                    // Skip infeasible points
                    continue;
                }
            }
        }
        
        return {
            success: bestUtility > -Infinity,
            w1: bestW1,
            w2: bestW2,
            utility: bestUtility,
            evaluations,
            method: 'grid_search'
        };
    }

    /**
     * Refines grid search result using numerical optimization.
     */
    async numericalRefinement(parameters, gridResult) {
        const { r, rho, gamma, t1, t2, beta, eta, tau, w0 = 1 } = parameters;
        
        // Create objective function for minimization (negative utility)
        const objectiveFunction = (vars) => {
            const [w1, w2] = vars;
            
            if (!checkConstraints(w1, w2, parameters)) {
                return 1e10; // Large penalty for constraint violations
            }
            
            try {
                const utility = lifetimeUtility(r, rho, gamma, t1, t2, beta, eta, tau, w0, w1, w2);
                
                if (!isFinite(utility) || utility === -5000) {
                    return 1e10;
                }
                
                return -utility; // Minimize negative utility
            } catch (error) {
                return 1e10;
            }
        };
        
        try {
            // Use numeric.js for unconstrained minimization
            const result = numeric.uncmin(
                objectiveFunction, 
                [gridResult.w1, gridResult.w2], 
                this.options.tolerance,
                null,
                this.options.maxIterations
            );
            
            if (result && isFinite(result.f) && result.f < 1e9) {
                const [finalW1, finalW2] = result.solution;
                
                // Verify final result is feasible
                if (checkConstraints(finalW1, finalW2, parameters)) {
                    const finalUtility = -result.f;
                    
                    return {
                        w1: finalW1,
                        w2: finalW2,
                        utility: finalUtility,
                        iterations: result.iterations || 0,
                        convergence: 'converged',
                        method: 'numerical_refinement'
                    };
                }
            }
        } catch (error) {
            console.warn('Numerical refinement failed:', error.message);
        }
        
        // Fall back to grid result if refinement fails
        return gridResult;
    }

    /**
     * Cache management methods
     */
    generateCacheKey(parameters) {
        // Create a stable hash of parameters rounded to reasonable precision
        const rounded = {};
        for (const [key, value] of Object.entries(parameters)) {
            if (typeof value === 'number') {
                rounded[key] = Math.round(value * 1000) / 1000;
            } else {
                rounded[key] = value;
            }
        }
        return JSON.stringify(rounded);
    }

    getFromCache(key) {
        const entry = this.cache.get(key);
        if (!entry) return null;
        
        // Check TTL
        if (Date.now() - entry.timestamp > this.options.cacheTTL) {
            this.cache.delete(key);
            return null;
        }
        
        // Update LRU order
        const index = this.cacheOrder.indexOf(key);
        if (index > -1) {
            this.cacheOrder.splice(index, 1);
        }
        this.cacheOrder.unshift(key);
        
        return entry.result;
    }

    addToCache(key, result) {
        // Remove oldest entries if cache is full
        while (this.cacheOrder.length >= this.options.cacheSize) {
            const oldKey = this.cacheOrder.pop();
            this.cache.delete(oldKey);
        }
        
        // Add new entry
        this.cache.set(key, {
            result: { ...result },
            timestamp: Date.now()
        });
        
        this.cacheOrder.unshift(key);
    }

    /**
     * Warm starting methods
     */
    updateWarmStart(parameters, result) {
        this.lastOptimalResult = { w1: result.w1, w2: result.w2 };
        this.lastParameters = { ...parameters };
    }

    isParameterSimilar(params1, params2) {
        if (!params2) return false;
        
        const threshold = 0.1; // 10% difference threshold
        const importantParams = ['r', 'rho', 'gamma', 'eta', 'beta', 'tau'];
        
        for (const param of importantParams) {
            const val1 = params1[param];
            const val2 = params2[param];
            
            if (Math.abs(val1 - val2) / Math.max(val1, val2) > threshold) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Utility methods
     */
    clearCache() {
        this.cache.clear();
        this.cacheOrder = [];
    }

    getCacheStats() {
        return {
            size: this.cache.size,
            maxSize: this.options.cacheSize,
            hitRate: this.cacheHits / Math.max(this.totalRequests, 1)
        };
    }

    /**
     * Gets comprehensive performance statistics including worker performance.
     */
    getPerformanceStats() {
        const workerStats = workerManager.getStats();
        
        return {
            ...this.performanceStats,
            cacheStats: this.getCacheStats(),
            workerStats: workerStats,
            avgWorkerTime: this.performanceStats.workerJobs > 0 ? 
                this.performanceStats.workerTime / this.performanceStats.workerJobs : 0,
            avgMainThreadTime: this.performanceStats.mainThreadJobs > 0 ? 
                this.performanceStats.mainThreadTime / this.performanceStats.mainThreadJobs : 0,
            workerSpeedup: this.calculateWorkerSpeedup(),
            recommendUseWorkers: this.shouldRecommendWorkers()
        };
    }

    /**
     * Calculates the speedup factor when using workers vs main thread.
     */
    calculateWorkerSpeedup() {
        const avgWorkerTime = this.performanceStats.workerJobs > 0 ? 
            this.performanceStats.workerTime / this.performanceStats.workerJobs : 0;
        const avgMainThreadTime = this.performanceStats.mainThreadJobs > 0 ? 
            this.performanceStats.mainThreadTime / this.performanceStats.mainThreadJobs : 0;
        
        if (avgWorkerTime > 0 && avgMainThreadTime > 0) {
            return avgMainThreadTime / avgWorkerTime;
        }
        return 1;
    }

    /**
     * Determines if workers should be recommended based on performance data.
     */
    shouldRecommendWorkers() {
        const speedup = this.calculateWorkerSpeedup();
        const totalJobs = this.performanceStats.workerJobs + this.performanceStats.mainThreadJobs;
        
        // Recommend workers if they provide speedup and we have enough data
        return speedup > 1.2 && totalJobs >= 5;
    }

    /**
     * Clears all caches including worker caches.
     */
    async clearAllCaches() {
        this.clearCache();
        await workerManager.clearCaches();
    }

    resetWarmStart() {
        this.lastOptimalResult = null;
        this.lastParameters = null;
    }
}

/**
 * Singleton instance for global use
 */
export const optimizationService = new OptimizationService();

/**
 * Convenience function for finding optimal wealth
 */
export async function findOptimalWealth(parameters) {
    return await optimizationService.findOptimalWealth(parameters);
}