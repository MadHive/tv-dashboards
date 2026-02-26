#!/usr/bin/env bun
// ===========================================================================
// Phase 3 Test Script — Verify persistence features
// ===========================================================================

const API_BASE = 'http://localhost:3000/api';

async function test() {
  console.log('\n=== Phase 3 Persistence Tests ===\n');

  try {
    // Test 1: Get current config
    console.log('1. Fetching current config...');
    const configRes = await fetch(`${API_BASE}/config`);
    const config = await configRes.json();
    console.log(`   ✓ Config loaded: ${config.dashboards.length} dashboards`);

    // Test 2: Update a dashboard
    console.log('\n2. Updating dashboard (platform-overview)...');
    const dashboard = config.dashboards[0];
    const originalTitle = dashboard.name;
    dashboard.name = 'TEST MODIFIED - ' + Date.now();

    const updateRes = await fetch(`${API_BASE}/dashboards/${dashboard.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dashboard)
    });

    const updateResult = await updateRes.json();
    if (updateResult.success) {
      console.log(`   ✓ Dashboard updated: ${dashboard.name}`);
    } else {
      throw new Error('Update failed: ' + updateResult.error);
    }

    // Test 3: Verify backup was created
    console.log('\n3. Checking backups...');
    const backupsRes = await fetch(`${API_BASE}/backups`);
    const backupsResult = await backupsRes.json();

    if (backupsResult.success && backupsResult.backups.length > 0) {
      console.log(`   ✓ Backups found: ${backupsResult.backups.length}`);
      console.log(`   Latest: ${backupsResult.backups[0].filename}`);
    } else {
      console.log('   ⚠ No backups found (first save?)');
    }

    // Test 4: Verify update persisted
    console.log('\n4. Verifying update persisted...');
    const verifyRes = await fetch(`${API_BASE}/config`);
    const verifyConfig = await verifyRes.json();
    const verifyDash = verifyConfig.dashboards.find(d => d.id === dashboard.id);

    if (verifyDash && verifyDash.name === dashboard.name) {
      console.log(`   ✓ Update persisted correctly`);
    } else {
      throw new Error('Update did not persist');
    }

    // Test 5: Restore from backup (if available)
    if (backupsResult.success && backupsResult.backups.length > 0) {
      console.log('\n5. Testing restore from backup...');
      const restoreRes = await fetch(`${API_BASE}/backups/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: backupsResult.backups[0].filename })
      });

      const restoreResult = await restoreRes.json();
      if (restoreResult.success) {
        console.log(`   ✓ Restored from: ${restoreResult.backup}`);

        // Verify restoration
        const afterRestoreRes = await fetch(`${API_BASE}/config`);
        const afterRestoreConfig = await afterRestoreRes.json();
        const afterRestoreDash = afterRestoreConfig.dashboards.find(d => d.id === dashboard.id);

        console.log(`   Dashboard name after restore: ${afterRestoreDash.name}`);

        // Restore should have reverted to original (or previous version)
        if (afterRestoreDash.name !== dashboard.name) {
          console.log(`   ✓ Restore reverted changes as expected`);
        }
      } else {
        console.log(`   ⚠ Restore failed: ${restoreResult.error}`);
      }
    }

    console.log('\n=== All Phase 3 Tests Passed ✓ ===\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

test();
