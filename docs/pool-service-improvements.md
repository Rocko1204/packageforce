# Pool Service Improvements

## Overview

This document describes the improvements made to the pool service to fix the SOQL query error and add support for default pool tags.

## Changes Made

### 1. Fixed SOQL Query Error in poolService.ts

**Problem**: The Description field in ScratchOrgInfo cannot be used with the LIKE operator in WHERE clauses, causing query failures.

**Solution**: 
- Removed the LIKE clause from the SOQL query
- Query all active scratch orgs first
- Filter by description in JavaScript using `Array.filter()`
- Maintains backward compatibility with both Tag__c custom field and Description field

**Code Changes**:
```typescript
// Old approach (causes error):
query += ` AND Description LIKE '%${options.tag}%'`

// New approach:
const allOrgsQuery = baseQuery + ` ORDER BY CreatedDate ASC`;
const result = await conn.query<ScratchOrgInfo>(allOrgsQuery);

// Filter in JavaScript
const filteredOrgs = result.records.filter(org => 
  org.Description && org.Description.toLowerCase().includes(options.tag.toLowerCase())
);
```

### 2. Removed Unused isDevHub Method

The `isDevHub` method was removed from poolService.ts as it's no longer needed. The service now uses StateAggregator which provides more efficient access to org information.

### 3. Added Default Pool Tag Support

**Feature**: Users can now configure a default pool tag in their sfdx-project.json file.

**Configuration**:
Add the following to your `sfdx-project.json`:
```json
{
  "plugins": {
    "packageforce": {
      "defaultPoolTag": "dev-pool"
    }
  }
}
```

**Benefits**:
- Pre-fills the pool tag input with the default value
- Reduces repetitive typing for commonly used pool tags
- Team-wide consistency through shared configuration

**Implementation**:
- Created `ConfigHelper` utility class to read sfdx-project.json
- Updated `poolCommands.ts` to read and use the default tag
- Works for both fetch and list commands

## Usage Examples

### Setting Default Pool Tag

1. Add to your `sfdx-project.json`:
```json
{
  "plugins": {
    "packageforce": {
      "defaultPoolTag": "team-dev-pool"
    }
  }
}
```

2. When running pool commands, the tag input will be pre-filled with "team-dev-pool"

### Pool Service Query Behavior

The service now follows this query strategy:
1. First attempts to use the custom `Tag__c` field (if it exists)
2. Falls back to filtering by Description field
3. Returns the oldest matching scratch org (first created)

## Error Handling

- Gracefully handles missing Tag__c custom field
- Provides clear error messages when no matching orgs are found
- Logs detailed information for debugging

## Performance Considerations

- JavaScript filtering is performed on the client side after querying all active orgs
- For large pools (hundreds of orgs), consider implementing the Tag__c custom field for better performance
- The Tag__c approach uses server-side filtering and is more efficient