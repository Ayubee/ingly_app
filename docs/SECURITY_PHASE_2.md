# Ingly Security Phase 2 — implementation and deployment report

Repository changes are **CONFIRMED IN CODE** where covered below. They are not a claim that the deployed project is secure. No migration, function deployment, production account creation, or live penetration test was performed. Repair Phase 1 remains the baseline. Phase 3 has not started.

## 1. Executive summary

Active mobile and browser authentication now uses Supabase Auth. Profiles use `users.id = users.auth_user_id = auth.users.id`. Database policies and a server endpoint enforce ownership and admin permissions. Local passwords, hash verification, editable browser admin sessions, arbitrary-target password/progress RPCs, client premium writes, and persisted payment cards have been removed from active flows.

Existing legacy users are deliberately **not automatically claimed** by a new Auth identity. Existing installations require operator review and migration. Applying this code alone will not repair remote grants or provision the server endpoint.

## 2. Files changed

| Area | Files |
| --- | --- |
| Auth and identity | `mobile/src/services/authService.js` (new), `supabaseClient.js`, `userService.js`, `mobile/src/context/UserContext.js`, `mobile/src/screens/AuthScreen.js`, `ProfileScreen.js`, `mobile/src/utils/crypto.js` |
| Local boundaries | `mobile/src/services/storage.js`, `syncEngine.js`, `leaderboardService.js`, `mobile/App.js`, `mobile/src/screens/MyWordsScreen.js` |
| Mock payments | `mobile/src/components/PaymentModal.js`, `mobile/src/services/appSettingsService.js`, payment callbacks in `HomeScreen.js`, `LearnScreen.js`, `ProfileScreen.js`, entitlement helpers in `UserContext.js` |
| Browser admin | `admin/index.html`, `admin/preview.html`, `admin/public/auth.js` (new) |
| Database/server | `backend/migrations/20261005_security_phase2.sql` (new), `backend/schema.sql`, retired `security_hardening.sql` and `update_rls_policies.sql`, `backend/supabase/functions/admin-accounts/index.ts` and `backend/supabase/config.toml` (new), `backend/verify_security_phase2.sql` (new) |
| Tests/config/docs | `tests/security-phase2.cjs` (new), `tests/repair-phase1.cjs`, `mobile/.env.example` (new), `backend/README.md`, this report |

No production npm dependencies were added. The Edge Function uses the existing Supabase SDK version as a pinned Deno npm import. Build outputs remain ignored.

## 3. Vulnerabilities repaired

- Local hash equality, including hash-as-password, cannot establish an authenticated session. Legacy hash/password helpers fail closed and are no longer imported by authentication.
- Profile queries explicitly exclude credentials. Database column grants exclude legacy hash columns, identity changes, block flags and entitlement writes.
- Normal clients cannot insert application profiles/admin roles or choose another user for privileged RPC operations.
- Backend admin operations verify bearer tokens and live database permissions. A moderator cannot reset, modify, or delete an admin through the users endpoint; failed privilege lookups fail closed.
- Forged browser role/session objects cannot authorize admin access. No fixed/default admin password is seeded or accepted.
- Cached private data and pending operations cannot simply spill into the next signed-in account. Sync requests retain their original token and do not acknowledge a different account's queue.
- Full payment-card persistence and cloud publication of mobile mock purchases have been removed.
- Private profile enumeration through the leaderboard and public transaction/score blobs has been stopped. Private/mixed tables are removed from Realtime replication by the migration.

## 4. Authentication: before → after

| Before | After |
| --- | --- |
| Local registry, fixed-salt hashes and cached `isLoggedIn` | Supabase password authentication and its persisted session |
| Locally generated account ID | Auth's UUID, owned profile with the same UUID |
| Locally asserted Google identity | Disabled until a verified OAuth integration is configured |
| Username/phone lookup exposing credential fields | Phone/email password login through Auth; username stays a display identifier |
| Client role labels/browser session objects | Verified Auth identity plus database role/permission checks |

Registration uses phone/password `signUp`, followed by SMS `verifyOtp(type: 'sms')` when confirmation is required. Mobile login accepts an Uzbek phone number or email. Nine phone digits normalize to `+998`; username-only login is no longer supported. No public directory lookup was added to recover the old username-login behavior. Unconfirmed phone login requests another Auth SMS and opens the confirmation screen.

The profile trigger copies Auth contact fields and a bounded daily goal. It ignores privilege metadata. Contact changes follow Auth's own contact-update flow; normal profile writes cannot replace username or phone. Google remains visibly unavailable and supplies no fabricated identity.

Session restore uses the SDK session, never the old profile's login flag. An unexpired cached SDK session permits account-owned local work during an outage; backend requests still validate the JWT and RLS. Cached premium flags are not restored as entitlements. Online absent/blocked/mismatched profiles detach the account. Logout immediately detaches private UI and clears the SDK session keys, while preserving the account's progress/outbox. Re-login is blocked while logout is finishing.

## 5. RLS and RPC changes

The migration removes **all existing policies and table/column grants on the nine known application tables** before granting the intended access. This avoids a permissive policy or broad grant surviving alongside a stricter policy. Private schema/public schema creation privileges are restricted; function grants revoke PUBLIC explicitly.

| Object | Effective client boundary |
| --- | --- |
| `users` | Own active profile; `manage_users` admins can read safe fields. Own update grants allow only name/avatar/goal/timestamp. No normal profile insert/delete or premium/identity/block update. |
| `user_progress`, `user_streaks` | Read/write requires `user_id = auth.uid()` and an active matching profile. `manage_users` admins may read statistics. |
| `admins` | Safe own-role read or super-admin read. No direct client role writes. |
| `admin_audit_logs` | Super-admin read; server inserts. No client audit writes. |
| `books`, `units`, `words` | Intentionally public vocabulary read; writes require `manage_words`. |
| `app_settings` | Public reads use an explicit setting-key allowlist. Private transactions/legacy scores are excluded. Writes/private reads require `manage_settings`. |
| `v_user_stats` | `security_invoker=true`; respects underlying policies and grants. Requires PostgreSQL 15+. |

All seven SECURITY DEFINER functions use an empty search path and qualified application objects:

| Function | Execution and identity |
| --- | --- |
| `ingly_private.active_account()` | Authenticated policy helper; checks the caller's matching, unblocked profile. |
| `ingly_private.has_permission(text)` | Authenticated policy helper; checks the caller's active admin row and matching unblocked profile. Super-admin is required for admin management; JSON object keys cannot masquerade as permission arrays. |
| `public.get_my_admin_access()` | Authenticated only; returns only the caller's active role, never a requested target. |
| `ingly_private.create_auth_profile()` | Trigger only; no PUBLIC/anon/authenticated execution grant. Uses `NEW.id`, never a supplied application ID. |
| `ingly_private.sync_auth_contact()` | Trigger only; tracks actual Auth contact fields. No client execution grant. |
| `public.record_user_activity(integer)` | Authenticated active account only; derives `auth.uid()`. Count bounded to 0–500. |
| `public.sync_user_offline_progress(jsonb)` | Authenticated active account only; derives `auth.uid()`. Batch limit 500; embedded target IDs are ignored. |

The old `verify_user_credentials(text,text)`, `set_user_password_secure(uuid,text,text)`, `get_safe_user_status(text)`, `record_user_activity(uuid,integer)` and `sync_user_offline_progress(uuid,jsonb)` signatures are dropped. PUBLIC and anon have no EXECUTE grant on the replacement RPCs. Default privilege changes apply to functions subsequently created **by the migration owner**; other owners and unknown deployed functions require a catalog audit.

Private tables and mixed `app_settings` are removed from `supabase_realtime` if present. The admin user list reloads through authorized REST. Instant settings propagation is paused until public settings can have a separate publication. Public vocabulary remains accessible.

## 6. Admin authorization

Both HTML entrypoints use `admin/public/auth.js`. Login is email/password through Auth, followed by server `getUser()` and `get_my_admin_access()`. SessionStorage holds the SDK token, not an authoritative role object. Old user/admin/transaction/credential caches are purged. Project URL/key are fixed deployment configuration; an editable connection URL cannot receive the admin's bearer token.

The `admin-accounts` Edge Function verifies every token with Auth, requires an active/unblocked matching admin identity, and checks permissions before using its server-only service role key. `manage_users` enables ordinary account creation, blocking, manual VIP grants, password reset and deletion. Only super-admin can create/change/delete admins. Privileged target checks are mandatory and fail closed. Self-deletion and deletion of a super-admin are refused. Role labels in the UI grant nothing.

Creation/deletion is accepted in the UI only after a server response with a confirmed ID. Account creation now requires a real phone or admin email because Auth must have a real contact. Newly created accounts are unconfirmed, not silently activated. Admin email login can request confirmation resend. Admin creation respects the selected role and filters permissions against the server allowlist. Direct database writes to protected account fields are no longer an admin fallback.

## 7. Password security

Passwords exist only in temporary form state and requests to trusted Auth endpoints. No new password/hash is stored in AsyncStorage, browser caches, profiles, or audit payloads. The legacy mobile registry and saved-card key are removed; credentials are stripped from the unscoped legacy profile. Hash fields retained in the database are inaccessible to clients and unused; their final deletion/backup retention requires an operator migration decision.

Mobile password change verifies the current Auth user, reauthenticates the old password with an isolated non-persistent Auth client, and uses Auth `updateUser` for that same identity. Reauthentication does not swap the main app's session. Admin password reset uses `auth.admin.updateUserById` only after the endpoint's permission and target checks. There is no replacement custom password RPC. Self-service forgotten-password UI is not implemented in this phase; use a separately configured Supabase recovery flow or an authorized operator reset.

## 8. Account isolation

Profile, MyWords/personal cards, progress, favorites, streak, dismissed announcements, local leaderboard, local mock transactions and sync queue use `@ingly_account:<Auth UUID>:<old key>`. A signed-out account does not read private keys. Public content/settings/language remain shareable.

Read/modify/write storage operations carry the account they started with and reject or discard stale writes. MyWords also captures the owner before network translation and confirmation callbacks. The active screen subtree is keyed by Auth UUID so the next account does not inherit the previous screen state. In-flight sync binds its bearer token to the originating account and retains queues if identity changes before acknowledgement. Profile requests also capture their token; their update payload contains no entitlements.

Old unscoped learning data is quarantined, not automatically attributed to whichever user logs in next. It is preserved in storage but not shown through the new private-key API. Recover it only after an explicit ownership decision and a backup, with migration performed per verified account. This avoids both silent deletion and automatic cross-account disclosure.

## 9. Mock-payment boundary

The existing payment form remains a simulator with explicit TEST/MOCK wording. Full number, expiry and holder remain in component state only and are cleared when visibility changes. Saved-card reading/writing has been removed; no CVV storage flow exists. The unused merchant card-number save path is also removed, old settings/browser caches are sanitized, and legacy merchant/provider settings are excluded from public reads. No real Click/Payme processing was added.

Mock purchases require both a development build and `EXPO_PUBLIC_ENABLE_MOCK_PAYMENTS=true`. Production builds cannot enable them with the environment flag alone. Mock VIP/book access is temporary React state, reset on logout/account switch/app restart. It never writes protected entitlements or cloud transactions. Payment callbacks require `mock: true` and report test access. Normal authenticated roles have no column grant for backend VIP writes. Authorized manual admin grants remain separate from the simulator.

## 10. Tests and validation

| Check | Result and limit |
| --- | --- |
| `node tests/security-phase2.cjs` | **PASS**. Mocked Auth, edge handler permissions, hash replay path, legacy purge, account switching/races, queue retention/token binding, forged browser sessions, both admin entrypoint render checks, imports/named exports, SQL static invariants, mock boundaries. No live network/database requests. |
| `node tests/repair-phase1.cjs` | **PASS**. Existing create/delete confirmation, failure/pending/no-connection cases, phone/password validation, blocked fallback, empty MyWords, single custom contribution, PNG checks retained. Harness now models the trusted endpoint and async Auth rejection. |
| `npm.cmd run build` in `admin` | **PASS**. Both HTML entrypoints build; public Auth script copied. Inline JSX also parsed/transformed and smoke-rendered in tests. This is not browser end-to-end validation. |
| JS parser/import checks | **PASS**. Mobile/admin source syntax, direct package imports, relative files and named exports. Edge TypeScript parses/transforms and its handler runs in the mocked tests. |
| `CI=1 EXPO_OFFLINE=1 npx.cmd expo install --check` | Local bundled-version comparison reports dependencies up to date; **offline advisory only**, not fresh registry verification. |
| Existing optional TTS module resolution | **FAIL (pre-existing)** for `expo-speech` and `expo-av`. No dependency cleanup performed. A native bundle/device test is not claimed to pass. |
| `git diff --check` | **PASS** after whitespace fixes. |
| SQL source inspection | **PASS for static invariants only**: explicit grants/revokes, policies, matching IDs, safe paths, retired signatures, transaction boundaries, and canonical migration embedded in fresh schema. No PostgreSQL execution was available. |
| Deployed Auth/RLS/RPC/Edge/SMS | **REQUIRES DEPLOYED SUPABASE VERIFICATION**. |
| Deno type check/native device testing | **NOT RUN**: Deno/ADB tooling unavailable. Mocked TypeScript execution is not a Deno production runtime test. |

## 11. Deployed staging verification matrix

Use isolated, real staging Auth accounts with confirmed contacts: two ordinary users A/B, an editor, a `manage_users` moderator, and a super-admin. Do not run destructive cases against production accounts.

1. Apply the migration twice in staging; execute `backend/verify_security_phase2.sql` as the operator. Review the complete SECURITY DEFINER inventory, policies, effective grants (including PUBLIC), FK/unique constraints and invoker-view setting. Review functions/tables not present in this repository separately.
2. With no token and a forged token, confirm profile/progress/admin/audit access and private setting blobs are denied. Public vocabulary/allowlisted settings must still read successfully.
3. With A's real JWT, read/update A's allowed profile fields. Reads for B must return no rows; writes to B must fail or affect zero rows. Selecting password hashes and updating identity/VIP/block flags must fail, including via explicit column requests and `select('*')`.
4. Test direct progress/streak insert/update/delete with B's UUID under A's JWT. Test RPC payloads containing B's UUID, extra IDs, invalid batches, and old signatures. Only A's rows can change; anonymous execution must fail. Validate result fields and ordinary sync correctness.
5. With a real non-admin JWT, fabricated localStorage/sessionStorage role objects must not open authorized admin access or enable the Edge Function. Editors can edit vocabulary but cannot manage users/settings unless explicitly granted. Moderators cannot act on admins through the users API. Deactivate/block a role and repeat requests with its existing token.
6. Test server-confirmed create/delete/failure cases on disposable staging accounts. Confirm profiles/admin rows and Auth identities cascade correctly. Confirm newly created contacts before login. Confirm the endpoint is deployed under the correct configuration and cannot be invoked without verification despite `verify_jwt=false`.
7. Confirm signup SMS delivery and latency to +998 numbers, retry/provider limits, wrong/expired OTP handling, phone/email login, current-password rejection, Auth password change, operator reset, session refresh and offline logout/restart behavior.
8. Switch A → B during translation/storage reads/sync on a throttled network. Neither screen nor private key/queue should expose A to B. Interrupt a sync, restart and confirm A's queue remains available. Test a release build with the mock flag set and confirm purchases remain disabled.
9. Confirm private/mixed tables are absent from Realtime, and audit reads/private transaction blobs remain permission-bound. Confirm no credentials/card fields occur in application/network/error-monitoring logs.

## 12. Remaining security risks and limits

- **Deployment is mandatory.** Old remote policies/RPCs/anonymous grants remain dangerous until the migration is successfully applied. Unknown deployed functions, Storage bucket policies, external services and project Auth settings are not verified from this repository.
- SDK session tokens and account caches use AsyncStorage; browser tokens use sessionStorage. They are not encrypted against device compromise/XSS. Account prefixes separate normal app accounts; they are not encryption or a defense against an attacker with arbitrary device storage access. Plan native protected session storage and browser XSS hardening.
- The admin HTML still loads CDN React/Babel/Supabase and uses inline scripts. Vite success is not supply-chain/CSP/SRI validation. Several settings/content controls still make optimistic local preview updates; backend permission denial remains authoritative. Review their confirmation/error UX separately.
- Audit insertion and Auth/profile/admin provisioning span services. They are not atomic. Compensation is attempted on provisioning failure; it can fail during an outage. Audit failure logs a generic error but cannot undo an already completed Auth action. Monitor failures and reconcile orphan/pending accounts.
- Password reset does not promise instant invalidation of all already-issued access tokens. Review Auth session lifetime/revocation controls and require MFA for administrators before a production rollout. Provider rate limits/CAPTCHA/SMTP/SMS costs/delivery require project configuration.
- Offline cached sessions can keep account-owned local UI visible while server revocation/blocking cannot be checked. Expired tokens may need connectivity to refresh. Offline premium is deliberately conservative after restart; public/bundled vocabulary is not DRM-protected.
- Offline acknowledgements still operate by word ID, timestamps still come from the client, and concurrent same-account read/modify/write can lose updates. RPC replay can inflate learning statistics. These affect reliability/score integrity and are not fixed by ownership checks. Direct own-progress writes also permit user-controlled statistics.
- Existing unlinked legacy rows can block signup through unique username/contact constraints. Old server-only hashes/legacy financial blobs remain until an operator decides their retention. No automatic ownership or entitlement migration is performed.
- Native TTS dependencies remain unresolved. No native binary or real SMS/browser session was exercised here. Cinema, learning/SRS behavior and media download policies were preserved.

## 13. Migration and deployment order

1. **Back up and inventory first.** Export the current schema/policies/grants, Auth users, application records and private blobs into access-controlled backups. Check PostgreSQL 15+, expected table/sequence/view names, and any pre-existing `auth_user_id` column/constraints. Stop on incompatible schema rather than inventing identities. Test in staging before production.
2. **Choose the correct SQL file.** For an existing project apply only `backend/migrations/20261005_security_phase2.sql` as the database owner. It is transaction-wrapped and rerunnable for the expected schema. For a fresh Supabase project apply all of `backend/schema.sql`; base schema and security changes commit together. Do not rerun the seed-bearing full schema on an existing production project. Old hardening scripts deliberately raise an exception and cannot restore the former policies.
3. **Resolve legacy users manually.** Legacy profiles/admin rows remain unlinked and cannot authenticate. First establish ownership through a trusted contact-verification/operator process, not an old hash, chosen username, claimed phone, or pasted UUID. Back up the selected legacy row and progress. Under operator control, archive/release that row's unique username/phone/email before creating the real Auth account, otherwise the trigger can fail on conflicts. Keep an explicit old-ID → verified Auth-ID mapping in restricted operator records. Create/confirm the real Auth identity with a new password; never import the old hash as a password. The trigger creates its matching profile. Reassign or merge only that owner's progress/streak rows in a checked transaction; retain a backup and resolve collisions deliberately. Move eligible display data only, and grant VIP only after independent entitlement verification. Archive/delete the old row and remove obsolete hashes according to retention policy. This is a per-account operator procedure, not an automatic bulk claim script. Unscoped device data requires the same explicit ownership decision before copy into the new prefix.
4. **Bootstrap a real super-admin.** Create and confirm the operator's real email Auth account; ensure the profile exists with exactly the same UUID. If it was created before the trigger, insert the matching profile through a trusted operator transaction after verifying Auth contact/identity and resolving unique conflicts. Insert an `admins` row referencing that exact Auth UUID, with `role='super_admin'`, an explicit permission array and `is_active=true`. Do not create a synthetic/default user or place admin permission in user-editable metadata. Existing legacy admin credentials provide no privilege. After reviewing any pre-existing linked rows, validate `users_auth_identity_matches`.
5. **Deploy the server function.** From the repository root, with a configured Supabase CLI/account, use `supabase --workdir backend functions deploy admin-accounts --project-ref YOUR_PROJECT_REF`. The function lives in `backend/supabase/functions/admin-accounts/`; its configuration is `backend/supabase/config.toml`. The hosted environment must provide `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` **server-side only**. Gateway JWT verification is disabled for publishable-key compatibility; the handler's explicit `getUser(token)` verification and live role checks must remain enabled. Do not expose the service key to the browser/mobile environment. The command was not run here.
6. **Configure Auth and clients.** Enable phone/password Auth and SMS confirmation with a provider that can deliver to +998 numbers; require email confirmation for admins and configure SMTP, rate limits and allowed redirects. Keep anonymous sign-in disabled unless separately reviewed. Configure secure password-change/session settings, admin MFA and recovery procedures. Google stays disabled. Set the mobile `EXPO_PUBLIC_SUPABASE_URL` and publishable/anon key; update the matching fixed public deployment constants in `admin/public/auth.js` (and displayed HTML constants) for the same project. Keep the private schema out of exposed API schemas. Use HTTPS for the admin site.
7. **Verify before publishing clients.** Run the catalog checks and the real-token staging matrix above, then deploy matching client builds during a coordinated rollout. Old clients will fail against the stricter APIs; that failure must not be bypassed by restoring old grants. Keep production mock payments disabled. Check returned server IDs, SMS delivery, logout, refresh and role revocation on real devices/browsers.

Operator bootstrap template (replace the placeholder with the already verified real Auth UUID; run only after reviewing the matching profile):

```sql
INSERT INTO public.admins(auth_user_id,full_name,username,email,role,permissions,is_active)
SELECT u.id,u.full_name,u.username,a.email,'super_admin',
  '["manage_words","manage_users","manage_settings","view_analytics"]'::jsonb,true
FROM public.users u JOIN auth.users a ON a.id=u.id
WHERE a.id='REPLACE_WITH_VERIFIED_AUTH_UUID'::uuid
  AND a.email_confirmed_at IS NOT NULL AND u.auth_user_id=a.id AND NOT u.is_blocked
ON CONFLICT (auth_user_id) DO NOTHING
RETURNING id,auth_user_id,role;
```

A zero-row result is not successful provisioning; resolve the mismatch through the operator procedure. Never substitute a demo account or default password.

Rollback must use reviewed backups and an operator procedure. Do not restore anonymous writes or hash authentication as a compatibility workaround.

Primary references checked for the implementation: [Supabase password/phone Auth](https://supabase.com/docs/guides/auth/passwords), [SMS verification](https://supabase.com/docs/reference/javascript/auth-verifyotp), [confirmation resend](https://supabase.com/docs/reference/javascript/auth-resend), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [column grants](https://supabase.com/docs/guides/database/postgres/column-level-security), [function security](https://supabase.com/docs/guides/database/functions), [Edge Function configuration](https://supabase.com/docs/guides/functions/function-configuration).

## 14. Git diff summary

The change removes the active custom trust system and replaces it with Auth SDK operations, a canonical migration, and one verified server endpoint. Large deletions in both admin HTML files and UserContext are mainly the old custom auth, cached account/role fixtures and credential paths. New files contain the Auth service, server function/config, migration/catalog verification, regression suite, environment template and this deployment guide. Existing Phase 1 regression coverage was adapted, not removed. Nothing was committed, deployed or pushed automatically.

## 15. Recommended Phase 3 work

Prioritize versioned per-account outbox entries, idempotent RPC/event acknowledgements, durable retry/backoff, cancellation on account changes and preservation of events added while a request is in flight. Separate server-authoritative totals/entitlements from local UI caches and handle replay/concurrent updates. Define ownership-checked legacy device recovery before importing old data.

For slow Uzbekistan connections, measure authentication refresh/timeout behavior, minimize duplicate profile writes, pause background retries, use bounded batches and test loss/reconnection/account switching on +998 devices. Separate public settings/leaderboard publication from private rows before restoring Realtime. Review secure native session storage, admin MFA/XSS hardening and error-confirmation UX. Media/offline caching and SRS redesign remain separate later work; no Phase 3 implementation began here.
