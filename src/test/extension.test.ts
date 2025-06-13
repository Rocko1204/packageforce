import * as assert from 'assert';
import * as vscode from 'vscode';

// Set up environment variables before importing anything that uses Salesforce
process.env.SFDX_DISABLE_TELEMETRY = 'true';
process.env.SF_DISABLE_TELEMETRY = 'true';
process.env.SFDX_USE_GENERIC_UNIX_KEYCHAIN = 'true';
process.env.SF_USE_GENERIC_UNIX_KEYCHAIN = 'true';
process.env.SFDX_DISABLE_INSIGHTS = 'true';
process.env.SF_DISABLE_INSIGHTS = 'true';
process.env.NODE_ENV = 'test';

suite('Extension Test Suite', () => {

  test('Extension should be present', () => {
    assert.ok(vscode.extensions.getExtension('Rocko1204.packageforce'));
  });

  test('Sample test to verify test framework', () => {
    assert.strictEqual(1 + 1, 2);
    assert.strictEqual(true, true);
  });
  
  // Skip activation tests in CI to avoid Salesforce CLI issues
  test.skip('Should activate without errors', async function() {
    this.timeout(10000);
    
    const extension = vscode.extensions.getExtension('Rocko1204.packageforce');
    if (!extension) {
      assert.fail('Extension not found');
      return;
    }

    try {
      await extension.activate();
      assert.ok(true, 'Extension activated successfully');
    } catch (error) {
      assert.fail(`Extension activation failed: ${error}`);
    }
  });
});
