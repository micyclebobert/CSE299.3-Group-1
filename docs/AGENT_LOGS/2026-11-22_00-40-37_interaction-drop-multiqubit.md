Title: Interaction.js multi-qubit gate placement (controls, target2, thetaRad)

Summary:
Enhanced src/editor/Interaction.js drop() to construct valid gates from gate catalog metadata:
- Reads controlCount, target2 flag, parameterized flag, and defaultTheta from the picked gateEntry.
- Allocates control rows ({ row, on: true }) from free rows in the column for controlled gates (CNOT, CZ, Toffoli); returns 'insufficient free rows' conflict when not enough free rows.
- Allocates target2 from a free row for SWAP.
- Uses defaultTheta as thetaRad for parameterized gates (Rx, Ry, Rz, Cu1).
- Preserves existing behavior for single-qubit uncontrolled gates (I, X, Y, Z, H, S, T).
- Placed Gate exposes controls, target2, and thetaRad.
Added 6 new tests in test/editor/Interaction.test.js covering CNOT control allocation, Toffoli two-control allocation, SWAP target2, Cu1 parameterized+control, and two insufficient-free-rows conflict cases.
All 25 tests pass and `node --input-type=module --check` reports SYNTAX OK.
