# Craft Ethics Control Panel

A local control system for governing AI agent behavior during design work.
Run from the **project root** — all hooks and scripts assume this working directory.

## What this system does

- **Kontrollpanel** (GUI + server) lets you set behavioral parameters for AI agents:
  fidelity, autonomy, clarification style, explanations, and ethics level.
- **Cases** (`cases/case-XX/`) are project workspaces. Each case has a decision log
  where the design-decision-tracker agent records MDRs (Micro Decision Records).
- **Hooks** (`.claude/settings.json`) automatically inject the current configuration
  into every prompt and trigger decision tracking after each git commit.

## Modes

| Mode | What it means |
|---|---|
| **Admin** | You are working on the control system itself. Hooks inject `[ADMIN MODE]`. Behavior parameters do not apply. |
| **Case** | You are working inside a case folder. Hooks inject `[KONTROLLPANEL]` with current behavior parameters and restrict edits to `cases/{current_case}/`. |

Switch modes in the GUI, or edit `control/config/agent-config.json` directly.

## Getting started

1. `cd control && npm install` — install server dependencies
2. `cd control/gui && npm install` — install GUI dependencies
3. `npm run dev` from `control/` — starts server + GUI
4. Open the GUI, set your parameters, select a case
5. Start working — hooks handle the rest

## Creating a new case

```
node control/scripts/new-case.js
```

Creates `cases/case-XX/` with a fresh `decisions.md` and sets it as the active case.
