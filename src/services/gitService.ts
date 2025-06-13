import * as vscode from 'vscode';
import * as simpleGit from 'simple-git';
import * as path from 'path';
import { PackageChangeInfo } from '../utils/changelogTypes';
import { Logger } from '../utils/logger';

const logger = Logger.getInstance();

export class GitService {
  private git: simpleGit.SimpleGit;
  private workspacePath: string;
  
  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
    this.git = simpleGit.simpleGit(workspacePath);
  }
  
  async getStagedFiles(): Promise<string[]> {
    try {
      const status = await this.git.status();
      const stagedFiles: string[] = [];
      
      // Get all staged files (both new and modified)
      status.staged.forEach(file => {
        stagedFiles.push(file);
      });
      
      logger.debug(`Found ${stagedFiles.length} staged files`);
      return stagedFiles;
    } catch (error) {
      logger.error('Error getting staged files:', error);
      throw new Error(`Failed to get staged files: ${error}`);
    }
  }
  
  async getModifiedPackages(packageDirectories: any[]): Promise<PackageChangeInfo[]> {
    const stagedFiles = await this.getStagedFiles();
    const packageChanges = new Map<string, PackageChangeInfo>();
    
    logger.debug(`Checking ${packageDirectories.length} package directories for changes`);
    logger.debug(`Staged files: ${stagedFiles.join(', ')}`);
    
    // Check which packages have staged changes
    for (const pkg of packageDirectories) {
      if (!pkg.package) {
        logger.debug(`Skipping directory without package name: ${pkg.path}`);
        continue;
      }
      
      const packagePath = path.normalize(pkg.path);
      const modifiedFiles: string[] = [];
      
      logger.debug(`Checking package ${pkg.package} at path: ${packagePath}`);
      
      for (const file of stagedFiles) {
        const normalizedFile = path.normalize(file);
        // Check if file is within package directory
        if (normalizedFile.startsWith(packagePath + path.sep) || 
            (normalizedFile === packagePath)) {
          modifiedFiles.push(file);
          logger.debug(`  - File ${file} belongs to package ${pkg.package}`);
        }
      }
      
      if (modifiedFiles.length > 0) {
        logger.info(`Package ${pkg.package} has ${modifiedFiles.length} modified files`);
        packageChanges.set(pkg.package, {
          packageName: pkg.package,
          packagePath: pkg.path,
          versionNumber: pkg.versionNumber || '1.0.0.NEXT',
          modifiedFiles
        });
      } else {
        logger.debug(`Package ${pkg.package} has no modified files`);
      }
    }
    
    logger.info(`Found ${packageChanges.size} packages with changes`);
    return Array.from(packageChanges.values());
  }
  
  async getCurrentBranch(): Promise<string> {
    try {
      const branch = await this.git.revparse(['--abbrev-ref', 'HEAD']);
      return branch.trim();
    } catch (error) {
      logger.error('Error getting current branch:', error);
      return 'unknown';
    }
  }
  
  async getGitUser(): Promise<string> {
    try {
      const config = await this.git.getConfig('user.name');
      return config.value || 'Unknown User';
    } catch (error) {
      logger.error('Error getting git user:', error);
      return 'Unknown User';
    }
  }
  
  async stageFiles(files: string[]): Promise<void> {
    try {
      await this.git.add(files);
      logger.info(`Staged ${files.length} files`);
    } catch (error) {
      logger.error('Error staging files:', error);
      throw new Error(`Failed to stage files: ${error}`);
    }
  }
}