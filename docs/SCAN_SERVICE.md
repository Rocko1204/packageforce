# Scan Service Documentation

The Scan Service provides comprehensive code analysis capabilities for Salesforce packages using PMD (Programming Mistake Detector).

## Features

- **PMD Integration**: Automatically downloads and manages PMD installation
- **Custom Rules Support**: Load and apply custom PMD rules from your repository
- **Multiple Output Formats**: Export results as HTML, CSV, JSON, or Markdown
- **VS Code Integration**: Display violations in the Problems panel
- **Configurable Analysis**: Choose rulesets, priority levels, and other options
- **Progress Tracking**: Real-time progress updates during scanning

## Usage

### Basic Scanning

1. Right-click on any package in the Packageforce Package Explorer
2. Select "Scan Package" from the context menu
3. Choose a scan option:
   - **Quick Scan**: Uses essential rules (best practices, error-prone, security)
   - **Full Scan**: Uses all available Apex rulesets
   - **Custom Scan**: Configure specific rulesets and options
   - **Scan with Custom Rules**: Use rules from your repository

### Custom Rules

Place custom PMD rule files in one of these directories:
- `.pmd/` (recommended)
- `config/pmd/`
- `pmd-rules/`

Example custom rule file structure:
```xml
<?xml version="1.0"?>
<ruleset name="Custom Apex Rules"
         xmlns="http://pmd.sourceforge.net/ruleset/2.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://pmd.sourceforge.net/ruleset/2.0.0 
                             https://pmd.sourceforge.io/ruleset_2_0_0.xsd">
    
    <description>Custom PMD rules for our project</description>
    
    <rule ref="category/apex/bestpractices.xml/ApexUnitTestClassShouldHaveAsserts">
        <priority>2</priority>
    </rule>
    
    <!-- Add more rules here -->
</ruleset>
```

### Configuration

Configure the scanner through VS Code settings:

```json
{
  "forceOps.scanner.pmdPath": "/path/to/custom/pmd",
  "forceOps.scanner.defaultRulesets": [
    "category/apex/bestpractices.xml",
    "category/apex/security.xml"
  ],
  "forceOps.scanner.minimumPriority": 3
}
```

## Scan Options

### Priority Levels
- **1 - Critical** 🔴: Must fix immediately
- **2 - High** 🟠: Should fix soon
- **3 - Medium** 🟡: Consider fixing
- **4 - Low** 🔵: Nice to fix
- **5 - Info** ⚪: Informational

### Available Rulesets
- `bestpractices.xml`: Apex best practices
- `codestyle.xml`: Code formatting and naming conventions
- `design.xml`: Design quality metrics
- `documentation.xml`: Documentation requirements
- `errorprone.xml`: Common error patterns
- `multithreading.xml`: Concurrency issues
- `performance.xml`: Performance optimizations
- `security.xml`: Security vulnerabilities

## Output Formats

### HTML Report
Professional report with:
- Summary statistics
- Color-coded violations by priority
- Grouped by file
- Direct links to documentation

### CSV Export
Spreadsheet-compatible format with:
- File path
- Line number
- Priority
- Rule name
- Violation message

### JSON Export
Machine-readable format containing:
- Complete scan metadata
- All violation details
- Suitable for automation

### Markdown Report
Documentation-friendly format with:
- Summary section
- Table format for violations
- Priority indicators
- GitHub/GitLab compatible

## API Usage

```typescript
import { ScanService, ScanOptions } from './services/scanService';

const scanService = ScanService.getInstance();

const options: ScanOptions = {
  packagePath: '/path/to/package',
  packageName: 'MyPackage',
  rulesets: ['category/apex/security.xml'],
  minimumPriority: 2,
  format: 'xml'
};

const result = await scanService.scanPackage(options);
console.log(`Found ${result.totalViolations} violations`);
```

## Troubleshooting

### PMD Not Found
The service will automatically download PMD on first use. Ensure you have:
- Internet connection for download
- Write permissions to `~/.forceops/pmd/`

### No Violations Found
Check that:
- The package contains Apex classes
- The selected rulesets apply to your code
- The minimum priority isn't filtering all results

### Custom Rules Not Loading
Verify that:
- XML files are valid PMD ruleset format
- File permissions allow reading
- Rule references are correct

## Performance Tips

1. **Use Quick Scan** for rapid feedback during development
2. **Cache Results** to speed up repeated scans (enabled by default)
3. **Limit Threads** on systems with limited resources
4. **Filter by Priority** to focus on critical issues first

## Integration with CI/CD

Export scan results in JSON format and integrate with your CI/CD pipeline:

```bash
# Example: Fail build if critical violations found
node -e "
  const report = require('./scan-report.json');
  const critical = report.violations.filter(v => v.priority === 1);
  if (critical.length > 0) {
    console.error('Critical violations found:', critical.length);
    process.exit(1);
  }
"
```