/**
 * Core mathematical utility functions for the lifetime wealth optimization model.
 * Implements utility functions, constraint checking, and economic parameter calculations.
 */

import { MathematicalError } from '../errors/ErrorTypes.js';
import { validateParametersOrThrow } from '../utils/ParameterValidator.js';
// import { MemoizedMath, paramCache, expCache } from './MathCache.js'; // Temporarily disabled

// Fallback to regular Math functions
const MemoizedMath = {
    exp: Math.exp,
    pow: Math.pow,
    log: Math.log
};

const paramCache = {
    getOrComputeWithParams: (prefix, params, computeFn) => computeFn()
};

/**
 * Calculates the kappa parameter used throughout the economic model.
 * kappa = (r * (γ - 1) + ρ) / γ
 * 
 * @param {number} r - Interest rate
 * @param {number} rho - Impatience rate  
 * @param {number} gamma - Risk aversion parameter
 * @returns {number} Kappa parameter
 */
export function kappa(r, rho, gamma) {
    if (gamma === 0) {
        throw new MathematicalError('Gamma cannot be zero in kappa calculation');
    }
    
    // Use memoized calculation
    return paramCache.getOrComputeWithParams('kappa', { r, rho, gamma }, () => {
        const result = (r * (gamma - 1) + rho) / gamma;
        
        if (!isFinite(result)) {
            throw new MathematicalError('Kappa calculation produced non-finite result', { r, rho, gamma });
        }
        
        return result;
    });
}

/**
 * Calculates period utility U2 for a given time period.
 * This is the core utility function for consumption over a time period.
 * 
 * @param {number} r - Interest rate
 * @param {number} rho - Impatience rate
 * @param {number} gamma - Risk aversion parameter
 * @param {number} T - Time period length
 * @param {number} A - Initial wealth for period
 * @param {number} B - Terminal wealth for period
 * @returns {number} Period utility value
 */
export function U2(r, rho, gamma, T, A, B) {
    try {
        // Validate inputs
        if (T <= 0) {
            throw new MathematicalError('Time period T must be positive');
        }
        
        // Pre-compute common subexpressions with memoization
        const expRT = MemoizedMath.exp(r * T);
        const term1 = expRT * A - B;
        
        if (term1 <= 0) {
            throw new MathematicalError('Insufficient wealth for consumption (expRT * A - B <= 0)', {
                expRT, A, B, term1
            });
        }
        
        const kappaVal = kappa(r, rho, gamma);
        const expNegKappaT = MemoizedMath.exp(-kappaVal * T);
        const expRminusRhoToverGamma = MemoizedMath.exp((r - rho) * T / gamma);
        const term2 = expRT - expRminusRhoToverGamma;
        
        if (term2 <= 0) {
            throw new MathematicalError('Invalid utility calculation (term2 <= 0)', {
                expRT, expRminusRhoToverGamma, term2
            });
        }
        
        // Handle potential complex number issues from fractional powers
        if (gamma !== 1) {
            if (term1 < 0 && (1 - gamma) % 1 !== 0) {
                throw new MathematicalError('Complex number result from fractional power of negative term1');
            }
            if (term2 < 0 && (1 - gamma) % 1 !== 0) {
                throw new MathematicalError('Complex number result from fractional power of negative term2');
            }
        }
        
        let result;
        if (gamma === 1) {
            // Log utility case with memoized log
            result = MemoizedMath.log(term1) * (1 - expNegKappaT) / kappaVal - MemoizedMath.log(term2);
        } else {
            // Power utility case with memoized pow
            const gammaTerm = 1 - gamma;
            const num = MemoizedMath.pow(term1, gammaTerm) * (1 - expNegKappaT) * MemoizedMath.pow(kappaVal, -gamma);
            const den = gammaTerm * MemoizedMath.pow(term2, gammaTerm);
            result = num / den;
        }
        
        if (!isFinite(result) || isNaN(result)) {
            throw new MathematicalError('U2 calculation produced non-finite result', {
                term1, term2, kappaVal, gamma, result
            });
        }
        
        return result;
        
    } catch (error) {
        if (error instanceof MathematicalError) {
            throw error;
        }
        throw new MathematicalError(`U2 calculation failed: ${error.message}`, { r, rho, gamma, T, A, B });
    }
}

/**
 * Calculates lifetime utility combining consumption utilities and bequest utility.
 * 
 * @param {number} r - Interest rate
 * @param {number} rho - Impatience rate
 * @param {number} gamma - Consumption risk aversion
 * @param {number} t1 - Pre-tax period length
 * @param {number} t2 - Post-tax period length
 * @param {number} beta - Bequest importance parameter
 * @param {number} eta - Bequest risk aversion
 * @param {number} tau - Tax rate
 * @param {number} w0 - Initial wealth
 * @param {number} w1 - Wealth at tax time
 * @param {number} w2 - Terminal wealth (bequest)
 * @returns {number} Lifetime utility value
 */
export function lifetimeUtility(r, rho, gamma, t1, t2, beta, eta, tau, w0, w1, w2) {
    try {
        // Calculate period 1 utility (pre-tax)
        const u1 = U2(r, rho, gamma, t1, w0, w1);
        if (!isFinite(u1) || u1 === -Infinity) {
            return -5000; // Large penalty for infeasible solutions
        }
        
        // Calculate period 2 utility (post-tax)
        const u2 = U2(r, rho, gamma, t2, w1 * (1 - tau), w2);
        if (!isFinite(u2) || u2 === -Infinity) {
            return -5000;
        }
        
        // Calculate bequest utility
        let bequestUtility;
        if (w2 <= 0) {
            return -5000; // Negative bequest not allowed
        }
        
        if (eta === 1) {
            // Log utility for bequest with memoization
            bequestUtility = beta * MemoizedMath.log(Math.max(w2, 1e-10));
        } else {
            // Power utility for bequest with memoization
            if (w2 <= 0 && (1 - eta) % 1 !== 0) {
                return -5000;
            }
            const etaTerm = 1 - eta;
            bequestUtility = beta * MemoizedMath.pow(Math.max(w2, 1e-10), etaTerm) / etaTerm;
        }
        
        if (!isFinite(bequestUtility) || isNaN(bequestUtility)) {
            return -5000;
        }
        
        // Combine utilities with memoized exponential
        const totalUtility = u1 + MemoizedMath.exp(-rho * t1) * u2 + bequestUtility;
        
        // Final check for mathematical validity
        if (!isFinite(totalUtility) || isNaN(totalUtility)) {
            return -5000;
        }
        
        return totalUtility;
        
    } catch (error) {
        // Return large penalty rather than throw for optimization robustness
        return -5000;
    }
}

/**
 * Calculates initial consumption level for period 1.
 * 
 * @param {number} r - Interest rate
 * @param {number} rho - Impatience rate
 * @param {number} gamma - Risk aversion parameter
 * @param {number} t1 - Period 1 length
 * @param {number} w0 - Initial wealth
 * @param {number} w1 - Terminal wealth for period 1
 * @returns {number} Initial consumption level
 */
export function initialConsumption1(r, rho, gamma, t1, w0, w1) {
    try {
        const k = kappa(r, rho, gamma);
        // Pre-compute common exponentials
        const expRt1 = MemoizedMath.exp(r * t1);
        const expRminusRhoT1 = MemoizedMath.exp((r - rho) * t1 / gamma);
        
        const num = k * (expRt1 * w0 - w1);
        const den = expRt1 - expRminusRhoT1;
        
        if (Math.abs(den) < 1e-10) {
            throw new MathematicalError('Division by near-zero denominator in consumption calculation');
        }
        
        const result = num / den;
        
        if (!isFinite(result) || result <= 0) {
            throw new MathematicalError('Invalid consumption calculation', { num, den, result });
        }
        
        return result;
        
    } catch (error) {
        if (error instanceof MathematicalError) {
            throw error;
        }
        throw new MathematicalError(`Initial consumption calculation failed: ${error.message}`, { r, rho, gamma, t1, w0, w1 });
    }
}

/**
 * Calculates initial consumption level for period 2.
 * 
 * @param {number} r - Interest rate
 * @param {number} rho - Impatience rate
 * @param {number} gamma - Risk aversion parameter
 * @param {number} t2 - Period 2 length
 * @param {number} w1 - Initial wealth for period 2 (pre-tax)
 * @param {number} tau - Tax rate
 * @param {number} w2 - Terminal wealth for period 2
 * @returns {number} Initial consumption level for period 2
 */
export function initialConsumption2(r, rho, gamma, t2, w1, tau, w2) {
    try {
        const k = kappa(r, rho, gamma);
        // Pre-compute common exponentials
        const expRt2 = MemoizedMath.exp(r * t2);
        const expRminusRhoT2 = MemoizedMath.exp((r - rho) * t2 / gamma);
        
        const num = k * (expRt2 * w1 * (1 - tau) - w2);
        const den = expRt2 - expRminusRhoT2;
        
        if (Math.abs(den) < 1e-10) {
            throw new MathematicalError('Division by near-zero denominator in consumption calculation');
        }
        
        const result = num / den;
        
        if (!isFinite(result) || result <= 0) {
            throw new MathematicalError('Invalid consumption calculation', { num, den, result });
        }
        
        return result;
        
    } catch (error) {
        if (error instanceof MathematicalError) {
            throw error;
        }
        throw new MathematicalError(`Initial consumption 2 calculation failed: ${error.message}`, { r, rho, gamma, t2, w1, tau, w2 });
    }
}

/**
 * Creates a wealth path function for period 1.
 * Returns a function that gives wealth at any time t in [0, t1].
 * 
 * @param {number} r - Interest rate
 * @param {number} rho - Impatience rate
 * @param {number} gamma - Risk aversion parameter
 * @param {number} t1 - Period length
 * @param {number} w0 - Initial wealth
 * @param {number} w1 - Terminal wealth
 * @returns {Function} Wealth path function w(t)
 */
export function createWealthPath1(r, rho, gamma, t1, w0, w1) {
    const k = kappa(r, rho, gamma);
    const c = initialConsumption1(r, rho, gamma, t1, w0, w1);
    
    return function(t) {
        if (t < 0 || t > t1) {
            throw new MathematicalError(`Time ${t} outside valid range [0, ${t1}]`);
        }
        
        const expRt = MemoizedMath.exp(r * t);
        const expNegKt = MemoizedMath.exp(-k * t);
        const result = expRt * w0 - c * expRt * (1 - expNegKt) / k;
        
        if (!isFinite(result)) {
            throw new MathematicalError('Wealth path calculation produced non-finite result', { t, result });
        }
        
        return result;
    };
}

/**
 * Creates a wealth path function for period 2.
 * Returns a function that gives wealth at any time s in [0, t2] (relative to start of period 2).
 * 
 * @param {number} r - Interest rate
 * @param {number} rho - Impatience rate
 * @param {number} gamma - Risk aversion parameter
 * @param {number} t2 - Period length
 * @param {number} w1 - Initial wealth (pre-tax)
 * @param {number} tau - Tax rate
 * @param {number} w2 - Terminal wealth
 * @returns {Function} Wealth path function w(s)
 */
export function createWealthPath2(r, rho, gamma, t2, w1, tau, w2) {
    const k = kappa(r, rho, gamma);
    const c = initialConsumption2(r, rho, gamma, t2, w1, tau, w2);
    
    return function(s) {
        if (s < 0 || s > t2) {
            throw new MathematicalError(`Time ${s} outside valid range [0, ${t2}]`);
        }
        
        const expRs = MemoizedMath.exp(r * s);
        const expNegKs = MemoizedMath.exp(-k * s);
        const result = expRs * w1 * (1 - tau) - c * expRs * (1 - expNegKs) / k;
        
        if (!isFinite(result)) {
            throw new MathematicalError('Wealth path calculation produced non-finite result', { s, result });
        }
        
        return result;
    };
}

/**
 * Creates a consumption path function for period 1.
 * 
 * @param {number} r - Interest rate
 * @param {number} rho - Impatience rate
 * @param {number} gamma - Risk aversion parameter
 * @param {number} c01 - Initial consumption level
 * @returns {Function} Consumption path function c(t)
 */
export function createConsumptionPath1(r, rho, gamma, c01) {
    return function(t) {
        if (t < 0) {
            throw new MathematicalError(`Time ${t} must be non-negative`);
        }
        
        const result = c01 * MemoizedMath.exp((r - rho) * t / gamma);
        
        if (!isFinite(result)) {
            throw new MathematicalError('Consumption path calculation produced non-finite result', { t, result });
        }
        
        return result;
    };
}

/**
 * Creates a consumption path function for period 2.
 * 
 * @param {number} r - Interest rate
 * @param {number} rho - Impatience rate
 * @param {number} gamma - Risk aversion parameter
 * @param {number} c02 - Initial consumption level for period 2
 * @returns {Function} Consumption path function c(s)
 */
export function createConsumptionPath2(r, rho, gamma, c02) {
    return function(s) {
        if (s < 0) {
            throw new MathematicalError(`Time ${s} must be non-negative`);
        }
        
        const result = c02 * MemoizedMath.exp((r - rho) * s / gamma);
        
        if (!isFinite(result)) {
            throw new MathematicalError('Consumption path calculation produced non-finite result', { s, result });
        }
        
        return result;
    };
}

/**
 * Checks if a wealth pair (w1, w2) satisfies all economic constraints.
 * 
 * @param {number} w1 - Wealth at tax time
 * @param {number} w2 - Terminal wealth
 * @param {Object} parameters - Economic parameters {r, t1, t2, tau, w0}
 * @returns {boolean} True if constraints are satisfied
 */
export function checkConstraints(w1, w2, parameters) {
    const { r, t1, t2, tau, w0 = 1 } = parameters;
    
    // Basic positivity constraints
    if (w1 <= 0 || w2 <= 0) {
        return false;
    }
    
    // Wealth cannot exceed maximum possible (all income, no consumption)
    const maxW1 = MemoizedMath.exp(r * t1) * w0;
    if (w1 >= maxW1) {
        return false;
    }
    
    // Post-tax wealth cannot exceed maximum possible in period 2
    const maxW2 = w1 * (1 - tau) * MemoizedMath.exp(r * t2);
    if (w2 >= maxW2) {
        return false;
    }
    
    return true;
}