# SFDX Package Manager - Deployment Functionality

## Overview
The SFDX Package Manager VS Code extension provides enhanced deployment capabilities for Salesforce DX projects, including support for deploying packages with dependencies and advanced deployment options.

## Key Features

### 1. Logger Utility (`src/utils/logger.ts`)
- Custom VS Code output channel logger
- Replaces console.log with proper VS Code logging
- Log levels: DEBUG, INFO, WARN, ERROR
- Automatically formats objects and errors
- Accessible via "SFDX Package Manager" output channel

### 2. Deployment Types (`src/utils/deployTypes.ts`)
- Comprehensive TypeScript interfaces for deployment operations
- Support for all Salesforce deployment options
- Test level configurations
- Error and warning handling structures
- Progress tracking interfaces

### 3. Package Helper (`src/utils/packageHelper.ts`)
- Reads and parses sfdx-project.json
- Resolves package dependencies
- Calculates deployment order considering dependencies
- Detects circular dependencies
- Supports "start from" functionality to begin deployment from a specific package

### 4. Error Handler (`src/utils/errorHandler.ts`)
- Displays deployment errors in VS Code Problems panel
- Maps errors to specific files and line numbers
- Provides navigation to error locations
- Shows warnings and test results
- Creates diagnostic entries for failed components

### 5. Deploy Command (`src/commands/packageCommands.ts`)
Main deployment functionality with:
- **Deploy Package Only**: Deploys single package without dependencies
- **Deploy with Dependencies**: Deploys package and all dependencies in correct order
- **Validate Only**: Runs deployment validation without saving changes
- **Advanced Options**: Configure test levels, specific tests, and other options

#### Deployment Options:
- **Test Levels**: NoTestRun, RunLocalTests, RunAllTestsInOrg, RunSpecifiedTests
- **Check Only**: Validate deployment without committing
- **Start From**: Begin deployment from specific package in dependency chain
- **Progress Tracking**: Real-time progress updates with cancellation support

## Usage

### From CodeLens
1. Open `sfdx-project.json`
2. Click "Deploy" action above any package
3. Select deployment option:
   - Deploy Package Only
   - Deploy with Dependencies (if package has dependencies)
   - Validate Only
   - Advanced Options

### Target Org Selection
- Automatically detects default org from sfdx-project.json
- Option to select different org or enter username/alias manually

### Error Handling
- Errors appear in VS Code Problems panel
- Click on errors to navigate to problematic files
- View detailed logs in Output panel ("SFDX Package Manager")

### Deployment with Dependencies
When deploying with dependencies:
1. Extension calculates dependency order
2. Optional: Select starting point in dependency chain
3. Deploys packages in correct order
4. Handles failures with option to continue or stop

## Implementation Details

### Connection Management
- Uses `@salesforce/core` for org authentication
- Creates secure connections using stored auth info
- Validates org connectivity before deployment

### Component Detection
- Uses `@salesforce/source-deploy-retrieve` for metadata operations
- Automatically detects all components in package directory
- Builds component sets for deployment

### Progress Monitoring
- Real-time deployment status updates
- Shows component deployment progress
- Cancellable operations
- Detailed logging of each step

### Error Recovery
- Comprehensive error messages
- File-level diagnostics for failures
- Option to continue deployment after failures
- Automatic rollback on errors

## Architecture

```
src/
├── commands/
│   └── packageCommands.ts    # Main deployment logic
├── utils/
│   ├── logger.ts            # VS Code output channel logging
│   ├── deployTypes.ts       # TypeScript interfaces
│   ├── packageHelper.ts     # Package dependency resolution
│   └── errorHandler.ts      # Error display and navigation
└── extension.ts             # Extension activation/deactivation
```

## Dependencies
- `@salesforce/core`: Salesforce authentication and org management
- `@salesforce/source-deploy-retrieve`: Metadata deployment operations
- VS Code APIs: Progress notifications, diagnostics, output channels

## Future Enhancements
- Deployment history tracking
- Rollback functionality
- Deployment profiles/presets
- Integration with Salesforce CLI commands
- Code coverage visualization
- Deployment impact analysis