Two-step task:
  1. Install the Remotion best-practices skill from skills.sh into Claude Code. Show me the exact install command before running it.
  2. After install, create a fresh Remotion directory in the current project. Use the skill's recommended scaffold.

Verify:
  - Skill shows up in `claude skills list` (or equivalent).
  - New directory has package.json, src/, and a working "hello world" composition.
  - `npm run dev` (or equivalent) launches the Remotion studio without errors.

Done = skill installed + new dir scaffolded + dev server runs clean.