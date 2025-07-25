// ui.js

let chart;
const ctx = document.getElementById('myChart').getContext('2d');
Chart.register(ChartAnnotation)

function updateValues() {
    document.getElementById('r-val').textContent = document.getElementById('r').value;
    document.getElementById('rho-val').textContent = document.getElementById('rho').value;
    document.getElementById('gamma-val').textContent = document.getElementById('gamma').value;
    document.getElementById('eta-val').textContent = document.getElementById('eta').value;
    document.getElementById('beta-val').textContent = document.getElementById('beta').value;
    document.getElementById('tau-val').textContent = document.getElementById('tau').value;
    document.getElementById('t1-val').textContent = document.getElementById('t1').value;
    document.getElementById('t2-val').textContent = document.getElementById('t2').value;
}

function getParams() {
    return {
        r: parseFloat(document.getElementById('r').value),
        rho: parseFloat(document.getElementById('rho').value),
        gamma: parseFloat(document.getElementById('gamma').value),
        eta: parseFloat(document.getElementById('eta').value),
        beta: parseFloat(document.getElementById('beta').value),
        tau: parseFloat(document.getElementById('tau').value),
        t1: parseInt(document.getElementById('t1').value),
        t2: parseInt(document.getElementById('t2').value),
        visualize: document.getElementById('visualize').value
    };
}

function updateChart() {
    const params = getParams();
    document.getElementById('tau').disabled = (params.visualize === 'Tax Effect Curves');
    const config = getVisualizationConfig(params);
    if (chart) {
        chart.destroy();
    }
    chart = new Chart(ctx, config);
    if (params.visualize === 'Tax Effect Curves') {
        document.getElementById('tableContainer').innerHTML = getTaxTable(params);
    } else {
        document.getElementById('tableContainer').innerHTML = '';
    }
}

const inputs = document.querySelectorAll('input[type="range"], select');
inputs.forEach(input => {
    input.addEventListener('input', () => {
        updateValues();
        updateChart();
    });
});

updateValues();
updateChart();
