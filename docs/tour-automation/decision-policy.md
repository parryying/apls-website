# Decision Policy

## Principle

Separate **hard deterministic rules** from **agent judgment**.

The model should never decide whether an opt-out may be ignored, whether an external send may bypass approval, or whether privacy controls apply.

## Hard rules

These run before the model and again before any side effect.

### Suppression
- If `email_opt_out = TRUE`, no admissions outreach may be recommended, drafted, or sent.
- If a family explicitly says they are no longer interested or asks not to be contacted, nurture stops.
- A model output cannot reverse suppression.

### Human approval
- Parent-facing Gmail may be drafted automatically.
- It may not be sent autonomously in the initial design.
- Sharon reviews, edits, sends, or skips.

### Idempotency
- One logical trigger/action pair must not create duplicate drafts.
- Use stable action keys / decision IDs.
- Rescheduled Cal.com bookings should update state rather than create duplicate family/tour sequences.

### Approved facts only
- Agent-generated messages may use active, validated school facts only.
- Time-sensitive facts must respect effective/expiration dates.

### Privacy
- Do not store parent email bodies, child details, tour notes, secrets, or raw action tokens in operational logs.
- Store short decision rationale, not hidden reasoning.

### Cadence
- The model must not invent unlimited follow-up frequency.
- Exact thresholds belong in configuration/policy.
- If a cadence rule blocks outreach, the agent may recommend `REVIEW_LATER`, not bypass the rule.

## Agent judgment

Within the hard-rule envelope, the agent may judge:
- how warm/engaged the family appears
- whether follow-up is useful now
- whether the goal should be reassurance, answering a concern, event invitation, or simple check-in
- whether a school event is relevant to a specific family
- suggested timing for the next review within configured bounds
- how to personalize tone using Sharon's notes and prior context

## Long-horizon families

Families may book tours many months before expected start.

Policy direction:
- lower-frequency nurture than near-term families
- prioritize meaningful school events over generic "checking in"
- invite only when the event is relevant
- avoid repeated pressure to enroll far in advance

Exact time bands and maximum contact frequency are intentionally not hard-coded yet. They should be configured after APLS chooses the cadence.

## Event-triggered evaluation

A new website/CMS event may trigger evaluation, but not automatic broadcast.

```text
new event
  -> find potentially relevant active prospects
  -> apply suppression + cadence rules
  -> agent judges relevance
  -> create draft only for recommended families
  -> Sharon approves
```

## Override behavior

If Sharon skips or overrides an agent recommendation:
- record the final action
- optionally capture a short override reason
- do not immediately re-recommend the same action
- future evaluations should consider the latest human decision

## Policy items still needing product choice

1. Exact near-term / mid-term / long-term expected-start-date bands.
2. Maximum nurture contacts per rolling time window.
3. Cooldown after Sharon skips a recommendation.
4. Whether some purely transactional messages may ever be auto-sent without review.

## Family Q&A policy

Q&A is informational and does not itself count as outbound nurture.

Hard requirements:
- resolve the Gmail thread to a known `prospect_id` before model invocation
- do not let the model guess family identity
- show conflicts when CRM, notes, or newer email content disagree
- do not answer from unrelated families' data
- school-specific factual claims must come from Approved School Facts
- creating a reply draft from Q&A still requires the normal external-send approval policy

Q&A may be available even when a family is opted out, because Sharon may need historical context to respond to an inbound message. However, opt-out remains in force for proactive outreach; the system must distinguish **answering Sharon's internal question** from **initiating new outbound nurture**.

## Gmail thread separation policy

Hard requirements:
- internal agent notifications must never be inserted into the parent-facing Gmail thread
- parent-facing AI reply drafts should join the existing parent thread whenever a reliable `gmail_thread_id` exists
- private rationale, staff notes, lead assessment, and Q&A controls must remain internal
- before creating a parent draft or internal notification, re-check the Gmail thread for a newer Sharon reply
- if Sharon already replied, mark the pending action `superseded_by_human_reply` and suppress the draft/notification
- if Sharon replies manually after an AI draft is created, mark the draft/recommendation obsolete and suppress further reminders

The intended behavior is **human first, agent assist second**.
