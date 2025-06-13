import * as vscode from 'vscode';
import * as path from 'path';
import {
  FailedComponent,
  DeploymentResult,
  DeploymentError,
} from './deployTypes';
import { logger } from './logger';

export class ErrorHandler {
  private static instance: ErrorHandler;
  private diagnosticCollection: vscode.DiagnosticCollection;

  private constructor() {
    this.diagnosticCollection =
      vscode.languages.createDiagnosticCollection('sfdx-deploy');
  }

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle deployment errors and display them to the user
   * @param error The deployment error
   * @param packageName The name of the package being deployed
   */
  public async handleDeploymentError(
    error: DeploymentError | Error,
    packageName: string
  ): Promise<void> {
    logger.error(`Deployment failed for package: ${packageName}`, error);

    // Clear previous diagnostics
    this.diagnosticCollection.clear();

    let message = `Deployment failed for package "${packageName}": ${error.message}`;
    const actions: string[] = ['Show Output'];

    // If we have detailed component errors, process them
    if ('details' in error && error.details) {
      this.processComponentErrors(error.details);
      actions.push('Show Problems');
      message += `\n\n${error.details.length} component(s) failed.`;
    }

    const action = await vscode.window.showErrorMessage(message, ...actions);

    if (action === 'Show Output') {
      logger.show();
    } else if (action === 'Show Problems') {
      vscode.commands.executeCommand('workbench.actions.view.problems');
    }
  }

  /**
   * Process deployment result and display any errors or warnings
   * @param result The deployment result
   * @param packageName The name of the package deployed
   */
  public async processDeploymentResult(
    result: DeploymentResult,
    packageName: string
  ): Promise<void> {
    // Clear previous diagnostics
    this.diagnosticCollection.clear();

    if (!result.success) {
      // Process failed components
      if (result.failedComponents && result.failedComponents.length > 0) {
        this.processComponentErrors(result.failedComponents);

        const action = await vscode.window.showErrorMessage(
          `Deployment failed for "${packageName}": ${result.failedComponents.length} component(s) failed.`,
          'Show Problems',
          'Show Output'
        );

        if (action === 'Show Problems') {
          vscode.commands.executeCommand('workbench.actions.view.problems');
        } else if (action === 'Show Output') {
          logger.show();
        }
      }
    } else {
      // Process warnings if any
      if (result.warnings && result.warnings.length > 0) {
        logger.warn(
          `Deployment succeeded with warnings for "${packageName}"`,
          result.warnings
        );

        const action = await vscode.window.showWarningMessage(
          `Deployment succeeded with ${result.warnings.length} warning(s) for "${packageName}".`,
          'Show Warnings',
          'Dismiss'
        );

        if (action === 'Show Warnings') {
          this.showWarnings(result.warnings);
        }
      } else {
        // Success without warnings
        vscode.window.showInformationMessage(
          `Successfully deployed "${packageName}" (${result.numberComponentsDeployed} components).`
        );
      }
    }

    // Log test results if available
    if (result.runTestResult) {
      this.logTestResults(result.runTestResult);
    }
  }

  /**
   * Process component errors and add them to diagnostics
   * @param failedComponents Array of failed components
   */
  private processComponentErrors(failedComponents: FailedComponent[]): void {
    const diagnosticMap = new Map<string, vscode.Diagnostic[]>();

    for (const component of failedComponents) {
      if (!component.filePath) {
        logger.warn(`No file path for failed component: ${component.fullName}`);
        continue;
      }

      const fileUri = this.getFileUri(component.filePath);
      if (!fileUri) {
        continue;
      }

      const diagnostic = this.createDiagnostic(component);
      const diagnostics = diagnosticMap.get(fileUri.toString()) || [];
      diagnostics.push(diagnostic);
      diagnosticMap.set(fileUri.toString(), diagnostics);
    }

    // Set all diagnostics
    diagnosticMap.forEach((diagnostics, uriString) => {
      const uri = vscode.Uri.parse(uriString);
      this.diagnosticCollection.set(uri, diagnostics);
    });
  }

  /**
   * Create a diagnostic from a failed component
   * @param component The failed component
   * @returns VSCode diagnostic
   */
  private createDiagnostic(component: FailedComponent): vscode.Diagnostic {
    const line = (component.lineNumber || 1) - 1;
    const column = (component.columnNumber || 1) - 1;

    const range = new vscode.Range(
      new vscode.Position(line, column),
      new vscode.Position(line, column + 1)
    );

    const diagnostic = new vscode.Diagnostic(
      range,
      component.problem,
      vscode.DiagnosticSeverity.Error
    );

    diagnostic.source = 'SFDX Deploy';
    diagnostic.code = component.problemType;

    // Add quick fix if possible
    if (this.canAutoFix(component)) {
      diagnostic.tags = [vscode.DiagnosticTag.Unnecessary];
    }

    return diagnostic;
  }

  /**
   * Get the file URI for a given file path
   * @param filePath The file path (relative or absolute)
   * @returns VSCode URI or undefined
   */
  private getFileUri(filePath: string): vscode.Uri | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return undefined;
    }

    // If absolute path, use it directly
    if (path.isAbsolute(filePath)) {
      return vscode.Uri.file(filePath);
    }

    // Otherwise, resolve relative to workspace
    const absolutePath = path.join(workspaceFolders[0].uri.fsPath, filePath);
    return vscode.Uri.file(absolutePath);
  }

  /**
   * Check if a component error can be auto-fixed
   * @param component The failed component
   * @returns True if can be auto-fixed
   */
  private canAutoFix(component: FailedComponent): boolean {
    // Add logic for auto-fixable errors
    const autoFixableTypes = [
      'MISSING_SEMICOLON',
      'UNUSED_VARIABLE',
      'MISSING_FIELD_DESCRIPTION',
    ];

    return autoFixableTypes.includes(component.problemType);
  }

  /**
   * Show deployment warnings in a user-friendly way
   * @param warnings Array of deployment warnings
   */
  private async showWarnings(warnings: any[]): Promise<void> {
    const items = warnings.map(warning => ({
      label: warning.fullName || 'Unknown',
      description: warning.type || '',
      detail: warning.warning || warning.message || 'No details available',
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a warning to view details',
      canPickMany: false,
    });

    if (selected) {
      logger.show();
      logger.warn(`Warning for ${selected.label}:`, selected.detail);
    }
  }

  /**
   * Log test results to the output channel
   * @param testResult The test result object
   */
  private logTestResults(testResult: any): void {
    logger.info('=== Test Results ===');
    logger.info(`Tests Run: ${testResult.numTestsRun || 0}`);
    logger.info(`Failures: ${testResult.numFailures || 0}`);
    logger.info(`Total Time: ${testResult.totalTime || 0}ms`);

    if (testResult.testFailures && testResult.testFailures.length > 0) {
      logger.error('Test Failures:');
      for (const failure of testResult.testFailures) {
        logger.error(
          `  ${failure.name}.${failure.methodName}: ${failure.message}`
        );
        if (failure.stackTrace) {
          logger.error(`    Stack: ${failure.stackTrace}`);
        }
      }
    }

    if (testResult.codeCoverage && testResult.codeCoverage.length > 0) {
      logger.info('Code Coverage:');
      for (const coverage of testResult.codeCoverage) {
        const percentage = Math.round(coverage.coverage * 100) / 100;
        logger.info(
          `  ${coverage.name}: ${percentage}% (${coverage.numLocations - coverage.numLocationsNotCovered}/${coverage.numLocations})`
        );
      }
    }
  }

  /**
   * Clear all diagnostics
   */
  public clear(): void {
    this.diagnosticCollection.clear();
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.diagnosticCollection.dispose();
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();
