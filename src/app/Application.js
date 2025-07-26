/**
 * Main application controller that orchestrates all services and manages the application lifecycle.
 * Coordinates between state management, optimization, visualization, and UI components.
 */

import { applicationState, subscribe } from '../state/ApplicationState.js';
import { optimizationService } from '../services/OptimizationService.js';
import { visualizationService } from '../services/VisualizationService.js';
import { handleError } from '../errors/ErrorHandler.js';
import { validateParameters } from '../utils/ParameterValidator.js';

/**
 * Main application class that coordinates all components.
 */
export class Application {
    constructor() {
        this.state = applicationState;
        this.isInitialized = false;
        
        // Performance tracking
        this.performanceStats = {
            calculationCount: 0,
            totalCalculationTime: 0,
            cacheHits: 0
        };
        
        // Throttling for parameter changes
        this.calculationThrottle = null;
        this.throttleDelay = 100; // ms
    }

    /**
     * Initializes the application and sets up event listeners.
     */
    async initialize() {
        if (this.isInitialized) {
            console.warn('Application already initialized');
            return;
        }

        try {
            console.log('Initializing Midlife Wealth Tax application...');
            
            // Set up state change listener
            this.setupStateListener();
            
            // Perform initial calculation asynchronously to avoid blocking UI
            setTimeout(() => this.performInitialCalculation(), 100);
            
            this.isInitialized = true;
            console.log('Application initialized successfully');
            
        } catch (error) {
            const errorInfo = handleError(error, { context: 'application_initialization' });
            console.error('Failed to initialize application:', errorInfo);
            this.state.addError(errorInfo, 'initialization');
        }
    }

    /**
     * Sets up the main state change listener that drives the application.
     */
    setupStateListener() {
        subscribe((newState, oldState, changeSet) => {
            try {
                this.handleStateChange(newState, oldState, changeSet);
            } catch (error) {
                const errorInfo = handleError(error, { context: 'state_change_handler' });
                this.state.addError(errorInfo, 'state_handler');
            }
        });
    }

    /**
     * Handles state changes and triggers appropriate actions.
     */
    async handleStateChange(newState, oldState, changeSet) {
        // Handle parameter changes
        if (changeSet.parameters || changeSet.visualizationType) {
            await this.handleParameterChange(newState);
        }
        
        // Handle optimization results
        if (changeSet.lastOptimizationResult && newState.lastOptimizationResult) {
            await this.handleOptimizationComplete(newState);
        }
        
        // Update performance stats
        if (changeSet.lastOptimizationResult) {
            this.updatePerformanceStats(newState.lastOptimizationResult);
        }
    }

    /**
     * Handles parameter changes with throttling to avoid excessive calculations.
     */
    async handleParameterChange(newState) {
        // Clear any existing throttled calculation
        if (this.calculationThrottle) {
            clearTimeout(this.calculationThrottle);
        }
        
        // Throttle calculations to avoid excessive computation during rapid parameter changes
        this.calculationThrottle = setTimeout(async () => {
            try {
                await this.performCalculation(newState.parameters, newState.visualizationType);
            } catch (error) {
                const errorInfo = handleError(error, { context: 'throttled_calculation' });
                this.state.addError(errorInfo, 'calculation');
            }
        }, this.throttleDelay);
    }

    /**
     * Handles completion of optimization and triggers visualization update.
     */
    async handleOptimizationComplete(newState) {
        try {
            const chartConfig = await visualizationService.generateVisualizationConfig(
                newState.visualizationType,
                newState.parameters
            );
            
            this.state.setChartConfig(chartConfig, 'optimization_complete');
            
        } catch (error) {
            const errorInfo = handleError(error, { context: 'visualization_generation' });
            this.state.addError(errorInfo, 'visualization');
        }
    }

    /**
     * Performs initial calculation on application startup.
     */
    async performInitialCalculation() {
        const state = this.state.getState();
        await this.performCalculation(state.parameters, state.visualizationType);
    }

    /**
     * Performs optimization calculation for given parameters.
     */
    async performCalculation(parameters, visualizationType) {
        const startTime = performance.now();
        
        try {
            // Validate parameters first
            const validation = validateParameters(parameters);
            if (!validation.isValid) {
                throw new Error(`Parameter validation failed: ${validation.errors.join(', ')}`);
            }
            
            // Set calculating state
            this.state.setCalculating(true, 'calculation_start');
            
            // Perform optimization
            const optimizationResult = await optimizationService.findOptimalWealth(parameters);
            
            // Update state with results
            this.state.setCalculationResults({
                ...optimizationResult,
                calculationTime: performance.now() - startTime,
                parameters: { ...parameters },
                visualizationType
            }, 'calculation_complete');
            
            console.log(`Calculation completed in ${(performance.now() - startTime).toFixed(2)}ms`, optimizationResult);
            
        } catch (error) {
            this.state.setCalculating(false, 'calculation_error');
            
            const errorInfo = handleError(error, { 
                context: 'optimization_calculation',
                parameters,
                visualizationType
            });
            
            this.state.addError(errorInfo, 'calculation');
            
            console.error('Calculation failed:', errorInfo);
        }
    }

    /**
     * Updates performance statistics.
     */
    updatePerformanceStats(optimizationResult) {
        this.performanceStats.calculationCount++;
        this.performanceStats.totalCalculationTime += optimizationResult.calculationTime || 0;
        
        if (optimizationResult.cacheHit) {
            this.performanceStats.cacheHits++;
        }
        
        // Update average calculation time
        this.performanceStats.avgCalculationTime = 
            this.performanceStats.totalCalculationTime / this.performanceStats.calculationCount;
        
        // Update state with new performance stats
        this.state.setState({
            performanceStats: { ...this.performanceStats }
        }, 'performance_update');
    }

    /**
     * Forces a recalculation regardless of throttling.
     */
    async forceRecalculation() {
        if (this.calculationThrottle) {
            clearTimeout(this.calculationThrottle);
            this.calculationThrottle = null;
        }
        
        const state = this.state.getState();
        await this.performCalculation(state.parameters, state.visualizationType);
    }

    /**
     * Resets the application to default state.
     */
    reset() {
        if (this.calculationThrottle) {
            clearTimeout(this.calculationThrottle);
            this.calculationThrottle = null;
        }
        
        // Clear service caches
        optimizationService.clearCache();
        optimizationService.resetWarmStart();
        
        // Reset state
        this.state.reset();
        
        // Reset performance stats
        this.performanceStats = {
            calculationCount: 0,
            totalCalculationTime: 0,
            cacheHits: 0
        };
        
        console.log('Application reset to defaults');
    }

    /**
     * Gets current performance statistics.
     */
    getPerformanceStats() {
        return {
            ...this.performanceStats,
            cacheHitRate: this.performanceStats.cacheHits / Math.max(this.performanceStats.calculationCount, 1),
            optimizationCacheStats: optimizationService.getCacheStats()
        };
    }

    /**
     * Exports current state and results for debugging or sharing.
     */
    exportState() {
        const state = this.state.getState();
        return {
            parameters: state.parameters,
            visualizationType: state.visualizationType,
            lastOptimizationResult: state.lastOptimizationResult,
            performanceStats: this.getPerformanceStats(),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Imports state from exported data.
     */
    async importState(exportedState) {
        try {
            // Validate imported parameters
            const validation = validateParameters(exportedState.parameters);
            if (!validation.isValid) {
                throw new Error(`Invalid imported parameters: ${validation.errors.join(', ')}`);
            }
            
            // Update state
            this.state.setParameters(exportedState.parameters, 'import');
            if (exportedState.visualizationType) {
                this.state.setVisualizationType(exportedState.visualizationType, 'import');
            }
            
            console.log('State imported successfully');
            
        } catch (error) {
            const errorInfo = handleError(error, { context: 'state_import' });
            this.state.addError(errorInfo, 'import');
            throw error;
        }
    }

    /**
     * Cleanup method for proper application shutdown.
     */
    destroy() {
        if (this.calculationThrottle) {
            clearTimeout(this.calculationThrottle);
        }
        
        // Clear caches
        optimizationService.clearCache();
        
        this.isInitialized = false;
        console.log('Application destroyed');
    }
}

/**
 * Global application instance.
 */
export const application = new Application();

/**
 * Convenience function to initialize the application.
 */
export async function initializeApplication() {
    return await application.initialize();
}

/**
 * Convenience function to get the application instance.
 */
export function getApplication() {
    return application;
}