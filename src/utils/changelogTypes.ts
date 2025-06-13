export interface PluginSettings {
  workItemFilter?: string;
  enableReadmeGeneration?: boolean;
  sfdxContentSubPath?: string;
  workItemUrl?: string;
  environmentConfigurationFilePath?: string;
  awsRegion?: string;
  awsSecretFormat?: string;
  metadataPlaceholderFormat?: string;
}

export interface ChangelogEntry {
  version: string;
  reference: string;
  author: string;
  description: string;
}

export interface PackageChangeInfo {
  packageName: string;
  packagePath: string;
  versionNumber: string;
  modifiedFiles: string[];
}

export interface ChangelogOptions {
  type: 'feature' | 'fix';
  hasBreakingChanges: boolean;
  reference: string;
  description: string;
  author: string;
}