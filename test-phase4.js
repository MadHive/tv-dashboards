#!/usr/bin/env bun
// ===========================================================================
// Phase 4 Test Script — Verify data source plugin system
// ===========================================================================

const API_BASE = 'http://localhost:3000/api';

async function test() {
  console.log('\n=== Phase 4 Data Source Plugin System Tests ===\n');

  try {
    // Test 1: List all data sources
    console.log('1. Listing all data sources...');
    const sourcesRes = await fetch(`${API_BASE}/data-sources`);
    const sourcesData = await sourcesRes.json();

    if (sourcesData.success && sourcesData.sources.length === 10) {
      console.log(`   ✓ Found ${sourcesData.sources.length} data sources`);
      const ready = sourcesData.sources.filter(s => s.isReady);
      console.log(`   ✓ Ready sources: ${ready.map(s => s.name).join(', ')}`);
    } else {
      throw new Error('Expected 10 data sources');
    }

    // Test 2: Get health status
    console.log('\n2. Checking data source health...');
    const healthRes = await fetch(`${API_BASE}/data-sources/health`);
    const healthData = await healthRes.json();

    if (healthData.success) {
      const healthKeys = Object.keys(healthData.health);
      console.log(`   ✓ Health data for ${healthKeys.length} sources`);

      const connected = healthKeys.filter(k => healthData.health[k].isConnected);
      console.log(`   ✓ Connected: ${connected.join(', ')}`);
    }

    // Test 3: Get configuration schemas
    console.log('\n3. Fetching configuration schemas...');
    const schemasRes = await fetch(`${API_BASE}/data-sources/schemas`);
    const schemasData = await schemasRes.json();

    if (schemasData.success) {
      const schemaKeys = Object.keys(schemasData.schemas);
      console.log(`   ✓ Schemas available for ${schemaKeys.length} sources`);

      // Check GCP schema
      const gcpSchema = schemasData.schemas.gcp;
      if (gcpSchema && gcpSchema.name === 'Google Cloud Platform') {
        console.log(`   ✓ GCP schema: ${gcpSchema.fields.length} fields`);
      }

      // Check VulnTrack schema
      const vtSchema = schemasData.schemas.vulntrack;
      if (vtSchema && vtSchema.name === 'VulnTrack') {
        console.log(`   ✓ VulnTrack schema: ${vtSchema.fields.length} fields`);
      }
    }

    // Test 4: Get available metrics for specific sources
    console.log('\n4. Fetching available metrics...');

    const sources = ['gcp', 'mock', 'vulntrack', 'aws'];
    for (const source of sources) {
      const metricsRes = await fetch(`${API_BASE}/data-sources/${source}/metrics`);
      const metricsData = await metricsRes.json();

      if (metricsData.success && metricsData.metrics) {
        console.log(`   ✓ ${source}: ${metricsData.metrics.length} metrics available`);
      }
    }

    // Test 5: Test connection to data sources
    console.log('\n5. Testing data source connections...');

    for (const source of ['mock', 'gcp', 'vulntrack']) {
      const testRes = await fetch(`${API_BASE}/data-sources/${source}/test`, {
        method: 'POST'
      });
      const testData = await testRes.json();

      if (testData.success !== undefined) {
        const status = testData.connected ? '✓ Connected' : '✗ Not connected';
        console.log(`   ${status}: ${source}`);
      }
    }

    // Test 6: Verify dashboard metrics still work
    console.log('\n6. Testing dashboard metrics endpoint...');
    const metricsRes = await fetch(`${API_BASE}/metrics/platform-overview`);
    const metricsData = await metricsRes.json();

    const metricKeys = Object.keys(metricsData);
    if (metricKeys.length > 0) {
      console.log(`   ✓ Dashboard metrics returned ${metricKeys.length} widget metrics`);
    } else {
      throw new Error('No metrics returned for dashboard');
    }

    // Test 7: Verify all data sources are registered
    console.log('\n7. Verifying all required data sources...');
    const requiredSources = [
      'gcp', 'aws', 'datadog', 'elasticsearch',
      'salesforce', 'hotjar', 'fullstory', 'zendesk',
      'vulntrack', 'mock'
    ];

    const registeredSources = sourcesData.sources.map(s => s.name);
    const missing = requiredSources.filter(s => !registeredSources.includes(s));

    if (missing.length === 0) {
      console.log(`   ✓ All ${requiredSources.length} required sources registered`);
    } else {
      throw new Error(`Missing sources: ${missing.join(', ')}`);
    }

    console.log('\n=== All Phase 4 Tests Passed ✓ ===\n');

    // Summary
    console.log('Summary:');
    console.log(`  • ${sourcesData.sources.length} data sources registered`);
    console.log(`  • ${sourcesData.sources.filter(s => s.isReady).length} sources ready`);
    console.log(`  • Data source plugin system operational`);
    console.log(`  • Backward compatibility maintained`);
    console.log();

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

test();
