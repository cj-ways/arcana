# High And Extra Deep-Audit Playbook

Read this reference only when the chosen effort is `high` or `extra`, or when the feature class needs richer lane coverage than the base skill body provides.

## High Pass

Do all of the following:

1. **Implementation inventory**
   - data model
   - API surface
   - background jobs
   - events and webhooks
   - notifications
   - error handling and failure paths
   - business rules and limits
   - key dependencies

2. **Cross-surface check**
   - admin or operator view
   - user-facing app
   - sibling services or apps where relevant

3. **Analytics and observability pass**
   - logs
   - metrics and dashboards
   - alerts
   - error tracking
   - debugging visibility

4. **Existing docs pass**
   - if feature docs exist, treat the work as a re-audit and note what changed or was missed

## Extra Pass

Do everything in the high pass, plus:

1. **Contradiction pass**
   - search for evidence that weakens the first impression
   - look for places where code contradicts docs or one surface contradicts another

2. **Hidden-edge pass**
   - retry and failure handling
   - degraded states
   - manual or admin overrides
   - customer trust failures
   - delayed or partial completion states

3. **Broader cross-surface verification**
   - verify the feature story across all clearly related surfaces before finalizing top recommendations

## Feature-Class Lane Examples

These are prompts for discovery, not mandatory sections.

### Auth
- token lifecycle
- session revocation
- MFA enrollment and recovery
- brute-force protection
- device trust and step-up moments

### Billing
- pricing clarity
- refunds and credits
- dunning and failed payments
- tax, fraud, and trust language
- entitlement and downgrade behavior

### Search
- relevance
- zero-results UX
- filter logic
- ranking transparency
- index freshness

### Notifications
- delivery guarantees
- preference hierarchy
- rate limits
- quiet hours
- retry and suppression behavior

### Permissions And Collaboration
- role boundaries
- ownership transfer
- invite and removal flow
- audit trail
- override paths

## External Research Expectations

### High
- verify competitor or current-state claims when they materially affect prioritization
- prefer official docs, help centers, pricing pages, product pages, and primary operational docs

### Extra
- widen the external pass to include leaders and meaningful challengers
- focus on differences that change roadmap or risk, not trivia

## Agent Split Suggestions

Recommended bounded splits:
- implementation inventory
- observability pass
- competitor deep dive
- contradiction search
- cross-surface verification

Do not launch overlapping generic agents with the same scope.
