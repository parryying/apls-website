# Data Model

## Source of truth

The operational schema lives in the Google Sheet **APLS Admissions & Tour Tracker**.

Existing core tabs:
- Prospects
- Children
- Bookings
- Tours
- Communications
- School Facts
- Config
- Events Log

Agent extension:
- Agent Decisions
- Agent Policies

## Entity relationships

```text
Prospect 1 ---- * Children
Prospect 1 ---- * Bookings
Booking  1 ---- 0..1 Tour
Prospect 1 ---- * Communications
Prospect 1 ---- * Agent Decisions
Tour     0..1 -- * Agent Decisions
Agent Decision 0..1 ---- 1 Communication
```

## Agent Decisions

One row per agent evaluation.

Fields:
- `decision_id`: stable unique identifier
- `prospect_id`: target family
- `tour_id`: related tour when applicable
- `trigger_type`: why evaluation ran
- `trigger_ref`: source event/entity identifier
- `evaluated_at`
- `recommended_action`
- `reason_summary`: concise explanation for Sharon
- `confidence`
- `recommended_for_at`
- `communication_id`: link to draft metadata when created
- `policy_version`
- `model`
- `status`
- `review_token_hash`
- `review_token_expires_at`
- `reviewed_by`
- `reviewed_at`
- `final_action`
- `override_reason`

Do not store the parent-facing email body here. Gmail remains the message body store; Communications stores Gmail IDs and metadata.

## Agent Policies

Policy rows distinguish deterministic rules from agent guidance.

Fields:
- `policy_id`
- `policy_type`: HardRule | Guidance
- `rule_name`
- `rule_description`
- `config_key`
- `config_value`
- `enabled`
- `status`
- `owner`
- `version`
- `updated_at`

Initial policies include:
- email opt-out suppression
- human approval before external send
- explicit decline suppression
- privacy-conscious logging
- explanation requirement
- Gmail-first/no-copy-paste staff UX
- long-horizon nurture guidance

## Communications

Communications remains one row per intended parent-facing message.

Existing fields already support:
- action/idempotency key
- Gmail draft/message/thread IDs
- generated/draft/sent/reply timestamps
- prompt/template/model versions
- review required
- retries/errors

The Agent Decisions row links to `communication_id` so agent reasoning and message delivery metadata remain separated.

## Tours

Tour notes are human-authored operational context. The agent may use them, but they should not be copied into logs.

Existing feedback token fields can support secure email-to-form/status flows. Tokens should be stored hashed, expire, and be single-use when appropriate.

## Logging

Events Log is operational, not a shadow CRM.

Allowed:
- event identity
- provider
- event type/time
- entity ID
- success/failure outcome
- payload hash/version
- retry/error metadata

Disallowed:
- raw email bodies
- child details
- full tour notes
- plaintext action tokens
- API/webhook secrets

## Agent Interactions

Add a dedicated operational tab for Sharon-initiated agent usage that is not a proactive follow-up decision.

One row per Q&A or staff-initiated assistant interaction.

Recommended fields:
- `interaction_id`
- `prospect_id`
- `gmail_thread_id`
- `interaction_type`: FAMILY_QA | FAMILY_SUMMARY | DRAFT_REPLY | ADD_NOTE
- `question_summary`
- `answer_summary`
- `source_summary`
- `conflict_detected`
- `communication_id`: populated if a Gmail draft is created
- `model`
- `prompt_version`
- `created_at`
- `created_by`
- `status`

Do not store hidden reasoning. Avoid storing full parent email bodies in this tab. The purpose is traceability of assistant usage, not duplication of Gmail content.

### Gmail-thread mapping

`Communications.gmail_thread_id` is the preferred bridge from the current Gmail conversation to the family record. If a thread cannot be resolved uniquely, the assistant should stop and require explicit staff selection rather than guess.

## Threading and supersession state

Use existing `Communications.gmail_thread_id` to keep parent-facing reply drafts attached to the correct family conversation.

Recommended additions to agent/communication state:
- `superseded_by_message_id`
- `superseded_at`
- status value `SupersededByHumanReply`

These fields/statuses allow the system to cancel stale AI help when Sharon answers manually.

Internal agent notifications should not reuse the parent's `gmail_thread_id`; they are separate private staff communications.
