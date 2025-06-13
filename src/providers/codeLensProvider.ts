import * as vscode from 'vscode';
import { parsePackagesFromJson } from '@/utils/packageParser';
import { Logger } from '@/utils/logger';

const logger = Logger.getInstance();

export class SfdxProjectCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> =
    this._onDidChangeCodeLenses.event;

  public provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    if (!document.fileName.endsWith('sfdx-project.json')) {
      return [];
    }

    return this.parseProjectFile(document);
  }

  private parseProjectFile(document: vscode.TextDocument): vscode.CodeLens[] {
    const codeLenses: vscode.CodeLens[] = [];

    try {
      // Use the robust parser
      const packages = parsePackagesFromJson(document.fileName);
      const lines = document.getText().split('\n');
      
      packages.forEach(pkg => {
        if (pkg.lineNumber === 0) {
          logger.warn(`Could not find line for package "${pkg.name}"`);
          return;
        }

        logger.debug(`Found package "${pkg.name}" at line ${pkg.lineNumber}`);

        // Get the actual line and find the package name position
        const lineIndex = pkg.lineNumber - 1;
        const line = lines[lineIndex];
        const packageStart = line.indexOf(pkg.name);
        
        if (packageStart === -1) {
          logger.warn(`Could not find package name "${pkg.name}" in line ${pkg.lineNumber}`);
          return;
        }

        const packageEnd = packageStart + pkg.name.length;
        
        const range = new vscode.Range(
          lineIndex, 
          packageStart, 
          lineIndex, 
          packageEnd
        );

        // Deploy CodeLens
        const deployCodeLens = new vscode.CodeLens(range, {
          title: `🚀 Deploy`,
          command: 'sfdxPkgMgr.deployPackageFromCodeLens',
          arguments: [{ package: pkg.name, path: pkg.path, fromLine: pkg.lineNumber }],
        });

        // Scan CodeLens
        const scanCodeLens = new vscode.CodeLens(range, {
          title: `🔍 Scan`,
          command: 'sfdxPkgMgr.scanPackageFromCodeLens',
          arguments: [{ package: pkg.name, path: pkg.path, fromLine: pkg.lineNumber }],
        });

        // Find Duplicates CodeLens
        const duplicatesCodeLens = new vscode.CodeLens(range, {
          title: `🔎 Find Duplicates`,
          command: 'sfdxPkgMgr.findDuplicatesFromCodeLens',
          arguments: [{ package: pkg.name, path: pkg.path, fromLine: pkg.lineNumber }],
        });

        // Test CodeLens
        const testCodeLens = new vscode.CodeLens(range, {
          title: `🧪 Test`,
          command: 'sfdxPkgMgr.testPackageFromCodeLens',
          arguments: [{ package: pkg.name, path: pkg.path, fromLine: pkg.lineNumber }],
        });

        codeLenses.push(deployCodeLens, scanCodeLens, duplicatesCodeLens, testCodeLens);
      });

      logger.info(`Created ${codeLenses.length} CodeLenses for ${packages.length} packages`);
      
    } catch (error) {
      logger.error('Error parsing sfdx-project.json for CodeLens:', error);
      vscode.window.showErrorMessage(`Error parsing sfdx-project.json: ${error}`);
    }

    return codeLenses;
  }


  public refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }
}