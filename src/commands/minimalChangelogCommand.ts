import * as vscode from 'vscode';
import * as path from 'path';
import { SfProjectJson } from '@salesforce/core';
import { GitService } from '../services/gitService';
import { ChangelogService } from '../services/changelogService';
import { Logger } from '../utils/logger';

const logger = Logger.getInstance();

export async function executeMinimalChangelogCommand() {
  try {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder found');
      return;
    }

    // Initialize services
    const gitService = new GitService(workspaceFolder.uri.fsPath);
    const changelogService = new ChangelogService();

    // Load project
    const projectJson = await SfProjectJson.create({
      rootFolder: workspaceFolder.uri.fsPath,
    });
    const projectContents = projectJson.getContents();

    // Get modified packages
    const modifiedPackages = await gitService.getModifiedPackages(
      projectContents.packageDirectories
    );

    if (modifiedPackages.length === 0) {
      vscode.window.showWarningMessage(
        'No staged changes found in any package'
      );
      return;
    }

    // DIRECTLY show change type - no info message before
    const changeType = await vscode.window.showQuickPick(['Feature', 'Fix'], {
      placeHolder: `Select change type for ${modifiedPackages[0].packageName}`,
    });

    if (!changeType) {
      return;
    }

    // Get reference
    const reference = await vscode.window.showInputBox({
      prompt: 'Enter work item reference',
      value: 'XXXXX-12345',
    });

    if (!reference) {
      return;
    }

    // Get description
    const description = await vscode.window.showInputBox({
      prompt: 'Describe your changes',
    });

    if (!description) {
      return;
    }

    // Breaking changes
    const breaking = await vscode.window.showQuickPick(['No', 'Yes'], {
      placeHolder: 'Breaking changes?',
    });

    if (!breaking) {
      return;
    }

    // Do the update
    const author = await gitService.getGitUser();
    const type = changeType.toLowerCase() as 'feature' | 'fix';
    const hasBreakingChanges = breaking === 'Yes';

    // Update version
    const pkg = modifiedPackages[0];
    const newVersion = changelogService.updatePackageVersion(
      pkg.versionNumber,
      type,
      hasBreakingChanges
    );

    // Update project json
    const packageIndex = projectContents.packageDirectories.findIndex(
      (p: any) => p.package === pkg.packageName
    );

    if (packageIndex !== -1) {
      (projectContents.packageDirectories[packageIndex] as any).versionNumber =
        newVersion;
      pkg.versionNumber = newVersion;
    }

    // Update readme
    const readmePath = await changelogService.updatePackageReadme(pkg, {
      type,
      hasBreakingChanges,
      reference,
      description,
      author,
    });

    // Save project json
    projectJson.setContentsFromObject(projectContents);
    await projectJson.write();

    // Stage files
    await gitService.stageFiles([readmePath, projectJson.getPath()]);

    vscode.window.showInformationMessage('Changelog updated successfully!');
  } catch (error) {
    logger.error('Minimal changelog error:', error);
    vscode.window.showErrorMessage(`Error: ${error}`);
  }
}
