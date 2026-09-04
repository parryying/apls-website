# Architecture

## 1. Current deterministic framework

```text
Cal.com / Website / Staff updates / Gmail replies
                  |
                  v
            Event ingestion
                  |
                  v
           Google Apps Script
      normalize / validate / dedupe
                  |
                  v
         Google Sheet CRM
                  |
          explicit if/then rules
                  |
        +---------+----------+
        |                    |
        v                    v
   create draft        schedule/remind
        |
        v
      Gmail
```

This framework is predictable: the same state and trigger should produce the same action.

## 2. Agent-assisted framework

```text
Cal.com / Website CMS / Gmail / Staff notes
                  |
                  v
        Deterministic ingestion layer
     auth / normalize / dedupe / persist
                  |
                  v
         Google Sheet CRM (state)
                  |
        deterministic policy gate
   opt-out / decline / cadence / privacy
                  |
                  v
            Agent evaluator
       context -> reason -> recommend
                  |
          +-------+--------+
          |                |
          v                v
   no action / wait    create communication
                           |
                           v
                    real Gmail draft
                           |
                           v
                  internal Sharon notice
             why now / goal / next step
                           |
                           v
                  Sharon reviews in Gmail
                    edit / send / skip
                           |
                           v
                  decision + state update
```

## 3. Component responsibilities

### Cal.com
- Produces booking lifecycle events.
- Supplies booking questions and expected start date.
- Must remain idempotent across create/reschedule/cancel events.

### Google Apps Script
- Webhook receiver and backend orchestration.
- Validates events.
- Normalizes provider payloads.
- Writes CRM state.
- Runs deterministic policy checks.
- Calls the agent only when an evaluation is eligible.
- Creates Gmail drafts and internal notifications.
- Processes staff action links/forms.
- Schedules future eligibility checks.

### Google Sheet CRM
Source of truth for:
- prospects and children
- bookings and tour outcomes
- communications
- approved school facts
- agent decisions
- agent policies
- operational event logs

### Agent
The agent is a decision layer, not the system of record.

It may:
- summarize relevant family context
- classify engagement/intent when useful
- recommend whether to follow up
- choose a communication goal/angle
- propose next review timing within policy constraints
- draft parent-facing copy
- generate a short explanation for Sharon

It may not:
- override opt-out or explicit decline
- send parent-facing email in the initial design
- invent school facts
- change privacy/safety rules
- silently exceed cadence limits
- write secrets into the Sheet

### Gmail
Primary staff UI.

Two distinct artifacts:
1. **Parent-facing Gmail draft** — the actual message Sharon can edit/send.
2. **Internal Sharon notification** — brief explanation + review actions.

The internal notification must not contain a block of text Sharon is expected to copy/paste.

### Website CMS
Publishes school events/announcements.

Future event trigger:
- new relevant event may cause the agent to evaluate eligible long-horizon families
- agent selects families based on program/language interest, timing, prior engagement, and suppression rules
- event relevance should be explainable and auditable

## 4. Trust boundaries

Hard rules must execute outside the LLM. The LLM receives only eligible context after suppression checks.

External send remains a human boundary:
```text
Agent recommendation -> Gmail draft -> Sharon approval -> parent
```

## 5. Failure behavior

If the model is unavailable or returns invalid output:
- do not send anything
- preserve the CRM state
- record a sanitized failure
- retry only according to bounded retry rules
- deterministic booking/tour processing continues without the agent

## 6. Family Q&A flow

A parent reply can also trigger a context-assistant workflow without forcing Sharon into the CRM.

```text
Parent replies in Gmail
        |
        v
Resolve Gmail thread -> prospect_id
        |
        v
Load bounded family context
CRM + tour notes + prior communication metadata
        |
        v
Sharon taps "Ask about this family"
        |
        v
Small Apps Script Q&A page
        |
        +--> agent answers question
        |
        +--> optional "Draft reply"
                 |
                 v
          real Gmail reply draft
                 |
                 v
           Sharon reviews/sends
```

### Thread-to-family resolution

The backend should resolve the current Gmail thread to a known family before invoking the agent. Preferred matching order:
1. existing `gmail_thread_id` in Communications
2. known sender email mapped to a single active prospect
3. explicit staff selection if ambiguous

Do not let the model guess which family a thread belongs to.

### Q&A source precedence

For factual answers:
1. latest parent email/reply
2. structured CRM fields
3. Sharon's tour notes
4. prior communication history
5. approved school facts for school-specific answers

If sources conflict, the agent should surface the conflict instead of silently choosing one.
