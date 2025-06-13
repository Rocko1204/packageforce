import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Connection, AuthInfo, ConfigAggregator } from '@salesforce/core';
import { MetadataResolver } from '@salesforce/source-deploy-retrieve';
import { Logger } from '../utils/logger';

const logger = Logger.getInstance();

export interface TestOptions {
  packageName: string;
  packagePath: string;
  targetOrg?: string;
  runAsync?: boolean; // true = async (default), false = sync
}

export interface TestResult {
  success: boolean;
  testsRun: number;
  passing: number;
  failing: number;
  skipped: number;
  time: string;
  coverage?: CoverageResult;
  failures?: TestFailure[];
  output?: string;
}

export interface CoverageResult {
  overall: number;
  classes: {
    name: string;
    coverage: number;
    coveredLines: number;
    uncoveredLines: number;
  }[];
}

export interface TestFailure {
  name: string;
  methodName: string;
  message: string;
  stackTrace?: string;
}

interface ApexTestQueueResult {
  QueuedList: string[];
  CompletedList: string[];
  FailedList: string[];
  ProcessingList: string[];
  OtherList: string[];
}

interface ApexClass {
  Id: string;
  Name: string;
  Body: string;
}

interface ApexTestQueueItem {
  Id: string;
  Status: string;
  ApexClass: {
    Name: string;
  };
}

interface ApexTestResult {
  ApexClass: {
    Name: string;
  };
  Outcome: string;
  MethodName: string;
  Message: string;
  StackTrace?: string;
}

interface ApexCodeCoverageAggregate {
  ApexClassOrTrigger: {
    Name: string;
  };
  NumLinesCovered: number;
  NumLinesUncovered: number;
}

export class TestService {
  private outputChannel: vscode.OutputChannel;
  private connection?: Connection;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Packageforce Tests');
  }

  public async runTestsWithCoverage(options: TestOptions): Promise<TestResult> {
    this.outputChannel.clear();
    this.outputChannel.show();
    
    logger.info(`Starting test execution for package: ${options.packageName}`);
    this.outputChannel.appendLine(`${'='.repeat(60)}`);
    this.outputChannel.appendLine(`🧪 Running Tests for Package: ${options.packageName}`);
    this.outputChannel.appendLine(`📍 Mode: ${options.runAsync !== false ? 'Asynchronous' : 'Synchronous'}`);
    this.outputChannel.appendLine(`${'='.repeat(60)}`);
    this.outputChannel.appendLine('');

    try {
      // Establish connection
      await this.establishConnection(options.targetOrg);

      // Find test classes using MetadataResolver
      const testClasses = await this.findTestClassesInPackage(options.packagePath);
      
      if (testClasses.length === 0) {
        this.outputChannel.appendLine('❌ No test classes found in package');
        this.outputChannel.appendLine('💡 Make sure your test classes have @isTest annotation');
        return {
          success: false,
          testsRun: 0,
          passing: 0,
          failing: 0,
          skipped: 0,
          time: '0s',
          output: 'No test classes found in package'
        };
      }

      this.outputChannel.appendLine(`📋 Found ${testClasses.length} test class(es):`);
      testClasses.forEach(tc => {
        this.outputChannel.appendLine(`   • ${tc.name}`);
      });
      this.outputChannel.appendLine('');

      // Get test class IDs from org
      const testClassIds = await this.getTestClassIds(testClasses.map(tc => tc.name));
      const apexClassIds = await this.getNonTestClassIds(options.packagePath);

      // Execute tests
      const startTime = Date.now();
      let result: TestResult;

      if (options.runAsync !== false) {
        result = await this.runTestsAsync(testClassIds, apexClassIds, options.packageName);
      } else {
        result = await this.runTestsSync(testClassIds, apexClassIds, options.packageName);
      }

      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
      result.time = `${elapsedTime}s`;
      
      // Display results
      this.displayTestResults(result);
      
      return result;

    } catch (error) {
      logger.error('Test execution failed:', error);
      this.outputChannel.appendLine(`\n❌ Error: ${error}`);
      
      return {
        success: false,
        testsRun: 0,
        passing: 0,
        failing: 0,
        skipped: 0,
        time: '0s',
        output: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async establishConnection(targetOrg?: string): Promise<void> {
    let username = targetOrg;
    
    if (!username) {
      // Try to get the default org
      try {
        const aggregator = await ConfigAggregator.create();
        const defaultOrgAlias = aggregator.getPropertyValue('target-org');
        
        if (defaultOrgAlias && typeof defaultOrgAlias === 'string') {
          // The defaultOrgAlias might be an alias, so we need to resolve it to a username
          try {
            // First try to create AuthInfo with the alias
            const authInfo = await AuthInfo.create({ username: defaultOrgAlias });
            username = authInfo.getUsername();
          } catch (error) {
            // If that fails, check if it's already a username
            logger.warn(`Could not resolve org alias '${defaultOrgAlias}': ${error}`);
            
            // Try to list all authenticated orgs and find a match
            const orgs = await AuthInfo.listAllAuthorizations();
            if (orgs && orgs.length > 0) {
              // Find an org that matches the alias or use the first available org
              const matchingOrg = orgs.find(org => 
                org.username === defaultOrgAlias || 
                org.aliases?.includes(defaultOrgAlias)
              );
              
              if (matchingOrg) {
                username = matchingOrg.username;
              } else {
                // Use the first available org as fallback
                username = orgs[0].username;
                this.outputChannel.appendLine(`⚠️  Could not find org '${defaultOrgAlias}', using first available org: ${username}`);
              }
            } else {
              throw new Error('No authenticated orgs found. Please authenticate with an org first.');
            }
          }
        } else {
          // No default org set, try to use the first available org
          const orgs = await AuthInfo.listAllAuthorizations();
          if (orgs && orgs.length > 0) {
            username = orgs[0].username;
            this.outputChannel.appendLine(`ℹ️  No default org set, using first available org: ${username}`);
          } else {
            throw new Error('No authenticated orgs found. Please authenticate with an org first.');
          }
        }
      } catch (error) {
        logger.error('Failed to resolve default org:', error);
        throw new Error(`Failed to resolve default org: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (!username) {
      throw new Error('No target org specified and no default org could be determined');
    }

    this.outputChannel.appendLine(`🔌 Connecting to org: ${username}`);
    
    try {
      const authInfo = await AuthInfo.create({ username });
      this.connection = await Connection.create({ authInfo });
      
      this.outputChannel.appendLine('✅ Connected successfully');
      this.outputChannel.appendLine('');
    } catch (error) {
      logger.error(`Failed to connect to org '${username}':`, error);
      throw new Error(`Failed to connect to org '${username}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async findTestClassesInPackage(packagePath: string): Promise<Array<{ name: string; isTest: boolean }>> {
    const classes: Array<{ name: string; isTest: boolean }> = [];
    const resolver = new MetadataResolver();
    
    try {
      const components = resolver.getComponentsFromPath(packagePath);
      
      for (const component of components) {
        if (component.type.id === 'apexclass' && component.content) {
          const isTestClass = await this.checkIsTestClass(component.content);
          classes.push({
            name: component.name,
            isTest: isTestClass
          });
        }
      }
    } catch (error) {
      logger.error(`Error finding test classes: ${error}`);
    }
    
    return classes.filter(c => c.isTest);
  }

  private async checkIsTestClass(filePath: string): Promise<boolean> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      return content.search(/@isTest/i) > -1;
    } catch (error) {
      logger.error(`Error reading file ${filePath}: ${error}`);
      return false;
    }
  }

  private async getTestClassIds(testClassNames: string[]): Promise<string[]> {
    if (!this.connection) throw new Error('No connection established');

    const ids: string[] = [];
    
    for (const className of testClassNames) {
      try {
        const result = await this.connection.singleRecordQuery<ApexClass>(
          `SELECT Id, Name FROM ApexClass WHERE Name = '${className}' AND NamespacePrefix = null LIMIT 1`,
          { tooling: true }
        );
        
        if (result && result.Id) {
          ids.push(result.Id);
        }
      } catch (error) {
        logger.warn(`Could not find test class ${className} in org`);
      }
    }
    
    return ids;
  }

  private async getNonTestClassIds(packagePath: string): Promise<string[]> {
    if (!this.connection) throw new Error('No connection established');

    const ids: string[] = [];
    const resolver = new MetadataResolver();
    
    try {
      const components = resolver.getComponentsFromPath(packagePath);
      
      for (const component of components) {
        if (component.type.id === 'apexclass' && component.content) {
          const isTestClass = await this.checkIsTestClass(component.content);
          
          if (!isTestClass) {
            try {
              const result = await this.connection.singleRecordQuery<ApexClass>(
                `SELECT Id, Name FROM ApexClass WHERE Name = '${component.name}' AND NamespacePrefix = null LIMIT 1`,
                { tooling: true }
              );
              
              if (result && result.Id) {
                ids.push(result.Id);
              }
            } catch (error) {
              logger.warn(`Could not find class ${component.name} in org`);
            }
          }
        }
      }
    } catch (error) {
      logger.error(`Error finding non-test classes: ${error}`);
    }
    
    return ids;
  }

  private async runTestsAsync(testClassIds: string[], apexClassIds: string[], packageName: string): Promise<TestResult> {
    if (!this.connection) throw new Error('No connection established');

    this.outputChannel.appendLine('🚀 Starting asynchronous test execution...');
    
    // Queue tests
    const jobId = await this.queueTests(testClassIds);
    this.outputChannel.appendLine(`📝 Test job queued with ID: ${jobId}`);
    this.outputChannel.appendLine('');
    
    // Poll for completion
    const testRunResult = await this.pollTestExecution(jobId);
    
    // Get test results
    const failures = await this.getTestFailures(testClassIds, jobId);
    
    // Get code coverage
    let coverage: CoverageResult | undefined;
    if (apexClassIds.length > 0) {
      coverage = await this.getCodeCoverage(apexClassIds);
    }
    
    return {
      success: failures.length === 0,
      testsRun: testRunResult.CompletedList.length + testRunResult.FailedList.length,
      passing: testRunResult.CompletedList.length - failures.length,
      failing: failures.length,
      skipped: 0,
      time: '0s',
      failures: failures.length > 0 ? failures : undefined,
      coverage
    };
  }

  private async runTestsSync(testClassIds: string[], apexClassIds: string[], packageName: string): Promise<TestResult> {
    if (!this.connection) throw new Error('No connection established');

    this.outputChannel.appendLine('🚀 Starting synchronous test execution...');
    this.outputChannel.appendLine('⚠️  This may take several minutes...');
    
    try {
      // Run tests synchronously using REST API
      const testPayload = {
        tests: testClassIds.map(id => ({ classId: id }))
      };
      
      const response = await this.connection.request({
        method: 'POST',
        url: '/services/data/v58.0/tooling/runTestsSynchronous',
        body: JSON.stringify(testPayload)
      });
      
      // Parse results
      const testResults = response as any;
      const failures: TestFailure[] = [];
      
      if (testResults.failures && Array.isArray(testResults.failures)) {
        testResults.failures.forEach((failure: any) => {
          failures.push({
            name: failure.name || 'Unknown',
            methodName: failure.methodName || 'Unknown',
            message: failure.message || 'No message',
            stackTrace: failure.stackTrace
          });
        });
      }
      
      // Get code coverage
      let coverage: CoverageResult | undefined;
      if (apexClassIds.length > 0) {
        coverage = await this.getCodeCoverage(apexClassIds);
      }
      
      const totalTests = testResults.numTestsRun || 0;
      const failedTests = testResults.numFailures || 0;
      
      return {
        success: failedTests === 0,
        testsRun: totalTests,
        passing: totalTests - failedTests,
        failing: failedTests,
        skipped: 0,
        time: '0s',
        failures: failures.length > 0 ? failures : undefined,
        coverage
      };
      
    } catch (error) {
      logger.error('Synchronous test execution failed:', error);
      throw error;
    }
  }

  private async queueTests(testClassIds: string[]): Promise<string> {
    if (!this.connection) throw new Error('No connection established');

    const response = await this.connection.requestPost(
      `${this.connection._baseUrl()}/tooling/runTestsAsynchronous/`,
      { classids: testClassIds.join(',') }
    );
    
    const jobId = response ? Object.values(response).join('') : '';
    if (!jobId) {
      throw new Error('Failed to queue test execution');
    }
    
    return jobId;
  }

  private async pollTestExecution(jobId: string): Promise<ApexTestQueueResult> {
    if (!this.connection) throw new Error('No connection established');

    let attempts = 0;
    const maxAttempts = 360; // 60 minutes with 10 second intervals
    
    while (attempts < maxAttempts) {
      const result = await this.checkTestStatus(jobId);
      
      // Update progress
      if (attempts % 3 === 0) { // Update every 30 seconds
        this.outputChannel.appendLine(
          `⏳ Status: Processing: ${result.ProcessingList.length}, ` +
          `Completed: ${result.CompletedList.length}, ` +
          `Failed: ${result.FailedList.length}, ` +
          `Queued: ${result.QueuedList.length}`
        );
      }
      
      if (result.QueuedList.length === 0 && result.ProcessingList.length === 0) {
        this.outputChannel.appendLine('');
        this.outputChannel.appendLine('✅ Test execution completed');
        return result;
      }
      
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second delay
      attempts++;
    }
    
    throw new Error('Test execution timeout after 60 minutes');
  }

  private async checkTestStatus(jobId: string): Promise<ApexTestQueueResult> {
    if (!this.connection) throw new Error('No connection established');

    const result: ApexTestQueueResult = {
      QueuedList: [],
      CompletedList: [],
      FailedList: [],
      ProcessingList: [],
      OtherList: []
    };
    
    const query = `SELECT Id, Status, ApexClass.Name FROM ApexTestQueueItem WHERE ParentJobId = '${jobId}'`;
    const response = await this.connection.tooling.query<ApexTestQueueItem>(query);
    
    if (response.records) {
      response.records.forEach(record => {
        const className = record.ApexClass?.Name || 'Unknown';
        
        switch (record.Status) {
          case 'Queued':
            result.QueuedList.push(className);
            break;
          case 'Completed':
            result.CompletedList.push(className);
            break;
          case 'Failed':
            result.FailedList.push(className);
            break;
          case 'Processing':
            result.ProcessingList.push(className);
            break;
          default:
            result.OtherList.push(className);
        }
      });
    }
    
    return result;
  }

  private async getTestFailures(testClassIds: string[], jobId: string): Promise<TestFailure[]> {
    if (!this.connection) throw new Error('No connection established');

    const failures: TestFailure[] = [];
    
    const query = `SELECT ApexClass.Name, Outcome, MethodName, Message, StackTrace ` +
                  `FROM ApexTestResult ` +
                  `WHERE Outcome = 'Fail' ` +
                  `AND ApexClassId IN ('${testClassIds.join("','")}') ` +
                  `AND AsyncApexJobId = '${jobId}'`;
    
    const response = await this.connection.query<ApexTestResult>(query);
    
    if (response.records) {
      response.records.forEach(record => {
        failures.push({
          name: record.ApexClass.Name,
          methodName: record.MethodName,
          message: record.Message,
          stackTrace: record.StackTrace
        });
      });
    }
    
    return failures;
  }

  private async getCodeCoverage(apexClassIds: string[]): Promise<CoverageResult> {
    if (!this.connection) throw new Error('No connection established');

    const classes: CoverageResult['classes'] = [];
    let totalCovered = 0;
    let totalUncovered = 0;
    
    const query = `SELECT ApexClassOrTrigger.Name, NumLinesCovered, NumLinesUncovered ` +
                  `FROM ApexCodeCoverageAggregate ` +
                  `WHERE ApexClassOrTriggerId IN ('${apexClassIds.join("','")}')`;
    
    const response = await this.connection.tooling.query<ApexCodeCoverageAggregate>(query);
    
    if (response.records) {
      response.records.forEach(record => {
        const covered = record.NumLinesCovered;
        const uncovered = record.NumLinesUncovered;
        const total = covered + uncovered;
        const percentage = total > 0 ? Math.floor((covered / total) * 100) : 0;
        
        classes.push({
          name: record.ApexClassOrTrigger.Name,
          coverage: percentage,
          coveredLines: covered,
          uncoveredLines: uncovered
        });
        
        totalCovered += covered;
        totalUncovered += uncovered;
      });
    }
    
    const totalLines = totalCovered + totalUncovered;
    const overallCoverage = totalLines > 0 ? Math.floor((totalCovered / totalLines) * 100) : 0;
    
    return {
      overall: overallCoverage,
      classes
    };
  }

  private displayTestResults(result: TestResult): void {
    this.outputChannel.appendLine(`${'='.repeat(60)}`);
    this.outputChannel.appendLine('📊 Test Results Summary');
    this.outputChannel.appendLine(`${'='.repeat(60)}`);
    this.outputChannel.appendLine('');
    
    // Summary
    const status = result.success ? '✅ PASSED' : '❌ FAILED';
    this.outputChannel.appendLine(`Status: ${status}`);
    this.outputChannel.appendLine(`Total Tests: ${result.testsRun}`);
    this.outputChannel.appendLine(`Passing: ${result.passing} ✓`);
    if (result.failing > 0) {
      this.outputChannel.appendLine(`Failing: ${result.failing} ✗`);
    }
    if (result.skipped > 0) {
      this.outputChannel.appendLine(`Skipped: ${result.skipped} ⚠`);
    }
    this.outputChannel.appendLine(`Time: ${result.time}`);
    this.outputChannel.appendLine('');

    // Failures
    if (result.failures && result.failures.length > 0) {
      this.outputChannel.appendLine(`${'='.repeat(60)}`);
      this.outputChannel.appendLine('❌ Test Failures');
      this.outputChannel.appendLine(`${'='.repeat(60)}`);
      
      result.failures.forEach((failure, index) => {
        this.outputChannel.appendLine(`\n${index + 1}. ${failure.name}.${failure.methodName}`);
        this.outputChannel.appendLine(`   Message: ${failure.message}`);
        if (failure.stackTrace) {
          this.outputChannel.appendLine(`   Stack Trace:\n${this.formatStackTrace(failure.stackTrace)}`);
        }
      });
    }

    // Coverage
    if (result.coverage) {
      this.outputChannel.appendLine('');
      this.outputChannel.appendLine(`${'='.repeat(60)}`);
      this.outputChannel.appendLine('📈 Code Coverage');
      this.outputChannel.appendLine(`${'='.repeat(60)}`);
      this.outputChannel.appendLine('');
      
      const overallEmoji = result.coverage.overall >= 75 ? '✅' : '❌';
      this.outputChannel.appendLine(`Overall Coverage: ${result.coverage.overall}% ${overallEmoji}`);
      
      if (result.coverage.overall < 75) {
        this.outputChannel.appendLine('⚠️  Warning: Coverage is below 75% requirement');
      }
      
      this.outputChannel.appendLine('');
      
      if (result.coverage.classes.length > 0) {
        this.outputChannel.appendLine('Class Coverage:');
        result.coverage.classes
          .sort((a, b) => a.coverage - b.coverage)
          .forEach(cls => {
            const emoji = cls.coverage >= 75 ? '✓' : '✗';
            const bar = this.createProgressBar(cls.coverage);
            this.outputChannel.appendLine(
              `   ${emoji} ${cls.name}: ${bar} ${cls.coverage}% ` +
              `(${cls.coveredLines}/${cls.coveredLines + cls.uncoveredLines} lines)`
            );
          });
      }
    }

    this.outputChannel.appendLine('');
    this.outputChannel.appendLine(`${'='.repeat(60)}`);
    this.outputChannel.appendLine('✨ Test execution completed');
    this.outputChannel.appendLine(`${'='.repeat(60)}`);
  }

  private formatStackTrace(stackTrace: string): string {
    return stackTrace
      .split('\n')
      .map(line => `      ${line}`)
      .join('\n');
  }

  private createProgressBar(percentage: number): string {
    const width = 20;
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return `[${'█'.repeat(filled)}${'-'.repeat(empty)}]`;
  }

  public dispose(): void {
    this.outputChannel.dispose();
  }
}