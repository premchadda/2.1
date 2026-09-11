# FortSpy Flask bridge

The PyPI `fortspy` package is a library/CLI with **no HTTP server**.
This tiny Flask app exposes exactly the endpoints the Node backend
(`apps/backend/src/services/fortspyService.js`) expects, backed by the
real `fortspy` pixel-level AES engine.

## Run

```bat
REM inside the repo venv (fortspy + flask already installed there)
.venv\Scripts\python.exe fortspy-server\app.py
REM optional: PORT=5002 FORTSPY_STORE=./fortspy-server/store
```

Then point the backend at it:

```env
FORTSPY_URL=http://localhost:5002
```

Verify: `GET /api/fortspy/health` → `{ available: true }`.

## End-to-end (admin)

1. `POST /api/fortspy/keygen` → copy `key` (64-char hex, AES-256).
2. `POST /api/fortspy/encrypt` (multipart `file`, form field `key`)
   → copy `id` (e.g. `f84963d12bea4152`).
3. Admin panel → study-materials → Videos → edit video →
   FortSpy Encryption → paste ID + key → save.
4. Watch as an entitled user (admin / active subscription / enrollment).
   The player auto-selects FortSpy; the key never leaves the server —
   `generate-stream-token` resolves it from `subject_videos.fortspy_key`.

## Self-test

`scripts/fortspy-bridge-test.tmp.py` (temporary, deleted after a green run)
covers keygen → encrypt → info → MJPEG stream against an isolated store.
Last green run: `ALL_PASS` (10-frame clip, JPEG frames verified).
