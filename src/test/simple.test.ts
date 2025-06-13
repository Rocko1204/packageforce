import * as assert from 'assert';
import * as vscode from 'vscode';

// Simple tests that don't require extension activation
suite('Basic Extension Tests', () => {
  test('Extension package.json should be valid', () => {
    const extension = vscode.extensions.getExtension('Rocko1204.packageforce');
    assert.ok(extension, 'Extension should be present');
    
    if (extension) {
      const packageJSON = extension.packageJSON;
      assert.strictEqual(packageJSON.name, 'packageforce');
      assert.strictEqual(packageJSON.publisher, 'Rocko1204');
      assert.ok(packageJSON.version);
      assert.ok(packageJSON.engines.vscode);
    }
  });

  test('Extension should define expected contribution points', () => {
    const extension = vscode.extensions.getExtension('Rocko1204.packageforce');
    assert.ok(extension, 'Extension should be present');
    
    if (extension) {
      const packageJSON = extension.packageJSON;
      
      // Check commands are defined
      assert.ok(packageJSON.contributes.commands);
      assert.ok(Array.isArray(packageJSON.contributes.commands));
      assert.ok(packageJSON.contributes.commands.length > 0);
      
      // Check views are defined
      assert.ok(packageJSON.contributes.views);
      assert.ok(packageJSON.contributes.views.explorer);
      
      // Check configuration is defined
      assert.ok(packageJSON.contributes.configuration);
      assert.ok(packageJSON.contributes.configuration.properties);
    }
  });

  test('Extension should have correct activation events', () => {
    const extension = vscode.extensions.getExtension('Rocko1204.packageforce');
    assert.ok(extension, 'Extension should be present');
    
    if (extension) {
      const packageJSON = extension.packageJSON;
      assert.ok(packageJSON.activationEvents);
      assert.ok(packageJSON.activationEvents.includes('onStartupFinished'));
    }
  });
});