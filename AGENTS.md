# AGENTS.md

This project follows the Kilo framework. See `.kilo/` for agent configuration.

## Conventions

- All code follows the layer cake structure in `support/`
- LAYER 1: pure math (complex, state, kernels)
- LAYER 2: gates (definitions, registry)
- LAYER 3: circuit data model
- LAYER 4: executor
- LAYER 5: measurement, algorithms, debug, analysis
- LAYER 6: AI, UI, storage
- No external runtime dependencies; tests run via node/test runner