/**
 * Error type definitions for the Midlife Wealth Tax application.
 * Provides specific error categories for different failure scenarios.
 */

/**
 * Base error class for mathematical operations that may fail due to
 * numerical issues, constraint violations, or invalid parameters.
 */
export class MathematicalError extends Error {
    constructor(message, context = {}) {
        super(message);
        this.name = 'MathematicalError';
        this.context = context;
        this.timestamp = new Date().toISOString();
        
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

/**
 * Error class for optimization algorithm failures.
 * Includes parameter context for debugging convergence issues.
 */
export class OptimizationError extends Error {
    constructor(message, parameters = {}, cause = null) {
        super(message);
        this.name = 'OptimizationError';
        this.parameters = parameters;
        this.cause = cause;
        this.timestamp = new Date().toISOString();
        
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

/**
 * Error class for parameter validation failures.
 * Includes specific validation errors for user feedback.
 */
export class ValidationError extends Error {
    constructor(errors, parameters = {}) {
        const message = Array.isArray(errors) 
            ? `Validation failed: ${errors.join(', ')}`
            : `Validation failed: ${errors}`;
        
        super(message);
        this.name = 'ValidationError';
        this.validationErrors = Array.isArray(errors) ? errors : [errors];
        this.parameters = parameters;
        this.timestamp = new Date().toISOString();
        
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

/**
 * Error class for visualization configuration issues.
 * Includes chart type and configuration context.
 */
export class VisualizationError extends Error {
    constructor(message, chartType = null, config = {}) {
        super(message);
        this.name = 'VisualizationError';
        this.chartType = chartType;
        this.config = config;
        this.timestamp = new Date().toISOString();
        
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

/**
 * Error codes for categorizing different types of failures
 */
export const ErrorCodes = {
    // Mathematical Errors
    INVALID_UTILITY_CALCULATION: 'INVALID_UTILITY_CALCULATION',
    NEGATIVE_UTILITY: 'NEGATIVE_UTILITY',
    INFINITE_RESULT: 'INFINITE_RESULT',
    COMPLEX_NUMBER: 'COMPLEX_NUMBER',
    
    // Optimization Errors
    OPTIMIZATION_FAILED: 'OPTIMIZATION_FAILED',
    CONVERGENCE_FAILED: 'CONVERGENCE_FAILED',
    INFEASIBLE_CONSTRAINTS: 'INFEASIBLE_CONSTRAINTS',
    NUMERICAL_INSTABILITY: 'NUMERICAL_INSTABILITY',
    
    // Validation Errors
    PARAMETER_OUT_OF_RANGE: 'PARAMETER_OUT_OF_RANGE',
    INVALID_PARAMETER_TYPE: 'INVALID_PARAMETER_TYPE',
    MISSING_REQUIRED_PARAMETER: 'MISSING_REQUIRED_PARAMETER',
    INCONSISTENT_PARAMETERS: 'INCONSISTENT_PARAMETERS',
    
    // Visualization Errors
    CHART_CREATION_FAILED: 'CHART_CREATION_FAILED',
    INVALID_CHART_TYPE: 'INVALID_CHART_TYPE',
    DATA_PREPARATION_FAILED: 'DATA_PREPARATION_FAILED',
    
    // General Errors
    UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

/**
 * User-friendly error messages for different error types.
 * These are safe to display to users and focus on actionable guidance.
 */
export const UserFriendlyMessages = {
    [ErrorCodes.INVALID_UTILITY_CALCULATION]: 'The utility calculation failed. Please check your parameter values.',
    [ErrorCodes.NEGATIVE_UTILITY]: 'The model parameters produced negative utility. Try adjusting the risk aversion or time parameters.',
    [ErrorCodes.INFINITE_RESULT]: 'The calculation produced an infinite result. Please try different parameter values.',
    [ErrorCodes.COMPLEX_NUMBER]: 'The calculation produced complex numbers. Please adjust the risk aversion parameters.',
    
    [ErrorCodes.OPTIMIZATION_FAILED]: 'The optimization algorithm failed to find a solution. Try adjusting the parameter ranges.',
    [ErrorCodes.CONVERGENCE_FAILED]: 'The optimization did not converge. Please try different starting parameters.',
    [ErrorCodes.INFEASIBLE_CONSTRAINTS]: 'No feasible solution exists with these parameters. Try reducing the tax rate or adjusting time horizons.',
    [ErrorCodes.NUMERICAL_INSTABILITY]: 'Numerical instability detected. Please try more moderate parameter values.',
    
    [ErrorCodes.PARAMETER_OUT_OF_RANGE]: 'One or more parameters are outside the valid range.',
    [ErrorCodes.INVALID_PARAMETER_TYPE]: 'Invalid parameter type provided.',
    [ErrorCodes.MISSING_REQUIRED_PARAMETER]: 'Required parameter is missing.',
    [ErrorCodes.INCONSISTENT_PARAMETERS]: 'Parameter values are inconsistent with each other.',
    
    [ErrorCodes.CHART_CREATION_FAILED]: 'Failed to create the visualization. Please try again.',
    [ErrorCodes.INVALID_CHART_TYPE]: 'Unknown visualization type selected.',
    [ErrorCodes.DATA_PREPARATION_FAILED]: 'Failed to prepare data for visualization.',
    
    [ErrorCodes.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again or adjust your parameters.'
};