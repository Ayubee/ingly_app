# Repair Phase 1

Implemented only the requested immediate repairs.

- Main and preview admin inline scripts parse; the broken apostrophe is corrected.
- User creation/deletion requires a connected Supabase client and confirmed returned rows. Errors, zero-row deletes, missing creation IDs, and disconnected operations do not update the local list. Creation uses server IDs, optional null phones, normalized Uzbek phone numbers, and six-character trimmed passwords. Confirmed lists are cached through the users effect.
- Secondary admin login is deliberately blocked in both HTML applications; no default password or plaintext comparison is used. Creation messaging says login is unavailable. Existing super-admin authentication is unchanged.
- Custom mastery is counted from custom-word storage by the leaderboard, without incrementing textbook counters. No sample cards are automatically inserted into an empty personal vocabulary.
- Identical mislabeled mobile images were consolidated into one actual PNG, shared by icon/favicon. Unreferenced duplicates were removed.

## Validation

`node tests/repair-phase1.cjs`: inline parsing, relative imports, denied/pending/confirmed creation, delete denial/zero rows/success, server IDs, optional and invalid phones, short passwords, disconnected creation, blocked secondary login, empty custom vocabulary, repeated leaderboard calculation, PNG signatures.

`npm.cmd run build` in admin: passes. Build artifacts are ignored. `git diff --check`: passes.

## Deferred

- Trusted authentication, auth.uid mapping, RLS/RPC authorization, offline queue and account isolation remain later-phase work.
- Deleted users can still be recreated by existing mobile synchronization; this phase intentionally does not change that lifecycle.
- Existing aggregate totals may already contain historic custom-word inflation. They cannot be safely reconstructed from the current aggregate-only data; no speculative subtraction or reset is performed.
- Mock payments, Cinema, SRS, content ownership, and dependency cleanup are unchanged.
- Secondary admins cannot log in until trusted server authentication is implemented; existing browser sessions/security weaknesses are not migrated here.
- Existing admin-record creation/permission handlers still require confirmed server results in a later phase; only user create/delete result handling was authorized here.
- Live Supabase permissions and native device behavior were not tested. Missing TTS modules from the audit still limit native bundle validation.

Next phase: trusted identities and admin authorization, paired with safe database authorization and a defined deletion lifecycle. Do not start automatically.
