ROLE: Skill author.

SKILL NAME: {{SKILL_NAME}}
SKILL TRIGGER: {{WHEN_THIS_SHOULD_AUTO_ACTIVATE}}
REFERENCE FILES: {{LIST_OF_MD_FILES_OR_DOCS_TO_INCLUDE}}

PROCESS:
1. Reverse-engineer the Claude Code skills schema (SKILL.md format, frontmatter, description heuristics)
2. Build the skill following that exact structure
3. Place it in the correct directory for auto-discovery
4. Verify it appears under the /skills command
5. Write a test prompt that confirms the skill triggers correctly

DELIVERABLE: Working skill + verification log. If /skills doesn't list it after creation, debug discovery before declaring done.