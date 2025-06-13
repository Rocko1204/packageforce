# DevHub Selection Update Summary

## Changes Made

### 1. Updated `poolService.ts`

#### Removed automatic DevHub detection
- Removed the automatic fallback logic that tried to find any DevHub when none was specified
- The `initialize` method now requires a `targetDevHub` parameter

#### Added `getAllDevHubs()` method
- Returns all authenticated DevHubs with their usernames, aliases, and default status
- Uses `AuthInfo.listAllAuthorizations()` to get all authenticated orgs
- Checks each org using the `isDevHub()` method
- Identifies the default DevHub using `ConfigAggregator`

#### Updated `isDevHub()` method
- Changed from querying `IsDevHub` field (which doesn't exist on all org types)
- Now queries `ActiveScratchOrg` object - if accessible, the org is a DevHub
- More reliable method for detecting DevHub status

### 2. Updated `poolCommands.ts`

#### Updated `fetchScratchOrgFromPool()`
- Added DevHub selection step before tag input
- Gets all available DevHubs using `poolService.getAllDevHubs()`
- Shows DevHubs with alias/username and marks the default with a star icon
- Sorts to show the default DevHub first
- Passes selected DevHub to `poolService.initialize()`

#### Updated `listScratchOrgsInPool()`
- Same DevHub selection logic as fetch command
- Ensures consistent behavior across both commands

## Usage Flow

1. User triggers pool fetch/list command
2. Extension searches for all authenticated DevHubs
3. User sees a list of DevHubs with the default marked
4. User selects a DevHub
5. User enters the pool tag
6. Command proceeds with the selected DevHub

## Benefits

- Users can explicitly choose which DevHub to use
- No more reliance on unreliable default DevHub detection
- Clear visibility of all available DevHubs
- Default DevHub is highlighted but not forced
- Better error handling and user feedback