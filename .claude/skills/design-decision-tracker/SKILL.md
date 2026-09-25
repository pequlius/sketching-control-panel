---
name: design-decision-tracker
description: >
  A skill for a sub-agent in a Claude Code multi-agent system whose responsibility is to
  detect design decisions made by the AI while carrying out a task, and to log them in a
  structured decision log. The central purpose is to make visible how many small decisions
  the AI makes relative to the user's actual input. Use this skill whenever agent output is
  reviewed, a session summary is requested, or a decision log needs to be maintained.
---
# Design Decision Tracker

This skill defines how to detect, classify, and log the design decisions an AI agent makes
while doing design work.

## Core purpose

> **Make visible how many small decisions the AI makes relative to what the user actually asked for.**

A single vague instruction ("make it colourful and fun") can spawn a dozen concrete
decisions the user never explicitly made. The log exists to surface that gap. Every
non-trivial choice is recorded — the value is in the *volume* and in how each decision
traces back (or fails to trace back) to the user's prompt.

---

## Classification

Each decision is classified along **two axes**.

### Axis 1 — Type

What does the decision affect?

| Type | Covers |
|---|---|
| **Functionality** | What the software can *do* — entirely new functions or modifications of existing ones |
| **User Experience** | Appearance & interaction — colour, fonts, layout, interactive behaviour, feedback, delight |
| **Infrastructure** | Underlying mechanics not directly visible to the user — data storage, file structure, coding schemes, state management |
| **Content & Scope** | What the app *includes or excludes* — categories, default values, copy/wording, naming, which options exist at all |

Pick the single best-fit type. Tie-break order when ambiguous:
Content & Scope → Functionality → User Experience → Infrastructure.

### Axis 2 — Derivation

How far did the decision travel from the user's prompt? **This is the heart of the log.**

| Derivation | Meaning | Test |
|---|---|---|
| **Direct** | The user named exactly this | Can you point to the word in the prompt? |
| **Interpretation** | The user gave a goal/quality; this is one reasonable realisation of it | Is the *intent* in the prompt but not the *thing*? |
| **Autonomous** | The prompt is silent on this dimension — even if the choice happens to serve the overall goal | Is there no phrase at all to trace the decision to? |

**Anti-default rule:** When torn between Interpretation and Autonomous, ask whether there is
a *concrete phrase* in the prompt the decision can be traced to. **If there is no such phrase,
it is Autonomous.** Do not let Interpretation become a catch-all — "I made a judgement call"
is not enough to qualify as Interpretation; the prompt must actually gesture at the dimension.

Worked examples (brief: "make it colourful and fun"):
- purple gradient theme → **Interpretation** (colour was requested)
- confetti on save → **Interpretation** (fun was requested)
- mood key bound to the week's start date → **Autonomous** (persistence was never mentioned)
- six fixed categories → **Autonomous** (categorisation was never mentioned)

---

## Documentation Format

Record each detected decision as a **Micro Decision Record (MDR)**:

```
## MDR-[NNN]: [Short title]
**Type**:        Functionality | User Experience | Infrastructure | Content & Scope
**Derivation**:  Direct | Interpretation | Autonomous
**Prompt**:      "[The relevant fragment of the user's instruction, or — if none]"
**Decision**:    [One sentence: what was concretely chosen.]
**Rationale**:   [Short: why this choice — for Interpretation/Autonomous. Otherwise —]
```

Keep entries short. The log's power is in the list as a whole, so a long task should
produce a visibly long list.

**Language:** Write each MDR in the same language as the user's prompt — an English prompt
gets an English entry, a Swedish prompt a Swedish entry. There is no default language; match
the user.

---

## What counts as a decision

- A choice between options that were **not all equivalent**.
- Something that was **done that could reasonably have been done differently**.
- Something **introduced that the user never asked for**.

Skip pure micro-style (naming `userId` vs `user_id`); keep anything that affects what the
software does, how it feels, how it is built, or what it contains.

---

## Important constraints

- **Do not invent decisions.** If unsure whether a real choice was made, leave it out.
- **Do not interrupt the workflow.** Log silently; the list is reviewed on request.
- **Number sequentially.** Never overwrite existing entries; append with the next MDR number.
- **One type per entry.** If a decision genuinely spans two, pick the dominant one by the
  tie-break order above.
