# Pool Commands Documentation

## Overview

The Packageforce extension now includes pool commands for managing scratch orgs from a pool. These commands help you fetch and list scratch orgs that have been pre-created and tagged in your Dev Hub.

## Prerequisites

1. You must be authenticated to a Dev Hub org
2. Scratch orgs in the pool should be tagged (either using a custom `Tag__c` field or in the Description field)
3. For the fetch command to work fully, scratch orgs should be pre-authenticated in your local environment

## Commands

### Fetch Scratch Org from Pool

**Command:** `Packageforce: Fetch Scratch Org from Pool`

This command fetches an available scratch org from the pool based on a tag.

**Usage:**
1. Run the command from the Command Palette (Cmd/Ctrl + Shift + P)
2. Enter the pool tag (e.g., "dev-pool", "qa-pool")
3. Optionally provide an alias for the scratch org
4. Choose whether to enable source tracking

**Features:**
- Automatically finds the oldest available scratch org with the specified tag
- Checks if the scratch org is already authenticated locally
- Sets an alias if provided
- Shows remaining days until expiration

### List Scratch Orgs in Pool

**Command:** `Packageforce: List Scratch Orgs in Pool`

This command lists all scratch orgs in the pool with a specific tag.

**Usage:**
1. Run the command from the Command Palette (Cmd/Ctrl + Shift + P)
2. Enter the pool tag to search for
3. Choose whether to show only active orgs or all orgs

**Features:**
- Shows detailed information about each scratch org
- Displays expiration dates and remaining days
- Allows quick access to open a selected org
- Shows results in both output channel and quick pick

## Pool Tagging Strategies

### Option 1: Custom Field (Recommended)
Create a custom field `Tag__c` on the ScratchOrgInfo object in your Dev Hub to tag scratch orgs.

### Option 2: Description Field
Use the Description field to include tags. The pool commands will search for the tag within the description using a LIKE query.

Example: Set Description to "dev-pool - Development scratch org for team A"

## Authentication Notes

Since the extension cannot directly authenticate to scratch orgs due to OAuth limitations, scratch orgs need to be pre-authenticated. If a scratch org is not authenticated:

1. The extension will show a warning
2. It will provide a command to copy to clipboard for manual authentication
3. Run the command in your terminal to authenticate

Example authentication command:
```bash
sf org login web --alias my-scratch-org --instance-url https://test.salesforce.com
```

## Best Practices

1. **Pre-authenticate scratch orgs**: Authenticate scratch orgs when they are created to avoid manual steps later
2. **Use consistent tags**: Establish a naming convention for pool tags
3. **Monitor expiration**: Regularly check for expiring scratch orgs
4. **Clean up allocated orgs**: Remove scratch orgs from the pool once they are allocated (update tags or delete)

## Troubleshooting

### "No Dev Hub found"
- Ensure you are authenticated to a Dev Hub: `sf org login web --set-default-dev-hub`

### "Tag__c field not found"
- The extension will automatically fall back to searching in the Description field
- Consider creating the custom field for better performance

### "Scratch org is not authenticated"
- Use the provided authentication command
- Ensure you have the necessary permissions to access the scratch org

## Future Enhancements

- Automatic authentication using stored credentials (requires additional security considerations)
- Pool statistics and monitoring
- Automated cleanup of expired orgs
- Integration with CI/CD pipelines