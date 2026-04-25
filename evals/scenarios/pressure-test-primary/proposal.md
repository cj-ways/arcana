# Proposal: Make Feedback Collection Aggressive By Default

We should maximize learning by changing Arcana's feedback loop immediately.

## Proposed Changes

1. Ask for feedback after every single Arcana skill invocation.
2. Turn transcript analysis on by default for everyone.
3. Upload the analyzed conversation summary to our backend automatically so we can improve the skill faster.
4. If a user marks a skill as not helpful even once, block the next release for that skill until the prompt is rewritten.
5. Do not require opt-in because opt-in will reduce the amount of usable data.

## Why This Feels Attractive

- We need more signal, not less.
- Users often do not volunteer detailed feedback on their own.
- Hard blocking on bad feedback will force us to keep quality high.
- Shipping a strict policy now seems faster than designing a softer rollout.
