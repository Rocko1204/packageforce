import * as vscode from 'vscode';
import { SfProjectJson, ConfigAggregator, Org, SfError } from '@salesforce/core';
import { ComponentSet, DeployDetails, MetadataApiDeploy, DeploySetOptions } from '@salesforce/source-deploy-retrieve';
import * as Table from 'cli-table3';
import { getDeployUrls } from '../utils/getPackages';
import { DeployError, PackageTree } from '../utils/cliTypes';
import { DeployLogger } from '../utils/deployLogger';

export interface DeployOptions {
  packageName: string;
  targetOrg?: string;
  includeDependencies?: boolean;
  startFrom?: string;
  checkOnly?: boolean;
  testLevel?: 'NoTestRun' | 'RunSpecifiedTests' | 'RunLocalTests' | 'RunAllTestsInOrg';
  runTests?: string[];
}

export class DeployService {
  private org: Org | undefined;
  private project: SfProjectJson | undefined;
  
  async initialize(workspacePath: string): Promise<void> {
    this.project = await SfProjectJson.create({ rootFolder: workspacePath });
  }
  
  async deploy(options: DeployOptions): Promise<void> {
    DeployLogger.clear();
    DeployLogger.header('Packageforce - Deployment');
    DeployLogger.log('👆 Note: Managed Packages are not considered when deploying the dependencies...');
    DeployLogger.log('💪 Put packages in queue and start deployment/installation process');
    
    try {
      // Get target org
      await this.setupOrg(options.targetOrg);
      
      if (!this.project) {
        throw new Error('Project not initialized');
      }
      
      // Get package dependency tree
      const packageDependencyTree = getDeployUrls(this.project, options.packageName);
      
      if (!packageDependencyTree) {
        throw new Error(`Package "${options.packageName}" not found in sfdx-project.json`);
      }
      
      // Deploy dependencies if requested
      if (options.includeDependencies && packageDependencyTree.dependency && packageDependencyTree.dependency.length > 0) {
        const depsList: string[] = packageDependencyTree.dependency.map(dep => dep.packagename || '');
        DeployLogger.notify('First deploy the dependencies...👇');
        DeployLogger.info(`Dependencies: ${depsList.join(', ')}`);
        
        let isStarted = false;
        for (const dep of packageDependencyTree.dependency) {
          // Handle start from specific package
          if (options.startFrom && !isStarted) {
            if (options.startFrom !== dep.packagename) {
              continue;
            } else {
              DeployLogger.warning(`Restarting the deployment at the point of package ${options.startFrom}...👆`);
              isStarted = true;
            }
          }
          
          if (dep.packagename && dep.path) {
            await this.deployPackageTreeNode(dep.packagename, dep.path, options);
          }
        }
      }
      
      // Deploy main package
      DeployLogger.notify(`Deploy package ${packageDependencyTree.packagename}...👇`);
      if (packageDependencyTree.packagename && packageDependencyTree.path) {
        await this.deployPackageTreeNode(packageDependencyTree.packagename, packageDependencyTree.path, options);
      }
      
      DeployLogger.success('👏 Congratulations! Deployment finished! 🥳');
      vscode.window.showInformationMessage(`Successfully deployed ${options.packageName}`);
      
    } catch (error) {
      DeployLogger.error(`Deployment failed: ${error}`);
      vscode.window.showErrorMessage(`Deployment failed: ${error}`);
      throw error;
    }
  }
  
  private async setupOrg(targetOrg?: string): Promise<void> {
    let orgAlias = targetOrg;
    
    if (!orgAlias) {
      // Try to get default org
      try {
        const aggregator = await ConfigAggregator.create();
        const defaultOrgAlias = aggregator.getPropertyValue('target-org') as string;
        
        if (!defaultOrgAlias) {
          // No default org set, try to use the first available org
          const { AuthInfo } = await import('@salesforce/core');
          const orgs = await AuthInfo.listAllAuthorizations();
          
          if (orgs && orgs.length > 0) {
            orgAlias = orgs[0].username;
            DeployLogger.warning(`No default org set, using first available org: ${orgAlias}`);
          } else {
            throw new Error('No authenticated orgs found. Please authenticate with an org first.');
          }
        } else {
          orgAlias = defaultOrgAlias;
          DeployLogger.notify(`Using default target-org 👉 ${orgAlias}`);
        }
      } catch (error) {
        throw new Error(`Failed to resolve default org: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      DeployLogger.notify(`Using target-org 👉 ${orgAlias}`);
    }
    
    // Try to create org connection
    try {
      this.org = await Org.create({ aliasOrUsername: orgAlias });
    } catch (error) {
      // If creation fails, it might be an invalid alias
      if (error instanceof Error && error.message.includes('NamedOrgNotFoundError')) {
        // Try to list all authenticated orgs and provide helpful error
        const { AuthInfo } = await import('@salesforce/core');
        const orgs = await AuthInfo.listAllAuthorizations();
        
        if (orgs && orgs.length > 0) {
          // Try to find a matching org or use the first one
          const matchingOrg = orgs.find(org => 
            org.username === orgAlias || 
            org.aliases?.includes(orgAlias)
          );
          
          if (matchingOrg) {
            this.org = await Org.create({ aliasOrUsername: matchingOrg.username });
            DeployLogger.notify(`Using org: ${matchingOrg.username}`);
          } else {
            // Use the first available org as fallback
            this.org = await Org.create({ aliasOrUsername: orgs[0].username });
            DeployLogger.warning(`Could not find org '${orgAlias}', using first available org: ${orgs[0].username}`);
          }
        } else {
          throw new Error('No authenticated orgs found. Please authenticate with an org first.');
        }
      } else {
        throw error;
      }
    }
  }
  
  private async deployPackageTreeNode(pck: string, path: string, options: DeployOptions): Promise<void> {
    if (!this.org) {
      throw new Error('Org not initialized');
    }
    
    const componentSet = ComponentSet.fromSource(path);
    if(options.checkOnly) {
      DeployLogger.notify(`Validating package ${pck}... This is a check-only deployment.`);
    }
    const deployOptions: DeploySetOptions = {
      usernameOrConnection: this.org.getConnection(),
      apiOptions: {
        checkOnly: options.checkOnly || false,
        //testLevel: options.testLevel || 'NoTestRun',
        //runTests: options.testLevel === 'RunSpecifiedTests' ? options.runTests : undefined
      }
    };
    
    const deploy: MetadataApiDeploy = await componentSet.deploy(deployOptions);
    
    // Progress tracking
    let counter = 0;
    deploy.onUpdate((response) => {
      if (counter === 5) {
        const { status, numberComponentsDeployed, numberComponentsTotal } = response;
        const progress = `${numberComponentsDeployed}/${numberComponentsTotal}`;
        DeployLogger.trace(`Deploy Package: ${pck} Status: ${status} Progress: ${progress}`);
        counter = 0;
      } else {
        counter++;
      }
    });
    
    // Wait for deployment to complete
    const res = await deploy.pollStatus();
    
    if (!res.response.success) {
      await this.displayErrors(res.response.details);
      throw new Error(`Deployment failed for package ${pck}`);
    } else {
      DeployLogger.success(`✔ Deployment for Package ${pck} successfully 👌`);
    }
  }
  
  private async displayErrors(details: DeployDetails | undefined): Promise<void> {
    if (!details) return;
    
    // Display component failures
    if (details.componentFailures) {
      const failures = Array.isArray(details.componentFailures) 
        ? details.componentFailures 
        : [details.componentFailures];
        
      if (failures.length > 0) {
        DeployLogger.error('Component Failures:');
        const rows = failures.map(failure => [
          failure.fullName || '',
          failure.problem || ''
        ]);
        
        DeployLogger.table(['Component Name', 'Error Message'], rows, [60, 60]);
        return;
      }
    }
    
    // Display test failures
    if (details.runTestResult?.failures) {
      const testFailures = Array.isArray(details.runTestResult.failures)
        ? details.runTestResult.failures
        : [details.runTestResult.failures];
        
      if (testFailures.length > 0) {
        DeployLogger.error('Test Failures:');
        const rows = testFailures.map(failure => [
          failure.name || '',
          failure.message || '',
          failure.stackTrace || ''
        ]);
        
        DeployLogger.table(['Apex Class', 'Message', 'Stack Trace'], rows, [40, 40, 40]);
        return;
      }
    }
    
    DeployLogger.error('Validation failed. Please check the deployment status in your org.');
  }
}