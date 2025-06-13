import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as simpleGit from 'simple-git';
import { Logger } from '../utils/logger';
import { ScanService, ScanOptions } from '../services/scanService';

const logger = Logger.getInstance();

export async function scanStagedFiles() {
  logger.info('Scanning staged files');

  // Get workspace folder
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder found');
    return;
  }

  const git = simpleGit.simpleGit(workspaceFolder.uri.fsPath);

  try {
    // Get staged files
    const status = await git.status();
    const stagedFiles = [...status.staged, ...status.created];

    if (stagedFiles.length === 0) {
      vscode.window.showInformationMessage('No staged files to scan');
      return;
    }

    // Filter for files that PMD can analyze
    const analyzableFiles = stagedFiles.filter(file => {
      // Apex files
      if (file.endsWith('.cls') || file.endsWith('.trigger')) {
        return true;
      }

      // Visualforce files
      if (file.endsWith('.page') || file.endsWith('.component')) {
        return true;
      }

      // Lightning Web Components
      if (file.endsWith('.js') && file.includes('/lwc/')) {
        return true;
      }
      if (file.endsWith('.html') && file.includes('/lwc/')) {
        return true;
      }

      // Aura Components
      if (
        file.endsWith('.cmp') ||
        file.endsWith('.evt') ||
        file.endsWith('.app')
      ) {
        return true;
      }
      if (file.endsWith('.js') && file.includes('/aura/')) {
        return true;
      }

      // Metadata files (for custom rules like empty descriptions)
      if (
        file.endsWith('.object-meta.xml') ||
        file.endsWith('.field-meta.xml')
      ) {
        return true;
      }
      if (file.endsWith('.flow-meta.xml')) {
        return true;
      }
      if (file.endsWith('.permissionset-meta.xml')) {
        return true;
      }
      if (file.endsWith('.profile-meta.xml')) {
        return true;
      }

      // Configuration files
      if (
        file.endsWith('.xml') &&
        (file.includes('/objects/') ||
          file.includes('/fields/') ||
          file.includes('/flows/') ||
          file.includes('/classes/') ||
          file.includes('/triggers/'))
      ) {
        return true;
      }

      return false;
    });

    if (analyzableFiles.length === 0) {
      vscode.window.showInformationMessage(
        'No analyzable files in staged changes'
      );
      return;
    }

    // Show scan options
    const scanOption = await vscode.window.showQuickPick(
      [
        { label: '$(search) Quick Scan (Default Rules)', value: 'quick' },
        { label: '$(checklist) Full Scan (All Rules)', value: 'full' },
        { label: '$(folder) Scan with Custom Rules', value: 'custom-rules' },
      ],
      {
        placeHolder: `Select scan option for ${analyzableFiles.length} staged file${analyzableFiles.length === 1 ? '' : 's'}`,
      }
    );

    if (!scanOption) {
      return;
    }

    // Prepare scan options
    const scanService = ScanService.getInstance();
    const scanOptions: ScanOptions = {
      packagePath: workspaceFolder.uri.fsPath,
      packageName: 'Staged Files',
      format: 'xml',
      cache: false,
      fileList: analyzableFiles.map(file =>
        path.join(workspaceFolder.uri.fsPath, file)
      ),
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
        // Always include custom rules for metadata files
        const customPath = path.join(workspaceFolder.uri.fsPath, '.pmd');
        if (fs.existsSync(customPath)) {
          scanOptions.customRulesPath = customPath;
        }
        break;
      case 'full':
        // Use all default rulesets (will be set by service)
        // Always include custom rules for metadata files
        const fullCustomPath = path.join(workspaceFolder.uri.fsPath, '.pmd');
        if (fs.existsSync(fullCustomPath)) {
          scanOptions.customRulesPath = fullCustomPath;
        }
        break;
      case 'custom-rules':
        const customRulesPath = path.join(workspaceFolder.uri.fsPath, '.pmd');
        scanOptions.customRulesPath = customRulesPath;
        // Don't specify rulesets - will use all available including custom
        break;
    }

    // Create diagnostic collection
    const diagnostics = vscode.languages.createDiagnosticCollection(
      'packageforce.scanner.staged'
    );

    // Run scan with progress
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Scanning ${analyzableFiles.length} staged file${analyzableFiles.length === 1 ? '' : 's'}`,
        cancellable: true,
      },
      async (progress, token) => {
        try {
          progress.report({ increment: 0, message: 'Initializing PMD...' });

          if (token.isCancellationRequested) {
            return;
          }

          progress.report({
            increment: 20,
            message: 'Loading configuration...',
          });
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

          const filesSummary = `in ${analyzableFiles.length} staged file${analyzableFiles.length === 1 ? '' : 's'}`;

          const action = await vscode.window.showInformationMessage(
            `Code analysis completed for staged files. ${violationSummary} ${filesSummary}`,
            'View Output'
          );

          if (action === 'View Output') {
            scanService.outputChannel.show();
          }
        } catch (error) {
          diagnostics.dispose();
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          logger.error(`Scan failed for staged files:`, error);
          vscode.window.showErrorMessage(`Scan failed: ${errorMessage}`);
        }
      }
    );
  } catch (error) {
    logger.error('Failed to get staged files:', error);
    vscode.window.showErrorMessage(`Failed to get staged files: ${error}`);
  }
}
