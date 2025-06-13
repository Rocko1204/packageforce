# Packageforce

[![CI](https://github.com/Rocko1204/packageforce/actions/workflows/ci.yml/badge.svg)](https://github.com/Rocko1204/packageforce/actions/workflows/ci.yml)
[![Release](https://github.com/Rocko1204/packageforce/actions/workflows/release.yml/badge.svg)](https://github.com/Rocko1204/packageforce/actions/workflows/release.yml)
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/RonnyRokitta.packageforce)](https://marketplace.visualstudio.com/items?itemName=RonnyRokitta.packageforce)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/RonnyRokitta.packageforce)](https://marketplace.visualstudio.com/items?itemName=RonnyRokitta.packageforce)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Advanced Salesforce DevOps toolkit for package operations, deployments, testing, and changelog management - completely independent from SF CLI.

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "Packageforce"
4. Click Install

### From GitHub Releases

1. Go to [Releases](https://github.com/Rocko1204/packageforce/releases)
2. Download the latest `.vsix` file
3. In VS Code, open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
4. Run "Extensions: Install from VSIX..."
5. Select the downloaded file

### From Source

```bash
# Clone the repository
git clone https://github.com/Rocko1204/packageforce.git
cd packageforce

# Install dependencies
npm install

# Build and package
npm run package

# Install the VSIX
code --install-extension packageforce-*.vsix
```

## Features

### CodeLens Actions
- Open any `sfdx-project.json` file to see inline actions for each package:
  - **🚀 Deploy Package**: Deploy a package to your selected org
  - **🔍 Scan Package**: Run PMD code analysis with custom rules support
  - **📋 Find Duplicates**: Detect duplicate code between package and entire repository
  - **🧪 Test Package**: Run all test classes in the package with code coverage

### Packageforce Packages View
- Find the **Packageforce Packages** view in the Explorer sidebar
- Shows all packages from your `sfdx-project.json` with package type indicators:
  - 🔒 Unlocked packages (have packageAliases entry)
  - 🗄️ Data packages (type: "data")
  - 🔀 Diff packages (type: "diff")
  - 📦 Source packages (default)
- Click any package to see available actions
- Quick actions available in the toolbar:
  - Search packages with quick pick
  - Update changelog from staged files
  - Scan staged files (global action)
  - Refresh package list

![Package View Demo](public/package_view.mov)

### Package Deployment
- Deploy packages directly from VS Code without SF CLI
- Support for multiple deployment modes:
  - **Package Only**: Deploy just the selected package
  - **With Dependencies**: Deploy package and all its dependencies
  - **Validate Only**: Run a check-only deployment to validate changes
  - **Advanced Options**: Configure test levels and specific test classes
- Smart org selection:
  - Use default org from config
  - Select specific org by alias or username
  - Automatic fallback to first available org
- Real-time deployment progress tracking
- Detailed error reporting with component-level failure details
- Support for all Salesforce metadata types

![Deploy Demo](public/deploy.mov)

### Duplicate Code Detection
- Find duplicate code across your entire repository
- Cross-package duplicate detection highlights code that should be shared
- Configurable sensitivity levels:
  - **Large Duplicates** (500+ tokens): Major code blocks
  - **Medium Duplicates** (200+ tokens): Significant methods or classes
  - **Small Duplicates** (100+ tokens): Smaller code patterns
  - **Custom Settings**: Fine-tune token count and matching options
- Smart exclusions:
  - Automatically excludes test classes
  - Detects @isTest annotations
  - Filters test files by naming patterns
- Advanced matching options:
  - Exact match for identical code
  - Ignore variable names for similar logic
  - Ignore literals for pattern matching
- Results visualization:
  - VS Code diagnostics integration
  - Cross-package duplicates shown as errors
  - Internal duplicates shown as warnings
  - Export reports in multiple formats

![Duplicate Demo](public/duplicate.mov)

### Test Execution (SF CLI Independent)
- Run all test classes in a package without requiring SF CLI
- Direct Salesforce API integration for test execution
- Two execution modes:
  - **Asynchronous (Default)**: Queue tests and poll for results
  - **Synchronous**: Wait for immediate results
- Uses MetadataResolver to automatically find test classes
- Detects test classes by @isTest annotation  
- Shows detailed test results with:
  - Pass/fail status for each test method
  - Code coverage percentage per class with line details
  - Overall package coverage with 75% threshold indicator
  - Full stack traces for failed tests
  - Progress updates during async execution
- Beautiful output formatting in dedicated output channel

![Tests Demo](public/tests.mov)

### Changelog Management
- Update package changelogs from staged Git files
- Automatically detects which packages have changes
- Interactive prompts for:
  - Change type (Feature/Fix)
  - Work item reference (e.g., JIRA ticket)
  - Change description
  - Breaking changes detection
- Updates:
  - Package versions in `sfdx-project.json`
  - README files with changelog tables
  - Stages all updated files for commit

![Changelog Demo](public/changelog.mov)

### Code Scanning with PMD
- Integrated PMD code analyzer for Apex, Visualforce, and Lightning
- Automatic PMD installation (no manual setup required)
- **PMD 7.x Compatible**: Updated rules for latest PMD version
- Custom rule support:
  - Place custom rules in `.pmd/` directory
  - XML-based rule configuration
  - Priority-based filtering
- Multiple scan modes:
  - Quick scan with essential rules
  - Full scan with all rules
  - Custom scan with selected rulesets
  - Custom rules scan from workspace
- **Global Scan Actions**:
  - Scan staged files from toolbar (not package-specific)
  - Scans all analyzable file types:
    - Apex (.cls, .trigger)
    - Visualforce (.page, .component)
    - Lightning Web Components (.js, .html in /lwc/)
    - Aura Components (.cmp, .evt, .app)
    - Metadata files (.object-meta.xml, .field-meta.xml, etc.)
  - Automatically applies custom rules for metadata validation
- Export scan results:
  - HTML reports with detailed findings
  - CSV for spreadsheet analysis
  - JSON for tool integration
  - Markdown for documentation
- VS Code integration:
  - Results shown in Problems panel
  - Click to navigate to violations
  - Detailed violation descriptions

![Scan Demo](public/scan.mov)

## Commands

All commands are available in the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`):

- `Packageforce: Test Extension` - Verify the extension is working
- `Packageforce: Find Package` - Search and navigate to packages
- `Packageforce: Update Changelog` - Update changelogs from staged files
- `Packageforce: Scan Staged Files` - Run PMD analysis on all staged files

## Requirements

- VS Code 1.95.0 or higher
- Salesforce DX project with `sfdx-project.json`
- Git repository for changelog features
- Authenticated Salesforce org (no SF CLI required)

## Getting Started

1. Open a Salesforce DX project in VS Code
2. The extension activates automatically
3. Open `sfdx-project.json` to see CodeLens actions
4. Look for "SFDX Packages" in the Explorer sidebar
5. Stage some changes and run the changelog command from the toolbar

### Using Custom PMD Rules

1. Copy the `.pmd/` folder to your Salesforce project root
2. Run scan on a package from CodeLens or Package Explorer
3. Select "Scan with Custom Rules" option
4. Review violations in the Problems panel

Example custom rules included:
- **Missing Data Factory**: Detects direct record instantiation in tests (CRITICAL)
- **Empty Object Description**: Flags objects without descriptions (HIGH)
- **Empty Field Description**: Flags fields without descriptions or help text (HIGH)
- **Test Data Factory Pattern**: Validates factory method implementations
- **Performance Rules**: Operations with limits in loops (PMD 7.x)
- **Security Rules**: CRUD and sharing violations

### Duplicate Code Detection
- Uses PMD's Copy-Paste Detector (CPD) to find duplicate code
- Compares package code against entire repository
- Multiple sensitivity levels:
  - Quick Check: 100+ tokens (larger duplicates)
  - Standard Check: 75+ tokens
  - Deep Check: 50+ tokens (smaller duplicates)
  - Custom: Configure your own threshold
- Matching options:
  - Exact match
  - Ignore variable names
  - Ignore literals (strings/numbers)
  - Ignore both (most flexible)
- Results shown in:
  - VS Code Problems panel with navigation
  - Detailed output channel
  - Exportable reports (HTML, CSV, JSON, Markdown)

## Troubleshooting

### Can't find the Packageforce Packages view?
- Look in the Explorer sidebar (where file tree is shown)
- The view should appear under a section called "Packageforce Packages"
- Try refreshing VS Code or reloading the window

### Changelog command stops after first prompt?
- Make sure you have staged files in Git
- Check the VS Code output panel for errors
- Try the "Simple Changelog Test" command first - if this works but the full command doesn't, it's a known issue with complex quick picks
- The extension now uses simplified string-based quick picks to avoid this issue

## Extension Settings

### Packageforce Settings

Configure Packageforce in VS Code settings:

```json
{
  // Path to PMD installation (optional - will auto-download if not set)
  "forceOps.pmd.path": "/path/to/pmd",
  
  // Custom PMD rules directory (defaults to .pmd/)
  "forceOps.pmd.customRulesPath": ".pmd/",
  
  // Java executable path
  "forceOps.pmd.javaPath": "java",
  
  // Show scan results in Problems panel
  "forceOps.scan.showDiagnostics": true,
  
  // Minimum priority for violations (1-5)
  "forceOps.scan.minimumPriority": 3
}
```

### SFDX Project Settings

This extension uses settings from your `sfdx-project.json` file:

```json
{
  "plugins": {
    "eon-sfdx": {
      "enableReadmeGeneration": true,
      "workItemFilter": "JIRA-\\d+",
      "workItemUrl": "https://jira.example.com/browse/"
    }
  }
}
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on:
- How to submit issues
- How to submit pull requests
- Development setup
- Code style guidelines

## Release Notes

### 0.0.1

Initial release with:
- CodeLens provider for sfdx-project.json
- Package Explorer view
- Changelog management from staged files
- Custom deployment service
- PMD 7.x compatible code scanning
- Global scan staged files action
- Test execution without SF CLI

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.