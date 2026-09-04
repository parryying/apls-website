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

## Phase 2A — family Q&A assistant

Add the **Ask about this family** workflow before more autonomous nurture features.

Implementation:
1. Internal Sharon email includes Ask about this family.
2. Signed link opens a small Apps Script page.
3. Backend resolves Gmail thread -> `prospect_id`.
4. Page loads a one-family bounded context package.
5. Sharon asks a natural-language question.
6. Agent returns concise answer + source categories + conflict flag.
7. Sharon may choose Draft Reply or Add Note.
8. Draft Reply creates a real Gmail reply draft and records it in Communications.
9. Interaction metadata is recorded in Agent Interactions.

### Family Q&A tests

- known Gmail thread resolves to correct prospect
- ambiguous sender/thread does not cause model guessing
- unrelated family data is never included
- latest parent reply overrides stale assumptions but conflicts are surfaced
- child name/start date/tour notes can be answered from CRM
- approved school facts are used for school-specific questions
- opted-out family can still be summarized internally after inbound contact, but no proactive nurture is created
- Draft Reply creates a real Gmail draft and does not send automatically
- Q&A page works on Sharon's desktop and iPhone

## Gmail threading + race-condition implementation

Before enabling inbound-reply assistance:

1. Preserve `gmail_thread_id` for every known family conversation.
2. Create parent-facing reply drafts in the existing Gmail thread whenever possible.
3. Send internal agent notifications as separate staff-only messages.
4. Add a human-first waiting state after inbound parent replies.
5. Re-check the Gmail thread immediately before draft/notification creation.
6. If Sharon has already sent a newer reply, mark the action `SupersededByHumanReply` and stop.
7. Reconcile pending AI drafts against later manual Sharon replies and suppress obsolete reminders.

### Threading tests

- AI parent reply draft appears in the correct existing Gmail thread
- internal agent notification is never inserted into the parent thread
- internal rationale cannot be accidentally sent as part of the family conversation
- Sharon manual reply before AI completion suppresses pending draft and notification
- Sharon manual reply after AI draft creation marks the AI action obsolete
- no duplicate reminder occurs for an already handled parent reply
- thread mismatch/ambiguity stops automation rather than guessing
