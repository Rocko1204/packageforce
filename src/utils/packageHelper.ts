import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { PackageInfo, PackageDependency } from './deployTypes';
import { logger } from './logger';

export class PackageHelper {
  private static instance: PackageHelper;
  private sfdxProjectPath: string | undefined;
  private packageDirectories: PackageInfo[] = [];

  private constructor() {
    this.loadSfdxProject();
  }

  public static getInstance(): PackageHelper {
    if (!PackageHelper.instance) {
      PackageHelper.instance = new PackageHelper();
    }
    return PackageHelper.instance;
  }

  private loadSfdxProject(): void {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      logger.warn('No workspace folder found');
      return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    this.sfdxProjectPath = path.join(workspaceRoot, 'sfdx-project.json');

    if (!fs.existsSync(this.sfdxProjectPath)) {
      logger.warn('sfdx-project.json not found in workspace root');
      return;
    }

    try {
      const projectContent = fs.readFileSync(this.sfdxProjectPath, 'utf8');
      const projectJson = JSON.parse(projectContent);
      this.packageDirectories = projectJson.packageDirectories || [];
      logger.info('Loaded sfdx-project.json successfully', {
        packageCount: this.packageDirectories.length,
      });
    } catch (error) {
      logger.error('Failed to parse sfdx-project.json', error);
    }
  }

  public reload(): void {
    this.loadSfdxProject();
  }

  public getPackageDirectories(): PackageInfo[] {
    return this.packageDirectories;
  }

  public getPackageByName(packageName: string): PackageInfo | undefined {
    return this.packageDirectories.find(pkg => pkg.package === packageName);
  }

  public getPackageByPath(packagePath: string): PackageInfo | undefined {
    return this.packageDirectories.find(pkg => pkg.path === packagePath);
  }

  /**
   * Get all dependencies for a package, including transitive dependencies
   * @param packageName The name of the package
   * @param includeTransitive Whether to include transitive dependencies
   * @returns Array of package dependencies in dependency order
   */
  public getPackageDependencies(
    packageName: string,
    includeTransitive: boolean = true
  ): PackageInfo[] {
    const pkg = this.getPackageByName(packageName);
    if (!pkg) {
      logger.warn(`Package not found: ${packageName}`);
      return [];
    }

    const dependencies: PackageInfo[] = [];
    const visited = new Set<string>();

    const collectDependencies = (currentPkg: PackageInfo) => {
      if (!currentPkg.dependencies || currentPkg.dependencies.length === 0) {
        return;
      }

      for (const dep of currentPkg.dependencies) {
        if (visited.has(dep.package)) {
          continue;
        }

        visited.add(dep.package);

        // Find the package info for this dependency
        const depPkg = this.getPackageByName(dep.package);
        if (depPkg) {
          if (includeTransitive) {
            collectDependencies(depPkg);
          }
          dependencies.push(depPkg);
        } else {
          logger.warn(
            `Dependency package not found in project: ${dep.package}`
          );
        }
      }
    };

    collectDependencies(pkg);
    return dependencies;
  }

  /**
   * Get the deployment order for packages, considering dependencies
   * @param packageNames Array of package names to deploy
   * @param includeDependencies Whether to include dependencies
   * @param startFrom Optional package name to start deployment from
   * @returns Array of packages in deployment order
   */
  public getDeploymentOrder(
    packageNames: string[],
    includeDependencies: boolean = true,
    startFrom?: string
  ): PackageInfo[] {
    const deploymentOrder: PackageInfo[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    // Helper function to detect circular dependencies
    const hasCircularDependency = (pkgName: string): boolean => {
      if (visiting.has(pkgName)) {
        return true;
      }
      if (visited.has(pkgName)) {
        return false;
      }

      visiting.add(pkgName);
      const pkg = this.getPackageByName(pkgName);

      if (pkg?.dependencies) {
        for (const dep of pkg.dependencies) {
          if (hasCircularDependency(dep.package)) {
            return true;
          }
        }
      }

      visiting.delete(pkgName);
      visited.add(pkgName);
      return false;
    };

    // Helper function to add package and its dependencies in correct order
    const addPackageWithDependencies = (pkgName: string) => {
      if (visited.has(pkgName)) {
        return;
      }

      const pkg = this.getPackageByName(pkgName);
      if (!pkg) {
        logger.warn(`Package not found: ${pkgName}`);
        return;
      }

      if (hasCircularDependency(pkgName)) {
        throw new Error(`Circular dependency detected for package: ${pkgName}`);
      }

      visited.add(pkgName);

      // Add dependencies first if requested
      if (includeDependencies && pkg.dependencies) {
        for (const dep of pkg.dependencies) {
          addPackageWithDependencies(dep.package);
        }
      }

      // Add the package itself
      deploymentOrder.push(pkg);
    };

    // Process all requested packages
    for (const pkgName of packageNames) {
      addPackageWithDependencies(pkgName);
    }

    // If startFrom is specified, filter to start from that package
    if (startFrom) {
      const startIndex = deploymentOrder.findIndex(
        pkg => pkg.package === startFrom
      );
      if (startIndex !== -1) {
        return deploymentOrder.slice(startIndex);
      } else {
        logger.warn(
          `Start package not found in deployment order: ${startFrom}`
        );
      }
    }

    return deploymentOrder;
  }

  /**
   * Get the absolute path for a package directory
   * @param pkg The package info
   * @returns Absolute path to the package directory
   */
  public getPackageAbsolutePath(pkg: PackageInfo): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error('No workspace folder found');
    }

    return path.join(workspaceFolders[0].uri.fsPath, pkg.path);
  }

  /**
   * Check if a package has any dependencies
   * @param packageName The name of the package
   * @returns True if the package has dependencies
   */
  public hasDependencies(packageName: string): boolean {
    const pkg = this.getPackageByName(packageName);
    return pkg?.dependencies !== undefined && pkg.dependencies.length > 0;
  }

  /**
   * Get packages that depend on a given package
   * @param packageName The name of the package
   * @returns Array of packages that depend on this package
   */
  public getDependentPackages(packageName: string): PackageInfo[] {
    return this.packageDirectories.filter(pkg =>
      pkg.dependencies?.some(dep => dep.package === packageName)
    );
  }
}

// Export singleton instance
export const packageHelper = PackageHelper.getInstance();
