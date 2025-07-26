// main.js - Corrected version matching Wolfram constraints exactly

// Cache for last good optimization result (warm starting)
let lastOptimalResult = null;

function kappa(r, rho, gamma) {
    return (r * (gamma - 1) + rho) / gamma;
}

function U2(r, rho, gamma, T, A, B) {
    const expRT = Math.exp(r * T);
    const term1 = expRT * A - B;
    if (term1 <= 0) return -Infinity;
    
    const kappaVal = kappa(r, rho, gamma);
    const expNegKappaT = Math.exp(-kappaVal * T);
    const expRminusRhoToverGamma = Math.exp((r - rho) * T / gamma);
    const term2 = expRT - expRminusRhoToverGamma;
    if (term2 <= 0) return -Infinity;
    
    // Handle potential complex number issues from fractional powers
    if (gamma !== 1) {
        if (term1 < 0 && (1 - gamma) % 1 !== 0) return -Infinity;
        if (term2 < 0 && (1 - gamma) % 1 !== 0) return -Infinity;
    }
    
    const num = Math.pow(term1, 1 - gamma) * (1 - expNegKappaT) * Math.pow(kappaVal, -gamma);
    const den = (1 - gamma) * Math.pow(term2, 1 - gamma);
    
    const result = num / den;
    
    if (!isFinite(result) || isNaN(result)) return -Infinity;
    
    return result;
}

function lifetimeU(r, rho, gamma, t1, t2, beta, eta, tau, w0, w1, w2) {
    const u1 = U2(r, rho, gamma, t1, w0, w1);
    if (!isFinite(u1) || u1 === -Infinity) return -5000;
    
    const u2 = U2(r, rho, gamma, t2, w1 * (1 - tau), w2);
    if (!isFinite(u2) || u2 === -Infinity) return -5000;
    
    // Handle bequest term carefully
    let beq;
    if (eta === 1) {
        beq = beta * Math.log(Math.max(w2, 1e-10));
    } else {
        if (w2 <= 0 && (1 - eta) % 1 !== 0) return -5000;
        beq = beta * Math.pow(Math.max(w2, 1e-10), 1 - eta) / (1 - eta);
    }
    
    if (!isFinite(beq) || isNaN(beq)) return -5000;
    
    const result = u1 + Math.exp(-rho * t1) * u2 + beq;
    
    // Critical protection against complex numbers
    if (!isFinite(result) || isNaN(result)) return -5000;
    
    return result;
}

function optimalWealthPair(r, rho, gamma, t1, t2, beta, eta, tau, w0 = 1) {
    const maxW1 = Math.exp(r * t1);
    
    // Use warm starting - begin search near last good result if available
    let searchCenterW1, searchCenterW2;
    
    if (lastOptimalResult && lastOptimalResult.length === 2) {
        // Start search around previous result
        searchCenterW1 = lastOptimalResult[0];
        searchCenterW2 = lastOptimalResult[1];
        
        // Verify previous result is still feasible with new parameters
        if (searchCenterW1 > 0 && searchCenterW2 > 0 && 
            searchCenterW1 < maxW1 && 
            searchCenterW2 < searchCenterW1 * (1 - tau) * Math.exp(r * t2)) {
            // Previous result is feasible, use it as center
        } else {
            // Previous result no longer feasible, use default center
            searchCenterW1 = maxW1 * 0.6;
            searchCenterW2 = maxW1 * 0.5;
        }
    } else {
        // No previous result, use default center
        searchCenterW1 = maxW1 * 0.6;
        searchCenterW2 = maxW1 * 0.5;
    }
    
    // Define search region around the center (smaller for warm starts)
    const searchRadius = lastOptimalResult ? 0.1 : 0.4; // Smaller radius if warm starting
    const w1_min = Math.max(0.01, searchCenterW1 * (1 - searchRadius));
    const w1_max = Math.min(maxW1 - 0.01, searchCenterW1 * (1 + searchRadius));
    const w2_min = Math.max(0.01, searchCenterW2 * (1 - searchRadius));
    const w2_max = Math.min(searchCenterW2 * (1 + searchRadius * 2), maxW1 * 3); // Allow w2 to vary more
    
    let bestW1 = searchCenterW1, bestW2 = searchCenterW2, bestU = -Infinity;
    
    // Fine grid search in the region around last result
    const gridSteps = lastOptimalResult ? 50 : 100; // Fewer steps if warm starting
    
    for (let i = 0; i <= gridSteps; i++) {
        const w1 = w1_min + (w1_max - w1_min) * i / gridSteps;
        
        // Check w1 constraint
        if (w1 >= maxW1) continue;
        
        for (let j = 0; j <= gridSteps; j++) {
            const w2 = w2_min + (w2_max - w2_min) * j / gridSteps;
            
            // Check all constraints
            if (w1 > 0 && w2 > 0 && w1 < maxW1 && w2 < w1 * (1 - tau) * Math.exp(r * t2)) {
                const u = lifetimeU(r, rho, gamma, t1, t2, beta, eta, tau, w0, w1, w2);
                
                if (isFinite(u) && u > bestU) {
                    bestU = u;
                    bestW1 = w1;
                    bestW2 = w2;
                }
            }
        }
    }
    
    if (bestU === -Infinity) {
        console.warn('Grid search failed, using previous result or fallback');
        if (lastOptimalResult) {
            return lastOptimalResult; // Return previous result if current search fails
        }
        return [maxW1 * 0.5, maxW1 * 0.4];
    }
    
    // Final refinement with numeric optimization, starting from grid result
    const objectiveFunction = (vars) => {
        const w1 = vars[0];
        const w2 = vars[1];
        
        if (w1 <= 0 || w2 <= 0 || w1 >= maxW1 || w2 >= w1 * (1 - tau) * Math.exp(r * t2)) {
            return 1e10;
        }
        
        const u = lifetimeU(r, rho, gamma, t1, t2, beta, eta, tau, w0, w1, w2);
        
        if (!isFinite(u) || u === -5000) {
            return 1e10;
        }
        
        return -u;
    };
    
    try {
        const result = numeric.uncmin(objectiveFunction, [bestW1, bestW2], 1e-12, null, 1000);
        
        if (result && isFinite(result.f)) {
            const [finalW1, finalW2] = result.solution;
            
            if (finalW1 > 0 && finalW2 > 0 && finalW1 < maxW1 && finalW2 < finalW1 * (1 - tau) * Math.exp(r * t2)) {
                // Cache this result for next time
                lastOptimalResult = [finalW1, finalW2];
                return [finalW1, finalW2];
            }
        }
    } catch (error) {
        console.warn('Refinement optimization failed:', error);
    }
    
    // Cache grid result if refinement fails but grid succeeded
    lastOptimalResult = [bestW1, bestW2];
    return [bestW1, bestW2];
}

function c01(r, rho, gamma, t1, w0, w1) {
    const k = kappa(r, rho, gamma);
    const num = k * (Math.exp(r * t1) * w0 - w1);
    const den = Math.exp(r * t1) - Math.exp((r - rho) * t1 / gamma);
    return num / den;
}

function c02(r, rho, gamma, t2, w1, tau, w2) {
    const k = kappa(r, rho, gamma);
    const num = k * (Math.exp(r * t2) * w1 * (1 - tau) - w2);
    const den = Math.exp(r * t2) - Math.exp((r - rho) * t2 / gamma);
    return num / den;
}

function wPath1(r, rho, gamma, t1, w0, w1) {
    return function(t) {
        const expRt = Math.exp(r * t);
        const k = kappa(r, rho, gamma);
        const c = c01(r, rho, gamma, t1, w0, w1);
        return expRt * w0 - c * expRt * (1 - Math.exp(-k * t)) / k;
    };
}

function wPath2(r, rho, gamma, t2, w1, tau, w2) {
    return function(s) {
        const expRs = Math.exp(r * s);
        const k = kappa(r, rho, gamma);
        const c = c02(r, rho, gamma, t2, w1, tau, w2);
        return expRs * w1 * (1 - tau) - c * expRs * (1 - Math.exp(-k * s)) / k;
    };
}

function cPath1(r, rho, gamma, c01v) {
    return function(t) {
        return c01v * Math.exp((r - rho) * t / gamma);
    };
}

function cPath2(r, rho, gamma, c02v) {
    return function(s) {
        return c02v * Math.exp((r - rho) * s / gamma);
    };
}

function meanSlope(v) {
    let sum = 0;
    for (let i = 1; i < v.length; i++) {
        sum += (v[i].y - v[i-1].y) / (v[i].x - v[i-1].x);
    }
    return sum / (v.length - 1);
}

function getVisualizationConfig(params) {
    const { r, rho, gamma, t1, t2, beta, eta, tau, visualize } = params;
    let config = {
        type: 'line',
        data: {
            datasets: []
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    type: 'linear',
                    min: 0,
                    title: {
                        display: true,
                        text: 'years',
                        font: { size: 28 }
                    },
                    ticks: {
                        font: { size: 18 }
                    }
                },
                y: {
                    min: 0,
                    title: {
                        display: true,
                        text: 'wealth',
                        font: { size: 28 }
                    },
                    ticks: {
                        font: { size: 18 }
                    }
                }
            },
            plugins: {
                legend: { display: false },
                annotation: {
                    annotations: {}
                }
            },
            aspectRatio: 2
        }
    };

    const numPoints = 100;

    switch (visualize) {
        case 'Wealth Trajectory':
            const pairW = optimalWealthPair(r, rho, gamma, t1, t2, beta, eta, tau);
            const w1 = pairW[0];
            const w2 = pairW[1];
            
            console.log('Optimal wealth pair:', {w1, w2}); // Debug output
            
            const dataGreen = [];
            for (let i = 0; i <= numPoints; i++) {
                const t = (t1 / numPoints) * i;
                dataGreen.push({ x: t, y: wPath1(r, rho, gamma, t1, 1, w1)(t) });
            }
            const dataRed = [];
            for (let i = 0; i <= numPoints; i++) {
                const s = t1 + (t2 / numPoints) * i;
                dataRed.push({ x: s, y: wPath2(r, rho, gamma, t2, w1, tau, w2)(s - t1) });
            }
            
            // Verify continuity at t=t1 when tau=0
            const greenEnd = wPath1(r, rho, gamma, t1, 1, w1)(t1);
            const redStart = wPath2(r, rho, gamma, t2, w1, tau, w2)(0);
            console.log('Continuity check at t1:', {greenEnd, redStart, expectedRedStart: w1 * (1 - tau)});
            
            config.data.datasets.push({
                data: dataGreen,
                borderColor: 'green',
                borderWidth: 4,
                pointRadius: 0
            });
            config.data.datasets.push({
                data: dataRed,
                borderColor: 'red',
                borderWidth: 4,
                pointRadius: 0
            });
            // Points
            config.data.datasets.push({
                data: [{ x: t1, y: w1 }],
                backgroundColor: 'green',
                pointRadius: 5,
                showLine: false
            });
            config.data.datasets.push({
                data: [{ x: t1, y: w1 * (1 - tau) }],
                backgroundColor: 'red',
                pointRadius: 5,
                showLine: false
            });
            config.data.datasets.push({
                data: [{ x: t1 + t2, y: w2 }],
                backgroundColor: 'brown',
                pointRadius: 5,
                showLine: false
            });
            // Annotations
            config.options.plugins.annotation.annotations.line1 = {
                type: 'line',
                xMin: t1,
                xMax: t1,
                borderColor: 'black',
                borderWidth: 1,
                borderDash: [5, 5]
            };
            config.options.plugins.annotation.annotations.label1 = {
                type: 'label',
                xValue: t1,
                yValue: w1,
                content: [w1.toFixed(2)],
                position: 'center',
                xAdjust: -15,  // Move right
                yAdjust: -15,  // Move down (below the curve)
                font: { size: 16 },
                color: 'black',
                backgroundColor: 'rgba(255,255,255,0.3)',
                borderColor: 'rgba(128,128,128,0.3)',
                borderWidth: 1
            };
            config.options.plugins.annotation.annotations.label2 = {
                type: 'label',
                xValue: t1,
                yValue: w1 * (1 - tau),
                content: [(w1 * (1 - tau)).toFixed(2)],
                position: 'center',
                xAdjust: -15, // Move left 
                yAdjust: -15, // Move up (above the curve)
                font: { size: 16 },
                color: 'black',
                backgroundColor: 'rgba(255,255,255,0.3)',
                borderColor: 'rgba(128,128,128,0.3)',
                borderWidth: 1
            };
            config.options.plugins.annotation.annotations.label3 = {
                type: 'label',
                xValue: t1 + t2,
                yValue: Math.min(3, w2),
                content: [w2.toFixed(2)],
                position: 'center',
                xAdjust: -25, // Move well to the left so it's visible
                yAdjust: 15,   // Keep at same height
                font: { size: 16 },
                color: 'black',
                backgroundColor: 'rgba(255,255,255,0.3)',
                borderColor: 'rgba(128,128,128,0.3)',
                borderWidth: 1
            };
            config.options.scales.x.max = t1 + t2;
            config.options.scales.y.max = 3;
            break;

        case 'Consumption Trajectory':
            const pairC = optimalWealthPair(r, rho, gamma, t1, t2, beta, eta, tau);
            const c01v = c01(r, rho, gamma, t1, 1, pairC[0]);
            const c02v = c02(r, rho, gamma, t2, pairC[0], tau, pairC[1]);
            const cGreen0 = cPath1(r, rho, gamma, c01v)(0);
            const cGreenT1 = cPath1(r, rho, gamma, c01v)(t1);
            const cRed0 = cPath2(r, rho, gamma, c02v)(0);
            const cRedT2 = cPath2(r, rho, gamma, c02v)(t2);
            const cmax = Math.max(cGreen0, cGreenT1, cRed0, cRedT2, 0.1);
            const dataGreenC = [];
            for (let i = 0; i <= numPoints; i++) {
                const t = (t1 / numPoints) * i;
                dataGreenC.push({ x: t, y: cPath1(r, rho, gamma, c01v)(t) });
            }
            const dataRedC = [];
            for (let i = 0; i <= numPoints; i++) {
                const s = t1 + (t2 / numPoints) * i;
                dataRedC.push({ x: s, y: cPath2(r, rho, gamma, c02v)(s - t1) });
            }
            config.data.datasets.push({
                data: dataGreenC,
                borderColor: 'green',
                borderWidth: 4,
                pointRadius: 0
            });
            config.data.datasets.push({
                data: dataRedC,
                borderColor: 'red',
                borderWidth: 4,
                pointRadius: 0
            });
            config.options.plugins.annotation.annotations.line1 = {
                type: 'line',
                xMin: t1,
                xMax: t1,
                borderColor: 'black',
                borderWidth: 1,
                borderDash: [5, 5]
            };
            config.options.scales.x.max = t1 + t2;
            config.options.scales.y.max = cmax;
            config.options.scales.y.title.text = 'consumption';
            config.options.scales.y.title.font = { size: 28 };
            break;

        case 'Tax Effect Curves':
            const taus = [0, 0.1, 0.2, 0.3, 0.4, 0.5];
            let beforeData = [];
            let afterData = [];
            let bequestData = [];
            for (let tau_i of taus) {
                const pair = optimalWealthPair(r, rho, gamma, t1, t2, beta, eta, tau_i);
                beforeData.push({ x: tau_i, y: pair[0] });
                afterData.push({ x: tau_i, y: pair[0] * (1 - tau_i) });
                bequestData.push({ x: tau_i, y: pair[1] });
            }
            config.data.datasets.push({
                label: 'Before Tax Wealth',
                data: beforeData,
                borderColor: 'blue',
                borderWidth: 4,
                pointRadius: 6,
                pointStyle: 'circle'
            });
            config.data.datasets.push({
                label: 'After Tax Wealth',
                data: afterData,
                borderColor: 'orange',
                borderWidth: 4,
                pointRadius: 6,
                pointStyle: 'circle'
            });
            config.data.datasets.push({
                label: 'Bequest',
                data: bequestData,
                borderColor: 'green',
                borderWidth: 4,
                pointRadius: 6,
                pointStyle: 'circle'
            });
            config.options.scales.x.max = 0.5;
            config.options.scales.x.title.text = 'tax rate';
            config.options.scales.x.title.font = { size: 28 };
            config.options.scales.y.title.text = 'wealth';
            config.options.scales.y.title.font = { size: 28 };
            config.options.scales.y.max = undefined; // auto
            config.options.plugins.legend.display = true;
            break;
    }
    return config;
}

function getTaxTable(params) {
    const { r, rho, gamma, t1, t2, beta, eta } = params;
    const taus = [0, 0.1, 0.2, 0.3, 0.4, 0.5];
    let beforeData = [];
    let afterData = [];
    let bequestData = [];
    for (let tau_i of taus) {
        const pair = optimalWealthPair(r, rho, gamma, t1, t2, beta, eta, tau_i);
        beforeData.push({ x: tau_i, y: pair[0] });
        afterData.push({ x: tau_i, y: pair[0] * (1 - tau_i) });
        bequestData.push({ x: tau_i, y: pair[1] });
    }
    const effectBefore = (meanSlope(beforeData) / 10).toFixed(3);
    const effectAfter = (meanSlope(afterData) / 10).toFixed(3);
    const effectBequest = (meanSlope(bequestData) / 10).toFixed(3);
    return `
        <table>
            <tr><td>~effect of 10% tax Δ on before tax wealth at ${t1}</td><td>${effectBefore}</td></tr>
            <tr><td>~effect of 10% tax Δ on after tax wealth at ${t1}</td><td>${effectAfter}</td></tr>
            <tr><td>~effect of 10% tax Δ on bequest at ${t1 + t2}</td><td>${effectBequest}</td></tr>
        </table>
    `;
}
