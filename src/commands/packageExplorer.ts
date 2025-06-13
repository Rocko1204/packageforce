import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface PackageInfo {
  name: string;
  path: string;
  lineNumber: number;
  versionNumber?: string;
  dependencies?: any[];
  type?: string;
  packageType?: 'unlocked' | 'data' | 'diff' | 'source';
}

export class PackageExplorerProvider implements vscode.TreeDataProvider<PackageItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<PackageItem | undefined | null | void> = new vscode.EventEmitter<PackageItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<PackageItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private packages: PackageInfo[] = [];
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.refresh();
  }

  refresh(): void {
    this.loadPackages();
    this._onDidChangeTreeData.fire();
  }

  private loadPackages(): void {
    const sfdxProjectPath = path.join(this.workspaceRoot, 'sfdx-project.json');
    
    if (!fs.existsSync(sfdxProjectPath)) {
      this.packages = [];
      return;
    }

    try {
      const content = fs.readFileSync(sfdxProjectPath, 'utf8');
      const projectJson = JSON.parse(content);
      
      this.packages = [];
      
      if (projectJson.packageDirectories && Array.isArray(projectJson.packageDirectories)) {
        projectJson.packageDirectories.forEach((dir: any, index: number) => {
          if (dir.package) {
            // Find line number by searching for the package name
            const lines = content.split('\n');
            let lineNumber = 0;
            
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes(`"package": "${dir.package}"`)) {
                lineNumber = i + 1;
                break;
              }
            }
            
            // Determine package type
            let packageType: 'unlocked' | 'data' | 'diff' | 'source' = 'source';
            
            // Check if it's an unlocked package (has an alias in packageAliases)
            if (projectJson.packageAliases && projectJson.packageAliases[dir.package]) {
              packageType = 'unlocked';
            }
            // Check if it has a type property
            else if (dir.type) {
              if (dir.type === 'data') {
                packageType = 'data';
              } else if (dir.type === 'diff') {
                packageType = 'diff';
              }
            }
            
            this.packages.push({
              name: dir.package,
              path: dir.path,
              lineNumber: lineNumber,
              versionNumber: dir.versionNumber,
              dependencies: dir.dependencies,
              type: dir.type,
              packageType: packageType
            });
          }
        });
      }
      
      // Sort packages alphabetically
      this.packages.sort((a, b) => a.name.localeCompare(b.name));
      
    } catch (error) {
      console.error('Error loading sfdx-project.json:', error);
      vscode.window.showErrorMessage(`Error loading packages: ${error}`);
    }
  }

  getTreeItem(element: PackageItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: PackageItem): Thenable<PackageItem[]> {
    if (!this.workspaceRoot) {
      vscode.window.showInformationMessage('No workspace folder open');
      return Promise.resolve([]);
    }

    if (element) {
      // No children for now
      return Promise.resolve([]);
    } else {
      // Return root level packages
      return Promise.resolve(this.packages.map(pkg => new PackageItem(
        pkg.name,
        pkg.path,
        pkg.lineNumber,
        pkg.packageType || 'source',
        pkg.versionNumber,
        vscode.TreeItemCollapsibleState.None
      )));
    }
  }

  findPackage(searchTerm: string): PackageInfo | undefined {
    return this.packages.find(pkg => 
      pkg.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  getAllPackages(): PackageInfo[] {
    return this.packages;
  }
}

export class PackageItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly packagePath: string,
    public readonly lineNumber: number,
    public readonly packageType: 'unlocked' | 'data' | 'diff' | 'source',
    public readonly version?: string,
    public readonly collapsibleState?: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    
    // Set tooltip and description based on package type
    const typeLabel = packageType.charAt(0).toUpperCase() + packageType.slice(1);
    this.tooltip = `${this.label} (${typeLabel} Package)`;
    this.description = typeLabel;
    
    this.contextValue = 'packageItem';
    
    // Set icon based on package type
    switch (packageType) {
      case 'unlocked':
        this.iconPath = new vscode.ThemeIcon('lock');
        break;
      case 'data':
        this.iconPath = new vscode.ThemeIcon('database');
        break;
      case 'diff':
        this.iconPath = new vscode.ThemeIcon('diff');
        break;
      case 'source':
      default:
        this.iconPath = new vscode.ThemeIcon('package');
        break;
    }
    
    // Add command to handle click
    this.command = {
      command: 'sfdxPkgMgr.packageItemClicked',
      title: 'Package Clicked',
      arguments: [this]
    };
  }
}

export async function showPackageQuickPick() {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  const provider = new PackageExplorerProvider(workspaceFolder.uri.fsPath);
  const packages = provider.getAllPackages();

  if (packages.length === 0) {
    vscode.window.showInformationMessage('No packages found in sfdx-project.json');
    return;
  }

  const quickPickItems = packages.map(pkg => {
    const typeLabel = pkg.packageType ? pkg.packageType.charAt(0).toUpperCase() + pkg.packageType.slice(1) : 'Source';
    let icon = '$(package)';
    
    switch (pkg.packageType) {
      case 'unlocked':
        icon = '$(lock)';
        break;
      case 'data':
        icon = '$(database)';
        break;
      case 'diff':
        icon = '$(diff)';
        break;
    }
    
    return {
      label: `${icon} ${pkg.name}`,
      description: typeLabel,
      detail: `Path: ${pkg.path} • Line: ${pkg.lineNumber}`,
      package: pkg
    };
  });

  const selected = await vscode.window.showQuickPick(quickPickItems, {
    placeHolder: 'Select a package to perform actions',
    matchOnDescription: true,
    matchOnDetail: true
  });

  if (!selected) {
    return;
  }

  const actions = [
    { label: '$(rocket) Deploy Package', action: 'deploy' },
    { label: '$(beaker) Test Package', action: 'test' },
    { label: '$(search) Scan Package', action: 'scan' },
    { label: '$(file-text) Go to Definition', action: 'goto' },
    { label: '$(copy) Copy Package Name', action: 'copy' }
  ];

  const selectedAction = await vscode.window.showQuickPick(actions, {
    placeHolder: `Select action for ${selected.package.name}`
  });

  if (!selectedAction) {
    return;
  }

  switch (selectedAction.action) {
    case 'deploy':
      vscode.commands.executeCommand('sfdxPkgMgr.deployPackageFromCodeLens', {
        package: selected.package.name,
        path: selected.package.path,
        fromLine: selected.package.lineNumber
      });
      break;
    case 'test':
      vscode.commands.executeCommand('sfdxPkgMgr.testPackageFromCodeLens', {
        package: selected.package.name,
        path: selected.package.path,
        fromLine: selected.package.lineNumber
      });
      break;
    case 'scan':
      vscode.commands.executeCommand('sfdxPkgMgr.scanPackageFromCodeLens', {
        package: selected.package.name,
        path: selected.package.path,
        fromLine: selected.package.lineNumber
      });
      break;
    case 'goto':
      const sfdxPath = path.join(workspaceFolder.uri.fsPath, 'sfdx-project.json');
      const doc = await vscode.workspace.openTextDocument(sfdxPath);
      const editor = await vscode.window.showTextDocument(doc);
      const position = new vscode.Position(selected.package.lineNumber - 1, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
      break;
    case 'copy':
      await vscode.env.clipboard.writeText(selected.package.name);
      vscode.window.showInformationMessage(`Copied "${selected.package.name}" to clipboard`);
      break;
  }
}