import * as vscode from 'vscode';
import { Logger } from '../utils/logger';

const logger = Logger.getInstance();

export async function executeSimpleChangelogCommand() {
  try {
    logger.info('Starting simple changelog test');

    // Test with basic string array instead of objects
    const changeType = await vscode.window.showQuickPick(
      ['Feature - Updates minor version', 'Fix - Updates patch version'],
      {
        placeHolder: 'Select the type of change',
      }
    );

    if (!changeType) {
      logger.info('User cancelled');
      vscode.window.showInformationMessage('Cancelled');
      return;
    }

    logger.info(`Selected: ${changeType}`);
    vscode.window.showInformationMessage(`You selected: ${changeType}`);
  } catch (error) {
    logger.error('Simple changelog error:', error);
    vscode.window.showErrorMessage(`Error: ${error}`);
  }
}
