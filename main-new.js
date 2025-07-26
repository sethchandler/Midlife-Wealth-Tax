/**
 * Main entry point for the Midlife Wealth Tax application.
 * Uses the new modular ES6 architecture with proper separation of concerns.
 */

import { initializeApplication, getApplication } from './src/app/Application.js';
import { applicationState, subscribe } from './src/state/ApplicationState.js';
import { generateTaxEffectTable } from './src/services/VisualizationService.js';
import { handleError } from './src/errors/ErrorHandler.js';
import { PARAMETER_RANGES, DEFAULT_PARAMETERS } from './src/utils/ParameterValidator.js';

/**
 * Preset scenarios for college financial aid impact analysis.
 * Models how wealth accumulation affects financial aid eligibility.
 */
const PRESET_SCENARIOS = {
    newParents: {
        name: "New Parents",
        description: "Standard college savings: 18 years to save, one child",
        parameters: {
            r: 0.06,      // Moderate investment return for college savings
            rho: 0.04,    // Standard impatience rate
            gamma: 1.0,   // Moderate risk aversion
            eta: 1.5,     // Moderate bequest risk aversion
            beta: 3,      // Standard bequest importance
            tau: 0.25,    // Typical financial aid wealth penalty (25%)
            t1: 18,       // 18 years from birth to college
            t2: 27,       // 27 years from college to end of life (age 45-72)
            w0: 1
        }
    },
    multipleChildren: {
        name: "Multiple Children",
        description: "Higher effective penalty - wealth affects multiple kids' aid",
        parameters: {
            r: 0.06,      // Standard return
            rho: 0.04,    // Standard impatience
            gamma: 1.2,   // Slightly higher risk aversion (family stress)
            eta: 1.7,     // Higher bequest risk aversion (more kids to provide for)
            beta: 4,      // Higher bequest importance (multiple children)
            tau: 0.40,    // Higher effective rate (wealth affects 2-3 kids' aid)
            t1: 18,       // Same timeline to first child's college
            t2: 25,       // Slightly shorter post-college period
            w0: 1
        }
    },
    lateStart: {
        name: "Late Start Savers",
        description: "Started saving when child was 10 - only 8 years to accumulate",
        parameters: {
            r: 0.07,      // Slightly more aggressive investing (catching up)
            rho: 0.05,    // Higher impatience (need growth faster)
            gamma: 0.8,   // Lower risk aversion (willing to take risk to catch up)
            eta: 1.3,     // Lower bequest risk aversion
            beta: 2.5,    // Lower bequest importance (focus on college)
            tau: 0.25,    // Standard aid penalty
            t1: 8,        // Only 8 years to save (started late)
            t2: 35,       // Longer post-college period (started saving at 35)
            w0: 1
        }
    },
    highAidImpact: {
        name: "High Aid Impact",
        description: "Severe wealth penalty - family loses significant aid eligibility",
        parameters: {
            r: 0.05,      // More conservative (afraid of losses affecting aid)
            rho: 0.03,    // Lower impatience (trying to be careful)
            gamma: 1.5,   // Higher risk aversion (cautious about aid impact)
            eta: 2.0,     // Higher bequest risk aversion
            beta: 5,      // Higher bequest importance (aid concerns)
            tau: 0.50,    // Very high aid penalty (50% wealth impact)
            t1: 18,       // Standard timeline
            t2: 25,       // Standard post-college period
            w0: 1
        }
    },
    longLife: {
        name: "Long Life Expectancy",
        description: "Expects to live long - may accept aid penalty for retirement security",
        parameters: {
            r: 0.065,     // Balanced long-term approach
            rho: 0.035,   // Lower impatience (long-term thinking)
            gamma: 0.9,   // Moderate risk aversion
            eta: 1.4,     // Moderate bequest risk aversion
            beta: 3.5,    // Moderate bequest importance
            tau: 0.30,    // Moderate aid penalty
            t1: 18,       // Standard college timeline
            t2: 40,       // Long life expectancy (age 45-85+)
            w0: 1
        }
    }
};

/**
 * UI Controller that manages DOM interactions and chart rendering.
 */
class UIController {
    constructor() {
        this.chart = null;
        this.ctx = null;
        this.isInitialized = false;
        
        // Throttling for UI updates
        this.updateThrottle = null;
        this.throttleDelay = 16; // ~60fps
    }

    /**
     * Initializes the UI controller and sets up event listeners.
     */
    async initialize() {
        try {
            // Get canvas context
            this.ctx = document.getElementById('myChart')?.getContext('2d');
            if (!this.ctx) {
                throw new Error('Chart canvas not found');
            }

            // Set up UI event listeners
            this.setupEventListeners();
            
            // Subscribe to state changes
            this.setupStateSubscription();
            
            // Initialize parameter values in UI
            this.updateParameterDisplays();
            
            // Show initial loading chart immediately
            this.showLoadingChart();
            
            this.isInitialized = true;
            console.log('UI Controller initialized');
            
        } catch (error) {
            const errorInfo = handleError(error, { context: 'ui_initialization' });
            this.displayError(errorInfo);
            throw error;
        }
    }

    /**
     * Sets up event listeners for all UI controls.
     */
    setupEventListeners() {
        // Parameter sliders
        const parameterInputs = document.querySelectorAll('input[type="range"]');
        parameterInputs.forEach(input => {
            input.addEventListener('input', (e) => this.handleParameterChange(e));
            input.addEventListener('change', (e) => this.handleParameterChangeComplete(e));
        });

        // Visualization type selector
        const visualizeSelect = document.getElementById('visualize');
        if (visualizeSelect) {
            visualizeSelect.addEventListener('change', (e) => this.handleVisualizationTypeChange(e));
        }

        // Reset button
        const resetButton = document.getElementById('resetDefaults');
        if (resetButton) {
            resetButton.addEventListener('click', () => this.handleResetDefaults());
        }

        // Preset scenarios selector
        const presetSelect = document.getElementById('presetScenarios');
        if (presetSelect) {
            presetSelect.addEventListener('change', (e) => this.handlePresetScenario(e));
        }

        // Use requestAnimationFrame for smooth parameter updates
        let scheduled = false;
        parameterInputs.forEach(input => {
            input.addEventListener('input', () => {
                this.updateParameterDisplays();
                if (!scheduled) {
                    scheduled = true;
                    requestAnimationFrame(() => {
                        scheduled = false;
                    });
                }
            });
        });
    }

    /**
     * Sets up subscription to application state changes.
     */
    setupStateSubscription() {
        subscribe((newState, oldState, changeSet) => {
            this.handleStateChange(newState, oldState, changeSet);
        });
    }

    /**
     * Handles application state changes and updates UI accordingly.
     */
    handleStateChange(newState, oldState, changeSet) {
        // Handle chart configuration updates
        if (changeSet.chartConfig && newState.chartConfig) {
            this.updateChart(newState.chartConfig);
        }

        // Handle visualization type changes
        if (changeSet.visualizationType) {
            this.updateVisualizationControls(newState);
        }

        // Handle loading state changes
        if (changeSet.isCalculating !== undefined) {
            this.updateLoadingState(newState.isCalculating);
        }

        // Handle errors
        if (changeSet.errors && newState.errors.length > 0) {
            const latestError = newState.errors[newState.errors.length - 1];
            this.displayError(latestError);
        }

        // Update table for tax effect curves
        if (newState.visualizationType === 'Tax Effect Curves' && changeSet.chartConfig) {
            this.updateTaxEffectTable(newState.parameters);
        }
    }

    /**
     * Handles parameter changes from UI controls.
     */
    handleParameterChange(event) {
        const paramName = event.target.id;
        let value = parseFloat(event.target.value);
        
        // Convert integer parameters
        if (paramName === 't1' || paramName === 't2') {
            value = parseInt(event.target.value, 10);
        }
        
        // Update state
        applicationState.setParameter(paramName, value, 'ui_input');
    }

    /**
     * Handles completion of parameter changes (for animations).
     */
    handleParameterChangeComplete(event) {
        // Enable brief animation for final value
        if (this.chart) {
            this.chart.options.animation.duration = 300;
            this.chart.update();
            
            // Revert to no animation for subsequent updates
            setTimeout(() => {
                if (this.chart) {
                    this.chart.options.animation.duration = 0;
                }
            }, 300);
        }
    }

    /**
     * Handles visualization type changes.
     */
    handleVisualizationTypeChange(event) {
        const visualizationType = event.target.value;
        applicationState.setVisualizationType(visualizationType, 'ui_select');
    }

    /**
     * Handles reset to defaults button click.
     */
    handleResetDefaults() {
        try {
            // Add visual feedback
            const resetButton = document.getElementById('resetDefaults');
            if (resetButton) {
                resetButton.textContent = 'Resetting...';
                resetButton.disabled = true;
            }

            // Reset all parameters to defaults
            applicationState.setParameters(DEFAULT_PARAMETERS, 'reset_defaults');
            
            // Reset visualization type to default
            const visualizeSelect = document.getElementById('visualize');
            if (visualizeSelect) {
                visualizeSelect.value = 'Wealth Trajectory';
                applicationState.setVisualizationType('Wealth Trajectory', 'reset_defaults');
            }

            // Update UI displays
            this.updateParameterDisplays();

            // Restore button state after a brief delay
            setTimeout(() => {
                if (resetButton) {
                    resetButton.textContent = 'Reset to Defaults';
                    resetButton.disabled = false;
                }
            }, 500);

            console.log('Parameters reset to defaults');

        } catch (error) {
            const errorInfo = handleError(error, { context: 'reset_defaults' });
            this.displayError(errorInfo);
            
            // Restore button state on error
            const resetButton = document.getElementById('resetDefaults');
            if (resetButton) {
                resetButton.textContent = 'Reset to Defaults';
                resetButton.disabled = false;
            }
        }
    }

    /**
     * Handles preset scenario selection.
     */
    handlePresetScenario(event) {
        const scenarioKey = event.target.value;
        
        if (!scenarioKey || !PRESET_SCENARIOS[scenarioKey]) {
            return; // No scenario selected or invalid scenario
        }

        try {
            const scenario = PRESET_SCENARIOS[scenarioKey];
            
            // Add visual feedback
            const presetSelect = document.getElementById('presetScenarios');
            if (presetSelect) {
                presetSelect.disabled = true;
            }

            // Apply scenario parameters
            applicationState.setParameters(scenario.parameters, `preset_${scenarioKey}`);
            
            // Update UI displays
            this.updateParameterDisplays();

            // Reset dropdown and restore state after a brief delay
            setTimeout(() => {
                if (presetSelect) {
                    presetSelect.value = '';
                    presetSelect.disabled = false;
                }
            }, 1000);

            console.log(`Applied ${scenario.name} scenario:`, scenario.description);

        } catch (error) {
            const errorInfo = handleError(error, { context: 'preset_scenario', scenario: scenarioKey });
            this.displayError(errorInfo);
            
            // Restore dropdown state on error
            const presetSelect = document.getElementById('presetScenarios');
            if (presetSelect) {
                presetSelect.value = '';
                presetSelect.disabled = false;
            }
        }
    }

    /**
     * Updates parameter display values in the UI.
     */
    updateParameterDisplays() {
        const state = applicationState.getState();
        const parameters = state.parameters;
        
        for (const [paramName, value] of Object.entries(parameters)) {
            const displayElement = document.getElementById(`${paramName}-val`);
            if (displayElement) {
                displayElement.textContent = value;
            }
            
            const inputElement = document.getElementById(paramName);
            if (inputElement && inputElement.value != value) {
                inputElement.value = value;
            }
        }
    }

    /**
     * Updates visualization-specific controls.
     */
    updateVisualizationControls(state) {
        const tauInput = document.getElementById('tau');
        if (tauInput) {
            // Disable tau input for Tax Effect Curves since it's varied automatically
            tauInput.disabled = (state.visualizationType === 'Tax Effect Curves');
        }
    }

    /**
     * Shows an immediate loading chart to prevent blank screen.
     */
    showLoadingChart() {
        try {
            const loadingConfig = {
                type: 'line',
                data: {
                    datasets: [{
                        label: 'Loading...',
                        data: [
                            { x: 0, y: 1 },
                            { x: 20, y: 2 },
                            { x: 45, y: 1.5 }
                        ],
                        borderColor: '#cccccc',
                        borderWidth: 2,
                        pointRadius: 0,
                        fill: false
                    }]
                },
                options: {
                    responsive: true,
                    animation: { duration: 0 },
                    scales: {
                        x: {
                            type: 'linear',
                            min: 0,
                            max: 45,
                            title: {
                                display: true,
                                text: 'Years',
                                font: { size: 28 }
                            }
                        },
                        y: {
                            min: 0,
                            title: {
                                display: true,
                                text: 'Wealth',
                                font: { size: 28 }
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: true,
                            labels: { font: { size: 18 } }
                        },
                        title: {
                            display: true,
                            text: 'Calculating optimal wealth trajectory...',
                            font: { size: 24 }
                        }
                    }
                }
            };

            this.chart = new Chart(this.ctx, loadingConfig);
        } catch (error) {
            console.warn('Failed to show loading chart:', error);
        }
    }

    /**
     * Updates the chart with new configuration.
     */
    updateChart(chartConfig) {
        try {
            if (this.chart) {
                // Update existing chart for better performance
                this.chart.data = chartConfig.data;
                this.chart.options = chartConfig.options;
                this.chart.update('none'); // No animation for real-time updates
            } else {
                // Create new chart
                this.chart = new Chart(this.ctx, {
                    ...chartConfig,
                    options: {
                        ...chartConfig.options,
                        animation: { duration: 0, easing: 'linear' }
                    }
                });
            }
        } catch (error) {
            const errorInfo = handleError(error, { context: 'chart_update' });
            this.displayError(errorInfo);
        }
    }

    /**
     * Updates the tax effect table.
     */
    async updateTaxEffectTable(parameters) {
        try {
            const tableContainer = document.getElementById('tableContainer');
            if (tableContainer) {
                const tableHTML = await generateTaxEffectTable(parameters);
                tableContainer.innerHTML = tableHTML;
                tableContainer.style.display = tableHTML.trim() ? 'block' : 'none';
            }
        } catch (error) {
            console.warn('Failed to update tax effect table:', error);
        }
    }

    /**
     * Updates loading state indicators.
     */
    updateLoadingState(isCalculating) {
        // Add visual indicators for calculation state
        const chartContainer = document.getElementById('chartContainer');
        if (chartContainer) {
            if (isCalculating) {
                chartContainer.style.opacity = '0.7';
                chartContainer.style.cursor = 'wait';
            } else {
                chartContainer.style.opacity = '1';
                chartContainer.style.cursor = 'default';
            }
        }
    }

    /**
     * Displays error messages to the user.
     */
    displayError(errorInfo) {
        console.error('UI Error:', errorInfo);
        
        // Simple error display - could be enhanced with better UI
        const errorContainer = document.getElementById('errorContainer');
        if (errorContainer) {
            errorContainer.textContent = errorInfo.userMessage || 'An error occurred';
            errorContainer.style.display = 'block';
            
            // Auto-hide after 5 seconds
            setTimeout(() => {
                errorContainer.style.display = 'none';
            }, 5000);
        }
    }

    /**
     * Cleanup method.
     */
    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
        
        if (this.updateThrottle) {
            clearTimeout(this.updateThrottle);
        }
    }
}

/**
 * Application initialization and startup.
 */
async function startApplication() {
    try {
        console.log('Starting Midlife Wealth Tax application...');
        
        // Initialize the core application
        await initializeApplication();
        
        // Initialize the UI controller
        const uiController = new UIController();
        await uiController.initialize();
        
        // Store UI controller globally for debugging
        window.uiController = uiController;
        window.applicationState = applicationState;
        window.application = getApplication();
        
        // Add performance monitoring
        setupPerformanceMonitoring();
        
        console.log('Application started successfully');
        
    } catch (error) {
        console.error('Failed to start application:', error);
        
        // Display fallback error message
        const errorContainer = document.getElementById('errorContainer') || document.body;
        errorContainer.innerHTML = `
            <div style="color: red; padding: 20px; border: 1px solid red; margin: 20px;">
                <h3>Application Failed to Start</h3>
                <p>Please refresh the page and try again.</p>
                <details>
                    <summary>Technical Details</summary>
                    <pre>${error.message}</pre>
                </details>
            </div>
        `;
    }
}

/**
 * Sets up performance monitoring and debugging tools.
 */
function setupPerformanceMonitoring() {
    // Toggle performance panel with Ctrl+Shift+P
    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.shiftKey && event.key === 'P') {
            const panel = document.getElementById('performancePanel');
            if (panel) {
                panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
                if (panel.style.display === 'block') {
                    updatePerformanceDisplay();
                }
            }
        }
    });

    // Make updatePerformanceDisplay globally available
    window.updatePerformanceDisplay = updatePerformanceDisplay;
}

/**
 * Updates the performance display with current statistics.
 */
function updatePerformanceDisplay() {
    const app = getApplication();
    const statsDiv = document.getElementById('performanceStats');
    
    if (!app || !statsDiv) return;

    try {
        const stats = app.getPerformanceStats();
        
        const html = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div>
                    <h4>Optimization Performance</h4>
                    <div>Worker Jobs: ${stats.workerJobs}</div>
                    <div>Main Thread Jobs: ${stats.mainThreadJobs}</div>
                    <div>Avg Worker Time: ${stats.avgWorkerTime.toFixed(2)}ms</div>
                    <div>Avg Main Thread Time: ${stats.avgMainThreadTime.toFixed(2)}ms</div>
                    <div>Worker Speedup: ${stats.workerSpeedup.toFixed(2)}x</div>
                    <div>Recommend Workers: ${stats.recommendUseWorkers ? 'Yes' : 'No'}</div>
                </div>
                <div>
                    <h4>Cache Statistics</h4>
                    <div>Cache Size: ${stats.cacheStats?.size || 0}/${stats.cacheStats?.maxSize || 0}</div>
                    <div>Cache Hit Rate: ${((stats.cacheStats?.hitRate || 0) * 100).toFixed(1)}%</div>
                    <h4>Worker Pool</h4>
                    <div>Total Workers: ${stats.workerStats?.workers?.total || 0}</div>
                    <div>Busy Workers: ${stats.workerStats?.workers?.busy || 0}</div>
                    <div>Queue Length: ${stats.workerStats?.queue?.length || 0}</div>
                    <div>Success Rate: ${((stats.workerStats?.successRate || 0) * 100).toFixed(1)}%</div>
                </div>
            </div>
            <div style="margin-top: 15px;">
                <h4>Mathematical Cache Performance</h4>
                <div>Last Updated: ${new Date().toLocaleTimeString()}</div>
            </div>
        `;
        
        statsDiv.innerHTML = html;
        
    } catch (error) {
        statsDiv.innerHTML = `<div style="color: red;">Error loading stats: ${error.message}</div>`;
    }
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApplication);
} else {
    startApplication();
}