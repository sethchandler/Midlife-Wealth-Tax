/**
 * Parameter validation utilities for the Midlife Wealth Tax application.
 * Provides comprehensive validation rules for economic model parameters.
 */

import { ValidationError } from '../errors/ErrorTypes.js';

/**
 * Validation rule function type: (value, params) => string | null
 * Returns error message if invalid, null if valid
 */

/**
 * Parameter validator that enforces economic model constraints
 * and mathematical requirements for stable computation.
 */
export class ParameterValidator {
    constructor() {
        this.rules = new Map([
            ['r', this.createInterestRateRules()],
            ['rho', this.createImpatienecRateRules()],
            ['gamma', this.createRiskAversionRules()],
            ['eta', this.createBequestRiskAversionRules()],
            ['beta', this.createBequestImportanceRules()],
            ['tau', this.createTaxRateRules()],
            ['t1', this.createTimeHorizonRules('t1')],
            ['t2', this.createTimeHorizonRules('t2')],
            ['w0', this.createWealthRules('w0')]
        ]);

        // Cross-parameter validation rules
        this.crossRules = [
            this.validateInterestRateConsistency,
            this.validateTimeHorizonsConsistency,
            this.validateRiskAversionConsistency
        ];
    }

    /**
     * Validates a complete parameter set
     * @param {Object} parameters - Parameters to validate
     * @returns {Object} - {isValid: boolean, errors: string[]}
     */
    validate(parameters) {
        const errors = [];

        // Validate individual parameters
        for (const [paramName, rules] of this.rules) {
            const value = parameters[paramName];
            
            for (const rule of rules) {
                const error = rule(value, parameters);
                if (error) {
                    errors.push(`${paramName}: ${error}`);
                }
            }
        }

        // Validate cross-parameter constraints
        for (const crossRule of this.crossRules) {
            const error = crossRule(parameters);
            if (error) {
                errors.push(error);
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validates parameters and throws ValidationError if invalid
     */
    validateOrThrow(parameters) {
        const validation = this.validate(parameters);
        if (!validation.isValid) {
            throw new ValidationError(validation.errors, parameters);
        }
    }

    /**
     * Creates validation rules for interest rate
     */
    createInterestRateRules() {
        return [
            this.createTypeRule('number'),
            this.createRangeRule(0.001, 0.2, 'Interest rate must be between 0.1% and 20%'),
            this.createFiniteRule()
        ];
    }

    /**
     * Creates validation rules for impatience rate
     */
    createImpatienecRateRules() {
        return [
            this.createTypeRule('number'),
            this.createRangeRule(0.001, 0.15, 'Impatience rate must be between 0.1% and 15%'),
            this.createFiniteRule()
        ];
    }

    /**
     * Creates validation rules for consumption risk aversion
     */
    createRiskAversionRules() {
        return [
            this.createTypeRule('number'),
            this.createRangeRule(0.1, 5, 'Consumption risk aversion must be between 0.1 and 5'),
            this.createFiniteRule(),
            (value) => value === 1 ? 'Consumption risk aversion cannot equal exactly 1 (log utility boundary)' : null
        ];
    }

    /**
     * Creates validation rules for bequest risk aversion
     */
    createBequestRiskAversionRules() {
        return [
            this.createTypeRule('number'),
            this.createRangeRule(0.1, 5, 'Bequest risk aversion must be between 0.1 and 5'),
            this.createFiniteRule(),
            (value) => value === 1 ? 'Bequest risk aversion cannot equal exactly 1 (log utility boundary)' : null
        ];
    }

    /**
     * Creates validation rules for bequest importance
     */
    createBequestImportanceRules() {
        return [
            this.createTypeRule('number'),
            this.createRangeRule(0, 50, 'Bequest importance must be between 0 and 50'),
            this.createFiniteRule()
        ];
    }

    /**
     * Creates validation rules for tax rate
     */
    createTaxRateRules() {
        return [
            this.createTypeRule('number'),
            this.createRangeRule(0, 0.99, 'Tax rate must be between 0% and 99%'),
            this.createFiniteRule()
        ];
    }

    /**
     * Creates validation rules for time horizons
     */
    createTimeHorizonRules(paramName) {
        return [
            this.createTypeRule('number'),
            this.createRangeRule(1, 100, `${paramName} must be between 1 and 100 years`),
            this.createIntegerRule(),
            this.createFiniteRule()
        ];
    }

    /**
     * Creates validation rules for wealth parameters
     */
    createWealthRules(paramName) {
        return [
            this.createTypeRule('number'),
            this.createRangeRule(0.01, 1000, `${paramName} must be between 0.01 and 1000`),
            this.createFiniteRule()
        ];
    }

    /**
     * Cross-parameter validation: interest rate consistency
     */
    validateInterestRateConsistency(params) {
        const { r, rho } = params;
        if (typeof r === 'number' && typeof rho === 'number') {
            if (r <= rho) {
                return 'Interest rate must be greater than impatience rate for economic consistency';
            }
        }
        return null;
    }

    /**
     * Cross-parameter validation: time horizons consistency
     */
    validateTimeHorizonsConsistency(params) {
        const { t1, t2 } = params;
        if (typeof t1 === 'number' && typeof t2 === 'number') {
            if (t1 + t2 > 120) {
                return 'Total lifetime (t1 + t2) should not exceed 120 years';
            }
            if (t1 < 5) {
                return 'Pre-tax period (t1) should be at least 5 years for meaningful analysis';
            }
        }
        return null;
    }

    /**
     * Cross-parameter validation: risk aversion consistency
     */
    validateRiskAversionConsistency(params) {
        const { gamma, eta } = params;
        if (typeof gamma === 'number' && typeof eta === 'number') {
            if (Math.abs(gamma - eta) > 3) {
                return 'Consumption and bequest risk aversion should be within 3 units of each other for realistic behavior';
            }
        }
        return null;
    }

    // Rule factory methods

    createTypeRule(expectedType) {
        return (value) => {
            if (typeof value !== expectedType) {
                return `must be a ${expectedType}`;
            }
            return null;
        };
    }

    createRangeRule(min, max, message) {
        return (value) => {
            if (typeof value === 'number' && (value < min || value > max)) {
                return message || `must be between ${min} and ${max}`;
            }
            return null;
        };
    }

    createFiniteRule() {
        return (value) => {
            if (typeof value === 'number' && !isFinite(value)) {
                return 'must be a finite number';
            }
            return null;
        };
    }

    createIntegerRule() {
        return (value) => {
            if (typeof value === 'number' && !Number.isInteger(value)) {
                return 'must be an integer';
            }
            return null;
        };
    }
}

/**
 * Convenience function to validate parameters
 */
export function validateParameters(parameters) {
    const validator = new ParameterValidator();
    return validator.validate(parameters);
}

/**
 * Convenience function to validate parameters and throw on error
 */
export function validateParametersOrThrow(parameters) {
    const validator = new ParameterValidator();
    validator.validateOrThrow(parameters);
}

/**
 * Default parameter values that pass validation
 */
export const DEFAULT_PARAMETERS = {
    r: 0.06,      // 6% interest rate
    rho: 0.04,    // 4% impatience rate
    gamma: 0.7,   // Consumption risk aversion
    eta: 1.7,     // Bequest risk aversion  
    beta: 3,      // Bequest importance
    tau: 0,       // 0% tax rate
    t1: 20,       // 20 years pre-tax
    t2: 25,       // 25 years post-tax
    w0: 1         // Initial wealth normalized to 1
};

/**
 * Parameter ranges for UI sliders
 */
export const PARAMETER_RANGES = {
    r: { min: 0.01, max: 0.09, step: 0.01 },
    rho: { min: 0.02, max: 0.09, step: 0.01 },
    gamma: { min: 0.3, max: 2.5, step: 0.2 },
    eta: { min: 0.3, max: 2.5, step: 0.2 },
    beta: { min: 0, max: 15, step: 0.1 },
    tau: { min: 0, max: 0.5, step: 0.01 },
    t1: { min: 10, max: 30, step: 1 },
    t2: { min: 10, max: 30, step: 1 }
};