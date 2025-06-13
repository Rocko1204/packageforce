# Scan and Duplicate Detection Results Storage

This document describes how to save scan and duplicate detection results directly to your package directories.

## Overview

The extension now supports saving analysis results in multiple formats directly to your package directory, similar to how changelog files are stored. This makes it easy to:

- Track code quality over time
- Include analysis results in version control
- Integrate with CI/CD pipelines
- Share results with team members

## File Locations

Results are saved in the package directory:

- **Scan Results**: `SCAN_RESULTS.{format}` 
- **Duplicate Analysis**: `DUPLICATE_ANALYSIS.{format}`

If your package path ends with `/main`, files are saved in the parent directory (similar to changelog behavior).

## Supported Formats

### Scan Results Formats

1. **Markdown** (`.md`) - Default, human-readable format
2. **PMD XML** (`.xml`) - Native PMD format for tooling integration
3. **JSON** (`.json`) - Structured data for programmatic access
4. **CSV** (`.csv`) - For spreadsheet analysis
5. **Plain Text** (`.text`) - Simple text format
6. **HTML** (`.html`) - Rich formatted report
7. **SARIF** (`.sarif`) - For GitHub/VS Code integration

### Duplicate Detection Formats

1. **Markdown** (`.md`) - Default, human-readable format
2. **CPD XML** (`.xml`) - Native CPD format
3. **JSON** (`.json`) - Structured data
4. **CSV** (`.csv`) - For spreadsheet analysis
5. **Plain Text** (`.text`) - Simple text format

## Usage

### Interactive Usage (VS Code)

When running scans or duplicate detection from VS Code, you'll see three options after analysis:

1. **View Output** - Shows results in VS Code output panel
2. **Save to Package** - Saves results to package directory
3. **Export Report** - Saves to custom location

### Programmatic Usage

```typescript
// Enable automatic saving
const scanOptions: ScanOptions = {
  packagePath: '/path/to/package',
  packageName: 'MyPackage',
  saveToPackage: true,        // Enable auto-save
  saveFormat: 'markdown',     // Choose format
  // ... other options
};

// Results will be automatically saved after scan
const result = await scanService.scanPackage(scanOptions);
```

### Manual Saving

```typescript
// Save results manually in any format
await scanService.saveResults(
  result,
  packagePath,
  'xml',  // format
  { 
    includeTimestamp: true,
    includeMetadata: true 
  }
);
```

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Run Code Quality Checks
  run: |
    # Run scan and save as SARIF for GitHub integration
    npm run scan -- --save --format=sarif
    
    # Upload SARIF file to GitHub
    - uses: github/codeql-action/upload-sarif@v2
      with:
        sarif_file: force-app/SCAN_RESULTS.sarif
```

### Jenkins Example

```groovy
stage('Code Quality') {
  steps {
    script {
      // Run scan and save results
      sh 'npm run scan -- --save --format=xml'
      
      // Publish PMD results
      recordIssues(
        enabledForFailure: true,
        tools: [pmdParser(pattern: '**/SCAN_RESULTS.xml')]
      )
    }
  }
}
```

## Report Examples

### Markdown Report
```markdown
# Code Scan Results - MyPackage

## Summary
- **Total Violations:** 5
- **Scan Date:** 2024-01-15 10:30:00
- **Scan Duration:** 1234ms

## Violations by File

### force-app/main/default/classes/AccountService.cls

| Line | Priority | Rule | Message |
|------|----------|------|----------|
| 45 | 🟡 3 | ApexUnitTestShouldNotUseSeeAllDataTrue | Test classes should not use seeAllData=true |
```

### HTML Report
Beautiful, interactive HTML reports with:
- Syntax highlighting
- Sortable tables
- Priority indicators
- File grouping

### SARIF Format
Integrates with:
- GitHub Security tab
- VS Code Problems panel
- Other SARIF-compatible tools

## Best Practices

1. **Version Control**: Add result files to `.gitignore` if you don't want them in version control
2. **CI/CD**: Use JSON or XML formats for easy parsing in automated pipelines
3. **Documentation**: Use Markdown format for README-style documentation
4. **Tool Integration**: Use native formats (PMD XML, SARIF) for tool integration

## Configuration

You can configure default behavior in VS Code settings:

```json
{
  "packageforce.scan.autoSave": true,
  "packageforce.scan.defaultFormat": "markdown",
  "packageforce.duplicate.autoSave": false,
  "packageforce.duplicate.defaultFormat": "json"
}
```

## Troubleshooting

### Files Not Being Created
- Check write permissions on package directory
- Verify package path is correct
- Check VS Code output panel for errors

### Format Not Supported
- Ensure you're using a supported format
- Check for typos in format specification

### Large Result Files
- Consider using CSV or JSON for large results
- Use filters to reduce result size (e.g., minimum priority)