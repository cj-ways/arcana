# Email Verification Resend Flow

## Current Flow

After signup, users land on a "check your inbox" screen. A resend button appears after a short cooldown and triggers another verification email.

## Known Problems

- Users often tap resend multiple times because the cooldown state is not clearly visible.
- If delivery fails or is delayed, the UI only shows a generic message with no next step.
- Support sees repeat tickets from mobile users who are unsure whether the second email was actually sent.
- The screen confirms the original signup, but not the resend action itself.

## Constraints

- Backend behavior is frozen this sprint.
- Product can change copy, layout, button states, and analytics only.
