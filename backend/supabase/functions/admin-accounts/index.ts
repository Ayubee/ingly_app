import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const profileColumns = 'id,auth_user_id,username,full_name,phone,is_blocked,is_premium,premium_until,created_at';
const failure = (message: string, status = 400) => new Response(JSON.stringify({ error: message }), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return failure('Method not allowed', 405);
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
  if (!token) return failure('Authentication required', 401);
  const server = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: verified, error: authError } = await server.auth.getUser(token);
  if (authError || !verified.user) return failure('Authentication required', 401);
  const actor = verified.user.id;
  const { data: role, error: roleError } = await server.from('admins').select('id,role,permissions,is_active').eq('auth_user_id', actor).single();
  const { data: actorProfile, error: profileError } = await server.from('users').select('id,is_blocked').eq('auth_user_id', actor).single();
  if (roleError || profileError || !role?.is_active || actorProfile?.id !== actor || actorProfile.is_blocked) return failure('Forbidden', 403);
  let body;
  try { body = await req.json(); } catch { return failure('Invalid JSON'); }
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      (body.payload !== undefined && (!body.payload || typeof body.payload !== 'object' || Array.isArray(body.payload)))) return failure('Invalid request');
  const adminActions = ['createAdmin', 'updateAdmin', 'deleteAdmin'];
  const userActions = ['createUser','deleteUser','updateUser','resetPassword'];
  if (![...adminActions,...userActions].includes(body.action)) return failure('Unknown action');
  const permission = adminActions.includes(body.action) ? 'manage_admins' : 'manage_users';
  const permissions = Array.isArray(role.permissions) ? role.permissions : [];
  if (role.role !== 'super_admin' && (permission === 'manage_admins' || !permissions.includes(permission))) return failure('Forbidden', 403);
  const p = body.payload || {};
  const validPermissions = ['manage_users','manage_words','manage_settings','view_analytics','view_stats','view_finance','manage_finance'];
  let target = null;
  let result = null;
  try {
    if (body.action === 'createUser' || body.action === 'createAdmin') {
      const username = String(p.username || '').trim().toLowerCase();
      if (!/^[a-z0-9_]{3,100}$/.test(username) || typeof p.password !== 'string' || p.password.length < 6) return failure('Invalid username or password');
      const email = body.action === 'createAdmin' ? String(p.email || p.username || '').trim() : '';
      // Administrators use an explicitly supplied, real email; no synthetic identities.
      if (body.action === 'createAdmin' && !email.includes('@')) return failure('A real admin email is required');
      const phone = body.action === 'createUser' ? String(p.phone || '') : '';
      if (body.action === 'createUser' && !/^\+998\d{9}$/.test(phone)) return failure('A verified phone contact is required');
      const { data, error } = await server.auth.admin.createUser({
        ...(email ? { email, email_confirm: false } : { phone, phone_confirm: false }),
        password: p.password, user_metadata: { username, full_name: String(p.full_name || username) },
      });
      if (error || !data.user) return failure('Auth account creation failed');
      target = data.user.id;
      // This is a cross-service provisioning operation, not a claimed atomic transaction.
      const { data: created, error: createdError } = await server.from('users').select(profileColumns).eq('auth_user_id', target).single();
      if (createdError || !created) {
        await server.auth.admin.deleteUser(target);
        return failure('Profile provisioning failed');
      }
      if (body.action === 'createAdmin') {
        const adminRole = p.role || 'editor';
        if (!['super_admin','editor','moderator'].includes(adminRole)) { await server.auth.admin.deleteUser(target); return failure('Invalid role'); }
        const adminPermissions = Array.isArray(p.permissions) ? p.permissions.filter((x: string) => validPermissions.includes(x)) : ['manage_words'];
        const { error: adminError } = await server.from('admins').insert({ auth_user_id: target, full_name: created.full_name, username,
          role: adminRole, permissions: adminPermissions, is_active: true });
        if (adminError) { await server.auth.admin.deleteUser(target); return failure('Admin provisioning failed'); }
      }
      if (body.action === 'createUser' && p.is_premium === true) {
        const { data: entitled, error: entitlementError } = await server.from('users')
          .update({ is_premium: true, premium_until: p.premium_until || null }).eq('auth_user_id', target).select(profileColumns).single();
        if (entitlementError || !entitled) { await server.auth.admin.deleteUser(target); return failure('Profile provisioning failed'); }
        result = entitled;
      } else if (body.action === 'createAdmin') {
        const { data: adminRow, error: adminRowError } = await server.from('admins').select('id,auth_user_id,full_name,username,role,permissions,is_active').eq('auth_user_id', target).single();
        if (adminRowError || !adminRow) { await server.auth.admin.deleteUser(target); return failure('Admin confirmation failed'); }
        result = adminRow;
      } else result = created;
    } else {
      const { data: owner, error: ownerError } = await server.from(body.action === 'deleteAdmin' || body.action === 'updateAdmin' ? 'admins' : 'users')
        .select('id,auth_user_id').eq('id', p.id).single();
      if (ownerError || !owner?.auth_user_id) return failure('Linked account not found');
      target = owner.auth_user_id;
      if (target === actor && (body.action === 'deleteUser' || body.action === 'deleteAdmin')) return failure('Cannot delete own admin identity');
      if (body.action === 'deleteUser' || body.action === 'deleteAdmin') {
        // A moderator may not delete or change a privileged identity via the users API.
        const { data: privileged, error: privilegeError } = await server.from('admins').select('role').eq('auth_user_id', target).maybeSingle();
        if (privilegeError) return failure('Privilege check unavailable', 503);
        if (privileged && role.role !== 'super_admin') return failure('Forbidden', 403);
        if (privileged?.role === 'super_admin') return failure('Super-admin deletion requires operator procedure');
        const { error } = await server.auth.admin.deleteUser(target);
        if (error) return failure('Auth deletion failed');
        result = { id: owner.id };
      } else if (body.action === 'resetPassword') {
        // Never let moderators reset another admin's password.
        const { data: privileged, error: privilegeError } = await server.from('admins').select('id').eq('auth_user_id', target).maybeSingle();
        if (privilegeError) return failure('Privilege check unavailable', 503);
        if (privileged && role.role !== 'super_admin') return failure('Forbidden', 403);
        if (typeof p.password !== 'string' || p.password.length < 6) return failure('Password too short');
        const { error } = await server.auth.admin.updateUserById(target, { password: p.password });
        if (error) return failure('Auth password update failed');
        result = { id: owner.id };
      } else if (body.action === 'updateAdmin') {
        if (!['super_admin','editor','moderator'].includes(p.role)) return failure('Invalid role');
        if (target === actor && (p.role !== 'super_admin' || p.is_active === false)) return failure('Cannot revoke own super-admin access');
        const perms = Array.isArray(p.permissions) ? p.permissions.filter((x: string) => validPermissions.includes(x)) : [];
        const { error } = await server.from('admins').update({ role: p.role, permissions: perms, is_active: p.is_active !== false }).eq('id',owner.id);
        if (error) return failure('Admin update failed');
        result = { id: owner.id };
      } else {
        const { data: privileged, error: privilegeError } = await server.from('admins').select('id').eq('auth_user_id', target).maybeSingle();
        if (privilegeError) return failure('Privilege check unavailable', 503);
        if (privileged && role.role !== 'super_admin') return failure('Forbidden', 403);
        const patch: Record<string, unknown> = {};
        if (typeof p.is_blocked === 'boolean') patch.is_blocked = p.is_blocked;
        if (typeof p.is_premium === 'boolean') { patch.is_premium = p.is_premium; patch.premium_until = p.premium_until || null; }
        const { data, error } = await server.from('users').update(patch).eq('id', owner.id).select(profileColumns).single();
        if (error) return failure('Profile update failed');
        result = data;
      }
    }
    // Audit payload excludes contact details, credentials, and tokens.
    const { error: auditError } = await server.from('admin_audit_logs').insert({ admin_id: role.id, admin_username: verified.user.id, action: body.action, target_type: adminActions.includes(body.action) ? 'admin' : 'user', target_id: target, details: { actor } });
    if (auditError) console.error('Admin audit insertion failed');
    return new Response(JSON.stringify({ data: result }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch { return failure('Operation failed'); }
});
