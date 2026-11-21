Title: Fix GitHub Actions setup-node cache and Node 24 action runtime

Summary:
Removed the unsupported `cache: 'none'` input from the `actions/setup-node@v4` step in `.github/workflows/test.yml`, which caused the CI failure `Error: Caching for 'none' is not supported` (setup-node only supports `npm`, `yarn`, `pnpm` for caching).

Bumped actions to Node.js 24-based releases to clear the GitHub Actions deprecation annotation: `actions/checkout@v4` -> `v5`, `actions/setup-node@v4` -> `v5`, and `actions/setup-python@v5` -> `v6`.

Retained `cache: 'pip'` on the setup-python step; it caches the pip download cache keyed on `requirements.txt`, while the Python venv itself is recreated per run by `scripts/ensure_venv.sh`.
