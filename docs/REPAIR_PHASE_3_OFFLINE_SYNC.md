# Repair Phase 3: offline startup and reliable account-safe synchronization

Date: 2026-10-05, Asia/Tashkent. Repository: `D:\inglyJon`.

## 1. Executive summary

Implemented local-first learning with a durable account journal, atomic progress/outbox commits, exact operation acknowledgements, session generations, event-driven synchronization and bounded retries. Supabase Auth, auth.uid(), Phase 2 RLS/admin restrictions and the mock-payment boundary remain in place. No migration, production change, deployment, commit or push was performed.

Local validation passes, including Android/iOS JavaScript/Hermes exports. Database runtime and physical-device behavior remain unverified. The new app's server sync requires the supplied migration; until it is applied, local learning works and rejected operations remain queued.

## 2. Architecture before → after

The **working repository at phase entry**, including uncommitted Phase 2 work, was the baseline. Git HEAD predates some repairs; its diff also contains earlier work and a pre-existing user edit in `admin/src/services/mockData.js`.

| Area | Confirmed before Phase 3 | Implemented now |
| --- | --- | --- |
| Startup | Awaited SDK getSession before rendering cached progress; SDK initialization can await token refresh | Read valid, unexpired SDK-persisted session locally, render owned cached progress, validate/refresh in background |
| Learning | Flashcard word ID was ignored; counters saved in profile; every save launched a remote profile update | Word-ID-aware local transaction commits word, aggregate and outbox before UI advances |
| Local writes | Independent read/modify/write operations could lose concurrent changes | One serialized journal per account, paged storage with an atomic manifest |
| Queue | Latest entry per word; acknowledgement deleted by word ID | Immutable device/sequence operation identity; exact ID/sequence acknowledgement |
| RPC failure | Existing Phase 2 engine already retained queue on reported RPC error | Retains queue on RPC errors, missing/partial/invented acknowledgement, auth failure, timeout and generation change |
| Account safety | Private keys already account-scoped, and A→B checks existed | Generation changes cover logout, A→B→A and replacement tokens for the same account |
| Processor | Mutex set only after queue/session awaits | Mutex acquired before any await |
| Scheduling | Dormant 25-second interval API, with no current application caller found | App now connects mutation, native connection, foreground and session events; no progress polling interval |
| Server | Timestamp-dependent progress upsert and replayable activity increments | New transaction-bound receipts, owned entities, per-device/entity sequence checkpoints, server revisions and reset epochs |

```text
User action → local reducer → new immutable outbox operation
           → write small journal pages → atomic manifest commit → UI update
           → event schedules background batch → authenticated RPC
           → validate exact acknowledgements → durable queue acknowledgement
```

## 3. Files changed in this phase

| Files | Purpose |
| --- | --- |
| `mobile/src/services/storage.js` | Serialized account journal, pages/manifest, migration, reducers, durable outbox, exact acknowledgements, generation checks |
| `mobile/src/services/syncEngine.js` | Single processor, captured JWT, bounded requests/batches, retry classification, events and status API |
| New `mobile/src/services/syncConflict.js` | Pending-safe server merge, monotonic completion/aggregates, reset conflict handling |
| New `mobile/src/services/networkEvents.js` | NetInfo connection events and AppState lifecycle subscriptions |
| New `mobile/src/services/sessionCache.js` | Read valid persisted SDK session without waiting for SDK network initialization |
| `mobile/src/context/UserContext.js` | Local-first startup, durable learning/profile/lesson/quiz/reset routes, server validation, safe local UI publication |
| `mobile/src/screens/FlashcardScreen.js`, `QuizScreen.js` | Await durable saves, prevent competing submissions, report save failures, guard delayed UI work |
| `mobile/src/screens/MyWordsScreen.js`, `HomeScreen.js`, `LeaderboardScreen.js` | Capture session before asynchronous operations and prevent stale private reads/writes |
| `mobile/src/screens/LearnScreen.js`, `ProfileScreen.js` | Await durable lesson/reset changes, guard confirmation callbacks, display actual per-book/unit completion and handle preference save failure |
| `mobile/src/services/wordsData.js` | Immediate bundled lesson content, owned progress reads, monotonic completion reporting |
| `mobile/src/services/translatorService.js` | Bounded account translation cache, offline cache hits, timeout for fallback request |
| `mobile/src/services/leaderboardService.js`, `appSettingsService.js`, `userService.js` | Generation-bound private cache/profile paths; preserve existing security/public-settings behavior |
| `mobile/package.json`, `package-lock.json` | Add only NetInfo 12.0.1; npm also reconciled the lockfile's stale root version to existing package version 1.4.0 |
| New `backend/migrations/20261005_repair_phase3_offline_sync.sql`, `backend/README.md` | Separate server migration and rollout instructions |
| New `tests/repair-phase3.cjs`; existing `tests/security-phase2.cjs`, `tests/repair-phase1.cjs` | New behavioral regressions; update mocks for generations/journal without removing prior security assertions |
| This document | Architecture, validation and remaining risks |

Phase 3 touches 20 existing files and adds 6 files, including this report. Earlier dirty files remain; admin application, Auth service, payments and Cinema were not redesigned.

## 4. Startup behavior before → after

Startup reads `ingly_supabase_auth_v2`, the SDK's existing opaque persisted session key. A session must have a user ID, nonempty access/refresh tokens and an unexpired numeric `expires_at`. A profile cache alone never restores login. No token is invented or installed into the SDK. The app reads that account's local journal and can render bundled lessons immediately, even if SDK initialization or remote profile validation is stalled.

SDK session restoration/refresh and explicit own-profile validation continue in the background. Server requests obtain the SDK session, check matching owner and generation, and use its captured access token. The server validates authorization through Supabase Auth, auth.uid(), active-account checks and RLS. Cached premium/purchased flags cannot grant entitlement, including after local learning or server snapshot events. Only the trusted profile response updates these flags; production mock payments remain disabled.

With no valid cached session, the local loading screen ends and the existing Auth screen renders while SDK restoration runs. An expired cached session does not unlock offline login on a cold start. A cached session is local UI continuity, not proof of current server authorization or revocation status. A confirmed missing/mismatched/blocked remote profile detaches the account and signs out locally. Temporary backend failure preserves the locally restored session instead of blocking content.

## 5. Outbox design

The journal holds `{schema, owner, device, sequence, epoch, values, outbox, cursor}`. Each operation holds `id`, `owner`, `device`, `sequence`, `epoch`, `action`, `changes`, optional `next_epoch`, `created_at`, `attempts` and `last_attempt_at`. IDs use a persisted random device identifier plus a monotonically increasing local sequence. These IDs are uniqueness labels, not security credentials.

Changes contain bounded entity snapshots: `word:<id>`, `custom:<id>`, `learning`, `lesson` or `preferences`. Payloads for different entities can share one operation. Word reviews carry the resulting review count, rather than a replayable increment. Custom deletion is a tombstone. App termination after remote commit but before local acknowledgement replays the same operation ID, allowing the server receipt to acknowledge it without applying it again.

Only the last unattempted patch in the same epoch can compact with a new mutation. Compaction has at most 24 distinct entity keys and a 24,000-character payload target; it **replaces the old operation with a new ID and sequence**. Attempted operations remain immutable. A processor that captured a subsequently compacted operation cannot acknowledge the replacement. Local state and the replacement operation still commit together.

## 6. Account isolation

Journal keys use `@ingly_account:<Auth UUID>:@ingly_local_v3`. Its pages use the same exact account prefix. Public course JSON, language preference and sanitized public application settings stay shared. Logout retains account progress and pending operations; it never clears another account's journal or the whole storage adapter.

Migration reads only Phase 2 account-prefixed keys. Their profile credentials are stripped; word progress, legacy word queue and owned custom vocabulary and known owned streak snapshots receive new operations. Existing aggregates remain a compatibility baseline. Unknown-owner unscoped progress/vocabulary is not imported into any account. Legacy credential registry and saved card keys retain the Phase 2 purge behavior.

## 7. Stale session and in-flight request protection

Storage sessions carry `{owner, generation}`. Owner changes and SDK token replacement advance generation. The Auth event callback invalidates old storage work immediately; async SDK work is deferred outside its lock. Every journal transaction checks its token before reads, between page writes, before manifest commit and after async work. Async translation/card operations, profile reads, lesson content and leaderboard caches retain their originating token.

Sync acquires a global processor mutex before any await. It captures the owner's generation and SDK JWT, checks both before sending and after receiving, and never acknowledges stale work. Learning event handlers retain the token that published their UI session, so a delayed event cannot acquire a replacement account's token. AbortController cancels RPCs on detachment/background/offline events where supported. A 20-second deadline also releases the processor when SDK/session work hangs. An already sent request may legitimately finish on the server **as its original account**; its captured JWT cannot become the next account's JWT. A native write already submitted before invalidation may finish in the original account's namespace; it cannot touch the next account's namespace or publish stale UI state.

## 8. Synchronization triggers and observability

The provider starts/stops sync with Auth sessions. Triggers are successful session restoration/login, local durable mutations, native offline→connected or connection-type changes, and foreground/resume. Background or offline notifications cancel pending timers and abort the active RPC. Network events do not start sync while the app is backgrounded. No background OS task or service was added.

Mutation scheduling coalesces activity for 2.5 seconds; remaining successful batches drain with a bounded 800 ms delay. Initial/session/network/foreground sync pulls server entities newer than the persisted revision cursor. Ordinary mutation/drain/retry attempts do not repeatedly fetch the whole remote snapshot. An idle, already hydrated empty outbox performs no progress RPC.

`getSyncStatus()` exposes pending operation count, processing flag, last success, error class, blocked reason, pause state and next retry. `onSyncStateChange()` emits started/completed/failed events without tokens or vocabulary text. `requestSync('manual')` supports an explicit retry, including a previously rejected permanent RPC after its deployment is repaired. Auth/transient blocks can retry on relevant new events. Corruption/reset conflicts are retained rather than automatically erased. No permanent status UI polling or global sync-state rerender was added.

## 9. Retry/backoff behavior

Transient failures permit five scheduled retries after the initial attempt: approximately 3, 6, 12, 24 and 48 seconds, each with 0.85–1.15 jitter. The delay expression caps at 120 seconds before jitter; after the fifth retry the processor waits for a relevant event. A mutation does not reset an exhausted retry series. Timers are cleared on stop/offline/background.

HTTP 401/403, JWT errors and authorization SQL errors block as auth failures. Invalid acknowledgements, invalid payloads/constraints and other permanent 4xx responses block without an automatic retry loop. HTTP 408/429, connectivity/timeouts and server failures are transient. Corrupt local state and reset-epoch conflicts have distinct blocked reasons. No failure class deletes queued work. `last_attempt_at` and attempt count commit before a remote write attempt.

## 10. Acknowledgement semantics

The new RPC must return `success: true` and an `acknowledged` array that matches the entire submitted batch's exact IDs and sequences, without duplicates or invented IDs. Partial, missing or malformed acknowledgements retain the whole batch. A count, a word ID or a successful HTTP response is insufficient. `clearSyncQueue` accepts only ID/sequence records and filters exactly matching operations under the local storage lock. It never clears all pending work as a default.

The server transaction returns receipts for already committed identical operations. Reusing an ID with different canonical content fails. Retry metadata is excluded from the canonical receipt comparison. PostgreSQL transaction failure rolls back receipts and state together.

## 11. Conflict-resolution rules

| Data | Rule |
| --- | --- |
| Textbook word completion | `completed` is monotonic OR within an epoch; later hard/review status does not undo completion |
| SRS status, next review, favorites | Increasing sequence for the same device/entity; different devices resolve by server transaction order, never device timestamps |
| Review count | Maximum snapshot count; replay cannot increment it; concurrent independent device counts are not summed |
| Total learned words | Maximum compatible aggregate, at least the union of known completed word IDs; custom words are excluded |
| Book totals/percent | Per-book known counts and max progress; actual bundled book sizes used for local learning; existing opaque legacy percentages are preserved |
| Unit completion | True when the bundled unit's words are all completed; persisted completion stays monotonic within the epoch |
| Daily activity/streak | Asia/Tashkent date (UTC+5); first word completion adds one, review/hard still records activity; newer activity date wins, same-date counters use max; known completed-day word union raises the local daily lower bound |
| Quiz accuracy | Preserve existing rolling average rule locally; latest accepted learning snapshot supplies accuracy across devices; pending local accuracy is protected |
| Active lesson/preferences | Last accepted server transaction, with per-device/entity sequence protection; pending local entity is preserved during hydration |
| Custom vocabulary | Owned records/tombstones, last accepted server transaction, pending local changes protected; never increments textbook counters |
| Progress reset | New epoch clears textbook progress/aggregates/lesson and mirrored legacy server progress/streaks; custom vocabulary and preferences remain; pre-reset epoch writes are rejected |

Per-device/entity checkpoint rows prevent an earlier operation from overwriting that device's later update even after another device updated the same entity. Aggregate max semantics are conservative snapshot reconciliation, **not an exact multi-device review/quiz/activity event ledger**. Historical inflated totals cannot be reconstructed reliably, so they are not guessed downwards. Initial server import preserves existing owned word state and streak/date snapshots without recording new activity.

A remote reset with local pending work stops synchronization with a visible API conflict reason and retains all operations. It does not silently rebase them or resurrect pre-reset progress. When there is no local pending work, the client adopts the new epoch and server snapshot. Conflict recovery UI/tooling is deferred; do not clear queues to suppress the error.

## 12. Storage keys and account scoping

| Key/data | Scope |
| --- | --- |
| `@ingly_local_v3` manifest and `:page:<version>:<n>` | Account-prefixed; page values at most 65,536 UTF-16 characters |
| Word progress, queue, streak compatibility values, favorites, profile | Logical entries in the account journal |
| Custom words, dismissed announcements, cached leaderboard | Logical entries in the account journal |
| Translation cache | `@ingly_translation_cache` in the account journal; at most 80 successful query/result pairs |
| Mock transactions/entitlement cache names | Account-scoped, preserving Phase 2 protections |
| `ingly_supabase_auth_v2` and SDK user companion | Existing SDK-managed string storage, separately purged at logout |
| `ingly_language`, public app-settings cache, APP_SETTINGS | Shared device/public data; unexpected/private settings remain filtered |
| `all_words.json` and content indexes | Shared bundled content; no per-account duplication |

All journal pages are written before replacing the manifest. A crash before pointer commit leaves the previous snapshot valid. Superseded pages are removed after commit. Native getAllKeys allows orphan-page collection once per account generation, only inside that account's journal-page namespace. Corrupt manifests, missing pages, malformed outboxes and legacy queues preserve original bytes and reject mutations. Volatile in-memory storage no longer pretends to save progress successfully.

## 13. Network request and performance changes

The ten-second profile/status poll was **already absent** in the Phase 2 working baseline. Phase 3 removes the unused 25-second interval implementation and connects real event-driven sync. The Cinema playback-position interval is a local media timer and remains untouched. SDK-required token refresh and the existing public-settings subscription also remain; they are not progress polling.

Opening a lesson in wordsData previously awaited an unfiltered `words.limit(20)` fetch, which could assign other units' rows to the requested unit. It now reads the bundled course by stable ID without any content HTTP request. Flashcards/Quiz already used bundled content and keep doing so. Opening known vocabulary or a cached translation needs no translation network round trip; previously uncached fallback translation now has a timeout.

Ordinary local saves no longer launch a profile PUT on every word/lesson/quiz action. A batch carries up to 32 operations and a conservative 196,608-byte upper bound (four bytes per serialized character), below the server's 512 KiB cap. Tail compaction groups up to 23 distinct words plus a learning snapshot. Word/unit/book indexes build once; learning updates do not scan the full course. Only mutation/remote-merge events publish local state; attempt/ack/cache bookkeeping does not update UserContext globally.

Only [NetInfo](https://github.com/react-native-netinfo/react-native-netinfo) was added. Its HTTP reachability probe is explicitly disabled; native connection events and actual RPC results drive recovery. No state-management, database, background-job or general retry package was added. Local journal writes still serialize current account state; pages solve individual-value size limits, not storage quotas or all write amplification.

## 14. Server/RPC/migration changes

New migration: `backend/migrations/20261005_repair_phase3_offline_sync.sql`. Apply it **after** Security Phase 2, including after `schema.sql` for fresh installs. The Phase 2 canonical migration and embedded fresh-schema copy were not rewritten in this phase.

Tables: `learning_sync_accounts` (epoch/revision), `learning_sync_entities` (owned snapshots), `learning_sync_receipts` (account+operation identity), `learning_sync_versions` (device/entity sequence checkpoints). All enable RLS. Authenticated clients have own active-account SELECT on account/entity state and no direct mutation grants; receipts/checkpoints stay behind the RPC. Service-role grants remain server-only.

RPCs: `read_learning_sync(p_after_revision)` and `sync_learning_operations(p_operations)`. Both derive actor from auth.uid(), require active_account(), use empty search_path with qualified identifiers, and revoke PUBLIC/anon execution. No arbitrary account-ID parameter exists. Operation owner must equal auth.uid(). Account-row locking serializes revisions, reset changes, entities and receipts. Preferences explicitly allow only name/avatar/daily goal/reminder/local notification/sound settings and cannot modify roles, premium or contact.

Known database word IDs mirror into existing user_progress, and learning snapshots mirror streak/date state without replayable increments. Bundled IDs absent from the database retain their owned sync entity without failing an entire batch on the legacy FK. Existing admin statistics see mirrors for imported database words; full bundled content ID correspondence requires staging verification. Global trusted leaderboard publication is not implemented; existing local leaderboard/demo behavior is preserved.

Once this migration is applied, legacy `sync_user_offline_progress(JSONB)` and `record_user_activity(INT)` lose client execution permission. Coordinate migration/mobile rollout: older clients may receive authorization failures and retain their old queues. The new client does not fall back to a non-idempotent RPC if the migration is missing.

## 15. Tests added

`node tests/repair-phase3.cjs` runs 31 focused cases using real mobile service/context modules, injected durable storage, controllable RPC results, generations and fake timers. Covers offline state+queue/restart, disk failure, concurrent mutations, unique totals/unit completion, exact/wrong-version acknowledgements, stale A→B→A and same-owner token changes, corrupt current/legacy storage, safe migration, failure/malformed acknowledgement retention, in-flight newer edits, processor mutex, wrong SDK account, logout, auth/permanent blocks, native recovery/foreground, bounded retries, hanging SDK calls, pending-safe hydration, reset conflicts, SDK-cache startup, cached premium rejection after learning, native event cleanup, bundled lessons, SQL static security invariants, compaction identity safety, interrupted paged writes, private offline translation cache and stale profile-response protection after acknowledgement.

SQL assertions are explicitly static, including verification that the helper namespace matches the current Phase 2 migration (`ingly_private`). Mock RPC acknowledgement tests do not claim to execute PostgreSQL receipts or real JWT/RLS enforcement. Existing Phase 2 tests keep their hash-replay/admin/payment/RLS assertions and account-switch cases; only storage/module mocks and changed queue shape were updated. Phase 1 custom-vocabulary contribution checks remain passing.

## 16. Validation results

| Check | Result |
| --- | --- |
| `node tests/repair-phase3.cjs` | PASS: 31 cases, 0 failures |
| `node tests/security-phase2.cjs` | PASS: all 9 reported regression groups, 0 failures |
| `node tests/repair-phase1.cjs` | PASS: all existing assertions, 0 failures |
| JS/JSX syntax, direct imports, relative modules, named exports | PASS, included in security suite |
| `git diff --check` | PASS; only Windows LF/CRLF conversion notices |
| `npm.cmd run build` in admin | PASS, Vite built both entrypoints |
| Offline Expo Android export | PASS; 663 modules, reported Hermes bundle 3.2 MB |
| Offline Expo iOS export | PASS; 665 modules, reported Hermes bundle 3.2 MB |
| Optional expo-speech / expo-av resolution | MISSING, pre-existing; not installed; exports still passed, real native pronunciation remains unverified |
| Database migration execution, deployed RLS/RPC tests | NOT RUN: no psql/Docker/Supabase CLI available and no production access used |
| Physical Android/iOS network and termination tests | NOT RUN; exports do not establish native runtime behavior |

Export artifacts are local ignored build output, not deployments. No before-phase bundle size was measured; 3.2 MB is a current artifact measurement, not a claimed size reduction.

## 17. CONFIRMED IN CODE

Owned journal/outbox persistence, local-first cached-session UI, exact acknowledgement matching, failed-operation retention, serialized mutations, pre-await sync mutex, generation checks including A→B→A, captured JWT requests, pending-safe merges, monotonic word completion, coherent reset epochs, event-driven sync, disabled reachability probes, bounded retry scheduling, public/private storage separation, custom-word exclusion from textbook totals and absence of legacy hash authentication imports.

Security tests also verify that forged browser admin sessions cannot authorize actions, protected account mutations stay server-side and mock payments never persist card data or production entitlement. These protections were preserved.

## 18. REQUIRES DEPLOYED SUPABASE VERIFICATION

Use an approved **staging** project first. No automatic deployment is authorized by this phase.

1. Apply the new migration after the Phase 2 baseline; verify PostgreSQL function compilation, privileges, policy function access and PostgREST schema refresh.
2. Test anonymous/non-active/blocked JWT rejection; direct client entity mutation must fail. User B cannot read A entities/receipts or submit an operation owned by A.
3. Submit identical operations twice, including a dropped first response; totals/reviews/streaks must not increment on replay. Changed content with the same ID must fail.
4. Interleave device sequences and server commits: earlier same-device/entity values cannot overwrite a later sequence after another device's update.
5. Force a failure mid-batch; entities, legacy mirrors and receipts must all roll back. Ack records must exactly match submitted operations.
6. Verify reset plus later operations, replay of a committed reset, rejection of old-epoch writes, and concurrent reset conflict retention.
7. Verify schema IDs against bundled word IDs, initial legacy-state bootstrap, mirrored admin statistics and owned custom tombstones.
8. Test real Supabase Auth refresh/SMS/session events with the app offline and around token expiry; confirm server-side revocation blocks server access.

## 19. Remaining risks

- SQL is reviewed/static-tested but not executed locally or deployed. Migration/grant/RLS/idempotency runtime validation is required before a release that depends on cloud sync.
- Device-session tokens retain Phase 2's AsyncStorage persistence. Offline cached UI cannot prove current revocation; server authorization remains authoritative. Cold-start expired sessions require SDK restoration.
- Native NetInfo/AppState integration, process-kill durability, actual device storage quotas and slow-radio performance need physical Android/iOS tests. One active app runtime per account journal is supported; cross-tab web storage locking is not implemented.
- Page commits temporarily need storage for old and new snapshots. Complete journal serialization still costs CPU/I/O as history grows. Full storage reports failure without falsely advancing progress; choose measured compaction/SQLite work only after device profiling.
- Server receipts/checkpoints grow with lifetime use; retention/archival policy is deferred. Do not simply delete receipts without preserving deduplication/version guarantees.
- Cross-device snapshots use max for review/activity counts and a latest snapshot for quiz accuracy; they do not provide exact additive attempt analytics. Legacy inflated aggregates and ambiguous historical activity days are preserved, not reconstructed.
- Conflicting remote resets preserve queues but require an explicit recovery policy/interface. No automatic destructive resolution was introduced.
- Sync observability is exposed through APIs; a new user-visible diagnostic/recovery UI is not built. Exact flashcard/question position is still ephemeral; active book/unit and word results are durable.
- Media/images/Cinema require network where remote assets are used. Optional TTS packages remain missing. Content/search/quiz generation performance outside the corrected lesson path is deferred.
- Existing demo leaderboard peers remain. No public shared score blob or arbitrary private-profile enumeration was reintroduced; a competitive server-verified leaderboard is deferred.

## 20. Intentionally deferred work

Real payments, AI Speaking, Telegram, Teacher Mode, new courses, visual redesign, auth redesign, general dependency cleanup, SRS redesign, media removal, trusted global leaderboard publishing, historical aggregate reconstruction, corrupt-data recovery UI, exact multi-device attempt ledgers and production rollout. The user's pre-existing admin mock-data edit remains untouched.

## 21. Recommended Phase 4

Release verification and measured performance: staging migration/RLS/receipt tests; native Auth/network switching/airplane-mode/token-expiry/process-kill tests; storage-quota and long-offline-history profiling on inexpensive Android phones; explicit reset-conflict recovery; media and optional TTS reliability; then prioritize changes from measurements. This phase stops here and does not begin Phase 4.
