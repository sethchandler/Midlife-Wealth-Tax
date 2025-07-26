// ui.js
let chart;
const ctx = document
  .getElementById('myChart')
  .getContext('2d');

function updateValues() {
  document.getElementById('r-val').textContent   = document.getElementById('r').value;
  document.getElementById('rho-val').textContent = document.getElementById('rho').value;
  document.getElementById('gamma-val').textContent = document.getElementById('gamma').value;
  document.getElementById('eta-val').textContent   = document.getElementById('eta').value;
  document.getElementById('beta-val').textContent  = document.getElementById('beta').value;
  document.getElementById('tau-val').textContent   = document.getElementById('tau').value;
  document.getElementById('t1-val').textContent    = document.getElementById('t1').value;
  document.getElementById('t2-val').textContent    = document.getElementById('t2').value;
}

function getParams() {
  return {
    r:       parseFloat(document.getElementById('r').value),
    rho:     parseFloat(document.getElementById('rho').value),
    gamma:   parseFloat(document.getElementById('gamma').value),
    eta:     parseFloat(document.getElementById('eta').value),
    beta:    parseFloat(document.getElementById('beta').value),
    tau:     parseFloat(document.getElementById('tau').value),
    t1:      parseInt(document.getElementById('t1').value, 10),
    t2:      parseInt(document.getElementById('t2').value, 10),
    visualize: document.getElementById('visualize').value
  };
}

// Build the chart once, with animations off
function initializeChart() {
  updateValues();
  const params = getParams();
  const initialConfig = getVisualizationConfig(params);

  // disable entry animations for instant redraws
  initialConfig.options.animation = {
    duration: 0,
    easing:   'linear'
  };

  chart = new Chart(ctx, initialConfig);

  // populate table if needed
  if (params.visualize === 'Tax Effect Curves') {
    document.getElementById('tableContainer').innerHTML = getTaxTable(params);
  }
}

// On each update, swap in new data & options—never destroy/recreate
function updateChart() {
  const params = getParams();
  document.getElementById('tau').disabled = (params.visualize === 'Tax Effect Curves');

  const newConfig = getVisualizationConfig(params);

  // replace datasets
  chart.data.datasets = newConfig.data.datasets;

  // replace scales
  chart.options.scales = newConfig.options.scales;

  // replace plugin settings
  chart.options.plugins.legend     = newConfig.options.plugins.legend;
  chart.options.plugins.annotation = newConfig.options.plugins.annotation;

  // update aspect ratio & responsiveness if they differ
  chart.options.aspectRatio = newConfig.options.aspectRatio;
  chart.options.responsive  = newConfig.options.responsive;

  // redraw with no animation
  chart.update('none');

  // update table if on Tax Effect Curves
  if (params.visualize === 'Tax Effect Curves') {
    document.getElementById('tableContainer').innerHTML = getTaxTable(params);
  } else {
    document.getElementById('tableContainer').innerHTML = '';
  }
}

// Wire up sliders & selects, throttled via requestAnimationFrame
const inputs = document.querySelectorAll('input[type="range"], select');
let scheduled = false;

inputs.forEach(input => {
  input.addEventListener('input', () => {
    updateValues();
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(() => {
        updateChart();
        scheduled = false;
      });
    }
  });

  // Optional: brief easing on final release
  input.addEventListener('change', () => {
    chart.options.animation.duration = 300;
    updateChart();
    // revert to no-animation for subsequent drags
    setTimeout(() => {
      chart.options.animation.duration = 0;
    }, 0);
  });
});

// Start up
initializeChart();








/* OLD VERSION BEFORE ChatGPt
// ui.js
let chart;
const ctx = document.getElementById('myChart').getContext('2d');

// Removed Chart.register(annotationPlugin) - handled in HTML now

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
*/
