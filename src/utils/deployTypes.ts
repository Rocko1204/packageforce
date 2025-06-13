// Component deployment status
export enum ComponentStatus {
  Created = 'Created',
  Changed = 'Changed',
  Unchanged = 'Unchanged',
  Deleted = 'Deleted',
  Failed = 'Failed'
}

// File response type
export interface FileResponse {
  fullName: string;
  type: string;
  filePath?: string;
  state: ComponentStatus;
  lineNumber?: number;
  columnNumber?: number;
  error?: string;
  problemType?: 'Warning' | 'Error';
}

export interface DeploymentOptions {
  packageName: string;
  packagePath: string;
  targetOrg?: string;
  includeDependencies?: boolean;
  startFrom?: string;
  testLevel?: TestLevel;
  runTests?: string[];
  checkOnly?: boolean;
  ignoreWarnings?: boolean;
  purgeOnDelete?: boolean;
  preDestructiveChanges?: string;
  postDestructiveChanges?: string;
}

export enum TestLevel {
  NoTestRun = 'NoTestRun',
  RunSpecifiedTests = 'RunSpecifiedTests',
  RunLocalTests = 'RunLocalTests',
  RunAllTestsInOrg = 'RunAllTestsInOrg'
}

export interface DeploymentResult {
  success: boolean;
  id?: string;
  status?: string;
  numberComponentsDeployed?: number;
  numberComponentsTotal?: number;
  numberComponentErrors?: number;
  deployedComponents?: DeployedComponent[];
  failedComponents?: FailedComponent[];
  warnings?: DeploymentWarning[];
  runTestResult?: TestResult;
  completedDate?: Date;
  createdDate?: Date;
  details?: any;
}

export interface DeployedComponent {
  fullName: string;
  type: string;
  filePath?: string;
  status: ComponentStatus;
}

export interface FailedComponent {
  fullName: string;
  type: string;
  filePath?: string;
  problemType: string;
  problem: string;
  lineNumber?: number;
  columnNumber?: number;
}

export interface DeploymentWarning {
  fullName: string;
  type: string;
  warning: string;
}

export interface TestResult {
  numTestsRun: number;
  numFailures: number;
  totalTime: number;
  testExecutionTime?: string;
  testFailures?: TestFailure[];
  codeCoverage?: CodeCoverageResult[];
  codeCoverageWarnings?: CodeCoverageWarning[];
}

export interface TestFailure {
  name: string;
  methodName: string;
  message: string;
  stackTrace?: string;
  time?: number;
}

export interface CodeCoverageResult {
  name: string;
  numLocations: number;
  numLocationsNotCovered: number;
  coverage: number;
}

export interface CodeCoverageWarning {
  name: string;
  message: string;
}

export interface PackageDependency {
  package: string;
  versionNumber?: string;
  subscriberPackageVersionId?: string;
}

export interface PackageInfo {
  path: string;
  package: string;
  versionName?: string;
  versionNumber?: string;
  default?: boolean;
  dependencies?: PackageDependency[];
  ancestorId?: string;
  ancestorVersion?: string;
  postInstallScript?: string;
  uninstallScript?: string;
}

export interface DeploymentProgress {
  status: DeploymentStatus;
  message: string;
  percentage: number;
  currentPackage?: string;
  totalPackages?: number;
  currentPackageIndex?: number;
}

export enum DeploymentStatus {
  Preparing = 'preparing',
  InProgress = 'inProgress',
  Validating = 'validating',
  Deploying = 'deploying',
  Succeeded = 'succeeded',
  Failed = 'failed',
  Canceled = 'canceled'
}

export interface DeploymentError extends Error {
  packageName?: string;
  deploymentId?: string;
  details?: FailedComponent[];
}