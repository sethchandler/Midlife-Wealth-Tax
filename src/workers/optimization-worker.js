/**
 * Web Worker for mathematical optimization computations.
 * Runs optimization algorithms in background thread to avoid blocking UI.
 */

// Import the optimization logic
// Note: We'll need to copy key functions here since workers can't import ES6 modules directly
importScripts('https://cdnjs.cloudflare.com/ajax/libs/numeric/1.2.6/numeric.min.js');

/**
 * Mathematical cache implementation for worker thread
 */
class WorkerMathCache {
    constructor(maxSize = 1000) {
        this.maxSize = maxSize;
        this.cache = new Map();
        this.accessOrder = [];
    }

    getOrCompute(key, computeFn) {
        if (this.cache.has(key)) {
            const index = this.accessOrder.indexOf(key);
            if (index > -1) {
                this.accessOrder.splice(index, 1);
            }
            this.accessOrder.unshift(key);
            return this.cache.get(key);
        }

        const value = computeFn();
        this.set(key, value);
        return value;
    }

    set(key, value) {
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            const oldest = this.accessOrder.pop();
            if (oldest !== undefined) {
                this.cache.delete(oldest);
            }
        }

        if (this.cache.has(key)) {
            const index = this.accessOrder.indexOf(key);
            if (index > -1) {
                this.accessOrder.splice(index, 1);
            }
        }

        this.cache.set(key, value);
        this.accessOrder.unshift(key);
    }

    clear() {
        this.cache.clear();
        this.accessOrder = [];
    }
}

// Worker-local caches
const expCache = new WorkerMathCache(2000);
const paramCache = new WorkerMathCache(500);

/**
 * Memoized Math functions for worker
 */
const WorkerMath = {
    exp: (value) => {
        const precision = 6;
        const rounded = Math.round(value * Math.pow(10, precision)) / Math.pow(10, precision);
        const key = `exp_${rounded}`;
        return expCache.getOrCompute(key, () => Math.exp(value));
    },
    
    pow: (base, exponent) => {
        const precision = 6;
        const baseRounded = Math.round(base * Math.pow(10, precision)) / Math.pow(10, precision);
        const expRounded = Math.round(exponent * Math.pow(10, precision)) / Math.pow(10, precision);
        const key = `pow_${baseRounded}_${expRounded}`;
        return expCache.getOrCompute(key, () => Math.pow(base, exponent));
    },
    
    log: (value) => {
        const precision = 6;
        const rounded = Math.round(value * Math.pow(10, precision)) / Math.pow(10, precision);
        const key = `log_${rounded}`;
        return expCache.getOrCompute(key, () => Math.log(value));
    }
};

/**
 * Parameter-based caching for complex functions
 */
function createParameterKey(prefix, params, precision = 4) {
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
 * Optimized mathematical functions (copied from UtilityFunctions.js)
 */
function kappa(r, rho, gamma) {
    if (gamma === 0) {
        throw new Error('Gamma cannot be zero in kappa calculation');
    }
    
    const key = createParameterKey('kappa', { r, rho, gamma });
    return paramCache.getOrCompute(key, () => {
        const result = (r * (gamma - 1) + rho) / gamma;
        if (!isFinite(result)) {
            throw new Error('Kappa calculation produced non-finite result');
        }
        return result;
    });
}

function U2(r, rho, gamma, T, A, B) {
    try {
        if (T <= 0) {
            throw new Error('Time period T must be positive');
        }
        
        // Pre-compute common subexpressions with memoization
        const expRT = WorkerMath.exp(r * T);
        const term1 = expRT * A - B;
        
        if (term1 <= 0) {
            throw new Error('Insufficient wealth for consumption');
        }
        
        const kappaVal = kappa(r, rho, gamma);
        const expNegKappaT = WorkerMath.exp(-kappaVal * T);
        const expRminusRhoToverGamma = WorkerMath.exp((r - rho) * T / gamma);
        const term2 = expRT - expRminusRhoToverGamma;
        
        if (term2 <= 0) {
            throw new Error('Invalid utility calculation');
        }
        
        // Handle potential complex number issues
        if (gamma !== 1) {
            if (term1 < 0 && (1 - gamma) % 1 !== 0) {
                throw new Error('Complex number result from fractional power');
            }
            if (term2 < 0 && (1 - gamma) % 1 !== 0) {
                throw new Error('Complex number result from fractional power');
            }
        }
        
        let result;
        if (gamma === 1) {
            // Log utility case with memoized log
            result = WorkerMath.log(term1) * (1 - expNegKappaT) / kappaVal - WorkerMath.log(term2);
        } else {
            // Power utility case with memoized pow
            const gammaTerm = 1 - gamma;
            const num = WorkerMath.pow(term1, gammaTerm) * (1 - expNegKappaT) * WorkerMath.pow(kappaVal, -gamma);
            const den = gammaTerm * WorkerMath.pow(term2, gammaTerm);
            result = num / den;
        }
        
        if (!isFinite(result) || isNaN(result)) {
            throw new Error('U2 calculation produced non-finite result');
        }
        
        return result;
        
    } catch (error) {
        throw new Error(`U2 calculation failed: ${error.message}`);
    }
}

function lifetimeUtility(r, rho, gamma, t1, t2, beta, eta, tau, w0, w1, w2) {
    try {
        // Calculate period 1 utility (pre-tax)
        const u1 = U2(r, rho, gamma, t1, w0, w1);
        if (!isFinite(u1) || u1 === -Infinity) {
            return -5000;
        }
        
        // Calculate period 2 utility (post-tax)
        const u2 = U2(r, rho, gamma, t2, w1 * (1 - tau), w2);
        if (!isFinite(u2) || u2 === -Infinity) {
            return -5000;
        }
        
        // Calculate bequest utility
        let bequestUtility;
        if (w2 <= 0) {
            return -5000;
        }
        
        if (eta === 1) {
            // Log utility for bequest with memoization
            bequestUtility = beta * WorkerMath.log(Math.max(w2, 1e-10));
        } else {
            // Power utility for bequest with memoization
            if (w2 <= 0 && (1 - eta) % 1 !== 0) {
                return -5000;
            }
            const etaTerm = 1 - eta;
            bequestUtility = beta * WorkerMath.pow(Math.max(w2, 1e-10), etaTerm) / etaTerm;
        }
        
        if (!isFinite(bequestUtility) || isNaN(bequestUtility)) {
            return -5000;
        }
        
        // Combine utilities with memoized exponential
        const totalUtility = u1 + WorkerMath.exp(-rho * t1) * u2 + bequestUtility;
        
        if (!isFinite(totalUtility) || isNaN(totalUtility)) {
            return -5000;
        }
        
        return totalUtility;
        
    } catch (error) {
        return -5000;
    }
}

function checkConstraints(w1, w2, parameters) {
    const { r, t1, t2, tau, w0 = 1 } = parameters;
    
    if (w1 <= 0 || w2 <= 0) {
        return false;
    }
    
    const maxW1 = WorkerMath.exp(r * t1) * w0;
    if (w1 >= maxW1) {
        return false;
    }
    
    const maxW2 = w1 * (1 - tau) * WorkerMath.exp(r * t2);
    if (w2 >= maxW2) {
        return false;
    }
    
    return true;
}

/**
 * High-performance grid search implementation
 */
function performGridSearch(parameters, searchSpace, gridSteps = 100) {
    const { r, rho, gamma, t1, t2, beta, eta, tau, w0 = 1 } = parameters;
    const { w1Min, w1Max, w2Min, w2Max } = searchSpace;
    
    let bestW1 = searchSpace.centerW1;
    let bestW2 = searchSpace.centerW2;
    let bestUtility = -Infinity;
    let evaluations = 0;
    
    // Progressive refinement - start with coarser grid
    const steps = Math.min(gridSteps, 50); // Limit initial grid size
    
    for (let i = 0; i <= steps; i++) {
        const w1 = w1Min + (w1Max - w1Min) * i / steps;
        
        for (let j = 0; j <= steps; j++) {
            const w2 = w2Min + (w2Max - w2Min) * j / steps;
            
            evaluations++;
            
            // Check constraints first (fast check)
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
                continue;
            }
        }
        
        // Send progress updates
        if (i % 10 === 0) {
            self.postMessage({
                type: 'progress',
                progress: i / steps,
                currentBest: { w1: bestW1, w2: bestW2, utility: bestUtility }
            });
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
 * Numerical refinement using numeric.js
 */
function performNumericalRefinement(parameters, gridResult) {
    const { r, rho, gamma, t1, t2, beta, eta, tau, w0 = 1 } = parameters;
    
    const objectiveFunction = (vars) => {
        const [w1, w2] = vars;
        
        if (!checkConstraints(w1, w2, parameters)) {
            return 1e10;
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
        const result = numeric.uncmin(
            objectiveFunction, 
            [gridResult.w1, gridResult.w2], 
            1e-12,
            null,
            1000
        );
        
        if (result && isFinite(result.f) && result.f < 1e9) {
            const [finalW1, finalW2] = result.solution;
            
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
        // Fall back to grid result
    }
    
    return gridResult;
}

/**
 * Main optimization function
 */
function optimizeWealth(parameters, options = {}) {
    const { r, t1, t2, tau, w0 = 1 } = parameters;
    const gridSteps = options.gridSteps || 100;
    
    // Determine search space
    const maxW1 = WorkerMath.exp(r * t1) * w0;
    const searchSpace = {
        w1Min: Math.max(0.01, maxW1 * 0.2),
        w1Max: Math.min(maxW1 - 0.01, maxW1 * 0.8),
        w2Min: 0.01,
        w2Max: maxW1 * 2,
        centerW1: maxW1 * 0.6,
        centerW2: maxW1 * 0.5
    };
    
    // Phase 1: Grid search
    const gridResult = performGridSearch(parameters, searchSpace, gridSteps);
    
    if (!gridResult.success) {
        throw new Error('Grid search failed to find feasible solution');
    }
    
    // Phase 2: Numerical refinement
    let finalResult;
    try {
        finalResult = performNumericalRefinement(parameters, gridResult);
    } catch (error) {
        finalResult = gridResult;
    }
    
    return {
        w1: finalResult.w1,
        w2: finalResult.w2,
        utility: finalResult.utility,
        iterations: finalResult.iterations || 0,
        convergence: finalResult.convergence || 'grid_only',
        method: finalResult.method || 'hybrid',
        cacheStats: {
            expCacheSize: expCache.cache.size,
            paramCacheSize: paramCache.cache.size
        }
    };
}

/**
 * Worker message handler
 */
self.onmessage = function(e) {
    const { type, id, parameters, options } = e.data;
    
    try {
        switch (type) {
            case 'optimize':
                const startTime = performance.now();
                const result = optimizeWealth(parameters, options);
                const endTime = performance.now();
                
                self.postMessage({
                    type: 'result',
                    id,
                    result: {
                        ...result,
                        calculationTime: endTime - startTime,
                        cacheHit: false
                    }
                });
                break;
                
            case 'clearCache':
                expCache.clear();
                paramCache.clear();
                self.postMessage({
                    type: 'cacheCleared',
                    id
                });
                break;
                
            default:
                self.postMessage({
                    type: 'error',
                    id,
                    error: 'Unknown message type'
                });
        }
    } catch (error) {
        self.postMessage({
            type: 'error',
            id,
            error: error.message
        });
    }
};