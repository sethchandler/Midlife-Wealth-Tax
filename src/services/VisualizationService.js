/**
 * Visualization service for generating Chart.js configurations.
 * Handles all chart types and data preparation for the wealth tax analysis.
 */

import { 
    createWealthPath1, 
    createWealthPath2, 
    createConsumptionPath1, 
    createConsumptionPath2,
    initialConsumption1,
    initialConsumption2
} from '../math/UtilityFunctions.js';
import { optimizationService } from './OptimizationService.js';
import { VisualizationError } from '../errors/ErrorTypes.js';
import { validateParametersOrThrow } from '../utils/ParameterValidator.js';

/**
 * Service for creating visualization configurations for different chart types.
 */
export class VisualizationService {
    constructor() {
        this.defaultOptions = {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 0, easing: 'linear' },
            aspectRatio: 1.6
        };
        
        this.numPoints = 100; // Number of points for smooth curves
    }

    /**
     * Generates visualization configuration for the specified chart type.
     * 
     * @param {string} visualizationType - Type of visualization
     * @param {Object} parameters - Economic parameters
     * @returns {Object} Chart.js configuration object
     */
    async generateVisualizationConfig(visualizationType, parameters) {
        validateParametersOrThrow(parameters);
        
        try {
            switch (visualizationType) {
                case 'Wealth Trajectory':
                    return await this.createWealthTrajectoryConfig(parameters);
                case 'Consumption Trajectory':
                    return await this.createConsumptionTrajectoryConfig(parameters);
                case 'Tax Effect Curves':
                    return await this.createTaxEffectConfig(parameters);
                default:
                    throw new VisualizationError(`Unknown visualization type: ${visualizationType}`);
            }
        } catch (error) {
            if (error instanceof VisualizationError) {
                throw error;
            }
            throw new VisualizationError(
                `Failed to create ${visualizationType} visualization: ${error.message}`,
                visualizationType,
                parameters
            );
        }
    }

    /**
     * Creates wealth trajectory visualization showing optimal paths.
     */
    async createWealthTrajectoryConfig(parameters) {
        const { r, rho, gamma, t1, t2, beta, eta, tau } = parameters;
        
        // Get optimal wealth pair
        const optimization = await optimizationService.findOptimalWealth(parameters);
        const { w1, w2 } = optimization;
        
        // Generate wealth path data
        const wealthPath1 = createWealthPath1(r, rho, gamma, t1, 1, w1);
        const wealthPath2 = createWealthPath2(r, rho, gamma, t2, w1, tau, w2);
        
        // Pre-tax period data (green line)
        const preTaxData = [];
        for (let i = 0; i <= this.numPoints; i++) {
            const t = (t1 / this.numPoints) * i;
            preTaxData.push({ x: t, y: wealthPath1(t) });
        }
        
        // Post-tax period data (red line)
        const postTaxData = [];
        for (let i = 0; i <= this.numPoints; i++) {
            const s = t1 + (t2 / this.numPoints) * i;
            const wealthValue = wealthPath2(s - t1);
            postTaxData.push({ x: s, y: wealthValue });
        }
        
        return {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: 'Pre-tax Period',
                        data: preTaxData,
                        borderColor: 'green',
                        borderWidth: 4,
                        pointRadius: 0,
                        fill: false
                    },
                    {
                        label: 'Post-tax Period',
                        data: postTaxData,
                        borderColor: 'red',
                        borderWidth: 4,
                        pointRadius: 0,
                        fill: false
                    },
                    // Key points
                    {
                        label: 'Wealth at Tax Time',
                        data: [{ x: t1, y: w1 }],
                        backgroundColor: 'green',
                        pointRadius: 6,
                        showLine: false
                    },
                    {
                        label: 'Wealth After Tax',
                        data: [{ x: t1, y: w1 * (1 - tau) }],
                        backgroundColor: 'red',
                        pointRadius: 6,
                        showLine: false
                    },
                    {
                        label: 'Final Bequest',
                        data: [{ x: t1 + t2, y: w2 }],
                        backgroundColor: 'brown',
                        pointRadius: 6,
                        showLine: false
                    }
                ]
            },
            options: {
                ...this.defaultOptions,
                scales: {
                    x: {
                        type: 'linear',
                        min: 0,
                        max: t1 + t2,
                        title: {
                            display: true,
                            text: 'Years',
                            font: { size: 28 }
                        },
                        ticks: { font: { size: 18 } }
                    },
                    y: {
                        min: 0,
                        max: 3,
                        title: {
                            display: true,
                            text: 'Wealth',
                            font: { size: 28 }
                        },
                        ticks: { font: { size: 18 } }
                    }
                },
                plugins: {
                    legend: { display: false },
                    annotation: {
                        annotations: {
                            taxLine: {
                                type: 'line',
                                xMin: t1,
                                xMax: t1,
                                borderColor: 'black',
                                borderWidth: 1,
                                borderDash: [5, 5]
                            },
                            ...this.createWealthAnnotations(w1, w2, t1, t2, tau)
                        }
                    }
                }
            }
        };
    }

    /**
     * Creates consumption trajectory visualization.
     */
    async createConsumptionTrajectoryConfig(parameters) {
        const { r, rho, gamma, t1, t2, beta, eta, tau } = parameters;
        
        // Get optimal wealth pair
        const optimization = await optimizationService.findOptimalWealth(parameters);
        const { w1, w2 } = optimization;
        
        // Calculate initial consumption levels
        const c01 = initialConsumption1(r, rho, gamma, t1, 1, w1);
        const c02 = initialConsumption2(r, rho, gamma, t2, w1, tau, w2);
        
        // Create consumption path functions
        const consumptionPath1 = createConsumptionPath1(r, rho, gamma, c01);
        const consumptionPath2 = createConsumptionPath2(r, rho, gamma, c02);
        
        // Pre-tax consumption data
        const preTaxConsumption = [];
        for (let i = 0; i <= this.numPoints; i++) {
            const t = (t1 / this.numPoints) * i;
            preTaxConsumption.push({ x: t, y: consumptionPath1(t) });
        }
        
        // Post-tax consumption data
        const postTaxConsumption = [];
        for (let i = 0; i <= this.numPoints; i++) {
            const s = t1 + (t2 / this.numPoints) * i;
            postTaxConsumption.push({ x: s, y: consumptionPath2(s - t1) });
        }
        
        // Calculate max consumption for scaling
        const maxConsumption = Math.max(
            consumptionPath1(0),
            consumptionPath1(t1),
            consumptionPath2(0),
            consumptionPath2(t2),
            0.1
        );
        
        return {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: 'Pre-tax Consumption',
                        data: preTaxConsumption,
                        borderColor: 'green',
                        borderWidth: 4,
                        pointRadius: 0,
                        fill: false
                    },
                    {
                        label: 'Post-tax Consumption',
                        data: postTaxConsumption,
                        borderColor: 'red',
                        borderWidth: 4,
                        pointRadius: 0,
                        fill: false
                    }
                ]
            },
            options: {
                ...this.defaultOptions,
                scales: {
                    x: {
                        type: 'linear',
                        min: 0,
                        max: t1 + t2,
                        title: {
                            display: true,
                            text: 'Years',
                            font: { size: 28 }
                        },
                        ticks: { font: { size: 18 } }
                    },
                    y: {
                        min: 0,
                        max: maxConsumption,
                        title: {
                            display: true,
                            text: 'Consumption',
                            font: { size: 28 }
                        },
                        ticks: { font: { size: 18 } }
                    }
                },
                plugins: {
                    legend: { display: false },
                    annotation: {
                        annotations: {
                            taxLine: {
                                type: 'line',
                                xMin: t1,
                                xMax: t1,
                                borderColor: 'black',
                                borderWidth: 1,
                                borderDash: [5, 5]
                            }
                        }
                    }
                }
            }
        };
    }

    /**
     * Creates tax effect curves showing how wealth responds to different tax rates.
     */
    async createTaxEffectConfig(parameters) {
        const taxRates = [0, 0.1, 0.2, 0.3, 0.4, 0.5];
        
        const beforeTaxData = [];
        const afterTaxData = [];
        const bequestData = [];
        
        // Calculate optimal wealth for each tax rate
        for (const tau of taxRates) {
            const params = { ...parameters, tau };
            const optimization = await optimizationService.findOptimalWealth(params);
            const { w1, w2 } = optimization;
            
            beforeTaxData.push({ x: tau, y: w1 });
            afterTaxData.push({ x: tau, y: w1 * (1 - tau) });
            bequestData.push({ x: tau, y: w2 });
        }
        
        return {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: 'Before Tax Wealth',
                        data: beforeTaxData,
                        borderColor: 'blue',
                        borderWidth: 4,
                        pointRadius: 6,
                        pointStyle: 'circle'
                    },
                    {
                        label: 'After Tax Wealth',
                        data: afterTaxData,
                        borderColor: 'orange',
                        borderWidth: 4,
                        pointRadius: 6,
                        pointStyle: 'circle'
                    },
                    {
                        label: 'Bequest',
                        data: bequestData,
                        borderColor: 'green',
                        borderWidth: 4,
                        pointRadius: 6,
                        pointStyle: 'circle'
                    }
                ]
            },
            options: {
                ...this.defaultOptions,
                scales: {
                    x: {
                        type: 'linear',
                        min: 0,
                        max: 0.5,
                        title: {
                            display: true,
                            text: 'Tax Rate',
                            font: { size: 28 }
                        },
                        ticks: { font: { size: 18 } }
                    },
                    y: {
                        min: 0,
                        title: {
                            display: true,
                            text: 'Wealth',
                            font: { size: 28 }
                        },
                        ticks: { font: { size: 18 } }
                    }
                },
                plugins: {
                    legend: { 
                        display: true,
                        position: 'top'
                    }
                }
            }
        };
    }

    /**
     * Creates wealth annotations for key points on the chart.
     */
    createWealthAnnotations(w1, w2, t1, t2, tau) {
        return {
            w1Label: {
                type: 'label',
                xValue: t1,
                yValue: w1,
                content: [w1.toFixed(2)],
                position: 'center',
                xAdjust: -15,
                yAdjust: -15,
                font: { size: 16 },
                color: 'black',
                backgroundColor: 'rgba(255,255,255,0.8)',
                borderColor: 'rgba(128,128,128,0.5)',
                borderWidth: 1
            },
            w1AfterTaxLabel: {
                type: 'label',
                xValue: t1,
                yValue: w1 * (1 - tau),
                content: [(w1 * (1 - tau)).toFixed(2)],
                position: 'center',
                xAdjust: 15,
                yAdjust: -15,
                font: { size: 16 },
                color: 'black',
                backgroundColor: 'rgba(255,255,255,0.8)',
                borderColor: 'rgba(128,128,128,0.5)',
                borderWidth: 1
            },
            w2Label: {
                type: 'label',
                xValue: t1 + t2,
                yValue: Math.min(3, w2),
                content: [w2.toFixed(2)],
                position: 'center',
                xAdjust: -25,
                yAdjust: 15,
                font: { size: 16 },
                color: 'black',
                backgroundColor: 'rgba(255,255,255,0.8)',
                borderColor: 'rgba(128,128,128,0.5)',
                borderWidth: 1
            }
        };
    }

    /**
     * Generates tax effect table data for display alongside the tax effect curves.
     */
    async generateTaxEffectTable(parameters) {
        const { t1, t2 } = parameters;
        const taxRates = [0, 0.1, 0.2, 0.3, 0.4, 0.5];
        
        const beforeTaxData = [];
        const afterTaxData = [];
        const bequestData = [];
        
        for (const tau of taxRates) {
            const params = { ...parameters, tau };
            const optimization = await optimizationService.findOptimalWealth(params);
            const { w1, w2 } = optimization;
            
            beforeTaxData.push({ x: tau, y: w1 });
            afterTaxData.push({ x: tau, y: w1 * (1 - tau) });
            bequestData.push({ x: tau, y: w2 });
        }
        
        // Calculate mean slopes (effects)
        const effectBefore = (this.calculateMeanSlope(beforeTaxData) / 10).toFixed(3);
        const effectAfter = (this.calculateMeanSlope(afterTaxData) / 10).toFixed(3);
        const effectBequest = (this.calculateMeanSlope(bequestData) / 10).toFixed(3);
        
        return `
            <table>
                <tr><td>~effect of 10% tax Δ on before tax wealth at ${t1}</td><td>${effectBefore}</td></tr>
                <tr><td>~effect of 10% tax Δ on after tax wealth at ${t1}</td><td>${effectAfter}</td></tr>
                <tr><td>~effect of 10% tax Δ on bequest at ${t1 + t2}</td><td>${effectBequest}</td></tr>
            </table>
        `;
    }

    /**
     * Calculates mean slope from data points.
     */
    calculateMeanSlope(data) {
        if (data.length < 2) return 0;
        
        let sum = 0;
        for (let i = 1; i < data.length; i++) {
            const deltaY = data[i].y - data[i-1].y;
            const deltaX = data[i].x - data[i-1].x;
            sum += deltaY / deltaX;
        }
        
        return sum / (data.length - 1);
    }
}

/**
 * Singleton instance for global use
 */
export const visualizationService = new VisualizationService();

/**
 * Convenience function for generating visualization configs
 */
export async function generateVisualizationConfig(visualizationType, parameters) {
    return await visualizationService.generateVisualizationConfig(visualizationType, parameters);
}

/**
 * Convenience function for generating tax effect table
 */
export async function generateTaxEffectTable(parameters) {
    return await visualizationService.generateTaxEffectTable(parameters);
}