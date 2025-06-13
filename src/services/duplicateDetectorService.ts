import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawn } from 'child_process';
import { Logger } from '../utils/logger';
import { ScanService } from './scanService';

const logger = Logger.getInstance();

export interface DuplicateDetectionOptions {
  packagePath: string;
  packageName: string;
  workspaceRoot: string;
  minimumTokens?: number;
  language?: 'apex' | 'visualforce';
  format?: 'xml' | 'csv' | 'text';
  skipDuplicateFiles?: boolean;
  ignoreIdentifiers?: boolean;
  ignoreLiterals?: boolean;
  ignoreAnnotations?: boolean;
  saveToPackage?: boolean;
  saveFormat?: 'markdown' | 'xml' | 'json' | 'csv' | 'text';
}

export interface DuplicateResult {
  packageName: string;
  duplications: Duplication[];
  totalDuplications: number;
  totalDuplicatedLines: number;
  totalDuplicatedTokens: number;
  scanDuration: number;
  timestamp: Date;
  hasCrossPackageDuplicates?: boolean;
  success: boolean;
}

export interface Duplication {
  lines: number;
  tokens: number;
  occurrences: DuplicationOccurrence[];
}

export interface DuplicationOccurrence {
  file: string;
  startLine: number;
  endLine: number;
  codeFragment?: string;
}

export class DuplicateDetectorService {
  private static instance: DuplicateDetectorService;
  public outputChannel: vscode.OutputChannel;

  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Packageforce Duplicate Detector');
  }

  public static getInstance(): DuplicateDetectorService {
    if (!DuplicateDetectorService.instance) {
      DuplicateDetectorService.instance = new DuplicateDetectorService();
    }
    return DuplicateDetectorService.instance;
  }

  /**
   * Find duplicates for a package
   */
  public async findDuplicates(options: DuplicateDetectionOptions): Promise<DuplicateResult> {
    const startTime = Date.now();
    
    logger.info(`Starting duplicate detection for package: ${options.packageName}`);
    this.outputChannel.clear();
    this.outputChannel.show(true); // Show output channel and preserve focus
    this.outputChannel.appendLine(`=== Duplicate Detection for ${options.packageName} ===`);
    this.outputChannel.appendLine(`Started at: ${new Date().toLocaleString()}\n`);

    try {
      // Ensure PMD is available
      const scanService = ScanService.getInstance();
      // First ensure PMD is installed
      await scanService.ensurePMDInstalled();
      // Then get the PMD path
      const pmdPath = scanService.getPMDPath();

      // Get all Apex files from the package
      this.outputChannel.appendLine('Scanning for Apex files (excluding test classes)...');
      const packageResult = await this.getApexFiles(options.packagePath);
      const packageApexFiles = packageResult.files;
      
      if (packageApexFiles.length === 0) {
        this.outputChannel.appendLine('No non-test Apex files found in package.');
        return this.createEmptyResult(options.packageName, Date.now() - startTime);
      }

      this.outputChannel.appendLine(`Found ${packageApexFiles.length} non-test Apex files in package:`);
      if (packageResult.excludedCount > 0) {
        this.outputChannel.appendLine(`  (Excluded ${packageResult.excludedCount} test files)`);
      }
      this.outputChannel.appendLine('');
      packageApexFiles.forEach(file => {
        this.outputChannel.appendLine(`  - ${path.relative(options.packagePath, file)}`);
      });

      // Get all Apex files from the workspace (excluding the package itself)
      const workspaceApexFiles = await this.getApexFilesFromWorkspace(
        options.workspaceRoot,
        options.packagePath
      );

      this.outputChannel.appendLine(`\nFound ${workspaceApexFiles.length} non-test Apex files in other packages to compare against.\n`);

      // Combine all files for CPD analysis
      const allFiles = [...packageApexFiles, ...workspaceApexFiles];

      // Run CPD
      const cpdResult = await this.runCPD(pmdPath, allFiles, options);
      
      // Debug: Log raw CPD output (only first 1000 chars to avoid spam)
      this.outputChannel.appendLine('\n--- Debug: Raw CPD Output ---');
      this.outputChannel.appendLine(`Output length: ${cpdResult.length} characters`);
      if (cpdResult.length === 0) {
        this.outputChannel.appendLine('⚠️  WARNING: CPD returned empty output!');
      } else if (cpdResult.includes('<?xml')) {
        // Only show a snippet of the XML
        const firstDuplication = cpdResult.indexOf('<duplication');
        if (firstDuplication > 0) {
          this.outputChannel.appendLine(cpdResult.substring(0, Math.min(1000, firstDuplication + 500)) + '\n... (truncated) ...');
        } else {
          this.outputChannel.appendLine('No <duplication> tags found in CPD output');
          this.outputChannel.appendLine(cpdResult.substring(0, 500));
        }
      } else {
        this.outputChannel.appendLine('Unexpected output format:');
        this.outputChannel.appendLine(cpdResult.substring(0, 500));
      }
      this.outputChannel.appendLine('--- End Raw CPD Output ---\n');
      
      // Parse and filter results to only show duplicates involving package files
      const result = await this.parseCPDResult(cpdResult, packageApexFiles, options);
      
      result.scanDuration = Date.now() - startTime;
      result.timestamp = new Date();

      // Display results
      this.displayResults(result);

      // Save results to package if requested
      if (options.saveToPackage) {
        await this.saveResults(
          result,
          options.packagePath,
          options.saveFormat || 'markdown'
        );
      }

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Duplicate detection failed:', error);
      this.outputChannel.appendLine(`\nError: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Get all Apex files from a directory (excluding test classes)
   */
  private async getApexFiles(dir: string): Promise<{ files: string[], excludedCount: number }> {
    const apexFiles: string[] = [];
    let excludedTestFiles = 0;

    const walk = async (currentDir: string) => {
      const files = await fs.promises.readdir(currentDir);
      
      for (const file of files) {
        const filePath = path.join(currentDir, file);
        const stats = await fs.promises.stat(filePath);
        
        if (stats.isDirectory() && !file.startsWith('.')) {
          await walk(filePath);
        } else if (stats.isFile() && (file.endsWith('.cls') || file.endsWith('.trigger'))) {
          // Exclude test classes based on filename
          const lowerFile = file.toLowerCase();
          if (lowerFile.endsWith('test.cls') || 
              lowerFile.endsWith('tests.cls') ||
              lowerFile.includes('_test.cls') ||
              lowerFile.includes('test_') ||
              lowerFile.includes('mock') ||
              lowerFile.includes('stub')) {
            excludedTestFiles++;
            continue;
          }
          
          // Additionally check file content for @isTest annotation
          if (file.endsWith('.cls')) {
            try {
              const content = await fs.promises.readFile(filePath, 'utf8');
              // Check if it's a test class
              if (content.match(/@isTest|@IsTest/)) {
                excludedTestFiles++;
                continue;
              }
            } catch (error) {
              // If we can't read the file, include it anyway
              logger.warn(`Could not read file ${filePath} to check for @isTest: ${error}`);
            }
          }
          
          apexFiles.push(filePath);
        }
      }
    };

    await walk(dir);
    
    return { 
      files: apexFiles.sort(), 
      excludedCount: excludedTestFiles 
    };
  }

  /**
   * Get all Apex files from workspace excluding a specific package
   */
  private async getApexFilesFromWorkspace(workspaceRoot: string, excludePath: string): Promise<string[]> {
    const apexFiles: string[] = [];

    // Read sfdx-project.json to find all package directories
    const projectJsonPath = path.join(workspaceRoot, 'sfdx-project.json');
    if (fs.existsSync(projectJsonPath)) {
      try {
        const projectJson = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));
        
        if (projectJson.packageDirectories && Array.isArray(projectJson.packageDirectories)) {
          for (const dir of projectJson.packageDirectories) {
            if (dir.path) {
              const packagePath = path.join(workspaceRoot, dir.path);
              
              // Skip the package we're analyzing
              if (packagePath === excludePath) {
                continue;
              }

              // Get Apex files from this package
              const result = await this.getApexFiles(packagePath);
              apexFiles.push(...result.files);
            }
          }
        }
      } catch (error) {
        logger.warn('Failed to parse sfdx-project.json:', error);
      }
    }

    return apexFiles;
  }

  /**
   * Run PMD's CPD (Copy-Paste Detector)
   */
  private async runCPD(pmdPath: string, files: string[], options: DuplicateDetectionOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      // Create a temporary file list
      const fileListPath = path.join(os.tmpdir(), `packageforce-cpd-${Date.now()}.txt`);
      fs.writeFileSync(fileListPath, files.join('\n'));

      // Use sh on Unix-like systems, cmd on Windows
      const isWindows = process.platform === 'win32';
      const cpdScript = isWindows ? 'cmd.exe' : 'sh';
      const scriptPath = path.join(pmdPath, 'bin', isWindows ? 'pmd.bat' : 'pmd');
      const args = isWindows ? ['/c', scriptPath, 'cpd'] : [scriptPath, 'cpd'];
      
      // File list
      args.push('--file-list', fileListPath);
      
      // Language
      args.push('--language', options.language || 'apex');
      
      // Minimum tokens (default 100)
      args.push('--minimum-tokens', String(options.minimumTokens || 100));
      
      // Format
      args.push('--format', options.format || 'xml');
      
      // Options
      if (options.skipDuplicateFiles !== false) {
        args.push('--skip-duplicate-files');
      }
      if (options.ignoreIdentifiers) {
        args.push('--ignore-identifiers');
      }
      if (options.ignoreLiterals) {
        args.push('--ignore-literals');
      }
      if (options.ignoreAnnotations) {
        args.push('--ignore-annotations');
      }

      logger.debug('Running CPD with args:', args);
      this.outputChannel.appendLine(`\nRunning CPD command: ${cpdScript} ${args.join(' ')}`);
      this.outputChannel.appendLine(`Minimum tokens: ${options.minimumTokens || 100}`);
      this.outputChannel.appendLine(`Files to analyze: ${files.length}\n`);

      const cpdProcess = spawn(cpdScript, args, {
        cwd: pmdPath,
        env: { ...process.env, JAVA_HOME: process.env.JAVA_HOME || '' }
      });

      let stdout = '';
      let stderr = '';

      cpdProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      cpdProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      cpdProcess.on('close', (code) => {
        // Clean up temp file
        try {
          fs.unlinkSync(fileListPath);
        } catch (e) {
          // Ignore
        }

        logger.debug(`CPD exited with code ${code}`);
        logger.debug(`CPD stdout length: ${stdout.length}`);
        logger.debug(`CPD stderr: ${stderr}`);

        if (code === 0 || code === 4) {
          resolve(stdout);
        } else {
          reject(new Error(`CPD exited with code ${code}: ${stderr}`));
        }
      });

      cpdProcess.on('error', (error) => {
        // Clean up temp file
        try {
          fs.unlinkSync(fileListPath);
        } catch (e) {
          // Ignore
        }
        reject(error);
      });
    });
  }

  /**
   * Parse CPD XML output and filter for package-related duplicates (PMD 7.x format)
   */
  private async parseCPDResult(
    xmlOutput: string, 
    packageFiles: string[], 
    options: DuplicateDetectionOptions
  ): Promise<DuplicateResult> {
    const duplications: Duplication[] = [];
    let totalDuplicatedLines = 0;
    let totalDuplicatedTokens = 0;

    // Debug: Log package files (only show first few to avoid spam)
    this.outputChannel.appendLine('\n--- Debug: Package Files Being Checked ---');
    this.outputChannel.appendLine(`Total package files: ${packageFiles.length}`);
    if (packageFiles.length <= 10) {
      packageFiles.forEach(f => this.outputChannel.appendLine(`  ${f}`));
    } else {
      packageFiles.slice(0, 5).forEach(f => this.outputChannel.appendLine(`  ${f}`));
      this.outputChannel.appendLine(`  ... and ${packageFiles.length - 5} more files`);
    }
    this.outputChannel.appendLine('--- End Package Files ---\n');

    // Parse duplication elements
    const duplicationMatches = xmlOutput.matchAll(
      /<duplication lines="(\d+)" tokens="(\d+)">([\s\S]*?)<\/duplication>/g
    );

    let duplicationCount = 0;
    let totalDuplicationsFound = 0;
    
    for (const match of duplicationMatches) {
      totalDuplicationsFound++;
      const lines = parseInt(match[1]);
      const tokens = parseInt(match[2]);
      const content = match[3];
      
      // Only log first few duplications to avoid spam
      if (totalDuplicationsFound <= 5) {
        this.outputChannel.appendLine(`\n--- Debug: Processing duplication ${totalDuplicationsFound} ---`);
        this.outputChannel.appendLine(`Lines: ${lines}, Tokens: ${tokens}`);
      } else if (totalDuplicationsFound === 6) {
        this.outputChannel.appendLine(`\n... (suppressing further duplication processing logs) ...`);
      }

      // Debug: show content for first duplication
      if (totalDuplicationsFound === 1) {
        this.outputChannel.appendLine(`\n--- Debug: First duplication content ---`);
        this.outputChannel.appendLine(content.substring(0, 500));
        this.outputChannel.appendLine(`--- End first duplication content ---\n`);
      }
      
      // Parse file occurrences within the duplication
      // PMD 7.x format - file elements can be self-closing or have content
      let fileMatches = content.matchAll(
        /<file\s+[^>]*path="([^"]+)"[^>]*line="(\d+)"[^>]*endline="(\d+)"[^>]*(?:\/|>[^<]*<\/file)>/g
      );
      
      let matchArray = Array.from(fileMatches);
      
      // If no matches, try simpler pattern
      if (matchArray.length === 0) {
        fileMatches = content.matchAll(
          /<file[^>]+path="([^"]+)"[^>]*>/g
        );
        matchArray = Array.from(fileMatches);
        
        // For simple pattern, extract line numbers separately
        if (matchArray.length > 0 && totalDuplicationsFound <= 3) {
          this.outputChannel.appendLine(`  Using simplified file pattern`);
        }
      }
      
      if (totalDuplicationsFound <= 3 && matchArray.length === 0) {
        this.outputChannel.appendLine(`  WARNING: No file matches found in duplication content`);
      }

      const occurrences: DuplicationOccurrence[] = [];
      let hasPackageFile = false;
      const isSimplePattern = matchArray.length > 0 && matchArray[0][2] === undefined;

      for (const fileMatch of matchArray) {
        let filePath, startLine, endLine;
        
        if (isSimplePattern) {
          // Simple pattern only gives us the path
          filePath = fileMatch[1];
          // Extract line numbers from the full match text
          const fullMatch = fileMatch[0];
          const lineMatch = fullMatch.match(/line="(\d+)"/);
          const endLineMatch = fullMatch.match(/endline="(\d+)"/);
          startLine = lineMatch ? parseInt(lineMatch[1]) : 1;
          endLine = endLineMatch ? parseInt(endLineMatch[1]) : startLine + lines - 1;
        } else {
          // Full pattern: path is [1], line is [2], endline is [3]
          filePath = fileMatch[1];
          startLine = parseInt(fileMatch[2]);
          endLine = parseInt(fileMatch[3]);
        }

        occurrences.push({
          file: filePath,
          startLine,
          endLine
        });
        
        // Debug first few file paths from CPD
        if (totalDuplicationsFound <= 3 && occurrences.length <= 2) {
          this.outputChannel.appendLine(`  File from CPD: ${filePath}`);
        }

        // Check if this file is from our package
        const isPackageFile = packageFiles.some(pkgFile => {
          // Direct string comparison first (most common case)
          if (pkgFile === filePath) {
            if (totalDuplicationsFound <= 5) {
              this.outputChannel.appendLine(`  ✓ MATCHED (exact): ${filePath}`);
            }
            return true;
          }
          
          // Normalize paths for comparison
          const normalizedPkgFile = path.normalize(pkgFile).toLowerCase();
          const normalizedFilePath = path.normalize(filePath).toLowerCase();
          
          // Case-insensitive direct comparison
          if (normalizedPkgFile === normalizedFilePath) {
            if (totalDuplicationsFound <= 5) {
              this.outputChannel.appendLine(`  ✓ MATCHED (normalized): ${filePath}`);
            }
            return true;
          }
          
          // For debugging - show comparison details for first few
          if (totalDuplicationsFound <= 2 && occurrences.length <= 2) {
            const pkgBasename = path.basename(pkgFile);
            const fileBasename = path.basename(filePath);
            if (pkgBasename === fileBasename) {
              this.outputChannel.appendLine(`    Comparing: ${pkgFile}`);
              this.outputChannel.appendLine(`    With CPD:  ${filePath}`);
              this.outputChannel.appendLine(`    Equal: ${pkgFile === filePath}`);
            }
          }
          
          return false;
        });
        
        if (isPackageFile) {
          hasPackageFile = true;
        }
      }

      // Extract code fragment if available
      const codeMatch = content.match(/<codefragment>[\s\S]*?<!\[CDATA\[([\s\S]*?)\]\]>[\s\S]*?<\/codefragment>/);
      if (codeMatch && occurrences.length > 0) {
        occurrences[0].codeFragment = codeMatch[1].trim();
      }

      // Include duplications where at least one file is from our package
      if (hasPackageFile) {
        duplications.push({
          lines,
          tokens,
          occurrences
        });

        totalDuplicatedLines += lines * occurrences.length;
        totalDuplicatedTokens += tokens * occurrences.length;
        
        // Debug: Show what type of duplication this is
        const packageOccurrences = occurrences.filter(occ => 
          packageFiles.some(pkgFile => {
            const normalizedPkgFile = path.normalize(pkgFile);
            const normalizedFilePath = path.normalize(occ.file);
            return normalizedPkgFile === normalizedFilePath || 
                   normalizedPkgFile.endsWith(normalizedFilePath) || 
                   normalizedFilePath.endsWith(normalizedPkgFile);
          })
        );
        
        if (totalDuplicationsFound <= 5) {
          if (packageOccurrences.length === occurrences.length) {
            this.outputChannel.appendLine(`  → Internal duplication (within package only)`);
          } else {
            this.outputChannel.appendLine(`  → Cross-package duplication (${packageOccurrences.length} in package, ${occurrences.length - packageOccurrences.length} in other packages)`);
          }
        }
      }
    }
    
    this.outputChannel.appendLine(`\n--- Debug: Parsing Summary ---`);
    this.outputChannel.appendLine(`Total duplications found in CPD output: ${totalDuplicationsFound}`);
    this.outputChannel.appendLine(`Duplications involving package files: ${duplications.length}`);
    
    // Check if PrepareEventInstanceHelper is in the CPD output at all
    if (xmlOutput.includes('PrepareEventInstanceHelper')) {
      this.outputChannel.appendLine(`✓ PrepareEventInstanceHelper found in CPD output`);
      
      // Count how many times it appears
      const count = (xmlOutput.match(/PrepareEventInstanceHelper/g) || []).length;
      this.outputChannel.appendLine(`  Appears ${count} times in output`);
    } else {
      this.outputChannel.appendLine(`✗ PrepareEventInstanceHelper NOT found in CPD output`);
    }
    
    this.outputChannel.appendLine(`--- End Parsing Summary ---\n`);

    // Check for cross-package duplicates
    let hasCrossPackageDuplicates = false;
    duplications.forEach(dup => {
      const packages = new Set<string>();
      dup.occurrences.forEach(occ => {
        packages.add(this.getPackageFromPath(occ.file));
      });
      if (packages.size > 1) {
        hasCrossPackageDuplicates = true;
      }
    });

    return {
      packageName: options.packageName,
      duplications,
      totalDuplications: duplications.length,
      totalDuplicatedLines,
      totalDuplicatedTokens,
      scanDuration: 0,
      timestamp: new Date(),
      hasCrossPackageDuplicates,
      success: duplications.length === 0
    };
  }

  /**
   * Create empty result
   */
  private createEmptyResult(packageName: string, duration: number): DuplicateResult {
    return {
      packageName,
      duplications: [],
      totalDuplications: 0,
      totalDuplicatedLines: 0,
      totalDuplicatedTokens: 0,
      scanDuration: duration,
      timestamp: new Date(),
      hasCrossPackageDuplicates: false,
      success: true
    };
  }

  /**
   * Display results in output channel
   */
  private displayResults(result: DuplicateResult) {
    this.outputChannel.appendLine('\n=== DUPLICATE DETECTION RESULTS ===\n');

    if (result.totalDuplications === 0) {
      this.outputChannel.appendLine('✅ No duplicate code found!\n');
      this.outputChannel.appendLine('Your package code appears to be unique across the repository.');
    } else {
      // Count cross-package vs internal duplications
      let crossPackageCount = 0;
      let internalCount = 0;
      
      result.duplications.forEach(dup => {
        const packages = new Set<string>();
        dup.occurrences.forEach(occ => {
          packages.add(this.getPackageFromPath(occ.file));
        });
        
        if (packages.size > 1) {
          crossPackageCount++;
        } else {
          internalCount++;
        }
      });
      
      this.outputChannel.appendLine(`⚠️  Found ${result.totalDuplications} duplicate code blocks\n`);
      this.outputChannel.appendLine(`Summary:`);
      this.outputChannel.appendLine(`  - Total duplicate blocks: ${result.totalDuplications}`);
      if (crossPackageCount > 0) {
        this.outputChannel.appendLine(`  - ❌ Cross-package duplicates: ${crossPackageCount} (CRITICAL - code shared between packages!)`);
      }
      if (internalCount > 0) {
        this.outputChannel.appendLine(`  - ⚠️  Internal duplicates: ${internalCount} (within the same package)`);
      }
      this.outputChannel.appendLine(`  - Total duplicated lines: ${result.totalDuplicatedLines}`);
      this.outputChannel.appendLine(`  - Total duplicated tokens: ${result.totalDuplicatedTokens}\n`);

      // Display each duplication
      result.duplications.forEach((dup, index) => {
        this.outputChannel.appendLine(`\n--- Duplication #${index + 1} ---`);
        this.outputChannel.appendLine(`Size: ${dup.lines} lines, ${dup.tokens} tokens`);
        this.outputChannel.appendLine(`Found in ${dup.occurrences.length} locations:\n`);

        dup.occurrences.forEach((occurrence, occIndex) => {
          // Check if this occurrence is in the package being analyzed
          const isInPackage = occurrence.file.includes(result.packageName) || 
                             occurrence.file.includes(result.packageName.replace(/-/g, '_'));
          const marker = isInPackage ? '📦' : '🔗';
          
          this.outputChannel.appendLine(`  ${occIndex + 1}. ${marker} ${occurrence.file}`);
          this.outputChannel.appendLine(`     Lines ${occurrence.startLine}-${occurrence.endLine}`);
        });

        // Show code fragment for first duplication
        if (dup.occurrences[0].codeFragment) {
          this.outputChannel.appendLine(`\nCode fragment:`);
          this.outputChannel.appendLine('```apex');
          this.outputChannel.appendLine(dup.occurrences[0].codeFragment);
          this.outputChannel.appendLine('```');
        }
      });
    }

    this.outputChannel.appendLine(`\nScan completed in ${result.scanDuration}ms`);
    this.outputChannel.appendLine(`Finished at: ${result.timestamp.toLocaleString()}`);
  }

  /**
   * Create diagnostics for duplicate code
   */
  public createDuplicateDiagnostics(result: DuplicateResult): Map<vscode.Uri, vscode.Diagnostic[]> {
    const diagnosticsMap = new Map<vscode.Uri, vscode.Diagnostic[]>();

    for (const duplication of result.duplications) {
      for (const occurrence of duplication.occurrences) {
        const uri = vscode.Uri.file(occurrence.file);
        const diagnostics = diagnosticsMap.get(uri) || [];

        const range = new vscode.Range(
          occurrence.startLine - 1,
          0,
          occurrence.endLine - 1,
          Number.MAX_SAFE_INTEGER
        );

        const otherLocations = duplication.occurrences
          .filter(occ => occ.file !== occurrence.file)
          .map(occ => {
            const fileName = path.basename(occ.file);
            const dirName = path.basename(path.dirname(occ.file));
            return `${dirName}/${fileName}:${occ.startLine}-${occ.endLine}`;
          })
          .join(', ');

        // Check if this is cross-package duplication
        const hasCrossPackageDuplication = duplication.occurrences.some(occ => {
          const occPackage = this.getPackageFromPath(occ.file);
          const currentPackage = this.getPackageFromPath(occurrence.file);
          return occPackage !== currentPackage;
        });

        const severityLevel = hasCrossPackageDuplication 
          ? vscode.DiagnosticSeverity.Error 
          : vscode.DiagnosticSeverity.Warning;

        const prefix = hasCrossPackageDuplication ? '❌ Cross-package duplicate' : '⚠️ Duplicate';
        
        const diagnostic = new vscode.Diagnostic(
          range,
          `${prefix} code found (${duplication.lines} lines, ${duplication.tokens} tokens). Also in: ${otherLocations}`,
          severityLevel
        );

        diagnostic.source = 'Packageforce Duplicate Detector';
        diagnostic.code = 'duplicate-code';

        diagnostics.push(diagnostic);
        diagnosticsMap.set(uri, diagnostics);
      }
    }

    return diagnosticsMap;
  }

  /**
   * Extract package name from file path
   */
  private getPackageFromPath(filePath: string): string {
    // Look for common Salesforce package directory patterns
    const pathParts = filePath.split(path.sep);
    
    // Find 'force-app' or similar package directory
    const forceAppIndex = pathParts.findIndex(part => 
      part === 'force-app' || part.endsWith('-app') || part === 'src'
    );
    
    if (forceAppIndex > 0) {
      // Return the directory before force-app (likely the package name)
      return pathParts[forceAppIndex - 1];
    }
    
    // Try to find package name from path structure
    // Look for pattern like: .../package-name/force-app/main/default/classes/...
    for (let i = 0; i < pathParts.length - 2; i++) {
      if (pathParts[i + 1] === 'force-app' || pathParts[i + 1] === 'src') {
        return pathParts[i];
      }
    }
    
    // Fallback: use the first meaningful directory after the workspace root
    const meaningfulParts = pathParts.filter(part => 
      part && !part.startsWith('.') && part !== 'Users' && part !== 'home'
    );
    
    return meaningfulParts[meaningfulParts.length - 5] || 'unknown';
  }

  /**
   * Save duplicate detection results to file
   */
  public async saveResults(
    result: DuplicateResult,
    packagePath: string,
    format: 'markdown' | 'xml' | 'json' | 'csv' | 'text' = 'markdown',
    options?: { includeTimestamp?: boolean; includeMetadata?: boolean }
  ): Promise<string> {
    const { ReportUtils } = await import('../utils/reportUtils');
    
    const reportOptions = {
      format,
      includeTimestamp: options?.includeTimestamp,
      includeMetadata: options?.includeMetadata
    };
    
    const filePath = await ReportUtils.saveDuplicateResults(result, packagePath, reportOptions);
    
    this.outputChannel.appendLine(`\nDuplicate analysis results saved to: ${filePath}`);
    logger.info(`Duplicate analysis results saved to: ${filePath}`);
    
    return filePath;
  }
}