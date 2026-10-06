-- PREPARATION ONLY. NOT A MIGRATION. NEVER run automatically or from an app.
-- Future approved trusted operator transaction AFTER verified Phase 2 rollout.
-- Replace NULL only in a private operator copy with the ALREADY VERIFIED Auth UUID.
-- Optional legacy_admin_row_id is an exact manually reviewed admins.id, never a
-- username/email match. Keep NULL for a new authorization row.
-- No Auth creation, passwords, hashes, secrets, public RPCs or client grants.
-- Reruns deliberately FAIL; use a separately reviewed recovery procedure instead.
BEGIN;
DO $$
DECLARE
  verified_auth_uuid UUID := NULL;
  legacy_admin_row_id UUID := NULL;
  identity auth.users%ROWTYPE;
  profile public.users%ROWTYPE;
  admin_row public.admins%ROWTYPE;
  trusted_permissions JSONB := '["manage_users","manage_words","manage_settings","view_analytics","view_stats","view_finance","manage_finance"]';
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Trusted postgres database operator required'; END IF;
  IF verified_auth_uuid IS NULL THEN RAISE EXCEPTION 'Supply an already verified Auth UUID in a private operator copy'; END IF;
  -- Serializes this one-time operation with other admin provisioning transactions.
  LOCK TABLE public.admins IN SHARE ROW EXCLUSIVE MODE;
  IF EXISTS(SELECT 1 FROM public.admins WHERE auth_user_id IS NOT NULL AND role='super_admin') THEN
    RAISE EXCEPTION 'A linked super-admin already exists; this first-admin procedure cannot be reused'; END IF;
  SELECT * INTO identity FROM auth.users WHERE id=verified_auth_uuid FOR UPDATE;
  IF identity.id IS NULL OR nullif(identity.email,'') IS NULL OR identity.email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'Existing confirmed real-email Auth identity required'; END IF;
  IF identity.deleted_at IS NOT NULL OR identity.banned_until > now() THEN
    RAISE EXCEPTION 'Auth identity is deleted or banned'; END IF;
  SELECT * INTO profile FROM public.users WHERE id=verified_auth_uuid AND auth_user_id=verified_auth_uuid FOR UPDATE;
  IF profile.id IS NULL OR profile.is_blocked THEN
    RAISE EXCEPTION 'Matching unblocked Auth-linked profile required; inspect the profile trigger first'; END IF;
  IF profile.email IS DISTINCT FROM identity.email THEN
    RAISE EXCEPTION 'Profile contact does not match trusted Auth contact'; END IF;
  IF EXISTS(SELECT 1 FROM public.admins WHERE auth_user_id=verified_auth_uuid) THEN
    RAISE EXCEPTION 'Auth identity already has admin authorization; review instead of overwriting'; END IF;
  IF legacy_admin_row_id IS NULL THEN
    INSERT INTO public.admins(auth_user_id,username,full_name,email,role,permissions,is_active)
      VALUES(verified_auth_uuid,profile.username,profile.full_name,identity.email,'super_admin',trusted_permissions,true)
      RETURNING * INTO admin_row;
  ELSE
    SELECT * INTO admin_row FROM public.admins WHERE id=legacy_admin_row_id FOR UPDATE;
    IF admin_row.id IS NULL OR admin_row.auth_user_id IS NOT NULL OR admin_row.role<>'super_admin' THEN
      RAISE EXCEPTION 'Expected manually verified unlinked legacy super-admin row'; END IF;
    -- Preserve admins.id/display identity and all audit references. No password use.
    UPDATE public.admins SET auth_user_id=verified_auth_uuid,email=identity.email,
      role='super_admin',permissions=trusted_permissions,is_active=true
      WHERE id=legacy_admin_row_id RETURNING * INTO admin_row;
  END IF;
  IF (SELECT count(*) FROM public.admins WHERE auth_user_id=verified_auth_uuid
    AND role='super_admin' AND is_active)<>1 THEN RAISE EXCEPTION 'Exactly one active authorization required'; END IF;
  INSERT INTO public.admin_audit_logs(admin_id,admin_username,action,target_type,target_id,details)
    VALUES(admin_row.id,admin_row.username,'BOOTSTRAP_SUPER_ADMIN','admin',admin_row.id::TEXT,
      jsonb_build_object('procedure','trusted_one_time_operator','auth_user_id',verified_auth_uuid));
END $$;
-- Inspect the single linked authorization before committing in the reviewed session.
SELECT a.id AS admin_row_id,a.auth_user_id,a.role,a.is_active,u.is_blocked,
  u.id=a.auth_user_id AND u.auth_user_id=a.auth_user_id AS profile_identity_matches
FROM public.admins a JOIN public.users u ON u.auth_user_id=a.auth_user_id
WHERE a.auth_user_id IS NOT NULL AND a.role='super_admin';
-- Default is a dry run. ONLY after staging acceptance/separate approval may a
-- trusted operator change this final ROLLBACK to COMMIT in their private copy.
ROLLBACK;
