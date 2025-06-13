import * as vscode from 'vscode';
import { PoolService, PoolFetchOptions, PoolListOptions, ScratchOrgInfo } from '@/services/poolService';
import { Logger } from '@/utils/logger';
import { ConfigHelper } from '@/utils/configHelper';

const logger = Logger.getInstance();

export async function fetchScratchOrgFromPool(): Promise<void> {
  // Log at the very beginning, before any try-catch
  console.log('fetchScratchOrgFromPool called');
  
  try {
    // Clear and show the output channel at the start
    logger.clear();
    logger.show();
    logger.info('=== Starting Scratch Org Pool Fetch ===');
    logger.info('Command handler started successfully');
    
    const poolService = new PoolService();
    let targetDevHub: string | undefined;
    
    // Get all DevHubs immediately
    logger.info('Searching for Dev Hubs...');
    let devHubs: { username: string; alias?: string; isDefault?: boolean }[] = [];
    
    try {
      devHubs = await poolService.getAllDevHubs();
      logger.info(`Found ${devHubs.length} Dev Hub(s)`);
    } catch (error) {
      logger.error('Failed to get Dev Hubs', error);
      // Continue to manual entry
    }
    
    if (devHubs.length === 0) {
      // No DevHubs found, show input box for manual entry
      logger.info('No Dev Hubs found, showing manual entry');
      const manualDevHub = await vscode.window.showInputBox({
        prompt: 'No Dev Hubs found. Enter the Dev Hub username or alias',
        placeHolder: 'e.g., devhub@mycompany.com or mydevhub',
        ignoreFocusOut: true,
        validateInput: (value) => {
          if (!value || !value.trim()) {
            return 'Dev Hub username or alias is required';
          }
          return null;
        }
      });
      
      if (!manualDevHub) {
        logger.info('User cancelled Dev Hub input');
        return;
      }
      
      targetDevHub = manualDevHub.trim();
      logger.info(`Manual Dev Hub entered: ${targetDevHub}`);
    } else {
      // Prepare DevHub selection items
      const devHubItems = devHubs.map(devHub => ({
        label: `$(key) ${devHub.alias || devHub.username}`,
        description: devHub.alias ? devHub.username : undefined,
        detail: devHub.isDefault ? 'Default Dev Hub' : undefined,
        devHub: devHub.username
      }));
      
      // Sort to show default first
      devHubItems.sort((a, b) => {
        if (a.detail && !b.detail) return -1;
        if (!a.detail && b.detail) return 1;
        return 0;
      });
      
      // Select DevHub
      const selectedDevHub = await vscode.window.showQuickPick(devHubItems, {
        placeHolder: 'Select a Dev Hub to use',
        ignoreFocusOut: true
      });
      
      if (selectedDevHub) {
        targetDevHub = selectedDevHub.devHub;
        logger.info(`Dev Hub selected: ${targetDevHub}`);
      } else {
        logger.info('User cancelled Dev Hub selection');
        return;
      }
    }
    
    if (!targetDevHub) {
      logger.info('No DevHub selected, exiting');
      return;
    }
    
    // Get default pool tag from configuration
    let defaultTag: string | undefined;
    try {
      const configHelper = ConfigHelper.getInstance();
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (workspaceFolder) {
        await configHelper.loadProjectConfig(workspaceFolder.uri.fsPath);
        defaultTag = configHelper.getDefaultPoolTag();
        if (defaultTag) {
          logger.info(`Found default pool tag in configuration: ${defaultTag}`);
        }
      }
    } catch (error) {
      logger.warn('Failed to load default pool tag from configuration', error);
    }
    
    // Get pool tag from user
    const tag = await vscode.window.showInputBox({
      prompt: 'Enter the pool tag to fetch from',
      placeHolder: 'e.g., dev-pool, qa-pool',
      value: defaultTag, // Pre-fill with default tag if available
      ignoreFocusOut: true, // Don't close when focus is lost
      validateInput: (value) => {
        if (!value || !value.trim()) {
          return 'Pool tag is required';
        }
        return null;
      }
    });
    
    if (!tag) {
      logger.info('User cancelled pool tag input');
      return;
    }
    
    logger.info(`Pool tag selected: ${tag}`);
    
    // Get optional alias
    const alias = await vscode.window.showInputBox({
      prompt: 'Enter an alias for the scratch org (optional)',
      placeHolder: 'e.g., my-scratch-org',
      ignoreFocusOut: true // Don't close when focus is lost
    });
    
    if (alias) {
      logger.info(`Alias specified: ${alias}`);
    } else {
      logger.info('No alias specified');
    }
    
    // Ask about source tracking - default to No
    const enableTracking = await vscode.window.showQuickPick(
      ['No', 'Yes'],
      {
        placeHolder: 'Enable source tracking for this scratch org? (Default: No)',
        ignoreFocusOut: true // Don't close when focus is lost
      }
    );
    
    const setSourceTracking = enableTracking === 'Yes';
    logger.info(`Source tracking: ${setSourceTracking ? 'enabled' : 'disabled'}`);
    
    // Show progress
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Fetching scratch org from pool...',
      cancellable: false
    }, async (progress) => {
      try {
        // Step 1: Connect to Dev Hub
        progress.report({ increment: 10, message: 'Connecting to Dev Hub...' });
        logger.info(`Step 1/3: Connecting to Dev Hub ${targetDevHub}...`);
        
        try {
          await poolService.initialize(targetDevHub);
          logger.info(`Successfully connected to Dev Hub: ${targetDevHub}`);
        } catch (error) {
          logger.error('Failed to connect to Dev Hub', error);
          throw new Error(`Dev Hub connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        
        // Step 2: Search for available scratch orgs
        progress.report({ increment: 30, message: 'Searching for available scratch orgs...' });
        logger.info(`Step 2/3: Searching for available scratch orgs with tag '${tag}'...`);
        
        const options: PoolFetchOptions = {
          tag,
          alias: alias || undefined,
          setSourceTracking
        };
        
        let username: string;
        try {
          username = await poolService.fetchScratchOrg(options);
          logger.info(`Found available scratch org: ${username}`);
        } catch (error) {
          logger.error('Failed to fetch scratch org', error);
          throw error;
        }
        
        // Step 3: Complete the process
        progress.report({ increment: 60, message: 'Completing setup...' });
        logger.info('Step 3/3: Completing scratch org setup...');
        
        // Success message
        const message = alias 
          ? `Successfully fetched scratch org: ${username} (alias: ${alias})`
          : `Successfully fetched scratch org: ${username}`;
        
        logger.info('=== Scratch Org Pool Fetch Completed Successfully ===');
        logger.info(message);
        
        // Ensure progress completes
        progress.report({ increment: 100, message: 'Done' });
        
        vscode.window.showInformationMessage(message, 'Open Org', 'View Logs').then(selection => {
          if (selection === 'Open Org') {
            vscode.commands.executeCommand('sfdx.force.org.open', { username });
          } else if (selection === 'View Logs') {
            logger.show();
          }
        });
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to fetch scratch org from pool', error);
        logger.info('=== Scratch Org Pool Fetch Failed ===');
        
        vscode.window.showErrorMessage(`Failed to fetch scratch org: ${errorMessage}`, 'View Logs').then(selection => {
          if (selection === 'View Logs') {
            logger.show();
          }
        });
        
        // Ensure progress completes even on error
        progress.report({ increment: 100, message: 'Failed' });
      }
    });
    
  } catch (error) {
    console.error('fetchScratchOrgFromPool error:', error);
    logger.error('Unexpected error in fetchScratchOrgFromPool', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`An unexpected error occurred: ${errorMessage}`, 'View Logs').then(selection => {
      if (selection === 'View Logs') {
        logger.show();
      }
    });
  }
}

export async function listScratchOrgsInPool(): Promise<void> {
  try {
    // Clear and show the output channel at the start
    logger.clear();
    logger.show();
    logger.info('=== Starting Scratch Org Pool List ===');
    logger.info('Command handler started successfully');
    
    const poolService = new PoolService();
    let targetDevHub: string | undefined;
    
    // Get all DevHubs immediately
    logger.info('Searching for Dev Hubs...');
    let devHubs: { username: string; alias?: string; isDefault?: boolean }[] = [];
    
    try {
      devHubs = await poolService.getAllDevHubs();
      logger.info(`Found ${devHubs.length} Dev Hub(s)`);
    } catch (error) {
      logger.error('Failed to get Dev Hubs', error);
      // Continue to manual entry
    }
    
    if (devHubs.length === 0) {
      // No DevHubs found, show input box for manual entry
      logger.info('No Dev Hubs found, showing manual entry');
      const manualDevHub = await vscode.window.showInputBox({
        prompt: 'No Dev Hubs found. Enter the Dev Hub username or alias',
        placeHolder: 'e.g., devhub@mycompany.com or mydevhub',
        ignoreFocusOut: true,
        validateInput: (value) => {
          if (!value || !value.trim()) {
            return 'Dev Hub username or alias is required';
          }
          return null;
        }
      });
      
      if (!manualDevHub) {
        logger.info('User cancelled Dev Hub input');
        return;
      }
      
      targetDevHub = manualDevHub.trim();
      logger.info(`Manual Dev Hub entered: ${targetDevHub}`);
    } else {
      // Prepare DevHub selection items
      const devHubItems = devHubs.map(devHub => ({
        label: `$(key) ${devHub.alias || devHub.username}`,
        description: devHub.alias ? devHub.username : undefined,
        detail: devHub.isDefault ? 'Default Dev Hub' : undefined,
        devHub: devHub.username
      }));
      
      // Sort to show default first
      devHubItems.sort((a, b) => {
        if (a.detail && !b.detail) return -1;
        if (!a.detail && b.detail) return 1;
        return 0;
      });
      
      // Select DevHub
      const selectedDevHub = await vscode.window.showQuickPick(devHubItems, {
        placeHolder: 'Select a Dev Hub to use',
        ignoreFocusOut: true
      });
      
      if (selectedDevHub) {
        targetDevHub = selectedDevHub.devHub;
        logger.info(`Dev Hub selected: ${targetDevHub}`);
      } else {
        logger.info('User cancelled Dev Hub selection');
        return;
      }
    }
    
    if (!targetDevHub) {
      logger.info('No DevHub selected, exiting');
      return;
    }
    
    // Get default pool tag from configuration
    let defaultTag: string | undefined;
    try {
      const configHelper = ConfigHelper.getInstance();
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (workspaceFolder) {
        await configHelper.loadProjectConfig(workspaceFolder.uri.fsPath);
        defaultTag = configHelper.getDefaultPoolTag();
        if (defaultTag) {
          logger.info(`Found default pool tag in configuration: ${defaultTag}`);
        }
      }
    } catch (error) {
      logger.warn('Failed to load default pool tag from configuration', error);
    }
    
    // Get pool tag from user
    const tag = await vscode.window.showInputBox({
      prompt: 'Enter the pool tag to list',
      placeHolder: 'e.g., dev-pool, qa-pool',
      value: defaultTag, // Pre-fill with default tag if available
      ignoreFocusOut: true, // Don't close when focus is lost
      validateInput: (value) => {
        if (!value || !value.trim()) {
          return 'Pool tag is required';
        }
        return null;
      }
    });
    
    if (!tag) {
      logger.info('User cancelled pool tag input');
      return;
    }
    
    logger.info(`Pool tag selected: ${tag}`);
    
    // Ask whether to show all orgs or just active ones
    const showAllOption = await vscode.window.showQuickPick(
      ['Active Only', 'All'],
      {
        placeHolder: 'Which scratch orgs to show?',
        ignoreFocusOut: true // Don't close when focus is lost
      }
    );
    
    const showAll = showAllOption === 'All';
    logger.info(`Show all orgs: ${showAll ? 'Yes' : 'No (active only)'}`);
    
    // Show progress
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Listing scratch orgs in pool...',
      cancellable: false
    }, async (progress) => {
      try {
        // Step 1: Connect to Dev Hub
        progress.report({ increment: 20, message: 'Connecting to Dev Hub...' });
        logger.info(`Step 1/3: Connecting to Dev Hub ${targetDevHub}...`);
        
        try {
          await poolService.initialize(targetDevHub);
          logger.info(`Successfully connected to Dev Hub: ${targetDevHub}`);
        } catch (error) {
          logger.error('Failed to connect to Dev Hub', error);
          throw new Error(`Dev Hub connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        
        // Step 2: Query scratch orgs
        progress.report({ increment: 50, message: 'Querying scratch orgs...' });
        logger.info(`Step 2/3: Querying scratch orgs with tag '${tag}'...`);
        
        const options: PoolListOptions = {
          tag,
          showAll
        };
        
        let scratchOrgs: ScratchOrgInfo[];
        try {
          scratchOrgs = await poolService.listScratchOrgs(options);
          logger.info(`Found ${scratchOrgs.length} scratch org(s)`);
        } catch (error) {
          logger.error('Failed to query scratch orgs', error);
          throw error;
        }
        
        // Step 3: Format and display results
        progress.report({ increment: 30, message: 'Formatting results...' });
        logger.info('Step 3/3: Formatting and displaying results...');
        
        if (scratchOrgs.length === 0) {
          logger.info(`No scratch orgs found with tag '${tag}'`);
          vscode.window.showInformationMessage(`No scratch orgs found with tag '${tag}'`);
          logger.info('=== Scratch Org Pool List Completed ===');
          return;
        }
        
        // Display results in output channel
        logger.info('');
        logger.info(`Scratch Orgs with tag '${tag}':`);
        logger.info('='.repeat(80));
        logger.info('');
        
        scratchOrgs.forEach((org, index) => {
          logger.info(`[${index + 1}] ${poolService.formatScratchOrgInfo(org)}`);
          logger.info('-'.repeat(40));
          logger.info('');
        });
        
        logger.info(`Total: ${scratchOrgs.length} scratch org(s)`);
        logger.info('=== Scratch Org Pool List Completed Successfully ===');
        
        // Ensure progress completes
        progress.report({ increment: 100, message: 'Done' });
        
        // Also show quick pick for easy selection
        const quickPickItems = scratchOrgs.map(org => ({
          label: `$(globe) ${org.Username}`,
          description: `${org.Status} - Expires: ${new Date(org.ExpirationDate).toLocaleDateString()}`,
          detail: org.Description || org.OrgName || 'No description',
          username: org.Username
        }));
        
        const selected = await vscode.window.showQuickPick(quickPickItems, {
          placeHolder: 'Select a scratch org to open (optional)'
        });
        
        if (selected) {
          logger.info(`User selected to open: ${selected.username}`);
          vscode.commands.executeCommand('sfdx.force.org.open', { username: selected.username });
        }
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to list scratch orgs', error);
        logger.info('=== Scratch Org Pool List Failed ===');
        
        vscode.window.showErrorMessage(`Failed to list scratch orgs: ${errorMessage}`, 'View Logs').then(selection => {
          if (selection === 'View Logs') {
            logger.show();
          }
        });
        
        // Ensure progress completes even on error
        progress.report({ increment: 100, message: 'Failed' });
      }
    });
    
  } catch (error) {
    logger.error('Unexpected error in listScratchOrgsInPool', error);
    vscode.window.showErrorMessage('An unexpected error occurred', 'View Logs').then(selection => {
      if (selection === 'View Logs') {
        logger.show();
      }
    });
  }
}