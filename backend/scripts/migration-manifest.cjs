// Byte-level local inventory. No database/network or deployment capability.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname,'../..');
const manifestFile = 'backend/staging-migration-manifest.json';
const order = [
  ['20261005000100','backend/migrations/20261005_security_phase2.sql'],
  ['20261005000200','backend/migrations/20261005_repair_phase3_offline_sync.sql'],
  ['20261006000100','backend/migrations/20261006_admin_real_data.sql']
];
const supporting = ['backend/schema.sql','backend/supabase_fresh_preflight.sql',
  'backend/supabase_migration_preflight.sql','backend/verify_security_phase2.sql',
  'backend/verify_migration_readiness.sql','backend/operator_first_super_admin.sql'];
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
function buildManifest() {
  return {formatVersion:1,planOnly:true,projectRef:null,executionApproved:false,
    logicalOrder:['Security Phase 2','Repair Phase 3 Offline/Sync','Admin Real Data'],
    migrations:order.map(([version,file])=>({file,sourceVersion:path.basename(file).split('_')[0],
      proposedUniqueVersion:version,sha256:sha256(file)})),
    duplicateSourceVersions:['20261005'],automaticCliDeploymentAllowed:false,
    warning:'Duplicate source prefixes require reviewed unique-version mapping; originals/history are unchanged. Checksums bind exact bytes, including line endings.',
    freshBaseline:{file:'backend/schema.sql',containsSecurityPhase2:true,proposedUniqueVersion:'20261005000000'},
    supportingFiles:supporting.map(file=>({file,sha256:sha256(file)}))};
}
function verifyManifest(manifest = JSON.parse(fs.readFileSync(path.join(root,manifestFile),'utf8'))) {
  const inventory = fs.readdirSync(path.join(root,'backend/migrations')).filter(f=>f.endsWith('.sql')).sort();
  assert.deepEqual(inventory,order.map(([,f])=>path.basename(f)).sort(),'Unexpected or missing migration; review inventory.');
  assert.deepEqual(manifest,buildManifest(),'Manifest mismatch: checksum, order, file or version mapping changed. Review before refreshing.');
  const versions = manifest.migrations.map(m=>m.proposedUniqueVersion);
  assert.equal(new Set(versions).size,versions.length,'Duplicate proposed versions.');
  assert.deepEqual([...versions].sort(),versions,'Migration versions out of order.');
  return manifest;
}
if (require.main === module) {
  try {
    if (process.argv.slice(2).join(' ') !== '--verify') throw new Error('Only --verify is supported. No automatic refresh or deploy.');
    verifyManifest();console.log('MIGRATION MANIFEST VERIFIED LOCALLY: 3 ordered migrations; checksums match; duplicate source prefix 20261005 documented; NOT approved for CLI deployment.');
  } catch (error) { console.error(error.message);process.exitCode=1; }
}
module.exports = {buildManifest,verifyManifest,order,sha256};
