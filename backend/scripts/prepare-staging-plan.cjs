// PLAN ONLY. No database/network/process execution and no credentials accepted.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { PRODUCTION_PROJECT_REF } = require('../../shared/environment.cjs');
const root = path.resolve(__dirname,'../..');
const {order:migrationOrder,verifyManifest} = require('./migration-manifest.cjs');
function preparePlan({environment, projectRef, baseline}) {
  if (environment !== 'staging') throw new Error('Plan generation requires explicit environment=staging.');
  if (!/^[a-z0-9]{20}$/.test(projectRef || '') || projectRef === PRODUCTION_PROJECT_REF)
    throw new Error('A separate hosted staging project reference is required; production is forbidden.');
  if (!['fresh','existing'].includes(baseline)) throw new Error('Choose baseline=fresh or existing explicitly.');
  verifyManifest();
  const steps=[];
  const add = (file,purpose,version=null) => steps.push({file,purpose,proposedUniqueVersion:version,
    sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')});
  if (baseline === 'existing') {
    add('backend/supabase_migration_preflight.sql','Read-only existing-schema inventory; operator review and backup before migration.');
    add(migrationOrder[0][1],'Security Phase 2',migrationOrder[0][0]);
  } else {
    add('backend/supabase_fresh_preflight.sql','Read-only fresh-project inventory BEFORE any schema; review recovery and STOP for owner approval.');
    add('backend/schema.sql','Fresh EMPTY Supabase only; contains Phase 2; never rerun on existing data.','20261005000000');
  }
  add('backend/verify_security_phase2.sql','Read-only Phase 2 verification');
  add(migrationOrder[1][1],'Repair Phase 3 offline/sync',migrationOrder[1][0]);
  add('backend/verify_security_phase2.sql','Read-only Phase 3 grant/retired-RPC verification');
  add(migrationOrder[2][1],'Admin Real Data',migrationOrder[2][0]);
  add('backend/verify_security_phase2.sql','Read-only final Phase 2/3 verification');
  add('backend/verify_migration_readiness.sql','Read-only final identity/RLS/grant/trigger verification');
  return {planOnly:true,environment,projectRef,baseline,
    expectedApiHost:projectRef+'.supabase.co',expectedDirectDatabaseHost:'db.'+projectRef+'.supabase.co',
    requiredTls:'verify-full (trusted CA configured by operator)',
    targetVerifiedRemotely:false,executionApproved:false,
    warnings:['This manifest does NOT verify the actual remote connection or authorize execution.',
      'Operator must verify staging project/connection in Dashboard; never reuse a production connection.',
      'Proposed unique versions are a future mapping, not renamed/applied migration history.',
      'Record successful file checksums/history; stop on error; never blindly retry Admin Real Data.'],
    steps,manualAfterMigrations:['Create ordinary staging Auth test identity via trusted Auth tools; verify profile and RLS.',
      'Create/confirm the staging operator identity; review operator_first_super_admin.sql (ROLLBACK default).',
      'Real JWT role/finance/analytics/offline-sync/session tests; only then consider a separate production plan.']};
}
if (require.main === module) {
  try {
    const args=process.argv.slice(2),options={};
    for (let i=0;i<args.length;i+=2) {
      const names={'--environment':'environment','--project-ref':'projectRef','--baseline':'baseline'};
      if (!names[args[i]] || !args[i+1] || args[i+1].startsWith('--') || names[args[i]] in options)
        throw new Error('Only --environment staging --project-ref REF --baseline fresh|existing are supported. No apply/deploy option.');
      options[names[args[i]]]=args[i+1];
    }
    process.stdout.write(JSON.stringify(preparePlan(options),null,2)+'\n');
  } catch (error) { console.error(error.message);process.exitCode=1; }
}
module.exports={preparePlan};
