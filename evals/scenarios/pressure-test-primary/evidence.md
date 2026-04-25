# Evidence Pack

## Current Arcana State

- Arcana already has a local-first feedback flow with manual capture and report commands.
- Arcana also has optional transcript analysis, but the design expectation is explicit consent before analysis or upload.
- Arcana has scorecards and compare-mode evals for measuring skill lift against a baseline.
- Arcana's documented boundary is "No Silent Telemetry," not "collect nothing ever."
- Automatic feedback prompting currently exists only through Claude Code hook integration and is intentionally sampled rather than shown every time.

## Current Risks The Team Already Knows About

- Asking for feedback too often can annoy users and reduce response quality.
- Transcript analysis has privacy and trust implications even when the summary is useful.
- A single negative rating is a weak signal if the sample size is tiny or the task was a poor fit for the skill.

## What The Proposal Gets Right

- Better user feedback would help improve skills faster.
- Stronger quality loops can catch weak skill behavior earlier.
