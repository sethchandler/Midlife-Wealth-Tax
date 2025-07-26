/**
 * Application state management with immutable updates and event notifications.
 * Provides centralized state for the wealth tax visualization application.
 */

import { DEFAULT_PARAMETERS } from '../utils/ParameterValidator.js';

/**
 * Immutable state management class with subscriber notifications.
 */
export class ApplicationState {
    constructor(initialState = {}) {
        this.state = Object.freeze({
            ...this.getDefaultState(),
            ...initialState
        });
        
        this.listeners = new Set();
        this.history = [this.state];
        this.maxHistorySize = 50;
    }

    /**
     * Gets the current state (immutable copy).
     */
    getState() {
        return this.state;
    }

    /**
     * Updates state with new values and notifies listeners.
     */
    setState(updates, source = 'unknown') {
        const oldState = this.state;
        const newState = Object.freeze({
            ...oldState,
            ...updates,
            lastUpdated: Date.now(),
            updateSource: source
        });
        
        this.state = newState;
        this.addToHistory(newState);
        this.notifyListeners(newState, oldState);
        
        return newState;
    }

    /**
     * Updates a specific parameter and triggers parameter validation.
     */
    setParameter(parameterName, value, source = 'ui') {
        const newParameters = {
            ...this.state.parameters,
            [parameterName]: value
        };
        
        return this.setState({
            parameters: newParameters,
            lastParameterChange: parameterName,
            needsRecalculation: true
        }, source);
    }

    /**
     * Updates multiple parameters at once.
     */
    setParameters(parameterUpdates, source = 'ui') {
        const newParameters = {
            ...this.state.parameters,
            ...parameterUpdates
        };
        
        return this.setState({
            parameters: newParameters,
            lastParameterChange: Object.keys(parameterUpdates),
            needsRecalculation: true
        }, source);
    }

    /**
     * Sets the visualization type and clears dependent state.
     */
    setVisualizationType(visualizationType, source = 'ui') {
        return this.setState({
            visualizationType,
            needsRecalculation: true,
            chartConfig: null
        }, source);
    }

    /**
     * Sets calculation results and marks as up-to-date.
     */
    setCalculationResults(results, source = 'calculation') {
        return this.setState({
            lastOptimizationResult: results,
            needsRecalculation: false,
            isCalculating: false,
            lastCalculationTime: Date.now(),
            errors: [] // Clear errors on successful calculation
        }, source);
    }

    /**
     * Sets chart configuration after successful visualization generation.
     */
    setChartConfig(chartConfig, source = 'visualization') {
        return this.setState({
            chartConfig,
            lastVisualizationTime: Date.now()
        }, source);
    }

    /**
     * Sets loading state for calculations.
     */
    setCalculating(isCalculating, source = 'calculation') {
        return this.setState({
            isCalculating,
            ...(isCalculating && { errors: [] }) // Clear errors when starting calculation
        }, source);
    }

    /**
     * Adds an error to the error list.
     */
    addError(error, source = 'error') {
        const newErrors = [...this.state.errors, {
            ...error,
            id: Date.now(),
            timestamp: new Date().toISOString()
        }];
        
        return this.setState({
            errors: newErrors,
            isCalculating: false
        }, source);
    }

    /**
     * Clears all errors.
     */
    clearErrors(source = 'ui') {
        return this.setState({
            errors: []
        }, source);
    }

    /**
     * Subscribes to state changes.
     */
    subscribe(listener) {
        this.listeners.add(listener);
        
        // Return unsubscribe function
        return () => this.listeners.delete(listener);
    }

    /**
     * Gets default application state.
     */
    getDefaultState() {
        return {
            // Economic parameters
            parameters: { ...DEFAULT_PARAMETERS },
            
            // UI state
            visualizationType: 'Wealth Trajectory',
            
            // Calculation state
            isCalculating: false,
            needsRecalculation: true,
            lastOptimizationResult: null,
            lastCalculationTime: null,
            
            // Visualization state
            chartConfig: null,
            lastVisualizationTime: null,
            
            // Error handling
            errors: [],
            
            // Performance tracking
            performanceStats: {
                calculationCount: 0,
                totalCalculationTime: 0,
                cacheHits: 0,
                avgCalculationTime: 0
            },
            
            // Metadata
            lastUpdated: Date.now(),
            updateSource: 'initialization'
        };
    }

    /**
     * Notifies all listeners of state changes.
     */
    notifyListeners(newState, oldState) {
        this.listeners.forEach(listener => {
            try {
                listener(newState, oldState, this.getChangeSet(newState, oldState));
            } catch (error) {
                console.error('Error in state listener:', error);
            }
        });
    }

    /**
     * Calculates what changed between states.
     */
    getChangeSet(newState, oldState) {
        const changes = {};
        
        for (const key in newState) {
            if (newState[key] !== oldState[key]) {
                changes[key] = {
                    old: oldState[key],
                    new: newState[key]
                };
            }
        }
        
        return changes;
    }

    /**
     * Adds state to history for debugging.
     */
    addToHistory(state) {
        this.history.unshift({
            ...state,
            historyTimestamp: Date.now()
        });
        
        // Maintain history size limit
        if (this.history.length > this.maxHistorySize) {
            this.history = this.history.slice(0, this.maxHistorySize);
        }
    }

    /**
     * Gets state history for debugging.
     */
    getHistory() {
        return [...this.history];
    }

    /**
     * Clears state history.
     */
    clearHistory() {
        this.history = [this.state];
    }

    /**
     * Resets state to defaults.
     */
    reset() {
        const defaultState = this.getDefaultState();
        this.state = Object.freeze(defaultState);
        this.history = [this.state];
        this.notifyListeners(this.state, {});
    }

    /**
     * Helper methods for common state queries.
     */
    isParameterChanged(parameterName, oldState) {
        return this.state.parameters[parameterName] !== oldState.parameters[parameterName];
    }

    hasErrors() {
        return this.state.errors.length > 0;
    }

    getLatestError() {
        return this.state.errors[this.state.errors.length - 1] || null;
    }

    needsRecalculation() {
        return this.state.needsRecalculation;
    }

    isVisualizationUpToDate() {
        return this.state.chartConfig !== null && 
               !this.state.needsRecalculation &&
               this.state.lastVisualizationTime >= this.state.lastCalculationTime;
    }
}

/**
 * Global application state instance.
 */
export const applicationState = new ApplicationState();

/**
 * Convenience functions for common operations.
 */
export function getState() {
    return applicationState.getState();
}

export function setState(updates, source) {
    return applicationState.setState(updates, source);
}

export function setParameter(name, value, source) {
    return applicationState.setParameter(name, value, source);
}

export function setParameters(updates, source) {
    return applicationState.setParameters(updates, source);
}

export function subscribe(listener) {
    return applicationState.subscribe(listener);
}