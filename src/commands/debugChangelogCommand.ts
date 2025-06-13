import * as vscode from 'vscode';
import * as path from 'path';
import { SfProjectJson } from '@salesforce/core';
import { GitService } from '../services/gitService';
import { Logger } from '../utils/logger';

const logger = Logger.getInstance();

export async function executeDebugChangelogCommand() {
  try {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder found');
      return;
    }

    logger.info('=== DEBUG CHANGELOG START ===');

    // Test 1: Can we show multiple prompts?
    const test1 = await vscode.window.showQuickPick(['Yes', 'No'], {
      placeHolder: 'Debug Test 1: Can you see this?'
    });
    logger.info(`Test 1 result: ${test1}`);
    
    if (!test1) {
      logger.info('Test 1 cancelled');
      return;
    }

    // Test 2: Can we show input box?
    const test2 = await vscode.window.showInputBox({
      prompt: 'Debug Test 2: Can you type here?',
      value: 'default'
    });
    logger.info(`Test 2 result: ${test2}`);
    
    if (!test2) {
      logger.info('Test 2 cancelled');
      return;
    }

    // Test 3: Load project and check packages
    logger.info('Loading sfdx-project.json...');
    const projectJson = await SfProjectJson.create({ rootFolder: workspaceFolder.uri.fsPath });
    const projectContents = projectJson.getContents();
    logger.info(`Package directories: ${JSON.stringify(projectContents.packageDirectories?.map((p: any) => p.package))}`);

    // Test 4: Check git status
    logger.info('Checking git status...');
    const gitService = new GitService(workspaceFolder.uri.fsPath);
    const stagedFiles = await gitService.getStagedFiles();
    logger.info(`Staged files: ${JSON.stringify(stagedFiles)}`);

    // Test 5: Find modified packages
    const modifiedPackages = await gitService.getModifiedPackages(projectContents.packageDirectories);
    logger.info(`Modified packages: ${JSON.stringify(modifiedPackages.map(p => p.packageName))}`);

    // Test 6: Show the actual change type prompt
    logger.info('About to show change type prompt...');
    
    // DO NOT show info message before quick pick
    const changeType = await vscode.window.showQuickPick(
      ['Feature', 'Fix'],
      { placeHolder: 'Select change type' }
    );
    
    logger.info(`Change type selected: ${changeType}`);
    
    if (!changeType) {
      logger.info('Change type cancelled');
      return;
    }

    vscode.window.showInformationMessage(`Debug complete! You selected: ${changeType}`);
    logger.info('=== DEBUG CHANGELOG END ===');
    
  } catch (error) {
    logger.error('Debug changelog error:', error);
    vscode.window.showErrorMessage(`Debug error: ${error}`);
  }
}