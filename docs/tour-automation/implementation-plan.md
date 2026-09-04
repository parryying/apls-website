# Implementation Plan

## Phase 0 — preserve deterministic backbone

Complete reliable ingestion before agent autonomy.

- Cal.com webhook authentication
- normalize create/reschedule/cancel
- stable prospect/child/booking matching
- idempotent event processing
- tour status capture
- opt-out enforcement
- Gmail communication metadata
- retry/error handling

Agent failure must not break booking/tour processing.

## Phase 1 — recommend + draft + explain

First agent release.

Trigger examples:
- tour outcome recorded
- eligible post-tour review date reached
- relevant parent reply received
- long-horizon nurture review date reached
- new relevant school event published

Flow:
1. Load bounded context.
2. Apply hard suppression/cadence rules.
3. Call agent with structured-output schema.
4. Validate output.
5. If no action, record decision.
6. If draft recommended:
   - create actual Gmail draft
   - create Agent Decisions row
   - send Sharon short internal explanation
7. Sharon edits/sends/skips.
8. Record final action.

## Phase 2 — Gmail/form interaction

Implement low-friction staff actions.

- review draft
- skip recommendation
- add note
- mark no-show
- set interest state
- set do-not-contact

Requirements:
- signed/opaque action tokens
- hashed token storage
- expiration
- replay protection
- simple mobile-friendly page
- no authentication surprises for Sharon beyond her normal Google account where feasible

Test the "Review draft" path specifically on:
- Sharon's desktop browser
- Sharon's iPhone/Gmail app

Do not assume a Gmail deep-link behavior until tested.

## Phase 3 — event-based nurture

Connect website CMS event publication to nurture evaluation.

- publish event
- create normalized event record
- identify candidate active prospects
- apply suppression/cadence
- agent evaluates relevance
- create drafts only for recommended families
- Sharon approval remains required

## Phase 4 — measurement and tuning

Review:
- Sharon acceptance/edit/skip rates
- family reply rates
- duplicate prevention
- complaint/opt-out rates
- enrollment progression
- agent cost per evaluation
- time saved for Sharon

Tune prompts only after reviewing real decisions.

## Engineering tests

### Deterministic
- duplicate webhook does not duplicate entities
- reschedule updates expected booking
- cancellation stops invalid pending follow-up
- opt-out blocks model call and draft creation
- explicit decline blocks nurture
- agent error creates no outbound side effect
- one action key produces at most one Gmail draft

### Agent contract
- invalid JSON rejected
- unsupported action rejected
- missing explanation rejected for outreach
- draft cannot cite unapproved school facts
- model cannot override hard policy state

### Human approval
- draft creation does not equal send
- skip prevents immediate same recommendation
- Sharon edit does not break communication tracking
- send/reply state reconciles correctly

## Open product decisions

Before production nurture is enabled, choose:
- expected-start-date cadence bands
- max outreach frequency
- cooldown after skip
- any transactional messages that may later be auto-sent

Until chosen, keep long-horizon cadence policy in `Needs decision` state.
