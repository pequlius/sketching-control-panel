# Craft Ethics Control Panel

An experimental system for steering AI agent behaviour in real time during programming sessions. Built as part of HCI research into human–AI collaboration.

---

## What it does

The system lets you configure how a Claude Code agent behaves before and during a task — without editing prompts manually. You control five global behavioural dimensions through a browser-based GUI, and changes take effect on the agent's next step.

It also has a **mode switch** (Admin / Case). In **Case mode** the agent is steered by the behaviour parameters and may only edit files inside the active case folder. In **Admin mode** you build and configure the control system itself, with no restrictions.

A decision tracker automatically logs the design decisions the agent makes during each case session to a `decisions.md` file in that case folder — making visible how much the AI decides on its own.

---

## Getting started

### 1. Install dependencies

Run this once after cloning:

```bash
cd control && npm install
cd server && npm install
cd ../gui && npm install
```

### 2. Start the system

Double-click **`start.bat`** in the root folder, or from the `control/` directory:

```bash
npm start
```

This starts both services in parallel:

| Service | URL |
|---------|-----|
| API server | `http://localhost:3333` |
| Control panel GUI | `http://localhost:5173` |

Open **http://localhost:5173** in your browser.

> **Important:** Open Claude Code at the **project root**, not inside a case
> folder. The hooks in the root `.claude/settings.local.json` only load from
> the root, and opening inside a case folder creates stray `.claude/`
> directories there. Use the **Mode** switch (not the working directory) to
> focus on a single case.

---

## Typical workflow

1. Double-click `start.bat` to launch the server and GUI.
2. Open Claude Code **at the project root** (not inside a case folder).
3. In the control panel at **http://localhost:5173**, click the **gear icon** → **+ New case** to create a fresh case folder. It becomes the active case and switches you to **Case mode**.
4. Set the behaviour parameters for the session with the sliders.
5. Work the case from the root. The agent is restricted to the active case folder; adjust parameters anytime — changes are picked up at the start of each new prompt.
6. To modify the control system itself, switch to **Admin mode** (no restart needed).
7. Review `decisions.md` in the case folder to see what decisions the agent made autonomously.
8. Run `npm run reset` in `control/` between sessions to restore defaults.

---

## The control panel

The GUI lets you configure agent behaviour without touching any files. Changes are saved automatically (500 ms debounce). The bottom bar shows sync state (green = saved, yellow = saving, red = server unreachable) and the current mode / active case.

The main view stays focused on the behaviour **parameters** and the **decision log**. Administrative controls live behind the **gear icon** (top-right), which opens a Settings panel containing the **mode switch** (Admin / Case) and case management — including a **+ New case** button that creates the next case folder, makes it active, and switches to Case mode without leaving the browser.

### Parameters

Five sliders, each on a scale of 1–5:

| Parameter | Low (1) | High (5) | What it controls |
|-----------|---------|----------|-----------------|
| **Fidelity** | Sketch | Complete | How finished the output is per prompt. Low = wireframe outlines and stubs only. High = production-ready in one pass. |
| **Autonomy** | Strict | Free | How freely the agent interprets instructions. Low = word-for-word execution, nothing added or reinterpreted. High = treats the instruction as a brief and freely adds ideas, reframes the problem, and expands scope. |
| **Clarification** | Assumes | Asks | Whether the agent clarifies before starting. Low = picks an interpretation and proceeds. High = mandatory restatement and approval before writing anything. |
| **Explanations** | Silent | Detailed | How much the agent documents its work. Low = output only. High = thorough log of every step and decision. |
| **Ethical Awareness** | Provocative | Aware | How much ethical and social considerations shape the output. Low = design provocation mode. High = full ethical scrutiny. |

---

## Decision tracking

Each case session has a `decisions.md` file that records design decisions in MDR (Micro Decision Record) format. The case agent populates this file automatically after each completed task (per the `[DECISION TRACKING]` instruction injected into the prompt) — no manual triggering needed.

The purpose is to make visible **how many small decisions the AI makes relative to what the user actually asked for**. Each MDR captures:

- **Type** — Functionality, User Experience, Infrastructure, or Content & Scope
- **Derivation** — Direct (user named it), Interpretation (a reading of a stated goal), or Autonomous (the prompt was silent)
- **Prompt** — the fragment of user input the decision traces back to
- **Decision** and a short rationale

---

## Managing cases

### Create a new case

The easiest way is from the GUI: click the **gear icon** → **+ New case**. This creates the folder, sets it as the active case, and switches to Case mode.

You can also do it from the command line — double-click **`new-case.bat`**, or from `control/`:

```bash
npm run new-case
```

Creates the next numbered folder under `cases/` (e.g. `cases/case-04/`), copies the behaviour contract template into it as `CLAUDE.md`, and creates an empty `decisions.md`. It also sets `current_case` in the config, so the new case immediately becomes the active one for **Case mode**. No `.claude/` folder is created in the case — all hooks live in the root.

### Reset config to defaults

```bash
cd control && npm run reset
```

Copies `agent-config.default.json` over `agent-config.json` and regenerates `agent-prompt.txt`.

---
---

# Technical reference

Everything below describes the internals — useful for modifying the control system, not needed for day-to-day use.

## Modes: Admin vs Case

The panel has two modes, switched with the **MODE** toggle in the Settings panel. The mode is stored as `"mode"` in `agent-config.json` and read fresh on every prompt — so switching takes effect on your **next message, in the same session** (no restart needed).

| | **Case mode** | **Admin mode** |
|---|---|---|
| Purpose | Run a study case, steered by the panel | Build / configure the control system itself |
| Injected context | `[KONTROLLPANEL]` parameters + `[ACTIVE CASE]` label | A short `[ADMIN MODE]` banner; parameters do **not** apply |
| File edits | **Restricted** to `cases/<current_case>/` | Unrestricted |
| Which case | Set by `current_case` (the last case `new-case` created) | n/a |

### How the restriction is enforced

Two hooks in the root `.claude/settings.local.json` do the work, both reading `agent-config.json` on every call:

1. **`inject-context.js`** (UserPromptSubmit) — injects the mode-appropriate context before each prompt. In Case mode it appends an `[ACTIVE CASE: case-XX]` block telling the agent to stay inside that folder.
2. **`guard-write.js`** (PreToolUse on `Write`/`Edit`/`MultiEdit`) — a hard guard. In Case mode it **denies** any edit whose resolved path falls outside `cases/<current_case>/` (path traversal included). In Admin mode it allows everything.

The injection is a soft instruction; the guard is the enforced backstop. Reads are never blocked — only edits.

This replaces the older pattern of `cd`-ing into a case folder, which created stray `.claude/` directories and risked per-folder work trees.

## How the agent reads the config

Each case folder contains a `CLAUDE.md` file that Claude Code reads when working in the project. The behaviour configuration itself is delivered two ways:

1. **Injected automatically** as `[KONTROLLPANEL]` context at the start of every prompt by the `inject-context.js` hook (Case mode only).
2. **Compiled to disk** as `control/config/agent-prompt.txt` by the server on every save and on startup — a fallback the agent can read directly if the injected context is ever absent.

No network call is needed, so it works on any machine, including those where newer Claude versions restrict HTTP access. If neither source is available the agent falls back to built-in defaults and states this at the start of the response.

## Project structure

```
craft-ethics-control-panel/
├── cases/                               # One folder per session (gitignored)
│   └── case-01/
│       ├── CLAUDE.md                    # Behaviour contract for this case
│       └── decisions.md                 # Auto-generated decision log (MDR format)
│
├── control/                             # The control system
│   ├── CLAUDE.case-template.md          # Template copied into new cases
│   ├── config/
│   │   ├── agent-config.json            # Live config incl. mode + current_case (gitignored)
│   │   ├── agent-config.default.json    # Default values
│   │   └── agent-prompt.txt             # Compiled instructions (gitignored, read by agent)
│   ├── gui/                             # React + Vite frontend
│   │   └── src/App.jsx
│   ├── server/
│   │   └── server.js                    # Express API (port 3333)
│   └── scripts/
│       ├── new-case.js                  # Creates a new numbered case folder
│       ├── build-prompt.js              # Compiles agent-prompt.txt (server + hook fallback)
│       ├── inject-context.js            # UserPromptSubmit hook: injects mode-aware context
│       ├── guard-write.js               # PreToolUse hook: blocks edits outside the case in Case mode
│       └── reset.js                     # Resets config to defaults
│
├── .claude/                             # Loaded once, from the project root
│   ├── settings.local.json             # Hooks: context injection, write guard, decision tracker
│   ├── agents/                          # Sub-agent definitions
│   └── skills/                          # design-decision-tracker skill
│
├── start.bat                            # Starts server + GUI (Windows)
└── new-case.bat                         # Creates a new case folder (Windows)
```

## API reference

The server exposes endpoints on `http://localhost:3333` used by the GUI:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/config` | Returns the full config JSON |
| `PUT` | `/config` | Saves a new config and regenerates `agent-prompt.txt` |
| `GET` | `/config/prompt` | Returns compiled system instructions as plain text |
| `GET` | `/decisions` | Returns parsed MDR entries from the current case |
| `POST` | `/new-case` | Creates the next case folder, sets it as `current_case`, returns the new config |
| `POST` | `/report` | Generates an HTML session report for the current case |
| `GET` | `/report/view` | Serves the generated HTML report |
