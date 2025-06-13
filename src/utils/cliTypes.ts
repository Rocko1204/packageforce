// Types adapted from the CLI implementation
export interface PackageTree {
  packagename?: string;
  version?: string;
  path?: string;
  managed?: boolean;
  dependency?: PackageTree[];
}

export interface DeployError {
  LineNumber?: string;
  Name?: string;
  Type?: string;
  Status?: string;
  Message?: string;
}

export interface NamedPackageDirLarge {
  package?: string;
  path?: string;
  versionNumber?: string;
  versionName?: string;
  default?: boolean;
  dependencies?: PackageDependency[];
  ignoreOnStage?: string[];
  fullPath?: string;
  postDeploymentScript?: string;
  preDeploymentScript?: string;
  type?: string;
}

export interface PackageDependency {
  package: string;
  versionNumber?: string;
}
