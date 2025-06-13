import { AuthInfo, Org, StateAggregator } from '@salesforce/core';
import { Logger } from '@/utils/logger';
import { isValidSfdxAuthUrl } from '@/utils/sfdxAuthValidator';

const logger = Logger.getInstance();

export interface ScratchOrgInfo {
  Id: string;
  Pooltag__c?: string;
  ScratchOrg: string;
  CreatedDate: string;
  ExpirationDate: string;
  SignupUsername: string;
  SignupEmail?: string;
  Password__c?: string;
  Allocation_status__c?: string;
  LoginUrl: string;
  SfdxAuthUrl__c?: string;
}

export interface PoolFetchOptions {
  tag: string;
  alias?: string;
  setSourceTracking?: boolean;
  targetDevHub?: string;
}

export interface PoolListOptions {
  tag: string;
  targetDevHub?: string;
  showAll?: boolean;
}

export class PoolService {
  private devHubOrg: Org | undefined;

  async initialize(targetDevHub: string): Promise<void> {
    try {
      logger.info(`Initializing with specified Dev Hub: ${targetDevHub}`);
      this.devHubOrg = await Org.create({ aliasOrUsername: targetDevHub });
      logger.info(`Successfully connected to Dev Hub: ${targetDevHub}`);
    } catch (error) {
      logger.error(`Failed to connect to Dev Hub: ${targetDevHub}`, error);
      throw new Error(
        `Failed to connect to Dev Hub '${targetDevHub}': ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async getAllDevHubs(): Promise<
    { username: string; alias?: string; isDefault?: boolean }[]
  > {
    logger.info('Searching for all authenticated Dev Hubs...');
    const devHubs: { username: string; alias?: string; isDefault?: boolean }[] =
      [];

    try {
      // Use StateAggregator for faster access to orgs
      const stateAggregator = await StateAggregator.getInstance();
      const orgs = await stateAggregator.orgs.readAll();
      const aliases = stateAggregator.aliases;

      if (orgs.length === 0) {
        logger.error('No authenticated orgs found');
        return devHubs;
      }

      logger.info(
        `Found ${orgs.length} authenticated org(s), checking for Dev Hubs...`
      );

      if (!orgs.some(org => org.isDevHub)) {
        logger.error(
          'No Dev Hubs found. Please ensure you have at least one Dev Hub org authenticated.'
        );
        throw new Error(
          'No Dev Hubs found. Please ensure you have at least one Dev Hub org authenticated.'
        );
      }

      // Check each org to see if it's a DevHub
      for (const orgInfo of orgs) {
        try {
          // Check if the org has isDevHub property set to true
          if (orgInfo.isDevHub) {
            let alias = '';
            if (orgInfo.username && aliases.get(orgInfo.username)) {
              alias = aliases.get(orgInfo.username) || '';
            }

            devHubs.push({
              username: orgInfo.username || '',
              alias,
              isDefault: false,
            });

            logger.info(
              `Found Dev Hub: ${orgInfo.username}${alias ? ` (${alias})` : ''}`
            );
          } else {
            logger.debug(`${orgInfo.username} is not a Dev Hub`);
          }
        } catch (error) {
          logger.debug(
            `Failed to check ${orgInfo.username}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
          // Continue to next org
        }
      }

      logger.info(`Found ${devHubs.length} Dev Hub(s)`);
      logger.info('Returning DevHub list to caller');
      return devHubs;
    } catch (error) {
      logger.error('Failed to get Dev Hubs', error);
      throw new Error(
        `Failed to get Dev Hubs: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async fetchScratchOrg(options: PoolFetchOptions): Promise<string> {
    if (!this.devHubOrg) {
      throw new Error(
        'Dev Hub not initialized. Please provide a target Dev Hub.'
      );
    }

    logger.info(`Fetching scratch org from pool with tag: ${options.tag}`);

    const conn = this.devHubOrg.getConnection();
    const devHubUsername = this.devHubOrg.getUsername();
    logger.info(`Using Dev Hub: ${devHubUsername}`);

    // Query for available scratch orgs with all necessary fields
    const query = `
      SELECT Pooltag__c, Id, CreatedDate, ScratchOrg, ExpirationDate, 
             SignupUsername, SignupEmail, Password__c, Allocation_status__c, 
             LoginUrl, SfdxAuthUrl__c 
      FROM ScratchOrgInfo 
      WHERE Pooltag__c = '${options.tag}' 
        AND Status = 'Active'
        AND Allocation_status__c = 'Available'
        AND ExpirationDate > TODAY
      ORDER BY CreatedDate ASC 
      LIMIT 1
    `;

    logger.info('Querying for available scratch orgs...');
    logger.debug(`Query: ${query}`);

    try {
      const result = await conn.query<ScratchOrgInfo>(query);

      if (!result.records || result.records.length === 0) {
        logger.error(
          `No available scratch orgs found with tag '${options.tag}'`
        );
        throw new Error(
          `No available scratch orgs found with tag '${options.tag}'`
        );
      }

      const scratchOrg = result.records[0];
      logger.info(`Found scratch org: ${scratchOrg.SignupUsername}`);
      logger.info(`Org details: ${this.formatScratchOrgInfo(scratchOrg)}`);

      // Check if SfdxAuthUrl is valid
      if (
        !scratchOrg.SfdxAuthUrl__c ||
        !isValidSfdxAuthUrl(scratchOrg.SfdxAuthUrl__c)
      ) {
        logger.error(
          `Scratch org ${scratchOrg.SignupUsername} does not have a valid SfdxAuthUrl`
        );
        throw new Error(
          `Scratch org ${scratchOrg.SignupUsername} does not have a valid SfdxAuthUrl. Please ensure the org has a valid auth URL in the pool.`
        );
      }

      // Authenticate using SfdxAuthUrl
      logger.info('Authenticating to scratch org using SfdxAuthUrl...');
      await this.authenticateUsingSfdxAuthUrl(scratchOrg, options.alias);

      // Update allocation status to mark as allocated
      logger.info('Updating allocation status...');
      await this.updateAllocationStatus(scratchOrg.Id, 'Allocated');

      // Set source tracking if requested
      if (options.setSourceTracking) {
        logger.info('Source tracking is enabled by default for scratch orgs');
      }

      logger.info(
        `Successfully allocated scratch org: ${scratchOrg.SignupUsername}`
      );
      return scratchOrg.SignupUsername;
    } catch (error) {
      logger.error('Failed to fetch scratch org from pool', error);
      throw error;
    }
  }

  async listScratchOrgs(options: PoolListOptions): Promise<ScratchOrgInfo[]> {
    if (!this.devHubOrg) {
      throw new Error(
        'Dev Hub not initialized. Please provide a target Dev Hub.'
      );
    }

    logger.info(`Listing scratch orgs with tag: ${options.tag}`);

    const conn = this.devHubOrg.getConnection();

    // Build query based on options
    let whereClause = `Pooltag__c = '${options.tag}'`;

    if (!options.showAll) {
      whereClause += ` AND Status = 'Active' AND ExpirationDate > TODAY`;
    }

    const query = `
      SELECT Pooltag__c, Id, CreatedDate, ScratchOrg, ExpirationDate, 
             SignupUsername, SignupEmail, Password__c, Allocation_status__c, 
             LoginUrl, SfdxAuthUrl__c
      FROM ScratchOrgInfo 
      WHERE ${whereClause}
      ORDER BY CreatedDate DESC
    `;

    try {
      logger.debug(`Query: ${query}`);
      const result = await conn.query<ScratchOrgInfo>(query);
      logger.info(
        `Found ${result.records.length} scratch orgs with tag '${options.tag}'`
      );
      return result.records;
    } catch (error) {
      logger.error('Failed to list scratch orgs', error);
      throw error;
    }
  }

  private async authenticateUsingSfdxAuthUrl(
    scratchOrg: ScratchOrgInfo,
    alias?: string
  ): Promise<void> {
    try {
      if (!scratchOrg.SfdxAuthUrl__c) {
        throw new Error('No SfdxAuthUrl found for scratch org');
      }

      // Parse the SfdxAuthUrl to get OAuth2 options
      const oauth2Options = AuthInfo.parseSfdxAuthUrl(
        scratchOrg.SfdxAuthUrl__c
      );

      // Create AuthInfo with the OAuth2 options
      const authInfo = await AuthInfo.create({ oauth2Options });

      // Save the auth info with scratch org metadata
      const fields = authInfo.getFields();
      await authInfo.save({
        ...fields,
        isScratch: true,
        devHubUsername: this.devHubOrg!.getUsername(),
        expirationDate: scratchOrg.ExpirationDate,
      });

      // Handle alias and default settings
      await authInfo.handleAliasAndDefaultSettings({
        alias: alias || scratchOrg.SignupUsername,
        setDefault: true,
        setDefaultDevHub: false,
      });

      // Get the complete auth fields
      const result = authInfo.getFields(true);

      // Ensure the clientSecret field exists (even if empty)
      // Create a new object with clientSecret to avoid read-only property error
      const resultWithClientSecret = {
        ...result,
        clientSecret: result.clientSecret ?? '',
      };

      // Identify possible scratch orgs
      await AuthInfo.identifyPossibleScratchOrgs(
        resultWithClientSecret,
        authInfo
      );

      logger.info(
        `Successfully authenticated to scratch org: ${scratchOrg.SignupUsername}`
      );
      if (alias) {
        logger.info(`Alias '${alias}' set for scratch org`);
      }
    } catch (error) {
      logger.error('Failed to authenticate using SfdxAuthUrl', error);
      throw new Error(
        `Failed to authenticate to scratch org: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async updateAllocationStatus(
    scratchOrgId: string,
    status: string
  ): Promise<void> {
    try {
      const conn = this.devHubOrg!.getConnection();
      await conn.sobject('ScratchOrgInfo').update({
        Id: scratchOrgId,
        Allocation_status__c: status,
      });
      logger.info(
        `Updated allocation status to '${status}' for scratch org ${scratchOrgId}`
      );
    } catch (error) {
      logger.warn(
        `Failed to update allocation status: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      // Don't throw - this is not critical for the fetch operation
    }
  }

  formatScratchOrgInfo(org: ScratchOrgInfo): string {
    const expirationDate = new Date(org.ExpirationDate);
    const createdDate = new Date(org.CreatedDate);
    const now = new Date();
    const daysUntilExpiration = Math.ceil(
      (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    return `
Username: ${org.SignupUsername}
Pool Tag: ${org.Pooltag__c || 'N/A'}
Allocation Status: ${org.Allocation_status__c || 'N/A'}
Created: ${createdDate.toLocaleDateString()}
Expires: ${expirationDate.toLocaleDateString()} (${daysUntilExpiration} days remaining)
Login URL: ${org.LoginUrl}
    `.trim();
  }
}
