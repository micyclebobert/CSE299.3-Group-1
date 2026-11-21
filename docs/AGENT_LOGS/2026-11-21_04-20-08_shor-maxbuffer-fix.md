Title: Fix Shor N=15 Qiskit differential maxBuffer transport failure

Summary:
Raised the spawnSync maxBuffer in runQiskit (and runQiskitMarginals) of test/cross-validation/qiskit-vs-simqc.test.js from 1024 * 1024 to 64 * 1024 * 1024. The failing test 'algorithm: Shor N=15, a=7 matches Qiskit' failed with 'qiskit-differential.py exited with code null' because the Python child wrote ~7.27MB of state-vector JSON to stdout, exceeding the 1MB maxBuffer; Node killed the child (SIGTERM) and surfaced status null. Raising maxBuffer to 64MB lets the full Qiskit differential output through. Source and Python code were not changed; fix is test-side only.
