# D2 — Hardcoded / Fake / Placeholder Data Inventory (re-verified 2026-09-06)

Supersedes the Aug-23-2026 pass. Spot-checked against live code today; the Aug-23
findings are largely FIXED. Classification: **FIXED** = removed/wired to live data ·
**FAKE** = user-visible fabricated data · **FALLBACK** = acceptable degradation ·
**LEGIT** = intentional (test-only, anonymization, UI metadata).

Regen: `grep -rn "DEFAULT_PLANS\|pay_\${Date.now()}\|rank:1" apps/frontend/src apps/backend/src` (expect zero hits outside the sandbox branch noted in #7).

## Backend

| #   | Location                                    | What                                                    | Status 2026-09-06                        | Impact                                                                                                                                                |
| --- | ------------------------------------------- | ------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `modules/users/user.routes.js:978-1034`     | `subjectWise` analytics                                 | ✅ FIXED (was FALLBACK)                  | Live SQL join across `attempts → questions → subjects` now computes per-subject attempted/correct; on SQL failure returns `[]` — no fake subject rows |
| 2   | `modules/live/liveMock.routes.js:129-142`   | `save-answer` route                                     | ✅ FIXED (was FAKE)                      | Delegates to `liveMockService.saveAnswer` which persists to `attempts`; no longer a `{success:true}` stub                                             |
| 3   | `modules/live/liveMock.routes.js:145-163`   | `live-rank`                                             | ✅ FIXED (was FAKE)                      | Returns real computed rank from completed results; 404 until a completed result exists — no more hard `rank:1/total:1`                                |
| 4   | `services/SubscriptionService.js:30-33`     | `SUBSCRIPTION_PLANS` constant                           | LEGIT enum (reclassified — was FALLBACK) | Now plan-id keys only (`pro_pass_monthly/yearly`); prices come from `subscription_plans` DB (`:246`); no price divergence possible                    |
| 5   | `api/routes/payments.js:354-355`            | Mock order `order_mock_*`                               | LEGIT test-only (keep)                   | Gated `NODE_ENV !== "production"`; never reachable in prod                                                                                            |
| 6   | `api/routes/payments.js:441-442`            | Verify bypass for mock orders                           | LEGIT test-only (keep)                   | Same gate as #5; real orders always go through HMAC verification                                                                                      |
| 7   | `pages/public/Pass.jsx:263-276`             | Fabricated `razorpay_payment_id` / `razorpay_signature` | Narrowed to sandbox FALLBACK (was FAKE)  | Only when `isMock \|\| !keyId \|\| keyId includes mock/sandbox`; real path uses the Razorpay Checkout response (`:278-336`, script `:202`)            |
| 8   | `pages/public/Pass.jsx:117-152`             | Plans display                                           | ✅ FIXED (was FALLBACK)                  | Zero `DEFAULT_PLANS` hits in the file; plans fetched from `GET /api/subscriptions/plans`, empty state on failure — admin pricing edits reach users    |
| 9   | `api/routes/leaderboards-public.js:61`      | `displayName = Student #${index+1}` anonymization       | LEGIT (keep)                             | Intentional PII protection                                                                                                                            |
| 10  | `modules/users/user.routes.js` recent-tests | `title: result.testTitle \|\| \`Test ${index+1}\``      | FALLBACK (keep)                          | Cosmetic label only when title missing                                                                                                                |

## Frontend (other)

| #   | Location                           | What                               | Status 2026-09-06 | Impact                                               |
| --- | ---------------------------------- | ---------------------------------- | ----------------- | ---------------------------------------------------- |
| 11  | `pages/tests/TestInstructions.jsx` | Duration source                    | OK                | Uses `test.duration` from API; no hardcoded fallback |
| 12  | `admin-panel/.../TestsManager.jsx` | `live-tests` category tab metadata | LEGIT (keep)      | Label/icon UI metadata, not data                     |

## Notes

- D2 sweeps of `practice.js`, `intelligence.js`, `series.js`, `questions.js`, `attempt.routes.js`, `admin-*` routers found **no additional hardcoded user-facing data** (all read live tables).
- If `db_live_inventory.txt` still exists at repo root, treat it as a failed-run log (`ERR_MODULE_NOT_FOUND: Cannot find package 'pg'`) — regenerate with a working script, do not cite row counts from it.
