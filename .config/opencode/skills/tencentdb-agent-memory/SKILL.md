---
name: tencentdb-agent-memory
description: Install, configure, and validate the TencentDB agent memory plugin for OpenClaw. Provides sustainable local long-term memory (L0→L1→L2→L3) without external hosting.
---
# TencentDB Agent Memory

Install, configure, and validate the `@tencentdb-agent-memory/memory-tencentdb` plugin for OpenClaw. Provides sustainable local long-term memory (L0→L1→L2→L3) without external hosting.

## Purpose

Provide OpenClaw with sustainable local long-term memory capability (L0→L1→L2→L3) without relying on external hosted memory services. Completes a one-stop closed loop from installation, configuration to acceptance.

## Applicable Scenarios

- User requests to install or enable `memory-tencentdb` in OpenClaw
- User needs to configure recall, extraction, profiling, cleanup, etc.
- User reports "plugin installed but no memory / no recall / no vector search"

## Not Applicable Scenarios

- User only needs to explain memory concepts without actual implementation
- User targets non-OpenClaw host framework (confirm target framework first)

## Standard Workflow

### 1) Environment Pre-check

Confirm base version meets requirements:

- OpenClaw: `>= 2026.3.13`
- Node.js: `>= 22.16.0`

Execute:

```bash
openclaw --version
node -v
```

If version doesn't meet requirements, upgrade first and then continue.

### 2) Install Plugin

Execute installation command:

```bash
openclaw plugins install @tencentdb-agent-memory/memory-tencentdb
```

If already installed, execute update:

```bash
openclaw plugins update memory-tencentdb
```

### 3) Write Minimal Configuration

Edit `~/.openclaw/openclaw.json`, ensure it exists:

```json
{
  "memory-tencentdb": {
    "enabled": true
  }
}
```

Note: This plugin supports zero-configuration startup; can run basic capabilities without additional fields.

### 4) Optionally Add Recommended Configuration (Production Common)

Based on user needs, supplement the following groups:

- `capture`: Conversation capture and retention policy
- `extraction`: L1 extraction and deduplication
- `pipeline`: L1→L2→L3 scheduling
- `recall`: Recall quantity, threshold, strategy
- `persona`: Scene and profiling trigger parameters
- `embedding`: Vector retrieval configuration (remote OpenAI-compatible)

Recommended template:

```json
{
  "memory-tencentdb": {
    "capture": {
      "enabled": true,
      "excludeAgents": [],
      "l0l1RetentionDays": 90,
      "cleanTime": "03:00"
    },
    "extraction": {
      "enabled": true,
      "enableDedup": true,
      "maxMemoriesPerSession": 10,
      "model": "provider/model"
    },
    "pipeline": {
      "everyNConversations": 5,
      "enableWarmup": true,
      "l1IdleTimeoutSeconds": 600,
      "l2DelayAfterL1Seconds": 10,
      "l2MinIntervalSeconds": 900,
      "l2MaxIntervalSeconds": 3600,
      "sessionActiveWindowHours": 24
    },
    "recall": {
      "enabled": true,
      "maxResults": 5,
      "scoreThreshold": 0.3,
      "strategy": "hybrid"
    },
    "persona": {
      "triggerEveryN": 50,
      "maxScenes": 15,
      "backupCount": 3,
      "sceneBackupCount": 10,
      "model": "provider/model"
    },
    "embedding": {
      "enabled": true,
      "provider": "openai",
      "baseUrl": "https://api.openai.com/v1",
      "apiKey": "${EMBEDDING_API_KEY}",
      "model": "text-embedding-3-small",
      "dimensions": 1536,
      "conflictRecallTopK": 5
    }
  }
}
```

### 5) Critical Configuration Rules (Avoid Hidden Failures)

- `embedding.provider = "none"`: Vector capability disables, retains only keyword path.
- If configuring remote `provider` (e.g. `openai` / `deepseek`), must simultaneously provide:
  - `apiKey`
  - `baseUrl`
  - `model`
  - `dimensions`
- Any missing above: plugin continues running but degrades to non-vector mode automatically.
- `l0l1RetentionDays`:
  - `0`: No cleanup
  - Non-`0`: Recommended `>=3`
  - If set to `1~2`, must explicitly enable `allowAggressiveCleanup`

### 6) Restart and Verify

Execute:

```bash
openclaw gateway restart
```

Check items:

- Gateway logs show `[memory-tdai]` prefix
- Data directory created: `~/.openclaw/state/memory-tdai/`
- Contains at least: `conversations/`/`records/`/`scene_blocks/`/`vectors.db`

### 7) Functional Smoke Test

Execute one minimal conversation loop and verify:

1. 2~3 consecutive conversation rounds, provide memorable information (preferences, constraints, background).
2. Start a new conversation round, observe if recall context injection appears.
3. In Agent call:
   - `tdai_memory_search`
   - `tdai_conversation_search`
4. Confirm can retrieve just-generated content.

## Fault Troubleshooting Quick Reference

- No plugin logs: Check `openclaw.json` has `memory-tencentdb.enabled` as `true`, and confirm gateway restarted.
- Has records but no recall: Check `recall.enabled`, `scoreThreshold` possibly too high.
- No vector results: Check `embedding` quartet (`apiKey/baseUrl/model/dimensions`) is complete.
- Over-aggressive cleanup causing less history: Check `l0l1RetentionDays` with `allowAggressiveCleanup`.
- Configuration changed but behavior unchanged: Confirm modification is in `~/.openclaw/openclaw.json`, and restart gateway again.

## Security & Compliance Constraints

- Treat `apiKey` as sensitive information; do not spread in chats, logs, screenshots.
- Prioritize environment variable injection of keys; config examples only retain placeholders.
- Only modify `memory-tencentdb` config segment, avoid overwriting other plugins' configurations.

## Definition of Done (Completion Criteria)

Must simultaneously satisfy before ending task:

- Plugin install/update command executed successfully
- `openclaw.json` exists with valid `memory-tencentdb` configuration
- Gateway restarted
- `[memory-tdai]` log visible
- Data directory and key files created
- At least 1 retrieval tool call successfully returns results

## Delivery Phrase Template

After completion, output to user:

- `memory-tencentdb` installation and configuration completed, and gateway restarted.
- Logs and data directory verified, memory chain available.
- If next-step optimization needed, can continue tuning `recall.scoreThreshold`, `pipeline.everyNConversations`, `persona.triggerEveryN` & `embedding` model parameters.