import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawn } from 'child_process';
import * as https from 'https';
const unzipper = require('unzipper');
import { Logger } from '../utils/logger';

const logger = Logger.getInstance();

// Interfaces for scan options and results
export interface ScanOptions {
  packagePath: string;
  packageName: string;
  rulesets?: string[];
  customRulesPath?: string;
  format?: 'xml' | 'json' | 'csv' | 'text';
  minimumPriority?: number;
  threads?: number;
  cache?: boolean;
  reportFile?: string;
  suppressMarker?: string;
  stagedFilesOnly?: boolean;
  fileList?: string[];
  saveToPackage?: boolean;
  saveFormat?: 'markdown' | 'xml' | 'json' | 'csv' | 'text' | 'html' | 'sarif';
}

export interface ScanResult {
  packageName: string;
  packagePath: string;
  totalViolations: number;
  violations: Violation[];
  errors: ScanError[];
  scanDuration: number;
  timestamp: Date;
}

export interface Violation {
  file: string;
  beginLine: number;
  endLine?: number;
  beginColumn?: number;
  endColumn?: number;
  rule: string;
  ruleset: string;
  priority: number;
  message: string;
  externalInfoUrl?: string;
  className?: string;
  methodName?: string;
  variableName?: string;
}

export interface ScanError {
  file: string;
  message: string;
}

export interface PMDConfiguration {
  version: string;
  downloadUrl: string;
  installPath: string;
  executablePath: string;
}

export class ScanService {
  private static instance: ScanService;
  public readonly outputChannel: vscode.OutputChannel;
  private pmdConfig: PMDConfiguration;
  private readonly PMD_VERSION = '7.8.0';
  private readonly PMD_DOWNLOAD_BASE = 'https://github.com/pmd/pmd/releases/download';

  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Packageforce - Code Scanner');
    this.pmdConfig = this.getDefaultPMDConfig();
  }

  public static getInstance(): ScanService {
    if (!ScanService.instance) {
      ScanService.instance = new ScanService();
    }
    return ScanService.instance;
  }

  private getDefaultPMDConfig(): PMDConfiguration {
    const homeDir = os.homedir();
    const baseInstallPath = path.join(homeDir, '.packageforce', 'pmd');
    const installPath = path.join(baseInstallPath, `pmd-bin-${this.PMD_VERSION}`);
    const pmdBinDir = path.join(installPath, 'bin');
    
    return {
      version: this.PMD_VERSION,
      downloadUrl: `${this.PMD_DOWNLOAD_BASE}/pmd_releases%2F${this.PMD_VERSION}/pmd-dist-${this.PMD_VERSION}-bin.zip`,
      installPath: installPath,
      executablePath: os.platform() === 'win32' 
        ? path.join(pmdBinDir, 'pmd.bat')
        : path.join(pmdBinDir, 'pmd')
    };
  }

  /**
   * Scan a package using PMD
   */
  public async scanPackage(options: ScanOptions): Promise<ScanResult> {
    const startTime = Date.now();
    logger.info(`Starting PMD scan for package: ${options.packageName}`);
    this.outputChannel.show(true); // Show output channel and preserve focus
    this.outputChannel.appendLine(`\n=== Scanning package: ${options.packageName} ===`);
    this.outputChannel.appendLine(`Path: ${options.packagePath}`);
    this.outputChannel.appendLine(`Timestamp: ${new Date().toISOString()}\n`);

    try {
      // Ensure PMD is installed
      await this.ensurePMDInstalled();

      // Get ruleset paths
      const rulesetPaths = await this.getRulesetPaths(options);

      // Run PMD scan
      const pmdOutput = await this.runPMD(options, rulesetPaths);

      // Parse results
      const violations = await this.parsePMDOutput(pmdOutput, options.format || 'xml');

      // Calculate scan duration
      const scanDuration = Date.now() - startTime;

      // Create scan result
      const result: ScanResult = {
        packageName: options.packageName,
        packagePath: options.packagePath,
        totalViolations: violations.length,
        violations: violations,
        errors: [],
        scanDuration: scanDuration,
        timestamp: new Date()
      };

      // Display results in output channel
      this.displayResults(result);

      // Save results to package if requested
      if (options.saveToPackage) {
        await this.saveResults(
          result,
          options.packagePath,
          options.saveFormat || 'markdown'
        );
      }

      logger.info(`PMD scan completed for ${options.packageName}. Found ${violations.length} violations in ${scanDuration}ms`);

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`PMD scan failed for ${options.packageName}:`, error);
      
      this.outputChannel.appendLine(`\n❌ Scan failed: ${errorMessage}`);
      
      throw new Error(`Scan failed for package ${options.packageName}: ${errorMessage}`);
    }
  }

  /**
   * Ensure PMD is installed, download if necessary
   */
  public async ensurePMDInstalled(): Promise<void> {
    if (await this.isPMDInstalled()) {
      logger.debug('PMD is already installed');
      return;
    }

    logger.info('PMD not found, downloading...');
    this.outputChannel.appendLine('PMD not found locally. Downloading...');

    await this.downloadAndInstallPMD();
  }

  /**
   * Get PMD installation path
   */
  public getPMDPath(): string {
    return this.pmdConfig.installPath;
  }

  /**
   * Check if PMD is installed
   */
  private async isPMDInstalled(): Promise<boolean> {
    try {
      await fs.promises.access(this.pmdConfig.executablePath, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Download and install PMD
   */
  private async downloadAndInstallPMD(): Promise<void> {
    const tempDir = path.join(os.tmpdir(), 'packageforce-pmd-download');
    const zipPath = path.join(tempDir, `pmd-${this.pmdConfig.version}.zip`);

    try {
      // Create directories
      await fs.promises.mkdir(tempDir, { recursive: true });
      await fs.promises.mkdir(this.pmdConfig.installPath, { recursive: true });

      // Download PMD
      this.outputChannel.appendLine(`Downloading PMD ${this.pmdConfig.version}...`);
      await this.downloadFile(this.pmdConfig.downloadUrl, zipPath);

      // Extract PMD to parent directory (the zip contains pmd-bin-VERSION folder)
      this.outputChannel.appendLine('Extracting PMD...');
      const parentDir = path.dirname(this.pmdConfig.installPath);
      await this.extractZip(zipPath, parentDir);

      // Make executable on Unix-like systems
      if (os.platform() !== 'win32') {
        await fs.promises.chmod(this.pmdConfig.executablePath, 0o755);
      }

      this.outputChannel.appendLine('✅ PMD installed successfully');
      logger.info('PMD installed successfully');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to install PMD: ${errorMessage}`);
    } finally {
      // Cleanup
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Download a file from URL
   */
  private async downloadFile(url: string, destination: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destination);
      
      https.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Handle redirect
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            file.close();
            this.downloadFile(redirectUrl, destination).then(resolve).catch(reject);
            return;
          }
        }

        if (response.statusCode !== 200) {
          file.close();
          reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
          return;
        }

        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (error) => {
        file.close();
        fs.unlinkSync(destination);
        reject(error);
      });

      file.on('error', (error) => {
        file.close();
        fs.unlinkSync(destination);
        reject(error);
      });
    });
  }

  /**
   * Extract a zip file
   */
  private async extractZip(zipPath: string, destination: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.createReadStream(zipPath)
        .pipe(unzipper.Extract({ path: destination }))
        .on('close', resolve)
        .on('error', reject);
    });
  }

  /**
   * Get ruleset paths for PMD
   */
  private async getRulesetPaths(options: ScanOptions): Promise<string[]> {
    const rulesets: string[] = [];

    // Add default rulesets if specified
    if (options.rulesets && options.rulesets.length > 0) {
      rulesets.push(...options.rulesets);
    } else {
      // Default rulesets based on file types
      // Always include Apex rules
      rulesets.push(
        'category/apex/bestpractices.xml',
        'category/apex/codestyle.xml',
        'category/apex/design.xml',
        'category/apex/errorprone.xml',
        'category/apex/performance.xml',
        'category/apex/security.xml'
      );

      // Add Visualforce rules if we might have VF files
      if (!options.fileList || options.fileList.some(f => f.endsWith('.page') || f.endsWith('.component'))) {
        rulesets.push(
          'category/visualforce/security.xml'
        );
      }

      // Note: XML rules will be applied through custom rules for metadata files
    }

    // Add custom rules if specified
    if (options.customRulesPath) {
      const customRules = await this.loadCustomRules(options.customRulesPath);
      rulesets.push(...customRules);
    }

    return rulesets;
  }

  /**
   * Load custom PMD rules from a directory
   */
  private async loadCustomRules(rulesPath: string): Promise<string[]> {
    const customRules: string[] = [];

    try {
      const files = await fs.promises.readdir(rulesPath);
      
      for (const file of files) {
        if (file.endsWith('.xml')) {
          const fullPath = path.join(rulesPath, file);
          const stats = await fs.promises.stat(fullPath);
          
          if (stats.isFile()) {
            customRules.push(fullPath);
            logger.debug(`Found custom rule file: ${fullPath}`);
          }
        }
      }

      logger.info(`Loaded ${customRules.length} custom rule files`);
      return customRules;

    } catch (error) {
      logger.warn(`Failed to load custom rules from ${rulesPath}:`, error);
      return [];
    }
  }

  /**
   * Run PMD command
   */
  private async runPMD(options: ScanOptions, rulesets: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = ['check'];
      
      // If scanning staged files only, use file list instead of directory
      if (options.stagedFilesOnly && options.fileList && options.fileList.length > 0) {
        // Use --file-list option for specific files
        const fileListPath = path.join(os.tmpdir(), `packageforce-scan-${Date.now()}.txt`);
        fs.writeFileSync(fileListPath, options.fileList.join('\n'));
        args.push('--file-list', fileListPath);
        
        // Clean up file list after PMD runs
        process.on('exit', () => {
          try {
            fs.unlinkSync(fileListPath);
          } catch { /* ignore */ }
        });
      } else {
        // Use directory scan
        args.push('-d', options.packagePath);
      }
      
      args.push(
        '-R', rulesets.join(','),
        '-f', options.format || 'xml',
        '--use-version', 'apex-60' // Salesforce API version
      );

      // Add optional parameters
      if (options.minimumPriority) {
        args.push('--minimum-priority', options.minimumPriority.toString());
      }

      if (options.threads) {
        args.push('-t', options.threads.toString());
      }

      if (options.cache === false) {
        args.push('--no-cache');
      }

      if (options.reportFile) {
        args.push('-r', options.reportFile);
      }

      if (options.suppressMarker) {
        args.push('--suppress-marker', options.suppressMarker);
      }

      logger.debug(`Running PMD with args: ${args.join(' ')}`);

      const pmdProcess = spawn(this.pmdConfig.executablePath, args);
      let stdout = '';
      let stderr = '';

      pmdProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pmdProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pmdProcess.on('close', (code) => {
        // PMD returns 4 if violations found, 0 if none
        if (code === 0 || code === 4) {
          resolve(stdout);
        } else {
          reject(new Error(`PMD exited with code ${code}: ${stderr}`));
        }
      });

      pmdProcess.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Parse PMD output
   */
  private async parsePMDOutput(output: string, format: string): Promise<Violation[]> {
    switch (format) {
      case 'xml':
        return this.parseXMLOutput(output);
      case 'json':
        return this.parseJSONOutput(output);
      default:
        throw new Error(`Unsupported output format: ${format}`);
    }
  }

  /**
   * Parse XML output from PMD
   */
  private parseXMLOutput(xmlOutput: string): Violation[] {
    const violations: Violation[] = [];
    
    // Simple XML parsing (consider using a proper XML parser for production)
    const fileMatches = xmlOutput.matchAll(/<file name="([^"]+)">([\s\S]*?)<\/file>/g);
    
    for (const fileMatch of fileMatches) {
      const fileName = fileMatch[1];
      const fileContent = fileMatch[2];
      
      const violationMatches = fileContent.matchAll(
        /<violation beginline="(\d+)"(?:\s+endline="(\d+)")?(?:\s+begincolumn="(\d+)")?(?:\s+endcolumn="(\d+)")?\s+rule="([^"]+)"\s+ruleset="([^"]+)"\s+priority="(\d+)"(?:\s+externalInfoUrl="([^"]+)")?(?:\s+class="([^"]+)")?(?:\s+method="([^"]+)")?(?:\s+variable="([^"]+)")?>([^<]+)<\/violation>/g
      );
      
      for (const match of violationMatches) {
        violations.push({
          file: fileName,
          beginLine: parseInt(match[1]),
          endLine: match[2] ? parseInt(match[2]) : undefined,
          beginColumn: match[3] ? parseInt(match[3]) : undefined,
          endColumn: match[4] ? parseInt(match[4]) : undefined,
          rule: match[5],
          ruleset: match[6],
          priority: parseInt(match[7]),
          externalInfoUrl: match[8],
          className: match[9],
          methodName: match[10],
          variableName: match[11],
          message: match[12].trim()
        });
      }
    }
    
    return violations;
  }

  /**
   * Parse JSON output from PMD
   */
  private parseJSONOutput(jsonOutput: string): Violation[] {
    try {
      const data = JSON.parse(jsonOutput);
      const violations: Violation[] = [];
      
      if (data.files && Array.isArray(data.files)) {
        for (const file of data.files) {
          if (file.violations && Array.isArray(file.violations)) {
            for (const violation of file.violations) {
              violations.push({
                file: file.filename,
                beginLine: violation.beginline,
                endLine: violation.endline,
                beginColumn: violation.begincolumn,
                endColumn: violation.endcolumn,
                rule: violation.rule,
                ruleset: violation.ruleset,
                priority: violation.priority,
                message: violation.message,
                externalInfoUrl: violation.externalInfoUrl,
                className: violation.class,
                methodName: violation.method,
                variableName: violation.variable
              });
            }
          }
        }
      }
      
      return violations;
    } catch (error) {
      throw new Error(`Failed to parse JSON output: ${error}`);
    }
  }

  /**
   * Display scan results in the output channel
   */
  private displayResults(result: ScanResult): void {
    this.outputChannel.appendLine('\n📊 Scan Results:');
    this.outputChannel.appendLine(`Total violations: ${result.totalViolations}`);
    this.outputChannel.appendLine(`Scan duration: ${result.scanDuration}ms\n`);

    if (result.violations.length === 0) {
      this.outputChannel.appendLine('✅ No violations found!');
      return;
    }

    // Group violations by file
    const violationsByFile = new Map<string, Violation[]>();
    for (const violation of result.violations) {
      if (!violationsByFile.has(violation.file)) {
        violationsByFile.set(violation.file, []);
      }
      violationsByFile.get(violation.file)!.push(violation);
    }

    // Display violations by file
    for (const [file, violations] of violationsByFile) {
      const relativePath = path.relative(result.packagePath, file);
      this.outputChannel.appendLine(`\n📄 ${relativePath} (${violations.length} violations):`);
      
      // Sort violations by line number
      violations.sort((a, b) => a.beginLine - b.beginLine);
      
      for (const violation of violations) {
        const priority = this.getPriorityIcon(violation.priority);
        const location = violation.endLine 
          ? `${violation.beginLine}-${violation.endLine}`
          : `${violation.beginLine}`;
        
        this.outputChannel.appendLine(`  ${priority} Line ${location}: ${violation.message}`);
        this.outputChannel.appendLine(`     Rule: ${violation.rule} (${violation.ruleset})`);
        
        if (violation.externalInfoUrl) {
          this.outputChannel.appendLine(`     Info: ${violation.externalInfoUrl}`);
        }
      }
    }

    this.outputChannel.appendLine('\n');
  }

  /**
   * Get priority icon for display
   */
  private getPriorityIcon(priority: number): string {
    switch (priority) {
      case 1: return '🔴'; // Critical
      case 2: return '🟠'; // High
      case 3: return '🟡'; // Medium
      case 4: return '🔵'; // Low
      case 5: return '⚪'; // Info
      default: return '⚫'; // Unknown
    }
  }

  /**
   * Load PMD configuration from workspace settings
   */
  public async loadWorkspaceConfiguration(): Promise<void> {
    const workspaceConfig = vscode.workspace.getConfiguration('packageforce.scanner');
    
    // Override default configuration with workspace settings
    const customPMDPath = workspaceConfig.get<string>('pmdPath');
    if (customPMDPath && await this.fileExists(customPMDPath)) {
      this.pmdConfig.executablePath = customPMDPath;
      logger.info(`Using custom PMD path: ${customPMDPath}`);
    }
  }

  /**
   * Check if a file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get available rulesets
   */
  public async getAvailableRulesets(): Promise<string[]> {
    const baseRulesets = [
      'category/apex/bestpractices.xml',
      'category/apex/codestyle.xml',
      'category/apex/design.xml',
      'category/apex/documentation.xml',
      'category/apex/errorprone.xml',
      'category/apex/multithreading.xml',
      'category/apex/performance.xml',
      'category/apex/security.xml'
    ];

    // Add any custom rulesets from workspace
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
      for (const folder of workspaceFolders) {
        const customRulesPath = path.join(folder.uri.fsPath, '.pmd');
        if (await this.fileExists(customRulesPath)) {
          const customRules = await this.loadCustomRules(customRulesPath);
          baseRulesets.push(...customRules);
        }
      }
    }

    return baseRulesets;
  }

  /**
   * Create diagnostics map for VS Code problems panel
   */
  public createDiagnostics(result: ScanResult): Map<vscode.Uri, vscode.Diagnostic[]> {
    const diagnosticsMap = new Map<vscode.Uri, vscode.Diagnostic[]>();
    
    // Group violations by file
    const violationsByFile = new Map<string, Violation[]>();
    for (const violation of result.violations) {
      if (!violationsByFile.has(violation.file)) {
        violationsByFile.set(violation.file, []);
      }
      violationsByFile.get(violation.file)!.push(violation);
    }

    // Create diagnostics for each file
    for (const [file, violations] of violationsByFile) {
      const uri = vscode.Uri.file(file);
      const fileDiagnostics: vscode.Diagnostic[] = [];

      for (const violation of violations) {
        const range = new vscode.Range(
          violation.beginLine - 1,
          violation.beginColumn ? violation.beginColumn - 1 : 0,
          violation.endLine ? violation.endLine - 1 : violation.beginLine - 1,
          violation.endColumn ? violation.endColumn - 1 : Number.MAX_VALUE
        );

        const severity = this.getSeverity(violation.priority);
        const diagnostic = new vscode.Diagnostic(
          range,
          `${violation.message} (${violation.rule})`,
          severity
        );

        diagnostic.source = 'PMD';
        diagnostic.code = violation.rule;

        fileDiagnostics.push(diagnostic);
      }

      diagnosticsMap.set(uri, fileDiagnostics);
    }

    return diagnosticsMap;
  }

  /**
   * Convert PMD priority to VS Code diagnostic severity
   */
  private getSeverity(priority: number): vscode.DiagnosticSeverity {
    switch (priority) {
      case 1:
      case 2:
        return vscode.DiagnosticSeverity.Error;
      case 3:
        return vscode.DiagnosticSeverity.Warning;
      case 4:
      case 5:
        return vscode.DiagnosticSeverity.Information;
      default:
        return vscode.DiagnosticSeverity.Hint;
    }
  }

  /**
   * Save scan results to file
   */
  public async saveResults(
    result: ScanResult,
    packagePath: string,
    format: 'markdown' | 'xml' | 'json' | 'csv' | 'text' | 'html' | 'sarif' = 'markdown',
    options?: { includeTimestamp?: boolean; includeMetadata?: boolean }
  ): Promise<string> {
    const { ReportUtils } = await import('../utils/reportUtils');
    
    const reportOptions = {
      format,
      includeTimestamp: options?.includeTimestamp,
      includeMetadata: options?.includeMetadata
    };
    
    const filePath = await ReportUtils.saveScanResults(result, packagePath, reportOptions);
    
    this.outputChannel.appendLine(`\nScan results saved to: ${filePath}`);
    logger.info(`Scan results saved to: ${filePath}`);
    
    return filePath;
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.outputChannel.dispose();
  }
}

// Export singleton instance
export const scanService = ScanService.getInstance();