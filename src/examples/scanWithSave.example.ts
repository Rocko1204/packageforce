/**
 * Example: How to use scan and duplicate detection with automatic saving
 */

import { ScanService, ScanOptions } from '../services/scanService';
import {
  DuplicateDetectorService,
  DuplicateDetectionOptions,
} from '../services/duplicateDetectorService';

// Example 1: Run scan and save results to package directory
async function scanAndSaveExample() {
  const scanService = ScanService.getInstance();

  const scanOptions: ScanOptions = {
    packagePath: '/path/to/package',
    packageName: 'MyPackage',
    saveToPackage: true, // Enable automatic saving
    saveFormat: 'markdown', // Save as markdown (default)
    rulesets: [
      'category/apex/bestpractices.xml',
      'category/apex/errorprone.xml',
      'category/apex/security.xml',
    ],
    minimumPriority: 3,
  };

  // This will scan and automatically save results to:
  // /path/to/package/SCAN_RESULTS.md
  const result = await scanService.scanPackage(scanOptions);

  // You can also save manually in different formats
  await scanService.saveResults(result, scanOptions.packagePath, 'xml'); // PMD XML format
  await scanService.saveResults(result, scanOptions.packagePath, 'json'); // JSON format
  await scanService.saveResults(result, scanOptions.packagePath, 'csv'); // CSV format
  await scanService.saveResults(result, scanOptions.packagePath, 'html'); // HTML report
  await scanService.saveResults(result, scanOptions.packagePath, 'sarif'); // SARIF for GitHub
}

// Example 2: Run duplicate detection and save results
async function duplicateDetectionAndSaveExample() {
  const duplicateService = DuplicateDetectorService.getInstance();

  const options: DuplicateDetectionOptions = {
    packagePath: '/path/to/package',
    packageName: 'MyPackage',
    workspaceRoot: '/path/to/workspace',
    minimumTokens: 100,
    saveToPackage: true, // Enable automatic saving
    saveFormat: 'markdown', // Save as markdown
    ignoreIdentifiers: true, // Ignore variable name differences
    ignoreLiterals: true, // Ignore string/number differences
  };

  // This will analyze and automatically save results to:
  // /path/to/package/DUPLICATE_ANALYSIS.md
  const result = await duplicateService.findDuplicates(options);

  // You can also save manually in different formats
  await duplicateService.saveResults(result, options.packagePath, 'xml'); // CPD XML format
  await duplicateService.saveResults(result, options.packagePath, 'json'); // JSON format
  await duplicateService.saveResults(result, options.packagePath, 'csv'); // CSV format
  await duplicateService.saveResults(result, options.packagePath, 'text'); // Plain text
}

// Example 3: Custom report options
async function customReportExample() {
  const scanService = ScanService.getInstance();

  const scanOptions: ScanOptions = {
    packagePath: '/path/to/package',
    packageName: 'MyPackage',
    saveToPackage: true,
    saveFormat: 'html', // Save as HTML report
  };

  const result = await scanService.scanPackage(scanOptions);

  // Save with custom options
  await scanService.saveResults(result, scanOptions.packagePath, 'markdown', {
    includeTimestamp: true, // Include timestamp in report
    includeMetadata: false, // Exclude metadata section
  });
}

// Example 4: Integration with CI/CD
async function cicdExample() {
  const scanService = ScanService.getInstance();
  const duplicateService = DuplicateDetectorService.getInstance();

  // Run both scan and duplicate detection, saving results
  const scanOptions: ScanOptions = {
    packagePath: process.env.PACKAGE_PATH!,
    packageName: process.env.PACKAGE_NAME!,
    saveToPackage: true,
    saveFormat: 'sarif', // Use SARIF for GitHub Actions integration
    minimumPriority: 3,
  };

  const duplicateOptions: DuplicateDetectionOptions = {
    packagePath: process.env.PACKAGE_PATH!,
    packageName: process.env.PACKAGE_NAME!,
    workspaceRoot: process.env.WORKSPACE_ROOT!,
    saveToPackage: true,
    saveFormat: 'json', // Use JSON for easy parsing
    minimumTokens: 100,
  };

  try {
    const scanResult = await scanService.scanPackage(scanOptions);
    const duplicateResult =
      await duplicateService.findDuplicates(duplicateOptions);

    // Check results for CI/CD
    if (scanResult.totalViolations > 0) {
      console.error(`Found ${scanResult.totalViolations} code violations`);
      process.exit(1);
    }

    if (
      duplicateResult.totalDuplications > 0 &&
      duplicateResult.hasCrossPackageDuplicates
    ) {
      console.error(
        `Found ${duplicateResult.totalDuplications} duplicate code blocks`
      );
      process.exit(1);
    }

    console.log('✅ Code quality checks passed!');
  } catch (error) {
    console.error('Code quality check failed:', error);
    process.exit(1);
  }
}

export {
  scanAndSaveExample,
  duplicateDetectionAndSaveExample,
  customReportExample,
  cicdExample,
};
