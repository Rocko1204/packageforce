import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../utils/logger';
import { DeployService, DeployOptions } from '../services/deployService';
import { DeployLogger } from '../utils/deployLogger';
import { TestService, TestOptions, TestResult } from '../services/testService';
import { ScanService, ScanOptions } from '../services/scanService';

const logger = Logger.getInstance();

export async function deployPackageFromCodeLens(packageInfo: any) {
  const packageName =
    packageInfo.package || packageInfo.path || 'Unknown Package';

  logger.info(`Deploying package: ${packageName}`, packageInfo);

  // Show deployment options
  const deploymentOption = await vscode.window.showQuickPick(
    [
      { label: '$(rocket) Deploy Package Only', value: 'package-only' },
      {
        label: '$(package) Deploy with Dependencies',
        value: 'with-dependencies',
      },
      {
        label: '$(check) Validate Only (Check Deploy)',
        value: 'validate-only',
      },
      { label: '$(gear) Advanced Options...', value: 'advanced' },
    ],
    {
      placeHolder: `Select deployment option for ${packageName}`,
    }
  );

  if (!deploymentOption) {
    return;
  }

  // Get workspace folder
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder found');
    return;
  }

  // Get target org
  const targetOrgResult = await selectTargetOrg();
  if (targetOrgResult === false) {
    // User cancelled the selection
    return;
  }

  // Prepare deployment options
  const deployOptions: DeployOptions = {
    packageName: packageName,
    targetOrg: targetOrgResult || undefined, // undefined means use default org
    includeDependencies: false,
    checkOnly: false,
  };

  // Handle deployment option
  switch (deploymentOption.value) {
    case 'package-only':
      // Default options are fine
      break;

    case 'with-dependencies':
      deployOptions.includeDependencies = true;

      // Ask for start point if deploying with dependencies
      const startFrom = await vscode.window.showInputBox({
        prompt: 'Enter package name to start from (optional)',
        placeHolder: 'Leave empty to deploy all dependencies',
      });

      if (startFrom) {
        deployOptions.startFrom = startFrom;
      }
      break;

    case 'validate-only':
      deployOptions.checkOnly = true;
      break;

    case 'advanced':
      const advancedOptions = await showAdvancedOptions();
      if (!advancedOptions) {
        return;
      }
      Object.assign(deployOptions, advancedOptions);
      break;
  }

  // Show progress and deploy
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Deploying ${packageName}`,
      cancellable: false,
    },
    async progress => {
      try {
        progress.report({ message: 'Initializing deployment...' });

        // Create and initialize deploy service
        const deployService = new DeployService();
        await deployService.initialize(workspaceFolder.uri.fsPath);

        // Show output channel
        DeployLogger.show();

        // Execute deployment
        await deployService.deploy(deployOptions);
      } catch (error) {
        logger.error('Deployment failed:', error);
        vscode.window.showErrorMessage(`Deployment failed: ${error}`);
      }
    }
  );
}

export async function selectTargetOrg(): Promise<string | null | false> {
  // First, offer to use default or select different
  const orgChoice = await vscode.window.showQuickPick(
    [
      { label: '$(globe) Use default org', value: 'default' },
      { label: '$(search) Enter org alias/username', value: 'custom' },
    ],
    {
      placeHolder: 'Select target org',
    }
  );

  if (!orgChoice) {
    return false; // User cancelled
  }

  if (orgChoice.value === 'default') {
    // Will use default org from ConfigAggregator
    return null; // null means use default
  } else {
    // Ask for custom org
    const customOrg = await vscode.window.showInputBox({
      prompt: 'Enter target org username or alias',
      placeHolder: 'e.g., myorg@example.com or dev-sandbox',
      ignoreFocusOut: true,
    });

    if (!customOrg) {
      return false; // User cancelled
    }

    return customOrg;
  }
}

async function showAdvancedOptions(): Promise<
  Partial<DeployOptions> | undefined
> {
  const options: Partial<DeployOptions> = {};

  // Test level
  const testLevel = await vscode.window.showQuickPick(
    [
      { label: '$(dash) No Tests', value: 'NoTestRun' },
      { label: '$(beaker) Run Specified Tests', value: 'RunSpecifiedTests' },
      { label: '$(package) Run Local Tests', value: 'RunLocalTests' },
      { label: '$(globe) Run All Tests', value: 'RunAllTestsInOrg' },
    ],
    {
      placeHolder: 'Select test level',
    }
  );

  if (!testLevel) {
    return undefined;
  }

  options.testLevel = testLevel.value as any;

  // If specified tests, ask for test classes
  if (testLevel.value === 'RunSpecifiedTests') {
    const testsInput = await vscode.window.showInputBox({
      prompt: 'Enter test class names (comma-separated)',
      placeHolder: 'e.g., MyTest, AccountTest, ContactTest',
    });

    if (testsInput) {
      options.runTests = testsInput
        .split(',')
        .map(t => t.trim())
        .filter(t => t);
    }
  }

  // Include dependencies
  const includeDeps = await vscode.window.showQuickPick(
    [
      { label: '$(package) Include Dependencies', value: true },
      { label: '$(dash) Package Only', value: false },
    ],
    {
      placeHolder: 'Deploy dependencies?',
    }
  );

  if (includeDeps) {
    options.includeDependencies = includeDeps.value;
  }

  // Check only
  const checkOnly = await vscode.window.showQuickPick(
    [
      { label: '$(rocket) Deploy', value: false },
      { label: '$(check) Validate Only', value: true },
    ],
    {
      placeHolder: 'Deployment mode',
    }
  );

  if (checkOnly) {
    options.checkOnly = checkOnly.value;
  }

  return options;
}

export async function scanPackageFromCodeLens(packageInfo: any) {
  const packageName =
    packageInfo.package || packageInfo.path || 'Unknown Package';

  logger.info(`Scanning package: ${packageName}`, packageInfo);

  // Get workspace folder
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder found');
    return;
  }

  // Get package path from sfdx-project.json if not provided
  let packagePath: string;
  if (packageInfo.path) {
    packagePath = path.join(workspaceFolder.uri.fsPath, packageInfo.path);
  } else {
    // Read sfdx-project.json to find package path
    const projectJsonPath = path.join(
      workspaceFolder.uri.fsPath,
      'sfdx-project.json'
    );
    try {
      const projectJson = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));
      const packageDir = projectJson.packageDirectories.find(
        (dir: any) => dir.package === packageName
      );
      if (!packageDir || !packageDir.path) {
        vscode.window.showErrorMessage(
          `Package path not found for ${packageName} in sfdx-project.json`
        );
        return;
      }
      packagePath = path.join(workspaceFolder.uri.fsPath, packageDir.path);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to read sfdx-project.json: ${error}`
      );
      return;
    }
  }

  // Check if package path exists
  if (!fs.existsSync(packagePath)) {
    vscode.window.showErrorMessage(`Package path not found: ${packagePath}`);
    return;
  }

  // Show scan options
  const scanOption = await vscode.window.showQuickPick(
    [
      { label: '$(search) Quick Scan (Default Rules)', value: 'quick' },
      { label: '$(checklist) Full Scan (All Rules)', value: 'full' },
      { label: '$(gear) Custom Scan...', value: 'custom' },
      { label: '$(folder) Scan with Custom Rules', value: 'custom-rules' },
    ],
    {
      placeHolder: `Select scan option for ${packageName}`,
    }
  );

  if (!scanOption) {
    return;
  }

  // Prepare scan options
  const scanService = ScanService.getInstance();
  const scanOptions: ScanOptions = {
    packagePath: packagePath,
    packageName: packageName,
    format: 'xml',
    cache: true,
  };

  // Configure based on scan option
  switch (scanOption.value) {
    case 'quick':
      scanOptions.rulesets = [
        'category/apex/bestpractices.xml',
        'category/apex/errorprone.xml',
        'category/apex/security.xml',
      ];
      scanOptions.minimumPriority = 3;
      break;
    case 'full':
      // Use all default rulesets (will be set by service)
      break;
    case 'custom':
      const customOptions = await showScanCustomOptions();
      if (!customOptions) {
        return;
      }
      Object.assign(scanOptions, customOptions);
      break;
    case 'custom-rules':
      const customRulesPath = await selectCustomRulesPath(
        workspaceFolder.uri.fsPath
      );
      if (customRulesPath) {
        scanOptions.customRulesPath = customRulesPath;
      }
      break;
  }

  // Create diagnostic collection
  const diagnostics = vscode.languages.createDiagnosticCollection(
    'packageforce.scanner'
  );

  // Run scan with progress
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Scanning ${packageName}`,
      cancellable: true,
    },
    async (progress, token) => {
      try {
        progress.report({ increment: 0, message: 'Initializing PMD...' });

        if (token.isCancellationRequested) {
          return;
        }

        progress.report({ increment: 20, message: 'Loading configuration...' });
        await scanService.loadWorkspaceConfiguration();

        if (token.isCancellationRequested) {
          return;
        }

        progress.report({
          increment: 40,
          message: 'Running static analysis...',
        });
        const result = await scanService.scanPackage(scanOptions);

        if (token.isCancellationRequested) {
          diagnostics.dispose();
          return;
        }

        progress.report({ increment: 80, message: 'Processing results...' });

        // Update diagnostics
        const scanDiagnostics = scanService.createDiagnostics(result);
        diagnostics.clear();
        scanDiagnostics.forEach((fileDiagnostics, uri) => {
          diagnostics.set(uri, fileDiagnostics);
        });

        progress.report({ increment: 100, message: 'Analysis complete!' });

        // Show summary
        const violationSummary =
          result.totalViolations === 0
            ? 'No violations found!'
            : `Found ${result.totalViolations} violation${result.totalViolations === 1 ? '' : 's'}`;

        const actions = ['View Output', 'Save to Package', 'Export Report'];
        const action = await vscode.window.showInformationMessage(
          `Code analysis for "${packageName}" completed. ${violationSummary}`,
          ...actions
        );

        if (action === 'View Output') {
          scanService.outputChannel.show();
        } else if (action === 'Save to Package') {
          await saveScanResultsToPackage(result, packagePath, scanService);
        } else if (action === 'Export Report') {
          await exportScanReport(result, workspaceFolder.uri.fsPath);
        }
      } catch (error) {
        diagnostics.dispose();
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error(`Scan failed for ${packageName}:`, error);
        vscode.window.showErrorMessage(`Scan failed: ${errorMessage}`);
      }
    }
  );
}

async function showScanCustomOptions(): Promise<
  Partial<ScanOptions> | undefined
> {
  const options: Partial<ScanOptions> = {};

  // Select rulesets
  const availableRulesets =
    await ScanService.getInstance().getAvailableRulesets();
  const selectedRulesets = await vscode.window.showQuickPick(
    availableRulesets.map(ruleset => ({
      label: path.basename(ruleset, '.xml'),
      description: ruleset,
      picked:
        ruleset.includes('bestpractices') || ruleset.includes('errorprone'),
    })),
    {
      placeHolder: 'Select rulesets to use',
      canPickMany: true,
    }
  );

  if (!selectedRulesets || selectedRulesets.length === 0) {
    return undefined;
  }

  options.rulesets = selectedRulesets.map(item => item.description);

  // Select minimum priority
  const priority = await vscode.window.showQuickPick(
    [
      { label: '🔴 Critical (1)', value: '1' },
      { label: '🟠 High (2)', value: '2' },
      { label: '🟡 Medium (3)', value: '3' },
      { label: '🔵 Low (4)', value: '4' },
      { label: '⚪ Info (5)', value: '5' },
    ],
    {
      placeHolder: 'Select minimum priority level',
    }
  );

  if (priority) {
    options.minimumPriority = parseInt(priority.value);
  }

  // Thread count
  const threads = await vscode.window.showInputBox({
    prompt: 'Number of threads (leave empty for default)',
    placeHolder: '4',
    validateInput: value => {
      if (value && (isNaN(parseInt(value)) || parseInt(value) < 1)) {
        return 'Please enter a valid number greater than 0';
      }
      return null;
    },
  });

  if (threads) {
    options.threads = parseInt(threads);
  }

  return options;
}

async function selectCustomRulesPath(
  workspacePath: string
): Promise<string | undefined> {
  // Check common locations for custom rules
  const commonPaths = [
    path.join(workspacePath, '.pmd'),
    path.join(workspacePath, 'config', 'pmd'),
    path.join(workspacePath, 'pmd-rules'),
  ];

  const existingPaths = [];
  for (const p of commonPaths) {
    if (fs.existsSync(p)) {
      existingPaths.push({
        label: path.basename(p),
        description: p,
      });
    }
  }

  if (existingPaths.length > 0) {
    existingPaths.push({
      label: 'Browse...',
      description: 'Select a different directory',
    });

    const selected = await vscode.window.showQuickPick(existingPaths, {
      placeHolder: 'Select custom rules directory',
    });

    if (selected) {
      if (selected.label === 'Browse...') {
        const uri = await vscode.window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          openLabel: 'Select Rules Directory',
        });

        return uri?.[0]?.fsPath;
      } else {
        return selected.description;
      }
    }
  } else {
    // No common paths found, show browse dialog
    const uri = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Select Custom Rules Directory',
    });

    return uri?.[0]?.fsPath;
  }

  return undefined;
}

async function exportScanReport(
  result: any,
  workspacePath: string
): Promise<void> {
  const formats = [
    { label: '📄 HTML Report', value: 'html' },
    { label: '📊 CSV Export', value: 'csv' },
    { label: '📋 JSON Export', value: 'json' },
    { label: '📝 Markdown Report', value: 'md' },
  ];

  const format = await vscode.window.showQuickPick(formats, {
    placeHolder: 'Select export format',
  });

  if (!format) {
    return;
  }

  const defaultFileName = `scan-report-${result.packageName}-${new Date().toISOString().split('T')[0]}.${format.value}`;
  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(path.join(workspacePath, defaultFileName)),
    filters: {
      'Report Files': [format.value],
      'All Files': ['*'],
    },
  });

  if (!uri) {
    return;
  }

  try {
    let content = '';

    switch (format.value) {
      case 'html':
        content = generateHTMLReport(result);
        break;
      case 'csv':
        content = generateCSVReport(result);
        break;
      case 'json':
        content = JSON.stringify(result, null, 2);
        break;
      case 'md':
        content = generateMarkdownReport(result);
        break;
    }

    await fs.promises.writeFile(uri.fsPath, content, 'utf8');
    vscode.window.showInformationMessage(
      `Report exported to ${path.basename(uri.fsPath)}`
    );

    // Offer to open the file
    const action = await vscode.window.showInformationMessage(
      'Report exported successfully',
      'Open File'
    );

    if (action === 'Open File') {
      vscode.commands.executeCommand('vscode.open', uri);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to export report: ${errorMessage}`);
  }
}

function generateHTMLReport(result: any): string {
  const html = `<!DOCTYPE html>
<html>
<head>
    <title>Code Scan Report - ${result.packageName}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .violation { margin: 10px 0; padding: 10px; border-left: 3px solid #ff9800; background: #fff3e0; }
        .priority-1 { border-left-color: #f44336; background: #ffebee; }
        .priority-2 { border-left-color: #ff9800; background: #fff3e0; }
        .priority-3 { border-left-color: #ffc107; background: #fffde7; }
        .priority-4 { border-left-color: #2196f3; background: #e3f2fd; }
        .priority-5 { border-left-color: #9e9e9e; background: #fafafa; }
        .file-group { margin: 20px 0; }
        .file-name { font-weight: bold; color: #1976d2; margin: 15px 0 5px 0; }
    </style>
</head>
<body>
    <h1>Code Scan Report - ${result.packageName}</h1>
    <div class="summary">
        <p><strong>Total Violations:</strong> ${result.totalViolations}</p>
        <p><strong>Scan Date:</strong> ${new Date(result.timestamp).toLocaleString()}</p>
        <p><strong>Scan Duration:</strong> ${result.scanDuration}ms</p>
    </div>
    ${generateHTMLViolations(result.violations)}
</body>
</html>`;
  return html;
}

function generateHTMLViolations(violations: any[]): string {
  const violationsByFile = new Map<string, any[]>();

  for (const violation of violations) {
    if (!violationsByFile.has(violation.file)) {
      violationsByFile.set(violation.file, []);
    }
    violationsByFile.get(violation.file)!.push(violation);
  }

  let html = '';
  for (const [file, fileViolations] of violationsByFile) {
    html += `<div class="file-group">`;
    html += `<div class="file-name">${file}</div>`;

    for (const violation of fileViolations) {
      html += `<div class="violation priority-${violation.priority}">`;
      html += `<strong>Line ${violation.beginLine}:</strong> ${violation.message}<br>`;
      html += `<small>Rule: ${violation.rule} | Priority: ${violation.priority}</small>`;
      html += `</div>`;
    }
    html += `</div>`;
  }

  return html;
}

function generateCSVReport(result: any): string {
  const headers = ['File', 'Line', 'Priority', 'Rule', 'Message'];
  const rows = [headers.join(',')];

  for (const violation of result.violations) {
    const row = [
      `"${violation.file}"`,
      violation.beginLine,
      violation.priority,
      `"${violation.rule}"`,
      `"${violation.message.replace(/"/g, '""')}"`,
    ];
    rows.push(row.join(','));
  }

  return rows.join('\n');
}

function generateMarkdownReport(result: any): string {
  let md = `# Code Scan Report - ${result.packageName}\n\n`;
  md += `**Total Violations:** ${result.totalViolations}  \n`;
  md += `**Scan Date:** ${new Date(result.timestamp).toLocaleString()}  \n`;
  md += `**Scan Duration:** ${result.scanDuration}ms  \n\n`;

  if (result.violations.length === 0) {
    md += '✅ No violations found!\n';
    return md;
  }

  // Group by file
  const violationsByFile = new Map<string, any[]>();
  for (const violation of result.violations) {
    if (!violationsByFile.has(violation.file)) {
      violationsByFile.set(violation.file, []);
    }
    violationsByFile.get(violation.file)!.push(violation);
  }

  for (const [file, violations] of violationsByFile) {
    md += `## ${file}\n\n`;
    md += '| Line | Priority | Rule | Message |\n';
    md += '|------|----------|------|----------|\n';

    for (const violation of violations) {
      const priority = getPriorityEmoji(violation.priority);
      md += `| ${violation.beginLine} | ${priority} ${violation.priority} | ${violation.rule} | ${violation.message} |\n`;
    }
    md += '\n';
  }

  return md;
}

function getPriorityEmoji(priority: number): string {
  switch (priority) {
    case 1:
      return '🔴';
    case 2:
      return '🟠';
    case 3:
      return '🟡';
    case 4:
      return '🔵';
    case 5:
      return '⚪';
    default:
      return '⚫';
  }
}

async function exportDuplicateReport(
  result: any,
  workspacePath: string
): Promise<void> {
  const formats = [
    { label: '📄 HTML Report', value: 'html' },
    { label: '📊 CSV Export', value: 'csv' },
    { label: '📋 JSON Export', value: 'json' },
    { label: '📝 Markdown Report', value: 'md' },
  ];

  const format = await vscode.window.showQuickPick(formats, {
    placeHolder: 'Select export format',
  });

  if (!format) {
    return;
  }

  const defaultFileName = `duplicate-report-${result.packageName}-${new Date().toISOString().split('T')[0]}.${format.value}`;
  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(path.join(workspacePath, defaultFileName)),
    filters: {
      'Report Files': [format.value],
      'All Files': ['*'],
    },
  });

  if (!uri) {
    return;
  }

  try {
    let content = '';

    switch (format.value) {
      case 'html':
        content = generateDuplicateHTMLReport(result);
        break;
      case 'csv':
        content = generateDuplicateCSVReport(result);
        break;
      case 'json':
        content = JSON.stringify(result, null, 2);
        break;
      case 'md':
        content = generateDuplicateMarkdownReport(result);
        break;
    }

    await fs.promises.writeFile(uri.fsPath, content, 'utf8');
    vscode.window.showInformationMessage(
      `Report exported to ${path.basename(uri.fsPath)}`
    );

    // Offer to open the file
    const action = await vscode.window.showInformationMessage(
      'Duplicate report exported successfully',
      'Open File'
    );

    if (action === 'Open File') {
      vscode.commands.executeCommand('vscode.open', uri);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to export report: ${errorMessage}`);
  }
}

function generateDuplicateHTMLReport(result: any): string {
  const html = `<!DOCTYPE html>
<html>
<head>
    <title>Duplicate Code Report - ${result.packageName}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .duplication { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .occurrence { margin: 10px 0; padding: 10px; background: #f9f9f9; border-left: 3px solid #2196f3; }
        .code-fragment { background: #f5f5f5; padding: 10px; border-radius: 3px; font-family: monospace; white-space: pre-wrap; overflow-x: auto; }
        .no-duplicates { color: #4caf50; font-size: 18px; text-align: center; padding: 50px; }
    </style>
</head>
<body>
    <h1>Duplicate Code Report - ${result.packageName}</h1>
    <div class="summary">
        <p><strong>Total Duplications:</strong> ${result.totalDuplications}</p>
        <p><strong>Total Duplicated Lines:</strong> ${result.totalDuplicatedLines}</p>
        <p><strong>Total Duplicated Tokens:</strong> ${result.totalDuplicatedTokens}</p>
        <p><strong>Scan Date:</strong> ${new Date(result.timestamp).toLocaleString()}</p>
        <p><strong>Scan Duration:</strong> ${result.scanDuration}ms</p>
    </div>
    ${
      result.totalDuplications === 0
        ? '<div class="no-duplicates">✅ No duplicate code found!</div>'
        : generateDuplicateHTMLBody(result.duplications)
    }
</body>
</html>`;
  return html;
}

function generateDuplicateHTMLBody(duplications: any[]): string {
  let html = '';
  duplications.forEach((dup, index) => {
    html += `<div class="duplication">`;
    html += `<h3>Duplication #${index + 1}</h3>`;
    html += `<p><strong>Size:</strong> ${dup.lines} lines, ${dup.tokens} tokens</p>`;
    html += `<p><strong>Found in ${dup.occurrences.length} locations:</strong></p>`;

    dup.occurrences.forEach((occ: any, occIndex: number) => {
      html += `<div class="occurrence">`;
      html += `<strong>${occIndex + 1}.</strong> ${occ.file}<br>`;
      html += `Lines ${occ.startLine}-${occ.endLine}`;
      html += `</div>`;
    });

    if (dup.occurrences[0]?.codeFragment) {
      html += `<h4>Code Fragment:</h4>`;
      html += `<div class="code-fragment">${escapeHtml(dup.occurrences[0].codeFragment)}</div>`;
    }

    html += `</div>`;
  });
  return html;
}

function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function generateDuplicateCSVReport(result: any): string {
  const headers = [
    'Duplication #',
    'Lines',
    'Tokens',
    'File',
    'Start Line',
    'End Line',
  ];
  const rows = [headers.join(',')];

  result.duplications.forEach((dup: any, dupIndex: number) => {
    dup.occurrences.forEach((occ: any) => {
      const row = [
        dupIndex + 1,
        dup.lines,
        dup.tokens,
        `"${occ.file}"`,
        occ.startLine,
        occ.endLine,
      ];
      rows.push(row.join(','));
    });
  });

  return rows.join('\n');
}

function generateDuplicateMarkdownReport(result: any): string {
  let md = `# Duplicate Code Report - ${result.packageName}\n\n`;
  md += `**Total Duplications:** ${result.totalDuplications}  \n`;
  md += `**Total Duplicated Lines:** ${result.totalDuplicatedLines}  \n`;
  md += `**Total Duplicated Tokens:** ${result.totalDuplicatedTokens}  \n`;
  md += `**Scan Date:** ${new Date(result.timestamp).toLocaleString()}  \n`;
  md += `**Scan Duration:** ${result.scanDuration}ms  \n\n`;

  if (result.totalDuplications === 0) {
    md += '✅ **No duplicate code found!**\n';
    return md;
  }

  result.duplications.forEach((dup: any, index: number) => {
    md += `## Duplication #${index + 1}\n\n`;
    md += `- **Size:** ${dup.lines} lines, ${dup.tokens} tokens\n`;
    md += `- **Found in ${dup.occurrences.length} locations:**\n\n`;

    dup.occurrences.forEach((occ: any, occIndex: number) => {
      md += `  ${occIndex + 1}. \`${occ.file}\`\n`;
      md += `     - Lines ${occ.startLine}-${occ.endLine}\n`;
    });

    if (dup.occurrences[0]?.codeFragment) {
      md += `\n### Code Fragment:\n\n`;
      md += '```apex\n';
      md += dup.occurrences[0].codeFragment;
      md += '\n```\n';
    }

    md += '\n---\n\n';
  });

  return md;
}

export async function findDuplicatesFromCodeLens(packageInfo: any) {
  const packageName =
    packageInfo.package || packageInfo.path || 'Unknown Package';

  logger.info(`Finding duplicates for package: ${packageName}`, packageInfo);

  // Import duplicate detector service dynamically
  const { DuplicateDetectorService } = await import(
    '../services/duplicateDetectorService'
  );

  // Get workspace folder
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder found');
    return;
  }

  // Get package path
  let packagePath: string;
  if (packageInfo.path) {
    packagePath = path.join(workspaceFolder.uri.fsPath, packageInfo.path);
  } else {
    // Read sfdx-project.json to find package path
    const projectJsonPath = path.join(
      workspaceFolder.uri.fsPath,
      'sfdx-project.json'
    );
    try {
      const projectJson = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));
      const packageDir = projectJson.packageDirectories.find(
        (dir: any) => dir.package === packageName
      );
      if (!packageDir || !packageDir.path) {
        vscode.window.showErrorMessage(
          `Package path not found for ${packageName} in sfdx-project.json`
        );
        return;
      }
      packagePath = path.join(workspaceFolder.uri.fsPath, packageDir.path);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to read sfdx-project.json: ${error}`
      );
      return;
    }
  }

  // Check if package path exists
  if (!fs.existsSync(packagePath)) {
    vscode.window.showErrorMessage(`Package path not found: ${packagePath}`);
    return;
  }

  // Show options for duplicate detection
  const duplicateOption = await vscode.window.showQuickPick(
    [
      {
        label: '$(search) Large Duplicates (500+ tokens)',
        value: 'large',
        tokens: 500,
      },
      {
        label: '$(checklist) Medium Duplicates (200+ tokens)',
        value: 'medium',
        tokens: 200,
      },
      {
        label: '$(microscope) Small Duplicates (100+ tokens)',
        value: 'small',
        tokens: 100,
      },
      { label: '$(gear) Custom Settings...', value: 'custom' },
    ],
    {
      placeHolder: `Select duplicate detection sensitivity for ${packageName}`,
    }
  );

  if (!duplicateOption) {
    return;
  }

  let minimumTokens = duplicateOption.tokens || 100;
  let ignoreIdentifiers = false;
  let ignoreLiterals = false;

  // Handle custom settings
  if (duplicateOption.value === 'custom') {
    const tokensInput = await vscode.window.showInputBox({
      prompt: 'Minimum tokens for duplicate detection',
      value: '100',
      placeHolder: 'Enter a number (e.g., 50, 75, 100)',
      validateInput: value => {
        const num = parseInt(value);
        if (isNaN(num) || num < 10) {
          return 'Please enter a number greater than or equal to 10';
        }
        return null;
      },
    });

    if (!tokensInput) {
      return;
    }
    minimumTokens = parseInt(tokensInput);

    // Ask about ignore options
    const ignoreOptions = await vscode.window.showQuickPick(
      [
        {
          label: 'Exact Match',
          description: 'Find exact duplicates only',
          value: 'exact',
        },
        {
          label: 'Ignore Variable Names',
          description: 'Ignore identifier differences',
          value: 'identifiers',
        },
        {
          label: 'Ignore Literals',
          description: 'Ignore string/number differences',
          value: 'literals',
        },
        {
          label: 'Ignore Both',
          description: 'Most flexible matching',
          value: 'both',
        },
      ],
      {
        placeHolder: 'Select matching options',
      }
    );

    if (ignoreOptions) {
      ignoreIdentifiers =
        ignoreOptions.value === 'identifiers' || ignoreOptions.value === 'both';
      ignoreLiterals =
        ignoreOptions.value === 'literals' || ignoreOptions.value === 'both';
    }
  }

  // Create diagnostic collection for duplicates
  const diagnostics = vscode.languages.createDiagnosticCollection(
    'packageforce.duplicates'
  );

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Finding duplicates in ${packageName}`,
      cancellable: true,
    },
    async (progress, token) => {
      try {
        progress.report({
          increment: 0,
          message: 'Initializing duplicate detection...',
        });

        const duplicateService = DuplicateDetectorService.getInstance();

        if (token.isCancellationRequested) {
          return;
        }

        progress.report({
          increment: 20,
          message: 'Scanning package files...',
        });

        const options = {
          packagePath,
          packageName,
          workspaceRoot: workspaceFolder.uri.fsPath,
          minimumTokens,
          ignoreIdentifiers,
          ignoreLiterals,
          language: 'apex' as const,
        };

        progress.report({
          increment: 40,
          message: 'Analyzing code patterns...',
        });

        const result = await duplicateService.findDuplicates(options);

        if (token.isCancellationRequested) {
          diagnostics.dispose();
          return;
        }

        progress.report({ increment: 80, message: 'Processing results...' });

        // Update diagnostics
        const duplicateDiagnostics =
          duplicateService.createDuplicateDiagnostics(result);
        diagnostics.clear();
        duplicateDiagnostics.forEach((fileDiagnostics, uri) => {
          diagnostics.set(uri, fileDiagnostics);
        });

        progress.report({ increment: 100, message: 'Analysis complete!' });

        // Show summary
        const summary =
          result.totalDuplications === 0
            ? 'No duplicate code found!'
            : `Found ${result.totalDuplications} duplicate block${result.totalDuplications === 1 ? '' : 's'}`;

        // Determine if there are cross-package duplicates
        let hasCrossPackageDuplicates = false;
        result.duplications.forEach(dup => {
          const packages = new Set<string>();
          dup.occurrences.forEach(occ => {
            const pkgName = occ.file.includes('/')
              ? occ.file
                  .split('/')
                  .find(
                    (part: string) =>
                      part.endsWith('-app') ||
                      part === 'force-app' ||
                      part === 'src'
                  )
                  ?.replace('-app', '') || 'unknown'
              : 'unknown';
            packages.add(pkgName);
          });
          if (packages.size > 1) {
            hasCrossPackageDuplicates = true;
          }
        });

        if (result.totalDuplications === 0) {
          const actions = ['View Output', 'Save to Package'];
          const action = await vscode.window.showInformationMessage(
            `Duplicate analysis for "${packageName}" completed. ${summary}`,
            ...actions
          );

          if (action === 'View Output') {
            duplicateService.outputChannel.show();
          } else if (action === 'Save to Package') {
            await saveDuplicateResultsToPackage(
              result,
              packagePath,
              duplicateService
            );
          }
        } else {
          // Show error for duplicates, especially cross-package ones
          const errorMessage = hasCrossPackageDuplicates
            ? `❌ Duplicate analysis failed for "${packageName}". ${summary} including cross-package duplicates!`
            : `⚠️ Duplicate analysis for "${packageName}" completed with warnings. ${summary}`;

          const actions = ['View Output', 'Save to Package', 'Export Report'];
          const action = await vscode.window.showErrorMessage(
            errorMessage,
            ...actions
          );

          if (action === 'View Output') {
            duplicateService.outputChannel.show();
          } else if (action === 'Save to Package') {
            await saveDuplicateResultsToPackage(
              result,
              packagePath,
              duplicateService
            );
          } else if (action === 'Export Report') {
            await exportDuplicateReport(result, workspaceFolder.uri.fsPath);
          }

          // Throw error to indicate failure
          throw new Error(
            `Duplicate code detected in package ${packageName}: ${summary}`
          );
        }
      } catch (error) {
        diagnostics.dispose();
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error(`Duplicate detection failed for ${packageName}:`, error);
        vscode.window.showErrorMessage(
          `Duplicate detection failed: ${errorMessage}`
        );
      }
    }
  );
}

async function saveScanResultsToPackage(
  result: any,
  packagePath: string,
  scanService: ScanService
): Promise<void> {
  const formats = [
    { label: '📝 Markdown (Default)', value: 'markdown' },
    { label: '📄 PMD XML Format', value: 'xml' },
    { label: '📊 JSON Format', value: 'json' },
    { label: '📈 CSV Format', value: 'csv' },
    { label: '📃 Plain Text', value: 'text' },
    { label: '🌐 HTML Report', value: 'html' },
    { label: '🔧 SARIF (GitHub/VS Code)', value: 'sarif' },
  ];

  const format = await vscode.window.showQuickPick(formats, {
    placeHolder: 'Select format for scan results',
  });

  if (!format) {
    return;
  }

  try {
    const filePath = await scanService.saveResults(
      result,
      packagePath,
      format.value as any,
      { includeTimestamp: true, includeMetadata: true }
    );

    const openAction = await vscode.window.showInformationMessage(
      `Scan results saved to package directory`,
      'Open File',
      'Reveal in Explorer'
    );

    if (openAction === 'Open File') {
      const uri = vscode.Uri.file(filePath);
      vscode.commands.executeCommand('vscode.open', uri);
    } else if (openAction === 'Reveal in Explorer') {
      const uri = vscode.Uri.file(filePath);
      vscode.commands.executeCommand('revealInExplorer', uri);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(
      `Failed to save scan results: ${errorMessage}`
    );
  }
}

async function saveDuplicateResultsToPackage(
  result: any,
  packagePath: string,
  duplicateService: any
): Promise<void> {
  const formats = [
    { label: '📝 Markdown (Default)', value: 'markdown' },
    { label: '📄 CPD XML Format', value: 'xml' },
    { label: '📊 JSON Format', value: 'json' },
    { label: '📈 CSV Format', value: 'csv' },
    { label: '📃 Plain Text', value: 'text' },
  ];

  const format = await vscode.window.showQuickPick(formats, {
    placeHolder: 'Select format for duplicate analysis results',
  });

  if (!format) {
    return;
  }

  try {
    const filePath = await duplicateService.saveResults(
      result,
      packagePath,
      format.value as any,
      { includeTimestamp: true, includeMetadata: true }
    );

    const openAction = await vscode.window.showInformationMessage(
      `Duplicate analysis results saved to package directory`,
      'Open File',
      'Reveal in Explorer'
    );

    if (openAction === 'Open File') {
      const uri = vscode.Uri.file(filePath);
      vscode.commands.executeCommand('vscode.open', uri);
    } else if (openAction === 'Reveal in Explorer') {
      const uri = vscode.Uri.file(filePath);
      vscode.commands.executeCommand('revealInExplorer', uri);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(
      `Failed to save duplicate analysis results: ${errorMessage}`
    );
  }
}

export async function testPackageFromCodeLens(packageInfo: any) {
  try {
    logger.info('Test package from CodeLens triggered', packageInfo);

    // Get workspace folder
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder found');
      return;
    }

    // Ask for test execution mode
    const executionMode = await vscode.window.showQuickPick(
      ['Asynchronous (Default)', 'Synchronous'],
      {
        placeHolder: 'Select test execution mode',
        ignoreFocusOut: true,
      }
    );

    if (!executionMode) {
      return;
    }

    // Get org selection
    const targetOrgResult = await selectTargetOrg();
    if (targetOrgResult === false) {
      return;
    }
    const targetOrg = targetOrgResult || undefined;

    // Initialize test service
    const testService = new TestService();

    // Get package path from sfdx-project.json
    const projectJsonPath = path.join(
      workspaceFolder.uri.fsPath,
      'sfdx-project.json'
    );
    const projectJson = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));
    const packageDir = projectJson.packageDirectories.find(
      (dir: any) => dir.package === packageInfo.package
    );

    if (!packageDir) {
      vscode.window.showErrorMessage(
        `Package ${packageInfo.package} not found in sfdx-project.json`
      );
      return;
    }

    const packagePath = path.join(workspaceFolder.uri.fsPath, packageDir.path);

    // Prepare test options
    const testOptions: TestOptions = {
      packageName: packageInfo.package,
      packagePath: packagePath,
      targetOrg: targetOrg,
      runAsync: executionMode.startsWith('Asynchronous'),
    };

    // Show progress and run tests
    let testResult: TestResult | undefined;
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Running tests with coverage for ${packageInfo.package}`,
        cancellable: false,
      },
      async progress => {
        progress.report({ message: 'Connecting to org...' });

        // Run tests with coverage
        testResult = await testService.runTestsWithCoverage(testOptions);
      }
    );

    // Show result notification after progress is complete
    if (testResult) {
      if (testResult.success) {
        const coverageInfo = testResult.coverage
          ? ` (${testResult.coverage.overall}% coverage)`
          : '';
        const actions = ['View Output'];
        const selection = await vscode.window.showInformationMessage(
          `✅ Tests passed! ${testResult.passing} tests passed${coverageInfo}`,
          ...actions
        );

        if (selection === 'View Output') {
          vscode.commands.executeCommand(
            'workbench.action.output.show',
            'Packageforce Tests'
          );
        }
      } else {
        const actions = ['View Output'];
        const selection = await vscode.window.showErrorMessage(
          `❌ Tests failed! ${testResult.passing} passed, ${testResult.failing} failed`,
          ...actions
        );

        if (selection === 'View Output') {
          vscode.commands.executeCommand(
            'workbench.action.output.show',
            'Packageforce Tests'
          );
        }
      }
    }
  } catch (error) {
    logger.error('Test package failed:', error);
    vscode.window.showErrorMessage(`Test failed: ${error}`);
  }
}
