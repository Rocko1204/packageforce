# Change Log

All notable changes to the "Packageforce" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

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