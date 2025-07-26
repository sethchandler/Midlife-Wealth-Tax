# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a sophisticated economic visualization tool that models optimal wealth trajectories under taxation scenarios. The application uses complex mathematical optimization to solve lifetime utility maximization problems for individuals facing potential wealth taxes at midlife. Built with vanilla JavaScript, Chart.js, and the numeric.js optimization library.

## Development Commands

This project requires no build step and can be run by simply opening `index.html` in a browser or hosting it on a static file server.

**Running the application:**
- Open `index.html` directly in a web browser
- Or serve via a local HTTP server (e.g., `python -m http.server` or similar)

**No build, lint, or test commands** - this is a pure static web application.

## Architecture Overview

The application follows a modern modular ES6 architecture with clean separation of concerns and professional-grade error handling:

### Enhanced Architecture Pattern
- **Domain Services**: Business logic encapsulated in service layer for separation of concerns
- **Error Handling**: Comprehensive error types with user-friendly messaging and automatic sanitization
- **State Management**: Centralized immutable state with event-driven updates
- **Optimization Engine**: Advanced caching, warm starting, and retry mechanisms
- **Validation System**: Robust parameter validation with economic model constraints

### Mathematical Foundation
- **Utility Maximization**: Solves complex lifetime utility optimization problems
- **Economic Modeling**: Implements sophisticated economic models with consumption, wealth, and bequest utilities
- **Numerical Optimization**: Uses the numeric.js library with grid search + refinement approach
- **Performance Optimization**: Intelligent caching, memoization, and warm starting strategies

### Modular File Structure

| File/Directory | Purpose |
|------|---------|
| `index.html` | Complete UI structure with ES6 module loading |
| `main-new.js` | Main application entry point with UI controller |
| `src/app/Application.js` | Core application orchestration and lifecycle management |
| `src/state/ApplicationState.js` | Immutable state management with event system |
| `src/services/OptimizationService.js` | Advanced optimization with caching and warm starting |
| `src/services/VisualizationService.js` | Chart.js configuration and data preparation |
| `src/math/UtilityFunctions.js` | Pure mathematical functions and economic calculations |
| `src/errors/ErrorTypes.js` | Custom error hierarchy for different failure scenarios |
| `src/errors/ErrorHandler.js` | Centralized error processing and user messaging |
| `src/utils/ParameterValidator.js` | Comprehensive parameter validation with economic constraints |
| `style.css` | Visual styling and responsive layout |

### Key Components

**Application Controller** (`src/app/Application.js`):
- Orchestrates all services and manages application lifecycle
- Handles state changes and triggers appropriate calculations
- Provides performance tracking and error recovery
- Manages throttled parameter changes and optimization workflows

**Mathematical Engine** (`src/math/UtilityFunctions.js`):
- `lifetimeUtility()` - Lifetime utility function with comprehensive error handling
- `U2()` - Period utility calculation with mathematical edge case protection
- `kappa()` - Economic parameter calculation with validation
- Path functions (`createWealthPath1/2`, `createConsumptionPath1/2`) - Trajectory generators
- `checkConstraints()` - Economic constraint validation

**Optimization Service** (`src/services/OptimizationService.js`):
- Advanced caching with LRU eviction and TTL
- Intelligent warm starting for performance
- Hybrid grid search + numerical refinement approach
- Comprehensive error recovery and fallback strategies

**Visualization Service** (`src/services/VisualizationService.js`):
- Chart.js configuration builders for all visualization types
- Data preparation and annotation generation
- Tax effect table calculation and formatting
- Error handling for visualization failures

**State Management** (`src/state/ApplicationState.js`):
- Immutable state updates with change tracking
- Event-driven architecture with listener subscriptions
- Parameter validation integration
- Error state management and history tracking

**Error Handling System** (`src/errors/`):
- Custom error hierarchy for different failure scenarios
- User-friendly error messages with technical details
- Automatic error sanitization and logging
- Recoverable vs non-recoverable error classification

**Economic Parameters**:
- Interest rate (r), Impatience rate (ρ), Risk aversion parameters (γ, η)
- Bequest importance (β), Tax rate (τ), Time horizons (t1, t2)
- Three visualization modes: Wealth Trajectory, Consumption Trajectory, Tax Effect Curves

### Performance Characteristics
- **Computationally Intensive**: Uses nested optimization loops for complex economic models
- **Warm Starting**: Caches previous optimization results to speed subsequent calculations
- **Grid Search + Refinement**: Combines coarse grid search with fine numeric optimization
- **Real-time Updates**: Throttled parameter changes for smooth user experience

## Important Implementation Notes

- **Mathematical Precision**: Handles edge cases like infinite utilities, complex numbers, and constraint violations
- **Numerical Stability**: Includes extensive bounds checking and fallback strategies
- **Chart.js Integration**: Uses advanced features like annotations and custom styling
- **No External Dependencies**: Pure client-side with CDN-loaded libraries only
- **Educational Purpose**: Designed for economic education and policy analysis

## Common Development Patterns

**Adding New Economic Parameters:**
1. Add parameter to `DEFAULT_PARAMETERS` and validation rules in `src/utils/ParameterValidator.js`
2. Add slider/input to `index.html` controls section with appropriate ranges
3. Update mathematical functions in `src/math/UtilityFunctions.js` to use new parameter
4. Update constraint checking if parameter affects economic feasibility
5. Test parameter validation and optimization behavior with new parameter

**Adding New Visualization Types:**
1. Add option to `<select id="visualize">` in `index.html`
2. Add new case to `generateVisualizationConfig()` method in `src/services/VisualizationService.js`
3. Implement data generation logic using mathematical functions
4. Configure Chart.js options (scales, colors, annotations) for new chart type
5. Add error handling for new visualization type

**Adding New Mathematical Functions:**
1. Add pure functions to `src/math/UtilityFunctions.js` with proper error handling
2. Include comprehensive input validation and edge case protection
3. Write JSDoc documentation with parameter descriptions and return types
4. Update relevant services to use new mathematical functions
5. Test with extreme parameter values for numerical stability

**Extending Error Handling:**
1. Add new error types to `src/errors/ErrorTypes.js` if needed
2. Update `src/errors/ErrorHandler.js` with specific handling logic
3. Add user-friendly error messages to `UserFriendlyMessages` mapping
4. Test error scenarios and ensure graceful degradation

**Performance Optimization:**
- Optimization is CPU-intensive - consider web workers for heavy calculations
- Grid search resolution can be adjusted based on parameter sensitivity
- Warm starting cache should be cleared when constraint structure changes
- Chart updates use `chart.update('none')` to avoid animations during parameter sweeps

## Mathematical Background

This application implements a two-period lifecycle model where individuals:
1. **Period 1 (Pre-tax)**: Accumulate wealth and consume optimally for t1 years
2. **Tax Event**: Face a wealth tax τ at time t1 that reduces wealth by τ percentage
3. **Period 2 (Post-tax)**: Continue consuming and leave bequest for t2 additional years

The optimization solves for optimal wealth targets (w1, w2) that maximize:
```
U = U1 + e^(-ρt1) * U2 + β * B(w2)
```

Where:
- U1, U2 are consumption utilities for periods 1 and 2
- B(w2) is bequest utility
- ρ is the time preference (impatience) rate
- β weights the importance of leaving bequests

## Development Workflow

**Testing Mathematical Changes:**
1. Make changes to utility functions or optimization logic
2. Test with extreme parameter values to check for numerical issues
3. Verify continuity and smoothness of resulting trajectories
4. Check optimization convergence for various parameter combinations

**UI/Visualization Changes:**
1. Test responsiveness across different screen sizes
2. Verify chart updates properly without memory leaks
3. Ensure parameter ranges produce meaningful visualizations
4. Test performance with rapid parameter changes

## Common Issues and Solutions

**Optimization Failures:**
- Increase grid search resolution for better initial guesses
- Adjust constraint bounds if feasible region is too restrictive
- Check for mathematical issues like negative utilities or complex numbers

**Chart Rendering Problems:**
- Verify Chart.js annotation plugin is loaded properly
- Check data array structure matches expected format
- Ensure scales and options are configured for chart type

**Performance Issues:**
- Reduce grid search resolution for real-time parameter updates
- Implement more aggressive caching for expensive calculations
- Consider debouncing rapid parameter changes