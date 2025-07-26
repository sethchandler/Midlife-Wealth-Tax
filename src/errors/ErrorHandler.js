/**
 * Centralized error handling system for the Midlife Wealth Tax application.
 * Provides consistent error processing, logging, and user-friendly messaging.
 */

import { 
    MathematicalError, 
    OptimizationError, 
    ValidationError, 
    VisualizationError,
    ErrorCodes,
    UserFriendlyMessages 
} from './ErrorTypes.js';

/**
 * Central error handler that processes all application errors.
 * Returns structured error information for consistent handling across the app.
 */
export class ErrorHandler {
    constructor(options = {}) {
        this.options = {
            logToConsole: true,
            includeStackTrace: false,
            maxErrorHistory: 50,
            ...options
        };
        
        this.errorHistory = [];
    }

    /**
     * Main error handling method that processes any error and returns
     * structured information for UI display and logging.
     */
    handle(error, context = {}) {
        const errorInfo = this.categorizeError(error, context);
        
        if (this.options.logToConsole) {
            this.logError(errorInfo);
        }
        
        this.addToHistory(errorInfo);
        
        return {
            code: errorInfo.code,
            userMessage: errorInfo.userMessage,
            technicalMessage: errorInfo.technicalMessage,
            context: context,
            timestamp: errorInfo.timestamp,
            canRetry: errorInfo.canRetry,
            suggestedAction: errorInfo.suggestedAction
        };
    }

    /**
     * Categorizes errors and extracts relevant information
     */
    categorizeError(error, context) {
        const baseInfo = {
            timestamp: new Date().toISOString(),
            originalError: error,
            context
        };

        if (error instanceof MathematicalError) {
            return {
                ...baseInfo,
                code: this.determineMathErrorCode(error),
                userMessage: this.getMathErrorMessage(error),
                technicalMessage: error.message,
                canRetry: true,
                suggestedAction: 'Try adjusting parameter values'
            };
        }

        if (error instanceof OptimizationError) {
            return {
                ...baseInfo,
                code: ErrorCodes.OPTIMIZATION_FAILED,
                userMessage: UserFriendlyMessages[ErrorCodes.OPTIMIZATION_FAILED],
                technicalMessage: error.message,
                canRetry: true,
                suggestedAction: 'Try different parameter combinations'
            };
        }

        if (error instanceof ValidationError) {
            return {
                ...baseInfo,
                code: ErrorCodes.PARAMETER_OUT_OF_RANGE,
                userMessage: this.formatValidationMessage(error),
                technicalMessage: error.message,
                canRetry: true,
                suggestedAction: 'Correct the invalid parameters'
            };
        }

        if (error instanceof VisualizationError) {
            return {
                ...baseInfo,
                code: ErrorCodes.CHART_CREATION_FAILED,
                userMessage: UserFriendlyMessages[ErrorCodes.CHART_CREATION_FAILED],
                technicalMessage: error.message,
                canRetry: true,
                suggestedAction: 'Try a different visualization type'
            };
        }

        // Handle unknown errors
        return {
            ...baseInfo,
            code: ErrorCodes.UNKNOWN_ERROR,
            userMessage: UserFriendlyMessages[ErrorCodes.UNKNOWN_ERROR],
            technicalMessage: error.message || 'Unknown error occurred',
            canRetry: true,
            suggestedAction: 'Try refreshing the page or adjusting parameters'
        };
    }

    /**
     * Determines specific error code for mathematical errors based on content
     */
    determineMathErrorCode(error) {
        const message = error.message.toLowerCase();
        
        if (message.includes('infinity') || message.includes('infinite')) {
            return ErrorCodes.INFINITE_RESULT;
        }
        if (message.includes('negative') && message.includes('utility')) {
            return ErrorCodes.NEGATIVE_UTILITY;
        }
        if (message.includes('complex') || message.includes('nan')) {
            return ErrorCodes.COMPLEX_NUMBER;
        }
        
        return ErrorCodes.INVALID_UTILITY_CALCULATION;
    }

    /**
     * Gets user-friendly message for mathematical errors
     */
    getMathErrorMessage(error) {
        const code = this.determineMathErrorCode(error);
        return UserFriendlyMessages[code] || UserFriendlyMessages[ErrorCodes.INVALID_UTILITY_CALCULATION];
    }

    /**
     * Formats validation error messages for user display
     */
    formatValidationMessage(error) {
        if (error.validationErrors && error.validationErrors.length > 0) {
            return `Parameter validation failed: ${error.validationErrors.join(', ')}`;
        }
        return UserFriendlyMessages[ErrorCodes.PARAMETER_OUT_OF_RANGE];
    }

    /**
     * Logs error information to console with appropriate level
     */
    logError(errorInfo) {
        const logMessage = `[${errorInfo.code}] ${errorInfo.technicalMessage}`;
        
        if (errorInfo.code === ErrorCodes.UNKNOWN_ERROR) {
            console.error(logMessage, errorInfo);
        } else {
            console.warn(logMessage, {
                context: errorInfo.context,
                timestamp: errorInfo.timestamp
            });
        }

        if (this.options.includeStackTrace && errorInfo.originalError?.stack) {
            console.debug('Stack trace:', errorInfo.originalError.stack);
        }
    }

    /**
     * Adds error to history for debugging and analytics
     */
    addToHistory(errorInfo) {
        this.errorHistory.unshift({
            code: errorInfo.code,
            message: errorInfo.technicalMessage,
            timestamp: errorInfo.timestamp,
            context: errorInfo.context
        });

        // Maintain maximum history size
        if (this.errorHistory.length > this.options.maxErrorHistory) {
            this.errorHistory = this.errorHistory.slice(0, this.options.maxErrorHistory);
        }
    }

    /**
     * Gets recent error history for debugging
     */
    getErrorHistory() {
        return [...this.errorHistory];
    }

    /**
     * Clears error history
     */
    clearHistory() {
        this.errorHistory = [];
    }

    /**
     * Determines if an error is recoverable and worth retrying
     */
    isRecoverable(error) {
        if (error instanceof ValidationError) {
            return false; // Need user input to fix
        }
        
        if (error instanceof MathematicalError) {
            return true; // Might work with different parameters
        }
        
        if (error instanceof OptimizationError) {
            return true; // Might converge with different starting point
        }
        
        return true; // Default to recoverable
    }
}

/**
 * Singleton instance for global error handling
 */
export const globalErrorHandler = new ErrorHandler();

/**
 * Convenience function for handling errors consistently across the application
 */
export function handleError(error, context = {}) {
    return globalErrorHandler.handle(error, context);
}