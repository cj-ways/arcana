# Repository Notes

## Current Reality

- Arcana is still one modest-sized repository and package.
- The repo already invested in a centralized catalog, generated docs, eval coverage, and scorecard gating to reduce drift inside the single-package layout.
- The roadmap priority is still skill quality, measurement, trust, and import governance rather than packaging work.
- There is no documented user request or package-consumer demand for separate npm packages yet.

## Likely Costs Of Splitting Early

- Cross-package versioning and release coordination.
- More places for docs and metadata drift to appear again.
- More complicated tests and fixture movement across package boundaries.
- Extra contributor overhead while the product surface is still changing quickly.

## Legitimate Upside

- Clearer module boundaries.
- Potentially lighter installs in the future.
- Easier reuse if Arcana eventually has distinct consumers for the CLI, catalog, and eval system.
