# Agent Behavior Contract

This project uses a hook-based control system. At the start of each prompt,
behavioral instructions are injected automatically as [KONTROLLPANEL] context.
Apply those instructions directly — no file reading needed.

## Fallback (if [KONTROLLPANEL] context is absent)

Read the configuration file:

    control/config/agent-prompt.txt

If that file is also missing, apply these defaults:
- Implement only what is explicitly requested
- Ask before deviating from instructions
- Provide a brief summary after completing work
- ethics: 3 (standard professional practice)
