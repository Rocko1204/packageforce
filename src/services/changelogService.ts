import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
// Remove markdown-table dependency - use simple implementation
import * as semver from 'semver';
import { ChangelogEntry, ChangelogOptions, PackageChangeInfo, PluginSettings } from '../utils/changelogTypes';
import { Logger } from '../utils/logger';

const logger = Logger.getInstance();

export class ChangelogService {
  
  async updatePackageReadme(
    packageInfo: PackageChangeInfo,
    options: ChangelogOptions,
    settings?: PluginSettings
  ): Promise<string> {
    // If package path ends with /main, put README in parent directory
    let readmeDir = packageInfo.packagePath;
    if (readmeDir.endsWith('/main') || readmeDir.endsWith('\\main')) {
      readmeDir = path.dirname(readmeDir);
    }
    const readmePath = path.join(readmeDir, 'readme.md');
    let readmeContent = '';
    
    // Check if readme exists
    try {
      readmeContent = await fs.promises.readFile(readmePath, 'utf8');
    } catch (error) {
      // Create new readme if it doesn't exist
      readmeContent = `# ${packageInfo.packageName}\n\n<!-- Add your package description here -->\n`;
      logger.info(`Creating new readme for package ${packageInfo.packageName}`);
    }
    
    // Update changelog section
    const existingChangelog = this.extractSection(readmeContent, '## Changelog');
    const newChangelog = this.createChangelog(
      existingChangelog,
      packageInfo,
      options,
      settings
    );
    
    // Update readme content
    let newReadmeContent = '';
    if (readmeContent.includes('## Changelog')) {
      newReadmeContent = readmeContent.replace(existingChangelog, newChangelog);
    } else {
      // Add changelog section at the end
      newReadmeContent = readmeContent + '\n' + newChangelog;
    }
    
    // Write updated readme
    await fs.promises.writeFile(readmePath, newReadmeContent, 'utf8');
    logger.info(`Updated readme for package ${packageInfo.packageName}`);
    
    return readmePath;
  }
  
  updatePackageVersion(
    currentVersion: string,
    changeType: 'feature' | 'fix',
    hasBreakingChanges: boolean
  ): string {
    // Remove .NEXT suffix if present
    const isNext = currentVersion.includes('.NEXT');
    const cleanVersion = currentVersion.replace('.NEXT', '');
    
    let newVersion = cleanVersion;
    
    if (semver.valid(cleanVersion)) {
      if (hasBreakingChanges) {
        newVersion = semver.inc(cleanVersion, 'major') || cleanVersion;
      } else if (changeType === 'feature') {
        newVersion = semver.inc(cleanVersion, 'minor') || cleanVersion;
      } else {
        newVersion = semver.inc(cleanVersion, 'patch') || cleanVersion;
      }
    } else {
      // If version is not valid semver, try to parse manually
      const parts = cleanVersion.split('.').map(p => parseInt(p) || 0);
      if (parts.length >= 3) {
        if (hasBreakingChanges) {
          parts[0]++;
          parts[1] = 0;
          parts[2] = 0;
        } else if (changeType === 'feature') {
          parts[1]++;
          parts[2] = 0;
        } else {
          parts[2]++;
        }
        newVersion = parts.join('.');
      }
    }
    
    // Add .NEXT suffix back if it was present
    return isNext ? `${newVersion}.NEXT` : newVersion;
  }
  
  private extractSection(content: string, sectionName: string): string {
    const sectionIndex = content.indexOf(sectionName);
    
    if (sectionIndex === -1) {
      return '';
    }
    
    // Find the next section (starting with ##)
    const nextSectionMatch = content.substring(sectionIndex).match(/\n## /);
    const nextSectionIndex = nextSectionMatch ? nextSectionMatch.index! : content.length - sectionIndex;
    
    return content.substring(sectionIndex, sectionIndex + nextSectionIndex);
  }
  
  private createChangelog(
    existingChangelog: string,
    packageInfo: PackageChangeInfo,
    options: ChangelogOptions,
    settings?: PluginSettings
  ): string {
    // Parse existing changelog entries
    const entries: ChangelogEntry[] = [];
    
    if (existingChangelog) {
      const lines = existingChangelog.split('\n');
      const tableStart = lines.findIndex(line => line.includes('|'));
      
      if (tableStart !== -1) {
        // Skip header and separator lines
        for (let i = tableStart + 2; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line && line.includes('|')) {
            const parts = line.split('|').map(p => p.trim()).filter(p => p);
            if (parts.length >= 4) {
              entries.push({
                version: parts[0],
                reference: parts[1],
                author: parts[2],
                description: parts[3]
              });
            }
          }
        }
      }
    }
    
    // Create work item link if URL is configured
    const reference = settings?.workItemUrl 
      ? `[${options.reference}](${settings.workItemUrl}${options.reference})`
      : options.reference;
    
    // Add new entry at the beginning
    entries.unshift({
      version: packageInfo.versionNumber,
      reference: reference,
      author: options.author,
      description: options.description
    });
    
    // Create markdown table - simple implementation
    const headers = ['Version', 'Reference', 'Author', 'Description'];
    const rows = entries.map(e => [e.version, e.reference, e.author, e.description]);
    
    // Calculate column widths
    const columnWidths = headers.map((header, index) => {
      const headerWidth = header.length;
      const maxRowWidth = Math.max(...rows.map(row => row[index].length));
      return Math.max(headerWidth, maxRowWidth);
    });
    
    // Create header row
    const headerRow = '| ' + headers.map((h, i) => h.padEnd(columnWidths[i])).join(' | ') + ' |';
    const separatorRow = '|' + columnWidths.map(w => '-'.repeat(w + 2)).join('|') + '|';
    
    // Create data rows
    const dataRows = rows.map(row => 
      '| ' + row.map((cell, i) => cell.padEnd(columnWidths[i])).join(' | ') + ' |'
    );
    
    const table = [headerRow, separatorRow, ...dataRows].join('\n');
    
    return `## Changelog\n\n${table}\n\n`;
  }
}