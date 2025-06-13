# Packageforce PMD Custom Rules

This folder contains custom PMD rules for Packageforce code scanning. Copy this entire `.pmd/` folder to your Salesforce project root to use these rules.

## Structure

```
.pmd/
├── custom-apex-rules.xml          # Standard Apex best practices
├── custom-ruleset.xml             # Complete ruleset with all rules
├── custom-rules/                  # Advanced custom rules
│   ├── missing-data-factory-rule.xml
│   └── test-data-factory-pattern-detector.xml
└── README.md                      # This file
```

## Key Rules

### 1. **AvoidDirectRecordInstantiationInTests** (CRITICAL - Priority 1)
Detects when test methods create records directly instead of using test data factories.

**Violations:**
```apex
@isTest
static void testMethod() {
    Account acc = new Account();  // VIOLATION!
    acc.Name = 'Test';
    insert acc;
}
```

**Correct:**
```apex
@isTest
static void testMethod() {
    Account acc = TestDataFactory.createAccount('Test', true);
}
```

### 2. **Performance Rules** (CRITICAL - Priority 1)
- AvoidSoqlInLoops
- AvoidDmlStatementsInLoops
- AvoidSoslInLoops

### 3. **Security Rules** (CRITICAL - Priority 1)
- ApexCRUDViolation
- ApexSharingViolations
- ApexInsecureEndpoint

### 4. **EmptyObjectDescription** (HIGH - Priority 2)
Detects custom objects without meaningful descriptions.

**Violations:**
```xml
<CustomObject>
    <label>Invoice</label>
    <!-- Missing description element -->
</CustomObject>
```

**Correct:**
```xml
<CustomObject>
    <label>Invoice</label>
    <description>Stores customer invoice information including line items and payment terms</description>
</CustomObject>
```

### 5. **EmptyFieldDescription** (HIGH - Priority 2)
Detects custom fields without description or help text.

**Violations:**
```xml
<CustomField>
    <fullName>Total_Amount__c</fullName>
    <label>Total Amount</label>
    <!-- Missing both description and inlineHelpText -->
</CustomField>
```

**Correct:**
```xml
<CustomField>
    <fullName>Total_Amount__c</fullName>
    <label>Total Amount</label>
    <description>The total invoice amount including taxes</description>
    <inlineHelpText>This field is auto-calculated from line items</inlineHelpText>
</CustomField>
```

## Usage

### In Packageforce VS Code Extension
1. Place this `.pmd/` folder in your project root
2. Right-click on a package in the Package Explorer
3. Select "Scan Package"
4. Choose from scan options:
   - **Quick Scan**: Essential rules only
   - **Full Scan**: All available rules
   - **Custom Scan**: Select specific rules
   - **Scan with Custom Rules**: Use workspace rules
   - **Scan Staged Files Only**: Scan only Git staged files

### Command Line
```bash
# Using custom-ruleset.xml (recommended)
pmd check -d force-app/main/default/classes -R .pmd/custom-ruleset.xml -f text

# Generate HTML report
pmd check -d force-app/main/default/classes -R .pmd/custom-ruleset.xml -f html -r scan-report.html

# Filter by priority (1 = Critical only)
pmd check -d force-app/main/default/classes -R .pmd/custom-ruleset.xml -f text --minimum-priority 1

# Scan only staged files
git diff --cached --name-only | grep -E '\.(cls|trigger|xml)$' > staged-files.txt
pmd check --file-list staged-files.txt -R .pmd/custom-ruleset.xml -f text
```

### CI/CD Integration
```yaml
# GitHub Actions example
- name: Run PMD Analysis
  run: |
    wget https://github.com/pmd/pmd/releases/download/pmd_releases%2F7.0.0/pmd-dist-7.0.0-bin.zip
    unzip pmd-dist-7.0.0-bin.zip
    ./pmd-bin-7.0.0/bin/pmd check -d force-app -R .pmd/custom-ruleset.xml -f text
```

## Customization

### Adding New Rules
1. Add rule definitions to appropriate XML files
2. Use XPath expressions for pattern matching
3. Set appropriate priority (1-5, where 1 is highest)

### Modifying Existing Rules
Edit the XML files directly. Common modifications:
- Change priority levels
- Adjust thresholds (e.g., method complexity)
- Add/remove object types from data factory rule

## Best Practices

1. **Test Data Factories**: Always use centralized test data creation
2. **Builder Pattern**: Use for complex object construction
3. **Bulk Testing**: Test with 200+ records
4. **Assertions**: Every test method should have assertions
5. **No SeeAllData**: Never use @isTest(SeeAllData=true)

## Troubleshooting

### Java Not Found
PMD requires Java 8+. Install Java or set the path in VS Code settings:
```json
"forceOps.pmd.javaPath": "/path/to/java"
```

### Rules Not Loading
- Ensure XML files are valid
- Check file paths in ruleset references
- Enable debug logging in VS Code

### False Positives
Use PMD suppress comments:
```apex
// NOPMD - This is intentional for specific reason
Account acc = new Account();
```

## Support

For issues or questions:
1. Check Packageforce extension logs
2. Validate XML with PMD's rule designer
3. Report issues on GitHub