# D2 — Hardcoded / Fake / Placeholder Data Inventory (Aug 23, 2026)

Classification: **FAKE** = user-visible fabricated data · **FALLBACK** = acceptable
degradation but misleading · **LEGIT** = intentional (anonymization etc.)

## Backend

| # | Location | What | Class | Impact |
|---|---|---|---|---|
| 1 | user.routes.js:798-803 | `subjectWise` fallback: 4 hardcoded subjects (Quantitative Aptitude / Reasoning / English / General Awareness) with emoji icons, accuracy 0, attempted 0 | FALLBACK | Every user without completed attempts (or on SQL failure) sees fake subject rows in analytics; Dashboard "strong/weak subjects" derives from them |
| 2 | liveMock.routes.js:98-100 | `save-answer` route — returns `{success:true}`, no DB write | FAKE | Live-test answers silently discarded |
| 3 | liveMock.routes.js:103-110 | `live-rank` fallback `{rank:1, totalParticipants:1}` | FAKE | Every user gets rank #1 on live tests when `live_rankings` empty |
| 4 | SubscriptionService.js:16 | `SUBSCRIPTION_PLANS` hardcoded constant (Free/Pro Monthly ₹99/Pro Yearly ₹199 etc.) | FALLBACK | Used only when `subscription_plans` table empty; diverges from DB/admin-managed plans |
| 5 | payments.js:183-194 | Mock Razorpay order `order_${Date.now()}` in non-prod | LEGIT (test) | Non-prod only; but paired with fake client signature (see #7) it masks that real flow is untested |
| 6 | payments.js:254-258 | Verify bypass for mock orders | LEGIT (test) | Same as #5 |
| 7 | Pass.jsx:239-245 (frontend) | Fabricated `razorpay_payment_id = pay_${Date.now()}_${userId}` and `razorpay_signature = sig_sandbox_${Date.now()}` sent to `/verify` | FAKE | In production with real keys this guarantees verify failure — purchase impossible |
| 8 | Pass.jsx:21-89 (frontend) | DEFAULT_PLANS hardcoded (Free ₹0 / Pro Monthly ₹99 orig ₹399 / Pro Yearly ₹199 orig ₹599) | FALLBACK | Plans page never reflects `subscription_plans` DB; pricing edits invisible to users |
| 9 | leaderboards-public.js:53 | `displayName = Student #${index+1}` anonymization | LEGIT | Intentional PII protection (SEC-08) |
| 10 | user.routes.js:755 | `title: result.testTitle \|\| \`Test ${index + 1}\`` | FALLBACK | Recent-tests list shows "Test 1..5" when title missing |

## Frontend (other)

| # | Location | What | Class | Impact |
|---|---|---|---|---|
| 11 | TestInstructions.jsx:264-270 | Countdown start logic — verify if hardcoded duration fallback exists (checked: uses test.duration from API) | — | OK |
| 12 | TestsManager.jsx:32-46 (admin-panel) | 'live-tests' category tab metadata (label/icon only) | LEGIT | UI metadata, not data |

## Notes

- D2 sweeps of `practice.js`, `intelligence.js`, `series.js`, `questions.js`,
  `test.routes.js`, `admin-*` routers found **no additional hardcoded user-facing data**
  (all read live tables).
- `db_live_inventory.txt` (repo root) is a **failed-run log**, not an inventory —
  remove or regenerate with a working `pg` script.