# APLS Tour Automation + Admissions Agent

## Purpose

This folder documents the admissions/tour automation system for APLS.

The system intentionally uses a **deterministic automation backbone** with a limited AI decision layer. The agent may interpret context, recommend the next action, explain why, and create Gmail drafts, but parent-facing messages remain human-approved.

## Staff experience

Sharon should work primarily from Gmail. She should not need to learn a CRM UI, copy/paste AI-generated text, or manage agent state directly.

Typical flow:

1. Cal.com or another source creates/updates a family/tour record.
2. Deterministic workflow updates the Google Sheet CRM.
3. Agent evaluates whether a follow-up is useful.
4. If appropriate, the agent creates the actual parent-facing Gmail draft.
5. Sharon receives a short internal notification explaining **why now**, the **goal**, and the **next step**.
6. Sharon opens the Gmail draft, edits if needed, and sends — or skips.
7. The system records the decision and schedules the next eligible review.

## Documents

- [Architecture](architecture.md)
- [Agent Design](agent-design.md)
- [Decision Policy](decision-policy.md)
- [Data Model](data-model.md)
- [Implementation Plan](implementation-plan.md)

## Operational source of truth

The live schema is the Google Sheet **APLS Admissions & Tour Tracker**. It contains the core CRM tabs plus:

- `Agent Decisions`
- `Agent Policies`

The Sheet remains the operational source of truth; these Markdown documents explain intended behavior and engineering contracts.

## Key design principles

- Deterministic rules for suppression, privacy, deduplication, idempotency, and send approval.
- AI only where judgment adds value.
- Gmail-first staff UX.
- No copy/paste required for Sharon.
- Every recommendation must be explainable in a short human-readable summary.
- Parent-facing email is never sent autonomously in the initial design.
- Exact nurture cadence is configurable and should not be invented by the model.
