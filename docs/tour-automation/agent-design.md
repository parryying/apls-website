# Agent Design

## Agent contract

Review the current family/tour state and relevant approved school information. Recommend the next useful admissions action, explain the recommendation briefly, and create a parent-facing Gmail draft when appropriate. Never send externally without Sharon's approval.

## Inputs

The agent should receive a bounded context package, not unrestricted account access.

Recommended context:
- prospect identifier
- parent first/name as needed for drafting
- program interest
- child age or relevant age band
- expected start date
- booking/tour history
- tour outcome and Sharon notes
- prior communication metadata
- recent reply summary, if available
- relevant school event metadata
- active approved school facts
- active policy constraints already evaluated by deterministic code

Avoid sending:
- unrelated family records
- operational secrets
- raw logs
- excessive historical email bodies
- unnecessary sensitive child data

## Structured output

The model response should be machine-validated. Suggested shape:

```json
{
  "action": "NO_ACTION | CREATE_DRAFT | REVIEW_LATER | EVENT_INVITE",
  "reason_summary": "short explanation for Sharon",
  "communication_goal": "what this message should accomplish",
  "recommended_for_at": "ISO timestamp or null",
  "confidence": "LOW | MEDIUM | HIGH",
  "draft": {
    "subject": "string or null",
    "body": "string or null"
  }
}
```

The backend, not the model, determines whether that output is allowed.

## Explainability UX

Every recommended outreach should produce a short internal explanation:

- **Why now:** e.g. toured 3 days ago; no follow-up yet.
- **Goal:** e.g. gentle check-in; answer hesitation; no enrollment pressure.
- **Next step:** e.g. if no reply, wait until the next eligible review.

Do not expose chain-of-thought. Store only the concise decision rationale needed for operations and audit.

## Gmail-first interaction

### Recommended follow-up

1. Agent returns `CREATE_DRAFT`.
2. Backend creates the actual Gmail draft addressed to the parent.
3. Backend records the Gmail draft ID in `Communications`.
4. Backend records the recommendation in `Agent Decisions`.
5. Sharon receives an internal email:
   - family
   - why now
   - goal
   - next step
   - review draft action
   - skip/add-note actions
6. Sharon opens the real Gmail draft, edits if desired, and sends.
7. Backend observes/records final state.

No copy/paste is part of the expected workflow.

### Tour outcome capture

Sharon may interact by:
- replying to a simple internal email with notes, or
- opening a short structured form/action page from email.

Use free-form reply for nuance and a structured action form for statuses such as:
- toured / no-show
- interested / maybe / not interested
- do not contact
- add note

## Tool permissions

### Read
- CRM rows for the target family
- relevant booking/tour records
- communication metadata
- relevant Gmail thread/reply summary
- approved school facts
- eligible school event metadata

### Write
- Agent Decisions row
- Communication metadata
- Gmail draft
- internal Sharon notification
- next-review timestamp/state
- staff notes/status received through approved actions

### Prohibited initially
- autonomous external send
- bulk campaign send
- deletion of CRM records
- modification of opt-out to false
- modification of approved school facts without explicit admin action

## Prompt/versioning

Record:
- policy version
- prompt version
- model identifier
- decision timestamp

This permits reproducibility and future evaluation.

## Evaluation

Track:
- recommendation acceptance rate
- Sharon edit rate
- skip/override rate
- draft-to-send time
- reply rate
- enrollment progression
- false-positive outreach complaints
- duplicate draft incidents
- suppression violations (target: zero)

The goal is not maximum outreach. The goal is useful, respectful follow-up with less staff burden.

## Family Q&A capability

The same agent also serves as a **family context assistant** when Sharon wants to remember who a family is or what was previously discussed.

### Entry point

Internal notification email includes:
- Family Summary
- Ask about this family
- Draft Reply
- Add Note

**Ask about this family** opens a minimal Apps Script page with one text box. Sharon can type a natural-language question without opening the CRM.

Example questions:
- What is the child's name?
- When do they expect to start?
- What did we talk about at the tour?
- What were their concerns?
- What did we already tell them?
- Draft a reply to their latest email.

### Q&A contract

Before answering, backend code resolves the Gmail thread to `prospect_id`. The agent then receives only the target family's bounded context.

The agent may answer using:
- structured CRM facts
- child/program/start-date data
- tour notes
- relevant prior communication metadata or bounded excerpts/summaries
- the latest parent reply
- approved school facts

For conflicting information, answers should explicitly identify the discrepancy, for example:

> CRM says January 2027, but the latest parent email says spring 2027.

The agent must not silently reconcile conflicting facts.

### Q&A response shape

Suggested machine-validated response:

```json
{
  "answer": "concise answer for Sharon",
  "source_summary": ["CRM", "Tour notes", "Latest parent reply"],
  "conflict_detected": false,
  "suggested_next_action": "NONE | DRAFT_REPLY | ADD_NOTE"
}
```

Do not expose chain-of-thought. `source_summary` identifies the operational source categories only.

### Draft reply from Q&A

If Sharon chooses **Draft reply using this context**:
1. reuse the resolved `prospect_id` and Gmail thread
2. load approved school facts if needed
3. create a real Gmail reply draft in the same thread where possible
4. record the draft in Communications
5. require Sharon review before send

The Q&A page should never require copy/paste.
