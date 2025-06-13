# Test Execution Feature

The SFDX Package Manager extension now includes a powerful test execution feature that allows you to run Apex tests directly from the CodeLens in your `sfdx-project.json` file.

## Features

- **Run Tests from CodeLens**: Click the "🧪 Test" button next to any package in your `sfdx-project.json` file
- **Multiple Test Options**:
  - Run all tests in a package
  - Run specific test classes
  - Run tests with code coverage
  - Advanced options for fine-grained control
- **Beautiful Output Format**: Test results are displayed in a nicely formatted output channel
- **Code Coverage Support**: View overall and per-class code coverage percentages
- **Failure Details**: Detailed error messages and stack traces for failed tests

## Usage

1. Open your `sfdx-project.json` file
2. Look for the CodeLens buttons above each package name
3. Click the "🧪 Test" button
4. Choose your test execution option:
   - **Run All Tests**: Executes all test classes in the package
   - **Run Specific Tests**: Enter comma-separated test class names
   - **Run with Code Coverage**: Includes code coverage analysis
   - **Advanced Options**: Configure all test parameters

## Test Output

The test results are displayed in the "SFDX Package Tests" output channel with:
- Test summary (passing, failing, skipped)
- Execution time
- Code coverage percentages (if enabled)
- Detailed failure information including stack traces

## Example Output

```
═══════════════════════════════════════════════════════════════════
🧪 Running tests for package: MyPackage
═══════════════════════════════════════════════════════════════════

📋 Found 3 test class(es):
   • AccountTest
   • ContactTest  
   • OpportunityTest

🚀 Executing command: sf apex run test --tests AccountTest,ContactTest,OpportunityTest --synchronous --result-format json

⏳ Running tests...

═══════════════════════════════════════════════════════════════════
📊 Test Summary
═══════════════════════════════════════════════════════════════════
   Total Tests Run: 15
   ✅ Passing: 14
   ❌ Failing: 1
   ⏭️  Skipped: 0
   ⏱️  Time: 12.34s
   
   📈 Code Coverage: 87%

═══════════════════════════════════════════════════════════════════
❌ Failed Tests
═══════════════════════════════════════════════════════════════════
   1. AccountTest.testAccountCreation
      Message: System.AssertException: Assertion Failed
      Stack Trace:
         Class.AccountTest.testAccountCreation: line 25, column 1

🏁 Test execution completed with failures
═══════════════════════════════════════════════════════════════════
```

## Requirements

- Salesforce CLI (`sf` command) must be installed and configured
- An authenticated Salesforce org (or use the default org)
- Test classes must be properly annotated with `@isTest`

## Tips

- The extension automatically finds all test classes in your package
- Test classes are identified by the `@isTest` annotation
- You can target specific orgs or use your default org
- Code coverage helps ensure your code meets Salesforce deployment requirements (75%)