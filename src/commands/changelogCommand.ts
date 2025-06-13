import * as vscode from 'vscode';
import * as path from 'path';
import { SfProjectJson } from '@salesforce/core';
import { GitService } from '../services/gitService';
import { ChangelogService } from '../services/changelogService';
import {
  ChangelogOptions,
  PackageChangeInfo,
  PluginSettings,
} from '../utils/changelogTypes';
import { Logger } from '../utils/logger';

const logger = Logger.getInstance();

export async function executeChangelogCommand() {
  try {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder found');
      return;
    }

    logger.info('Starting changelog command');

    // Initialize services
    const gitService = new GitService(workspaceFolder.uri.fsPath);
    const changelogService = new ChangelogService();

    // Load sfdx-project.json
    let projectJson: SfProjectJson;
    let projectContents: any;
    let settings: PluginSettings | undefined;

    try {
      projectJson = await SfProjectJson.create({
        rootFolder: workspaceFolder.uri.fsPath,
      });
      projectContents = projectJson.getContents();
      settings = projectContents.plugins?.['eon-sfdx'] as
        | PluginSettings
        | undefined;

      logger.info(`Loaded sfdx-project.json successfully`);
      logger.info(
        `Found ${projectContents.packageDirectories?.length || 0} package directories`
      );

      if (
        !projectContents.packageDirectories ||
        projectContents.packageDirectories.length === 0
      ) {
        vscode.window.showErrorMessage(
          'No package directories found in sfdx-project.json'
        );
        return;
      }
    } catch (error) {
      logger.error('Failed to load sfdx-project.json:', error);
      vscode.window.showErrorMessage(
        `Failed to load sfdx-project.json: ${error}`
      );
      return;
    }

    // Get modified packages from staged files
    const modifiedPackages = await gitService.getModifiedPackages(
      projectContents.packageDirectories
    );

    if (modifiedPackages.length === 0) {
      const choice = await vscode.window.showWarningMessage(
        'No staged changes found in any package. Please stage your changes first.',
        'Show Git Status'
      );

      if (choice === 'Show Git Status') {
        vscode.commands.executeCommand('workbench.view.scm');
      }
      return;
    }

    // For multiple packages, ask for confirmation
    if (modifiedPackages.length > 1) {
      const proceed = await vscode.window.showWarningMessage(
        `Found changes in ${modifiedPackages.length} packages: ${modifiedPackages.map(p => p.packageName).join(', ')}. Continue?`,
        'Yes',
        'No'
      );

      if (proceed !== 'Yes') {
        return;
      }
    }

    // DIRECTLY show change type - no info message
    const packageNames = modifiedPackages.map(p => p.packageName).join(', ');
    const changeTypeSelection = await vscode.window.showQuickPick(
      ['Feature - Updates minor version', 'Fix - Updates patch version'],
      {
        placeHolder: `Select change type for: ${packageNames}`,
        ignoreFocusOut: true,
      }
    );

    if (!changeTypeSelection) {
      logger.info('User cancelled at change type selection');
      return;
    }

    const changeType = changeTypeSelection.startsWith('Feature')
      ? 'feature'
      : 'fix';
    logger.info(`User selected change type: ${changeType}`);

    // Get reference (e.g., JIRA ticket)
    const currentBranch = await gitService.getCurrentBranch();
    let defaultReference = 'XXXXX-12345';

    if (settings?.workItemFilter) {
      const match = currentBranch.match(new RegExp(settings.workItemFilter));
      if (match) {
        defaultReference = match[0];
      }
    }

    const reference = await vscode.window.showInputBox({
      prompt: 'Enter work item reference (e.g., JIRA ticket)',
      value: defaultReference,
      ignoreFocusOut: true,
      validateInput: value => {
        return value.trim() ? null : 'Reference is required';
      },
    });

    if (!reference) {
      return;
    }

    // Get description
    const description = await vscode.window.showInputBox({
      prompt: 'Describe your changes briefly',
      ignoreFocusOut: true,
      validateInput: value => {
        return value.trim() ? null : 'Description is required';
      },
    });

    if (!description) {
      return;
    }

    // Check for breaking changes
    const breakingChangeSelection = await vscode.window.showQuickPick(
      [
        'No breaking changes',
        'Yes - includes breaking changes (major version)',
      ],
      {
        placeHolder: 'Do your changes include breaking changes?',
        ignoreFocusOut: true,
      }
    );

    if (breakingChangeSelection === undefined) {
      return;
    }

    const hasBreakingChanges = breakingChangeSelection.startsWith('Yes');

    // Get git user
    const author = await gitService.getGitUser();

    // Prepare changelog options
    const options: ChangelogOptions = {
      type: changeType as 'feature' | 'fix',
      hasBreakingChanges: hasBreakingChanges,
      reference,
      description,
      author,
    };

    // Show summary and confirm
    const commitPrefix = changeType === 'feature' ? 'feat:' : 'fix:';
    const commitMessage = `${commitPrefix} ${reference} ${description}`;

    const summaryItems: string[] = [
      `Commit message: ${commitMessage}`,
      `Packages to update: ${modifiedPackages.map(p => p.packageName).join(', ')}`,
    ];

    // Calculate new versions
    const versionUpdates: string[] = [];
    for (const pkg of modifiedPackages) {
      const newVersion = changelogService.updatePackageVersion(
        pkg.versionNumber,
        options.type,
        options.hasBreakingChanges
      );
      versionUpdates.push(
        `${pkg.packageName}: ${pkg.versionNumber} → ${newVersion}`
      );
    }

    summaryItems.push(...versionUpdates);

    // Show summary as a message first, then confirm
    const summaryMessage = `${commitMessage} | ${versionUpdates.join(' | ')}`;

    const confirmSelection = await vscode.window.showQuickPick(
      ['Yes - update files and stage changes', 'No - cancel'],
      {
        placeHolder: summaryMessage,
        ignoreFocusOut: true,
      }
    );

    if (!confirmSelection || confirmSelection.startsWith('No')) {
      return;
    }

    // Update files
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Updating changelog and versions',
        cancellable: false,
      },
      async progress => {
        const updatedFiles: string[] = [];

        // Update each package
        for (const pkg of modifiedPackages) {
          progress.report({ message: `Updating ${pkg.packageName}...` });

          // Update version in sfdx-project.json
          const newVersion = changelogService.updatePackageVersion(
            pkg.versionNumber,
            options.type,
            options.hasBreakingChanges
          );

          // Find and update package in project json
          const packageIndex = projectContents.packageDirectories.findIndex(
            (p: any) => p.package === pkg.packageName
          );

          if (packageIndex !== -1) {
            (
              projectContents.packageDirectories[packageIndex] as any
            ).versionNumber = newVersion;

            // Update package info for readme
            pkg.versionNumber = newVersion;
          }

          // Update readme if enabled
          if (settings?.enableReadmeGeneration !== false) {
            const readmePath = await changelogService.updatePackageReadme(
              pkg,
              options,
              settings
            );
            updatedFiles.push(readmePath);

            // Also add variations for case sensitivity
            updatedFiles.push(readmePath.replace('readme.md', 'README.md'));
            updatedFiles.push(readmePath.replace('readme.md', 'Readme.md'));
          }
        }

        // Save updated sfdx-project.json
        progress.report({ message: 'Saving sfdx-project.json...' });
        projectJson.setContentsFromObject(projectContents);
        await projectJson.write();
        updatedFiles.push(projectJson.getPath());

        // Stage all updated files
        progress.report({ message: 'Staging files...' });
        await gitService.stageFiles(updatedFiles);

        logger.info(`Updated ${updatedFiles.length} files`);
      }
    );

    vscode.window
      .showInformationMessage(
        `✅ Successfully updated changelog and staged files. Ready to commit!`,
        'Copy Commit Message'
      )
      .then(selection => {
        if (selection === 'Copy Commit Message') {
          vscode.env.clipboard.writeText(commitMessage);
          vscode.window.showInformationMessage(
            'Commit message copied to clipboard'
          );
        }
      });
  } catch (error) {
    logger.error('Changelog command failed:', error);
    vscode.window.showErrorMessage(`Changelog update failed: ${error}`);
  }
}
