---
name: agent-skills
description: Patterns and conventions for senior software engineers using AI coding agents. Contains workflows for code simplification, debugging, API design, UI engineering, git workflow, TDD, code review, and more.
---
# Agent Skills Knowledge Base

This skill provides access to proven patterns and conventions for AI-assisted development. When working on any project, use this skill to understand which workflow applies to your task.

## When to Use

Use this skill when:
- You need to apply consistent coding patterns across a codebase
- You're unsure which skill applies to your task
- You're working on the agent-skills repository or a project with similar patterns
- You need to understand the lifecycle mapping for feature development, bug fixing, or code review

## Intent → Skill Mapping

| Intent | Skill |
|--------|-------|
| Feature / new functionality | spec-driven-development, then incremental-implementation, test-driven-development |
| Planning / breakdown | planning-and-task-breakdown |
| Bug / failure / unexpected behavior | debugging-and-error-recovery |
| Code review | code-review-and-quality |
| Refactoring / simplification | code-simplification |
| API or interface design | api-and-interface-design |
| UI work | frontend-ui-engineering |
| Authentication/authorization | security-and-hardening |
| Deprecation/migration work | deprecation-and-migration |
| Documentation updates | documentation-and-adr |
| Idea exploration/refinement | idea-refine |
| Shipping/launch preparation | shipping-and-launch |
| Test strategy design | test-driven-development |

## Lifecycle Mapping

Follow this implicit lifecycle for all development tasks:

1. **DEFINE** → Use spec-driven-development to clarify requirements
2. **PLAN** → Use planning-and-task-breakdown to break down the work
3. **BUILD** → Use incremental-implementation + test-driven-development
4. **VERIFY** → Use debugging-and-error-recovery to fix issues
5. **REVIEW** → Use code-review-and-quality for code reviews
6. **SHIP** → Use shipping-and-launch for release preparation

## Repository Structure

The agent-skills repo organizes skills in `skills/<kebab-case-name>/SKILL.md` with YAML frontmatter (`name`, `description`). Each skill follows the section anatomy:
- Overview
- When to Use
- The Process (Step 1-4)
- Common Rationalizations
- Red Flags
- Verification

## Cross-Project Usage

This skill is designed to be project-agnostic. When working on any project:
1. Import the relevant skill using the skill tool
2. Follow the skill's workflow exactly
3. Adapt conventions to match the host project's style
4. Reference the skill's patterns for consistency

The skills in this repository are model-agnostic and work with any AI coding agent (Claude Code, OpenCode, Cursor, etc.).