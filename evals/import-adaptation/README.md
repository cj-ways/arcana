# Import Adaptation Eval

Static fixture pairs for measuring whether Arcana-style adaptation improved an imported skill.

Each fixture directory contains:

- `raw.md` — the imported skill as originally received
- `adapted.md` — the adapted Arcana-style version

Run:

```bash
node evals/run-import-adaptation.js
node evals/run-import-adaptation.js --fixture legacy-skill
node evals/run-import-adaptation.js --skill some-imported-skill
```

Artifacts are written locally to:

```text
evals/import-adaptation/results/latest.json
evals/import-adaptation/results/latest.md
```
