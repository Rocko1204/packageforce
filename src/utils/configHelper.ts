import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@/utils/logger';

const logger = Logger.getInstance();

export interface SfdxProjectConfig {
  packageDirectories?: any[];
  plugins?: {
    packageforce?: {
      defaultPoolTag?: string;
    };
    [key: string]: any;
  };
  [key: string]: any;
}

export class ConfigHelper {
  private static instance: ConfigHelper;
  private projectConfig: SfdxProjectConfig | null = null;

  private constructor() {}

  static getInstance(): ConfigHelper {
    if (!ConfigHelper.instance) {
      ConfigHelper.instance = new ConfigHelper();
    }
    return ConfigHelper.instance;
  }

  /**
   * Reads the sfdx-project.json file from the workspace
   */
  async loadProjectConfig(workspacePath: string): Promise<void> {
    try {
      const projectFilePath = path.join(workspacePath, 'sfdx-project.json');

      if (!fs.existsSync(projectFilePath)) {
        logger.warn('sfdx-project.json not found in workspace');
        this.projectConfig = null;
        return;
      }

      const content = fs.readFileSync(projectFilePath, 'utf8');
      this.projectConfig = JSON.parse(content);
      logger.info('Successfully loaded sfdx-project.json');
    } catch (error) {
      logger.error('Failed to load sfdx-project.json', error);
      this.projectConfig = null;
    }
  }

  /**
   * Gets the default pool tag from the configuration
   */
  getDefaultPoolTag(): string | undefined {
    if (!this.projectConfig) {
      return undefined;
    }

    return this.projectConfig.plugins?.packageforce?.defaultPoolTag;
  }

  /**
   * Gets the entire project configuration
   */
  getProjectConfig(): SfdxProjectConfig | null {
    return this.projectConfig;
  }

  /**
   * Checks if the project configuration is loaded
   */
  isConfigLoaded(): boolean {
    return this.projectConfig !== null;
  }
}
