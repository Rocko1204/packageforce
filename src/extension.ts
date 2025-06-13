import * as vscode from 'vscode';
import * as path from 'path';
import { SfdxProjectCodeLensProvider } from '@/providers/codeLensProvider';
import {
  deployPackageFromCodeLens,
  scanPackageFromCodeLens,
  findDuplicatesFromCodeLens,
  testPackageFromCodeLens,
} from '@/commands/packageCommands';
import {
  PackageExplorerProvider,
  showPackageQuickPick,
} from '@/commands/packageExplorer';
import { executeChangelogCommand } from '@/commands/changelogCommand';
import { testChangelogFlow } from '@/commands/testChangelogCommand';
import { executeSimpleChangelogCommand } from '@/commands/simpleChangelogCommand';
import { executeDebugChangelogCommand } from '@/commands/debugChangelogCommand';
import { executeMinimalChangelogCommand } from '@/commands/minimalChangelogCommand';
import { scanStagedFiles } from '@/commands/scanStagedFiles';
import {
  fetchScratchOrgFromPool,
  listScratchOrgsInPool,
} from '@/commands/poolCommands';
import { Logger } from '@/utils/logger';

const logger = Logger.getInstance();

let codeLensProvider: SfdxProjectCodeLensProvider;
let packageExplorer: PackageExplorerProvider;

export function activate(context: vscode.ExtensionContext) {
  try {
    console.log('Packageforce: Starting activation...');
    logger.info('Packageforce is activating...');

    // Register CodeLens Provider for sfdx-project.json
    codeLensProvider = new SfdxProjectCodeLensProvider();
    const codeLensDisposable = vscode.languages.registerCodeLensProvider(
      { scheme: 'file', pattern: '**/sfdx-project.json' },
      codeLensProvider
    );
    logger.info('CodeLens provider registered');

    // Register test command
    const testCommand = vscode.commands.registerCommand(
      'sfdxPkgMgr.testExtension',
      () => {
        logger.info('Test command triggered');
        vscode.window.showInformationMessage('Packageforce is working! 🎉');
      }
    );

    // Register Package Explorer
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceRoot) {
      try {
        packageExplorer = new PackageExplorerProvider(workspaceRoot);
        const treeView = vscode.window.createTreeView('sfdxPackageExplorer', {
          treeDataProvider: packageExplorer,
          showCollapseAll: true,
        });
        logger.info('Package Explorer registered');

        // Register the tree view without trying to reveal it
        context.subscriptions.push(treeView);
        logger.info('Package Explorer created');
      } catch (error) {
        logger.error('Failed to create Package Explorer', error);
        // Don't throw - extension can still work without tree view
      }
    } else {
      logger.warn('No workspace folder found, Package Explorer not created');
    }

    // Register Quick Pick command
    const quickPickCommand = vscode.commands.registerCommand(
      'sfdxPkgMgr.showPackageQuickPick',
      showPackageQuickPick
    );

    // Register CodeLens commands
    const deployFromCodeLensCommand = vscode.commands.registerCommand(
      'sfdxPkgMgr.deployPackageFromCodeLens',
      (packageInfo: any) => {
        logger.info('Deploy from CodeLens triggered', packageInfo);
        return deployPackageFromCodeLens(packageInfo);
      }
    );

    const scanFromCodeLensCommand = vscode.commands.registerCommand(
      'sfdxPkgMgr.scanPackageFromCodeLens',
      (packageInfo: any) => {
        logger.info('Scan from CodeLens triggered', packageInfo);
        return scanPackageFromCodeLens(packageInfo);
      }
    );

    const findDuplicatesCommand = vscode.commands.registerCommand(
      'sfdxPkgMgr.findDuplicatesFromCodeLens',
      (packageInfo: any) => {
        logger.info('Find duplicates from CodeLens triggered', packageInfo);
        return findDuplicatesFromCodeLens(packageInfo);
      }
    );

    const testFromCodeLensCommand = vscode.commands.registerCommand(
      'sfdxPkgMgr.testPackageFromCodeLens',
      (packageInfo: any) => {
        logger.info('Test from CodeLens triggered', packageInfo);
        return testPackageFromCodeLens(packageInfo);
      }
    );

    // Register changelog command
    const changelogCommand = vscode.commands.registerCommand(
      'sfdxPkgMgr.updateChangelog',
      () => {
        logger.info('Changelog command triggered');
        return executeChangelogCommand();
      }
    );

    // Register refresh command
    const refreshCommand = vscode.commands.registerCommand(
      'sfdxPkgMgr.refreshPackageExplorer',
      () => {
        if (packageExplorer) {
          packageExplorer.refresh();
          logger.info('Package Explorer refreshed');
        }
      }
    );

    // Register test changelog command
    const testChangelogCommand = vscode.commands.registerCommand(
      'sfdxPkgMgr.testChangelog',
      testChangelogFlow
    );

    // Register simple changelog command
    const simpleChangelogCommand = vscode.commands.registerCommand(
      'sfdxPkgMgr.simpleChangelog',
      executeSimpleChangelogCommand
    );

    // Register debug changelog command
    const debugChangelogCommand = vscode.commands.registerCommand(
      'sfdxPkgMgr.debugChangelog',
      executeDebugChangelogCommand
    );

    // Register minimal changelog command
    const minimalChangelogCommand = vscode.commands.registerCommand(
      'sfdxPkgMgr.minimalChangelog',
      executeMinimalChangelogCommand
    );

    // Register scan staged files command
    const scanStagedFilesCommand = vscode.commands.registerCommand(
      'sfdxPkgMgr.scanStagedFiles',
      scanStagedFiles
    );

    // Register package item clicked command
    const packageItemClickedCommand = vscode.commands.registerCommand(
      'sfdxPkgMgr.packageItemClicked',
      async (item: any) => {
        // Show quick pick with actions when a package is clicked
        const actions = [
          { label: '$(rocket) Deploy Package', action: 'deploy' },
          { label: '$(beaker) Test Package', action: 'test' },
          { label: '$(search) Scan Package', action: 'scan' },
          { label: '$(file-text) Go to Definition', action: 'goto' },
        ];

        const selectedAction = await vscode.window.showQuickPick(actions, {
          placeHolder: `Select action for ${item.label}`,
        });

        if (!selectedAction) {
          return;
        }

        switch (selectedAction.action) {
          case 'deploy':
            vscode.commands.executeCommand(
              'sfdxPkgMgr.deployPackageFromCodeLens',
              {
                package: item.label,
                path: item.packagePath,
                fromLine: item.lineNumber,
              }
            );
            break;
          case 'test':
            vscode.commands.executeCommand(
              'sfdxPkgMgr.testPackageFromCodeLens',
              {
                package: item.label,
                path: item.packagePath,
                fromLine: item.lineNumber,
              }
            );
            break;
          case 'scan':
            vscode.commands.executeCommand(
              'sfdxPkgMgr.scanPackageFromCodeLens',
              {
                package: item.label,
                path: item.packagePath,
                fromLine: item.lineNumber,
              }
            );
            break;
          case 'goto':
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
              const sfdxPath = path.join(
                workspaceFolder.uri.fsPath,
                'sfdx-project.json'
              );
              const doc = await vscode.workspace.openTextDocument(sfdxPath);
              const editor = await vscode.window.showTextDocument(doc);
              const position = new vscode.Position(item.lineNumber - 1, 0);
              editor.selection = new vscode.Selection(position, position);
              editor.revealRange(
                new vscode.Range(position, position),
                vscode.TextEditorRevealType.InCenter
              );
            }
            break;
        }
      }
    );

    // Register pool commands
    const poolFetchCommand = vscode.commands.registerCommand(
      'packageforce.pool.fetch',
      fetchScratchOrgFromPool
    );

    const poolListCommand = vscode.commands.registerCommand(
      'packageforce.pool.list',
      listScratchOrgsInPool
    );

    // Subscribe to disposables
    context.subscriptions.push(
      testCommand,
      quickPickCommand,
      deployFromCodeLensCommand,
      scanFromCodeLensCommand,
      findDuplicatesCommand,
      testFromCodeLensCommand,
      changelogCommand,
      refreshCommand,
      testChangelogCommand,
      simpleChangelogCommand,
      debugChangelogCommand,
      minimalChangelogCommand,
      scanStagedFilesCommand,
      packageItemClickedCommand,
      poolFetchCommand,
      poolListCommand,
      codeLensDisposable
    );

    logger.info('Packageforce activation complete');
    console.log('Packageforce: Activation complete');

    // Don't show activation message - it can block the extension
    // Users will see the extension is active in the Extensions view
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('Packageforce: Activation failed', error);
    logger.error('Activation failed', error);
    vscode.window.showErrorMessage(
      `Packageforce activation failed: ${errorMessage}`
    );
    throw error;
  }
}

export function deactivate() {
  logger.info('Packageforce deactivated');
  logger.dispose();
}
