import * as vscode from 'vscode';
import { Logger } from '../utils/logger';

const logger = Logger.getInstance();

export async function testChangelogFlow() {
  try {
    logger.info('Starting test changelog flow');

    // Test 1: Simple information message
    await vscode.window.showInformationMessage(
      'Test 1: Information message works'
    );

    // Add a small delay to ensure the message is dismissed
    await new Promise(resolve => setTimeout(resolve, 100));

    // Test 2: Quick pick
    logger.info('Showing test quick pick');
    const choice = await vscode.window.showQuickPick(
      ['Option 1', 'Option 2', 'Option 3'],
      {
        placeHolder: 'Test quick pick - select any option',
        ignoreFocusOut: true,
      }
    );

    if (!choice) {
      logger.info('Quick pick was cancelled');
      await vscode.window.showInformationMessage('Quick pick was cancelled');
      return;
    }

    logger.info(`Selected: ${choice}`);
    await vscode.window.showInformationMessage(`You selected: ${choice}`);

    // Test 3: Input box
    const input = await vscode.window.showInputBox({
      prompt: 'Test input box - enter any text',
      value: 'default value',
      ignoreFocusOut: true,
    });

    if (!input) {
      logger.info('Input box was cancelled');
      await vscode.window.showInformationMessage('Input box was cancelled');
      return;
    }

    logger.info(`Input: ${input}`);
    await vscode.window.showInformationMessage(`You entered: ${input}`);

    // Test 4: Warning with options
    const warning = await vscode.window.showWarningMessage(
      'Test warning - select an option',
      'Option A',
      'Option B'
    );

    logger.info(`Warning selection: ${warning}`);
    await vscode.window.showInformationMessage(
      `Warning selection: ${warning || 'cancelled'}`
    );

    logger.info('Test changelog flow completed');
    vscode.window.showInformationMessage('All tests completed successfully!');
  } catch (error) {
    logger.error('Test changelog flow error:', error);
    vscode.window.showErrorMessage(`Test failed: ${error}`);
  }
}
