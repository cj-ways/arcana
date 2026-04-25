# Billing Recovery

## Current Flow

When a subscription renewal fails, users receive an email and see a billing warning the next time they open the app. They can update the payment method and retry the charge.

## Known Problems

- Users do not know whether access will be removed immediately or after a grace period.
- Failed renewal emails mention the failure, but not what will happen next.
- Support says users often retry payment without understanding whether the original retry already queued.
- Product wants stronger recovery conversion without creating dark patterns.

## Constraints

- Pricing and grace-period policy are fixed this quarter.
- The team can change copy, retry-state clarity, billing UI, admin visibility, and analytics.
