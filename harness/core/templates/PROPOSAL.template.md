# PROPOSAL-NNN — {Title}

> **Summary:** {≤ 3 lines: the problem, the proposed solution, what {{OWNER}} must approve}
>
> The first artifact in the SDD flow. Captures intent, scope, and risk before any specification or design work begins. Created by the SCRUM/PO when a business need is identified. Approved by the human before proceeding to SPEC and DESIGN.

---

## Meta

- **ID:** PROPOSAL-NNN
- **Status:** {draft | approved | rejected | superseded by PROPOSAL-MMM}
- **Stack target:** {android | web | shared | none}
- **Origin:** {business request | bug report | refactor opportunity | TASK-NNN}
- **Created:** {YYYY-MM-DD}
- **Approved by:** {human name or "pending"}
- **Related ADRs:** {ADR-NNN, ...}

---

## 1. Problem statement

One paragraph. What is the pain point or opportunity? Describe it in business terms, not technical terms.

---

## 2. Proposed solution

One paragraph. The high-level approach to solving the problem. Not implementation detail — that goes in SPEC and DESIGN.

---

## 2b. Focus check

Answered before the proposal leaves draft. Any "no" or "unknown" goes to the human first.

- **In the current focus?** {yes | no} — {the focus item from MEMORY.md it serves}
- **Cost estimate:** {hours or days}
- **What gets parked to make room:** {item, or "nothing"}

---

## 3. Scope

### In scope

- {what this proposal explicitly covers}

### Out of scope

- {what this proposal explicitly does NOT cover, even if related}

### Edge cases to consider

- {known edge cases that affect scope definition}

---

## 4. Success criteria

Measurable conditions. The proposal is valid if, after implementation, ALL of these are true.

- [ ] {criterion 1 — observable from outside the system}
- [ ] {criterion 2}
- [ ] {criterion 3}

---

## 5. Risks and open questions

- **Risk:** {what could go wrong} — {mitigation or "open"}
- **Question:** {what needs to be decided before spec} — {who decides}

---

## 6. Impact assessment

### Affected areas

- {area/module} — {nature of impact: data model change, new UI, API contract, etc.}

### Stakeholders

- {who cares about this change and why}

---

## 7. Dependencies

|Depends on|Type|Status|
|---|---|---|
|{PROPOSAL-NNN or TASK-NNN}|{blocks / is blocked by / relates to}|{status}|

---

## 8. Downstream artifacts

Complete automatically as the SDD flow progresses.

- [ ] SPEC-NNN created from this proposal
- [ ] DESIGN-NNN created from this proposal
- [ ] TASK-NNN created from spec + design
- [ ] PROMPT-NNN generated for Coder

---

**Template version:** v1.1