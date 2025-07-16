# Change Log

All notable changes to the "Packageforce" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.0.3] - 2025-07-16

### Fixed
- Synchronous test execution now uses correct API payload format
- Changelog entries now append to the end of the table instead of prepending
- sfdx-project.json formatting is now preserved when updating versions
- Removed unused imports and parameters in test service

### Added
- Custom sfdx-project.json writer that detects and preserves original indentation
- Better formatting preservation during changelog operations

### Improved
- Test execution error messages are more descriptive
- Code cleanup and optimization

## [1.0.2] - 2025-06-18

### Changed
- Removed extensionDependencies on Salesforce extensions - Packageforce is now 100% standalone
- True independence from SF CLI and Salesforce VS Code extensions

### Benefits
- Faster installation (no dependent extensions required)
- Lighter weight extension
- No conflicts with Salesforce extension versions
- Complete standalone operation

## [1.0.1] - 2025-06-18

### Fixed
- VS Code test execution in CI/CD pipeline using xvfb-run
- PMD command line arguments (changed --no-progress-bar to --no-progress)
- Error details now properly captured and saved in scan reports
- Support for PMD exit code 5 (partial results with errors)

### Improved
- Enhanced error logging with full output buffer capture
- Better error reporting in saved scan results (markdown, HTML, CSV formats)
- Added note about viewing animated demos in VS Code markdown preview

## [1.0.0] - 2025-06-18

### Added
- Initial release of Packageforce
- Package deployment with multiple options (quick, with dependencies, validation-only)
- Package scanning with PMD integration for code quality analysis
- Duplicate code detection across packages
- Test execution with code coverage
- Changelog generation and version management
- Package Explorer tree view
- CodeLens integration for quick actions
- Support for custom PMD rulesets
- Error log saving for failed operations
- Independent from Salesforce CLI - uses direct APIs