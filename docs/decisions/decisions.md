# Decision Log

This file is maintained by the design-decision-tracker agent.
Each entry follows the MDR (Micro Decision Record) format.

<!-- MDRs appended below this line -->

## MDR-001: Single-file HTML architecture for vissla-spel
**Nature**:   AUTONOMOUS
**Domain**:   Technical architecture, Infrastructure & dependencies
**Scope**:    Modular
**Reversibility**: Moderate
**What was decided**:
The whistling game was implemented as a single self-contained HTML file rather than a multi-file project with separate CSS, JS, and asset files.
**Context in agent output**:
Task 1 — creation of vissla-spel.html described as a "single HTML file."
**Alternatives not considered (or not presented to user)**:
- Separate HTML/CSS/JS files in a small project folder
- A simple React or Vue component-based structure
- An existing game framework (e.g., Phaser.js)
**Future constraints**:
All future feature additions must be made inside a single file, which limits maintainability as complexity grows. Extracting code later requires restructuring the entire file.
**User consulted**: No
**User input**: N/A
**Escalation status**: FLAGGED

---

## MDR-002: Web Audio API chosen for microphone and whistle detection
**Nature**:   DERIVED
**Domain**:   Technical architecture, Functional scope
**Scope**:    Modular
**Reversibility**: Moderate
**What was decided**:
The Web Audio API (native browser API) was selected as the mechanism for capturing microphone input and performing frequency analysis to detect whistling, with no third-party audio library.
**Context in agent output**:
Task 1 — "Web Audio API for microphone/whistle detection."
**Alternatives not considered (or not presented to user)**:
- Tone.js or other audio libraries for higher-level pitch detection
- An external pitch-detection library (e.g., pitchfinder, ml5.js)
- Pre-recorded sound matching instead of live mic input
**Future constraints**:
Behaviour is tied to browser support for Web Audio API and `getUserMedia`; cross-browser quirks and iOS Safari restrictions may require workarounds later.
**User consulted**: No
**User input**: N/A
**Escalation status**: LOGGED

---

## MDR-003: Whistle detection frequency range set to 700–4500 Hz
**Nature**:   AUTONOMOUS
**Domain**:   Functional scope, Interaction design
**Scope**:    Local
**Reversibility**: Easy
**What was decided**:
The agent defined the detection window for whistling as 700–4500 Hz, excluding sounds outside this range from triggering flight.
**Context in agent output**:
Task 1 — "Frequency range 700–4500 Hz used to detect whistling."
**Alternatives not considered (or not presented to user)**:
- Narrower range (e.g., 1000–3000 Hz) to reduce false positives from ambient noise
- Configurable sensitivity/range via an in-game settings control
- A machine-learning-based whistle classifier
**Future constraints**:
Children or players with atypical whistle frequencies outside this range may not trigger the mechanic reliably; tuning will require revisiting this constant.
**User consulted**: No
**User input**: N/A
**Escalation status**: LOGGED

---

## MDR-004: Fallback controls (spacebar and touch) added alongside microphone input
**Nature**:   AUTONOMOUS
**Domain**:   Interaction design, Functional scope
**Scope**:    Local
**Reversibility**: Easy
**What was decided**:
Spacebar and touch input were added as fallback controls to allow play when microphone access is unavailable or denied.
**Context in agent output**:
Task 1 — "Fallback controls: spacebar and touch for when mic is unavailable."
**Alternatives not considered (or not presented to user)**:
- No fallback, with a clear error message asking the user to grant mic permission
- A single fallback (touch only, targeting mobile-first children's use)
- A dedicated "practice mode" with keyboard-only play
**Future constraints**:
Having two parallel input paths means any future interaction changes (e.g., variable whistle strength) must be mirrored or explicitly scoped to the mic path only.
**User consulted**: No
**User input**: N/A
**Escalation status**: LOGGED

---

## MDR-005: Flappy-Bird-style mechanic chosen for game interaction
**Nature**:   EXPLICIT
**Domain**:   Interaction design, Functional scope
**Scope**:    Global
**Reversibility**: Difficult
**What was decided**:
The core game mechanic was implemented as a Flappy-Bird clone: continuous gravity pulls the player down, and whistle input provides upward thrust to navigate through rings.
**Context in agent output**:
Task 1 — "Flappy-Bird-style mechanic: whistle to fly up, gravity pulls down."
**Alternatives not considered (or not presented to user)**:
- N/A (user explicitly requested this mechanic)
**Future constraints**:
The entire scoring, difficulty progression, and input design is built around this single mechanic; introducing a fundamentally different play mode would require major rework.
**User consulted**: Yes
**User input**: "Flappy-Bird-style mechanic: whistle to fly up, gravity pulls down"
**Escalation status**: LOGGED

---

## MDR-006: Background color scheme changed from blue/green to pink
**Nature**:   EXPLICIT
**Domain**:   Visual / aesthetic
**Scope**:    Local
**Reversibility**: Easy
**What was decided**:
The sky/ground gradient was changed from a blue-sky and green-ground palette (`#87CEEB` → `#90EE90`) to an all-pink palette (`#FFB6C1` → `#FF8FAB`).
**Context in agent output**:
Task 2 — explicit color replacement values provided by the user.
**Alternatives not considered (or not presented to user)**:
- N/A (user explicitly specified the target color scheme)
**Future constraints**:
Other visual elements (rings, bird/player sprite, UI text) were not updated to match the new pink palette; visual coherence may require follow-up styling changes.
**User consulted**: Yes
**User input**: Change background color scheme from blue/green to pink, with specific gradient values provided.
**Escalation status**: LOGGED
