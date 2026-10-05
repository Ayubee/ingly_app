# Admin real-data audit and repair — Dashboard + Finance

## 1. Executive summary

Audited the current repository before edits. The two shipped applications are `admin/index.html` and `admin/preview.html`; Vite builds these HTML entrypoints, not `src/main.jsx`. A separate React implementation also exists under `admin/src/`. Both shipped dashboards contained literal demo statistics. The React dashboard imported `mockStats`. The shipped Finance tab already read a persisted JSON array from `app_settings.transactions_data`; individual deployed records were not inspected and must not be declared fake merely from names or amounts. Its accounting, persistence confirmations and deletion model were incomplete. The React monetization page was local UI only.

Implemented shared real-data panels, authorized aggregate/configuration RPCs, and a small finance ledger. Existing product settings remain the monetization source. No fake fallback records are inserted. Missing migrations/permissions/network produce unavailable states, not fabricated metrics. Existing legacy finance JSON is preserved in the database and explicitly excluded pending provenance review. No Supabase migration, production write, deployment, commit or push was performed by this agent.

## 2. Dashboard before — source classification

Classification: **A** real and correct; **B** real but incorrect/incomplete; **C** mock/hardcoded/demo; **D** UI only/not implemented.

| Visible function | Shipped index + preview source | React source | Classification and finding |
| --- | --- | --- | --- |
| DAU | Literal `3,240` | `mockStats.activeToday` | C; no activity query |
| Total users | Literal `14,850` | `mockStats.totalUsers` | C; independent of authenticated user population |
| Weekly growth | Literal `+14.2%` | `mockStats.userGrowthPct` and other fixed growth percentages | C; no period comparison |
| Mastered words | Literal `184,520` | `mockStats.wordsLearned` | C; no canonical progress counting |
| Streak users | Literal `2,890` | `mockStats.streakChampions=412`, labeled 10+ days | C; unrelated definitions/values |
| Book titles/counts | Six literal objects, 600 words/30 units | Static copy and `mockStats.booksProgress` | Counts verified against bundle, but copy incorrectly said total 4,000; progress percentages and active learner counts C |
| Book availability | Book 1 ready, later books pending in unused object fields | Demo progress grid | C; bundle actually contains all six books |
| Free/paid state | Browser caches and `freeBookIds`, ignoring disabled VIP in cards | Mock feature flags | B in HTML, C/D in React; server app_settings does exist |
| Monetization switches | Existing app_settings writes, local optimistic state, duplicate REST+SDK requests, ignored error results | `handleSave` only displays saved state | B in HTML, D in React |
| System/marketing claims | Cinema and 4,000 words; header always free/ad-free | Every word has a movie, 15–20 MB, all-free/ads-disabled assertions | C or unsupported claims; removed from dashboard |
| Navigation/header badges | Fixed admin email/initial | 14.8k users, OFF monetization, DB connection and full-rights badges | C/D; operational assertions removed |

Real architecture retained: Supabase Auth admin gate, live database permission checks, verified account-management Edge Function, actual bundled course data, app_settings configuration, and Phase 3 server progress entities/receipts. No working user-management or content-editing path was replaced.

## 3. Dashboard after — exact sources/formulas

`admin_dashboard_snapshot()` returns aggregates only after `auth.uid()` and `ingly_private.has_permission('view_analytics')` or its compatible `view_stats` alias succeed. It returns no learner names, contacts or user lists.

- **Population / total users:** retained application profiles joined to `auth.users` with `users.id=users.auth_user_id=auth.users.id`. Admin-linked identities are excluded. Blocked learner profiles remain registered users; deleted and unlinked legacy identities are excluded. This is the current retained learner population, not every Auth identity or a historical deletion ledger.
- **DAU:** unique population identities with a recorded `admin_learning_days.activity_day` equal to today's `Asia/Tashkent` date. A new successful Phase 3 patch receipt with a learning snapshot/word-practice change and a valid `learning.lastActiveDate` records one account/day. Reset receipts do not create activity. The primary key deduplicates multiple operations and receipt replays. Dates come from authenticated, account-owned client learning snapshots; these are not anti-cheat telemetry. App opening, preference-only operations without learning, and custom-word creation alone do not qualify. Unsynced offline activity is absent until synchronization. Only the snapshot's latest reported activity day is available, so compacted multi-day history cannot be reconstructed. No historical receipts are backfilled. Tracking start is shown; zero means no qualifying synchronized activity, not proof that nobody learned offline.
- **Day boundary:** server current day uses `now() AT TIME ZONE 'Asia/Tashkent'`. Calendar boundaries are midnight in Uzbekistan, not UTC midnight/05:00 local. Phase 3's client policy remains UTC+5 and unchanged.
- **Weekly growth:** current calendar day plus preceding six days versus the preceding seven days, using `auth.users.created_at` for the retained population. `(current - previous) * 100 / previous`, rounded to one decimal. Previous=0 returns null and the UI says insufficient data. A window ends at the following local midnight; it is not seven rolling 24-hour periods. Deleted/unlinked registrations cannot be reconstructed.
- **Mastered words:** unique `(user_id, canonical textbook word_id)` pairs. Phase 3 word entities qualify if `completed=true` or status is `mastered`. A legacy `user_progress.status='mastered'` row is used only if no corresponding sync entity exists. SQL UNION deduplicates mirrors. Canonical catalog membership rejects custom/unknown IDs; client aggregate `totalWordsLearned` is never summed. Reviews do not add another pair. A deliberate progress reset removes current completion; this is current retained completion, not lifetime attempt events.
- **Active streaks:** positive streak in the canonical learning entity and `lastActiveDate` today/yesterday. `device='legacy'` bootstrap and old `CURRENT_DATE` streak rows are excluded because their local-day provenance cannot be proved. This is an honest synchronized subset, not a fabricated historical estimate or the old React 10+ day threshold.
- **Books:** catalog derived from verified current bundle IDs and matching mobile `booksList` titles. Six books, 30 units and 600 entries per book: 180 units / 3,600 entries. All are bundled/available; that does not mean every user's payment/progression gate is open. Per-book learner count means users with at least one completed word in that book, not DAU; mastered pair counts use the same canonical completion CTE.
- **Monetization:** real app_settings keys, read through authorized snapshot RPCs. Free access matches mobile's current rule: VIP disabled OR book in explicit IDs OR book within free_books_count prefix. Missing configuration is visibly unavailable; browser caches are not authoritative. Writes atomically project explicit IDs to their contiguous prefix: `[1,3]` stores count=1, not list length=2 or max ID=3. Existing inconsistent settings are displayed as their current effective access and corrected only when an admin saves a new selection. No settings are seeded or toggled by this migration.

No demo charts or percentages remain in either dashboard. `mockData.js` remains for unrelated demo pages and the user's prior edit is untouched.

## 4. Finance before — source classification

| Function | Source / behavior | Classification |
| --- | --- | --- |
| Transaction rows | Authorized app_settings `transactions_data` JSON array; initial state empty after Phase 2 | B: persisted source exists, origin/environment/status validation absent; deployed rows unverified |
| Income / expenses / net | Browser sums completed type-specific array rows | B: ignores production/test boundary and trusts entire mixed blob |
| Purchase count | Every completed income row | B: manual/non-purchase income counted as sales |
| VIP/book categories | `item_type` from JSON/form; manual income defaulted to VIP | B: real metadata could exist, but not verified purchases |
| Filter counts/search | Same array, type/item_type and name/username/title/method | B: dataset source persisted, but unsafe provenance/accounting boundaries |
| CSV | Exports that array | B: not a hardcoded export, but same mixed source; escaping/formula safety incomplete |
| Add manual entry | Optimistic local prepend then whole-blob upsert; resolves without checking SDK error | B: apparent success could mean nothing persisted; concurrent edits overwritten |
| Delete | Optimistic removal + whole-blob overwrite; no audit history | B: destructive/unconfirmed/inconsistent behavior |
| Edit | No active transaction edit handler | D |
| Trusted purchase ingestion | Mobile mock payment is deliberately local; no verified provider finance path | D for future real ingestion; mock boundary itself is correct and preserved |
| Alternate React Finance | No route/page existed | D; added thin route to shared real Finance panel |

The example names/items from the request were not present as seeded active finance rows in the current code. No assumption was made that deployed legacy JSON is real or fake. Unknown provenance is why it is not automatically imported.

## 5. Finance after — exact source/formulas

`finance_ledger` is canonical. `admin_finance_snapshot` returns a bounded page, aggregate cards, real filter counts and matched row count from one database statement. Environment defaults to production; test/mock are explicit separate views. Values are whole UZS, amount >0 and <=1,000,000,000,000 per row. Multi-currency/FX accounting is not implemented.

| Item | Rule |
| --- | --- |
| Income | Sum amount where selected environment, type=income, status=completed |
| Expenses | Same, type=expense |
| Net profit | Income minus expenses |
| Purchase count | Completed income with `is_purchase=true` AND `source=verified_provider` |
| Excluded from production totals | Every test/mock row; pending, failed, cancelled, voided records |
| Manual accounting | Explicit environment and completed manual records; never a verified purchase or entitlement |
| Filters | all; income/expense by type; VIP/book by category, over the same selected-environment ledger |
| Filter counts | Real counts across that environment, including visible non-completed/voided history; they are row counts, not revenue/purchases |
| Search | Literal case-insensitive match on title, description, payment method, reference; no user directory or unrelated PII |
| Totals under filtering | Stay environment-wide; search/filter changes the list/matched count, not the financial cards |
| Pagination | 50 rows; stable occurred_at + UUID keyset cursor |
| Export | Entire selected environment/filter/search result in one server snapshot, <=2,000 records. Over limit fails explicitly instead of silently truncating; refine search. UTF-8 BOM, escaped quotes/newlines, spreadsheet-formula neutralization and explicit safe field allowlist |

Ledger stores type/positive amount/currency/category/title/description, optional user/product relationship for trusted purchases, method/reference/date/status/environment/source, creation metadata, original recorded status, and void audit metadata. No card/password/token/merchant-secret columns exist. Manual input is allowlisted and does not accept related-user identity or purchase flags. Browser-facing rows and CSV omit related user and creator identities. Free text is intentional accounting text: do not enter secrets in it.

Create confirms the exact request UUID before success. A stable UUID survives retries while the form is open; uniqueness of source+environment+reference also rejects accidental duplicates after page reload. Changed content reusing an ID/reference is rejected. No optimistic row/total mutation occurs on failure. Refresh after confirmed writes re-queries authoritative data. Observed database/auth errors remain visible; empty returned data is not treated as success.

Financial corrections use void + replacement, not destructive deletion or silent editing. Void locks the row, retains it, stores actor/time/reason and one audit event, and removes it from qualifying totals. Repeating a void does not create another audit record.

## 6. TEST/MOCK payments and future purchases

Mobile payment/Auth/entitlement code is unchanged. No mobile mock transaction is uploaded to this ledger. A manual admin entry is always `source=manual,is_purchase=false` and cannot grant VIP/book rights. Test/mock rows have explicit environment and are excluded from production queries by default; their alternative totals are labeled TEST/MOCK.

`record_verified_finance_purchase` is a future service-role-only ingestion function, not an implemented Click/Payme integration. It accepts settled transactions only, requires a related Auth user and valid product, prefixes references with provider and deduplicates per environment/provider transaction ID. Callers must verify provider signature, amount/product/user and settlement first. Multiple callback event IDs for the same purchase must use the same transaction reference. Conflicting replay content is rejected. A replay after void uses original recorded status and cannot resurrect revenue. No authenticated/anon client execute grant exists; no browser or mobile code invokes this function. It writes finance/audit only and grants no entitlement.

## 7. Security and authorization

- Existing Supabase Auth + trusted live admin permissions remain the authority. Browser role strings/localStorage never grant access.
- Analytics: `view_analytics` or compatible `view_stats`. Configuration read/write: `manage_settings`. Finance read: `view_finance` or `manage_finance`. Finance creation/void: `manage_finance`. Existing super-admin semantics remain.
- The account-management Edge Function change only extends its permitted permission names. Its JWT verification, blocked-profile checks, and super-admin-only role-management boundary remain. Both HTML permission pickers now expose analytics/finance names. No existing role is automatically given new finance permissions.
- New tables have RLS and no anon/authenticated direct grants/policies. Public RPC execution grants are authenticated only, with explicit authorization inside SECURITY DEFINER functions. Definer access is necessary for private aggregates and transactional writes without exposing private tables; all have empty search_path and qualified relations/helpers. The activity trigger runs on already-authorized receipts, with no client callable grant. Provider ingestion additionally checks service-role claims and grants only service_role.
- Old Phase 2/Phase 3 migrations, safe admin Auth helper, mobile Auth, password handling, payment-card boundary and mock entitlement checks are untouched.
- Requests capture session JWT + generation, check verified identity, reject stale A→B→A results and time out after 20 seconds. UI handler generations prevent old rendered data/forms from submitting under a replacement admin. Private panels clear on Auth session events; no new persistent private browser caches exist.

## 8. Offline/sync preservation and request behavior

Mobile source and both completed migrations compare byte-for-byte with the recorded task-start SHA-256 baseline (37 files including the prior mockData edit). Phase 3's durable journal/outbox, exact acknowledgements, session generations, serialized mutations, bounded retry and local startup are unchanged. The new database receipt trigger only records an aggregate activity day transactionally; it does not alter operation IDs, receipts/acks, progress payloads or mobile scheduling. Runtime trigger behavior still needs staging verification.

Admin loads on mount, explicit reload/filter/search submission, confirmed relevant writes and session events. No intervals or ten-second polling were added. Each request uses the existing Auth/role verification plus its aggregate RPC; counts never download private user tables. Course counts are queried in the database, not by shipping another whole vocabulary dataset into the new panel. No production runtime dependency was added. Shared browser UI compilation uses Vite's already-installed esbuild dependency.

## 9. Database inventory and application order

New migration: `backend/migrations/20261006_admin_real_data.sql`. It must follow the Phase 2 baseline and Phase 3 migration; fresh projects also apply it after complete schema.sql + Phase 3. It is a one-time forward migration, not an idempotent re-seed script. No historical migration was edited.

New tables: `admin_course_catalog`, `admin_learning_days`, `admin_analytics_state`, `finance_ledger`, `finance_audit`. New index names: `admin_learning_days_day`, `finance_ledger_date`. PKs/unique constraints provide catalog, day and financial idempotency indexes. No public/client direct table policies are added; RLS denies direct access.

New public functions: `admin_dashboard_snapshot`, `admin_configuration_snapshot`, `admin_update_configuration`, `admin_finance_snapshot`, `admin_create_finance_entry`, `admin_void_finance_entry`, `record_verified_finance_purchase`. New private functions: `track_admin_learning_day`, `validate_finance_input`. New trigger: `admin_learning_day_receipt` AFTER INSERT on learning_sync_receipts. Settings writes use existing admin_audit_logs; finance uses dedicated audit rows.

The bundled catalog is a migration snapshot, verified by tests against all current vocabulary copies and mobile titles. Future content changes must deliberately update that metadata; database words/books are not assumed to match a bundle that is not yet imported. Existing `transactions_data` is not deleted, imported, publicly exposed or replaced.

## 10. UI text and visual scope

Kept existing brand gradients, rounded cards/table/modal and Tailwind tokens. Replaced data-dependent dashboard/finance/monetization content with shared panels rather than redesigning the application layout.

Removed hardcoded totals/growth/progress bars, false pending-book labels, “4,000 words” totals, Cinema marketing, unverified app-size claims, always-free/ad-free assertions, fixed user-count/OFF/DB-online badges and fabricated admin contact/full-rights text. “4000 Essential English Words” can remain as the source publication's proper name, not a claimed app entry count. Uzbek apostrophes, field/status/category/method labels and currency grouping are consistent; example output is `29 000 so‘m`. Manual dates use a native date/time input explicitly labeled Toshkent (+05:00). Delete is now “Hisobdan chiqarish”, with reason and retained status. Export is honestly CSV suitable for Excel, not an XLSX generator.

Existing video configuration remains editable, including the Words-tab control; no Cinema mobile code/dependencies/database removal occurred. Other notification/content/admin demo implementations outside these panels remain separate work.

## 11. Tests and exact results

| Validation | Final result |
| --- | --- |
| `node tests/admin-real-data.cjs` | 28 PASS, 0 FAIL |
| `node tests/security-phase2.cjs` | All 9 reported groups PASS, 0 FAIL |
| `node tests/repair-phase1.cjs` | All assertions PASS, 0 FAIL (suite does not emit a per-assertion count) |
| `node tests/repair-phase3.cjs` | 31 PASS, 0 FAIL |
| JS/JSX/import/relative/named export checks | PASS, included in security suite |
| Generated shared browser UI consistency | PASS, admin suite/build |
| `npm.cmd run build` in admin | PASS, both HTML entrypoints |
| Android offline Expo export | PASS, 663 modules / 3.2 MB Hermes bundle |
| iOS offline Expo export | PASS, 665 modules / 3.2 MB Hermes bundle |
| `git diff --check` | PASS, Windows line-ending notices only |
| Baseline hash comparison | PASS: 37 protected files unchanged |
| PostgreSQL migration/RLS/actual SQL integration | NOT RUN: no PostgreSQL/Docker/Supabase CLI or deployed access used |
| Native physical-device QA and live browser/database flow | NOT RUN |

Local tests execute real shared service/components with injected Auth/RPC/hook harnesses: zero/unavailable states, actual server value rendering, JWT and generation checks, confirmation failures, stable manual IDs, input validation, paging/query boundaries, environment labels, canonical export, UTF-8/formula escaping, privacy and configuration. SQL checks are explicitly static, not fabricated database executions.

`backend/tests/admin_real_data.sql` prepares actual transactional staging assertions for Auth population, DAU receipt replay, canonical mastery/custom exclusion, active streaks, registration windows/growth, book catalog, non-contiguous free-book configuration, income/expense/net/purchase totals, duplicate manual/provider events, unsuccessful/mock exclusions, filters/search, void/audit and authorization/grants. It rolls back fixtures. It is not automatically executed or production-safe verification authorization.

Initial new-suite failures concerned the test renderer's zero-text handling/asynchronous flush and an Array.from false-positive in a static query check; the harness was corrected. A later timing assertion mistook an allowed session refresh for a stale export; it now specifically verifies no export/create from the stale handler. Existing Phase 1–3 assertions were not weakened or edited. A standalone generation command initially used the wrong working-directory path; the normal admin build regenerated the artifact successfully. Final commands above pass.

## 12. Exact file inventory for this task

| Existing file changed | Purpose |
| --- | --- |
| admin/index.html | Shared panels, remove obsolete array finance/optimistic config UI, permission picker, truthful header, retain verified Auth/account paths |
| admin/preview.html | Same repair for second shipped entrypoint |
| admin/package.json | Generate shared browser panel before Vite build |
| admin/src/App.jsx | Alternate React Finance route |
| admin/src/pages/DashboardPage.jsx | Thin shared real-dashboard wrapper |
| admin/src/pages/MonetizationPage.jsx | Thin shared real-configuration wrapper |
| admin/src/components/layout/Sidebar.jsx | Finance navigation; remove fabricated counters/status |
| admin/src/components/layout/Navbar.jsx | Finance title; remove unsupported operational/access assertions |
| backend/supabase/functions/admin-accounts/index.ts | Extend explicit analytics/finance permission-name allowlist only |
| admin/README.md | Current source/build/integration instructions |
| backend/README.md | New migration order and unverified deployment boundary |

| New file | Purpose |
| --- | --- |
| admin/public/real-data.js | Shared verified-session RPC service, validation/access/format/export helpers |
| admin/public/real-data-ui.js | Generated browser artifact for both raw HTML entrypoints |
| admin/scripts/build-real-data.cjs | Compile/check shared UI without new dependency |
| admin/src/components/RealDataPanels.jsx | Shared Dashboard, Finance and Monetization components |
| admin/src/pages/FinancePage.jsx | Alternate React Finance wrapper |
| backend/migrations/20261006_admin_real_data.sql | Protected aggregates/configuration, activity day tracking and auditable ledger |
| backend/tests/admin_real_data.sql | Prepared rollback-only staging integration assertions |
| tests/admin-real-data.cjs | 28 focused local regression cases |
| docs/ADMIN_REAL_DATA_AUDIT_REPAIR.md | This report |

Scope: 11 existing files changed + 9 added, 20 final files. The initial intermediate admin migration filename was changed to 20261006 to place it after the earlier migrations. Final migration is the file above, not the intermediate 20261005_admin_real_data.sql.

## 13. CONFIRMED IN CODE

Shared panels in both shipped and alternate implementations; no operational demo dashboard totals; count-only learner aggregation; canonical unique textbook counting; local timezone definitions; explicit unavailable states; real app_settings reads/confirmed writes; compatible atomic free-book projection; canonical finance queries; production default/test separation; manual-versus-purchase boundary; exact create confirmation; idempotency constraints/logic; void/audit logic; private field allowlists; safe CSV; request/session protection; no added polling; untouched mobile/Phase 2/3 files and passing regression/build/export checks.

These statements describe reviewed code/local tests, not a claim that remote policies/functions have been deployed or validated.

## 14. REQUIRES MANUAL APPROVAL / DEPLOYED VERIFICATION

Skipped only these externally dependent steps; no approval request or external mutation was attempted:

1. Approve and apply the new migration to an isolated staging project after the required baseline. Verify function compilation, ownership, grants, RLS, PostgREST schema cache and transaction rollback. Do not apply the deleted intermediate migration. Existing fresh-schema seeds/policies must be reviewed separately.
2. Run the prepared rollback-only staging assertions with suitable database-owner access. Also test a fresh empty database, previous-week-zero growth, month/year boundaries and Uzbekistan midnight with real timestamps; the local static checks are not runtime timezone validation.
3. Exercise real ordinary-user/anon/editor/moderator/super-admin JWTs via REST. Verify no finance table reads/mutations, no unauthorized aggregates/settings, no forged browser-role authority and no client provider ingestion. Verify permission picker updates persist through the modified Edge Function; its updated allowlist needs an approved deployment before non-super-admin grants can be provisioned through it.
4. Verify actual Phase 3 receipt trigger behavior with dropped responses/replays/reset/partial failures, including atomic progress+receipt+activity rollback. DAU must not change before synchronization, from duplicate receipts or a preference-only operation without learning data.
5. Test concurrent manual submissions/duplicate references, late confirmation, edited retry payloads, voids and provider transaction replays including replay after void. Verify audit preservation and cards/list consistency.
6. Inspect provenance of any existing transactions_data with authorized access. A reviewed, separately authorized import/reconciliation is required to count legitimate historical records; no speculative import was performed.
7. Browser end-to-end checks for both HTML routes and alternate components: loading failures, session changes, keyboard/date input, pagination and Uzbek CSV opened in Excel. Verify the deployed static assets are included; building locally did not deploy them.
8. Physical Android/iOS checks remain necessary to validate old Phase 3 native behavior under slow internet/process termination; no mobile behavior was changed here. Optional pre-existing expo-speech/expo-av packages remain missing and were not installed.

## 15. Remaining limitations and deliberately deferred work

- New panels require the new migration. Until approved rollout, missing RPCs show unavailable and mutations fail visibly. Current remote state was not queried.
- Analytics are synchronized current-state aggregates, not tamper-proof event analytics, complete offline DAU, historical deletions or exact multi-day attempts. Canonical streaks exclude uncertain legacy timezone records. Server snapshot totals are lower bounds while clients are offline.
- Catalog metadata must follow future bundle changes. Long-lived finance/activity tables and aggregate query plans need measured staging performance, indexing/retention decisions when actual volumes justify them.
- One currency (whole UZS); no tax/refunds/reconciliation/FX workflow. Audit corrections use void + replacement. Manual business references are unique per environment; separate operators must not reuse the same reference for unrelated entries.
- Export is CSV, capped at 2,000 matches, not XLSX. Monetary aggregates outside JavaScript safe integer precision fail visibly rather than silently round; broader decimal-money support is deferred.
- The future ingestion helper trusts a service-role server to validate real provider transactions. No provider signatures/callback endpoint/merchant credentials/entitlement issuance were implemented. Real Click/Payme integration remains separate.
- Alternate React Users/Admins/Notifications still have their earlier demo/UI-only behavior; only Dashboard/Finance/monetization and misleading shared operational badges were in scope. Its real panels require the existing trusted Auth helper/session, and fail closed without it.
- No full Cinema cleanup, auth redesign, offline/sync redesign, dependency cleanup, general performance phase, visual redesign, AI Speaking or other product work began.

## 16. Git summary and stop boundary

The working tree was dirty at task start. No git add/commit/push, reset, deployment or external production write was run by this agent. During execution HEAD changed externally to `754a02a5` (“codex Phase 3”), incorporating earlier work and some intermediate admin edits. That state was preserved. Consequently the final git diff against HEAD is a remaining delta, not the full task inventory or a clean Phase 3-only diff. The deleted intermediate admin migration is a rename to the final new migration, not a deletion of a completed Phase 2/3 migration.

Use the exact file inventory above for review; earlier mobile/Auth/payment/admin-mock edits remain preserved. `git diff --check` passes. Stop after this admin audit/repair. No Phase 4, deployment or production migration was started.
