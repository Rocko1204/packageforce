import * as path from 'path';
import * as fs from 'fs';
import { ScanResult, Violation } from '../services/scanService';
import {
  DuplicateResult,
  Duplication,
} from '../services/duplicateDetectorService';
import { Logger } from './logger';

const logger = Logger.getInstance();

export interface ReportOptions {
  format: 'markdown' | 'xml' | 'json' | 'csv' | 'text' | 'html' | 'sarif';
  includeTimestamp?: boolean;
  includeMetadata?: boolean;
}

export class ReportUtils {
  /**
   * Get the report file path for a package
   */
  static getReportPath(
    packagePath: string,
    reportType: 'scan' | 'duplicate',
    format: string
  ): string {
    // If package path ends with /main, put report in parent directory
    let reportDir = packagePath;
    if (reportDir.endsWith('/main') || reportDir.endsWith('\\main')) {
      reportDir = path.dirname(reportDir);
    }

    const baseFileName =
      reportType === 'scan' ? 'SCAN_RESULTS' : 'DUPLICATE_ANALYSIS';
    const extension = format === 'markdown' ? 'md' : format;
    const fileName = `${baseFileName}.${extension}`;

    return path.join(reportDir, fileName);
  }

  /**
   * Save scan results to file
   */
  static async saveScanResults(
    result: ScanResult,
    packagePath: string,
    options: ReportOptions
  ): Promise<string> {
    const filePath = this.getReportPath(packagePath, 'scan', options.format);
    let content: string;

    switch (options.format) {
      case 'markdown':
        content = this.generateScanMarkdown(result, options);
        break;
      case 'xml':
        content = this.generatePMDXml(result);
        break;
      case 'json':
        content = JSON.stringify(result, null, 2);
        break;
      case 'csv':
        content = this.generateScanCsv(result);
        break;
      case 'text':
        content = this.generateScanText(result);
        break;
      case 'html':
        content = this.generateScanHtml(result);
        break;
      case 'sarif':
        content = this.generateScanSarif(result);
        break;
      default:
        throw new Error(`Unsupported format: ${options.format}`);
    }

    await fs.promises.writeFile(filePath, content, 'utf8');
    logger.info(`Saved scan results to: ${filePath}`);
    return filePath;
  }

  /**
   * Save duplicate detection results to file
   */
  static async saveDuplicateResults(
    result: DuplicateResult,
    packagePath: string,
    options: ReportOptions
  ): Promise<string> {
    const filePath = this.getReportPath(
      packagePath,
      'duplicate',
      options.format
    );
    let content: string;

    switch (options.format) {
      case 'markdown':
        content = this.generateDuplicateMarkdown(result, options);
        break;
      case 'xml':
        content = this.generateCPDXml(result);
        break;
      case 'json':
        content = JSON.stringify(result, null, 2);
        break;
      case 'csv':
        content = this.generateDuplicateCsv(result);
        break;
      case 'text':
        content = this.generateDuplicateText(result);
        break;
      default:
        throw new Error(`Unsupported format for duplicates: ${options.format}`);
    }

    await fs.promises.writeFile(filePath, content, 'utf8');
    logger.info(`Saved duplicate results to: ${filePath}`);
    return filePath;
  }

  /**
   * Generate markdown report for scan results
   */
  private static generateScanMarkdown(
    result: ScanResult,
    options: ReportOptions
  ): string {
    let md = `# Code Scan Results - ${result.packageName}\n\n`;

    if (options.includeMetadata !== false) {
      md += `## Summary\n\n`;
      md += `- **Total Violations:** ${result.totalViolations}\n`;
      md += `- **Package Path:** ${result.packagePath}\n`;
      md += `- **Scan Date:** ${result.timestamp.toLocaleString()}\n`;
      md += `- **Scan Duration:** ${result.scanDuration}ms\n\n`;
    }

    if (result.totalViolations === 0) {
      md += '✅ **No violations found!**\n';
      return md;
    }

    // Group violations by file
    const violationsByFile = new Map<string, Violation[]>();
    for (const violation of result.violations) {
      if (!violationsByFile.has(violation.file)) {
        violationsByFile.set(violation.file, []);
      }
      violationsByFile.get(violation.file)!.push(violation);
    }

    md += `## Violations by File\n\n`;

    for (const [file, violations] of violationsByFile) {
      const relativePath = path.relative(result.packagePath, file);
      md += `### ${relativePath}\n\n`;
      md += '| Line | Priority | Rule | Message |\n';
      md += '|------|----------|------|----------|\n';

      // Sort violations by line number
      violations.sort((a, b) => a.beginLine - b.beginLine);

      for (const violation of violations) {
        const priority = this.getPriorityEmoji(violation.priority);
        const line = violation.endLine
          ? `${violation.beginLine}-${violation.endLine}`
          : `${violation.beginLine}`;
        md += `| ${line} | ${priority} ${violation.priority} | ${violation.rule} | ${violation.message} |\n`;
      }
      md += '\n';
    }

    return md;
  }

  /**
   * Generate markdown report for duplicate results
   */
  private static generateDuplicateMarkdown(
    result: DuplicateResult,
    options: ReportOptions
  ): string {
    let md = `# Duplicate Code Analysis - ${result.packageName}\n\n`;

    if (options.includeMetadata !== false) {
      md += `## Summary\n\n`;
      md += `- **Total Duplications:** ${result.totalDuplications}\n`;
      md += `- **Total Duplicated Lines:** ${result.totalDuplicatedLines}\n`;
      md += `- **Total Duplicated Tokens:** ${result.totalDuplicatedTokens}\n`;
      md += `- **Cross-Package Duplicates:** ${result.hasCrossPackageDuplicates ? 'Yes ❌' : 'No ✅'}\n`;
      md += `- **Scan Date:** ${result.timestamp.toLocaleString()}\n`;
      md += `- **Scan Duration:** ${result.scanDuration}ms\n\n`;
    }

    if (result.totalDuplications === 0) {
      md += '✅ **No duplicate code found!**\n';
      return md;
    }

    md += `## Duplicate Code Blocks\n\n`;

    result.duplications.forEach((dup, index) => {
      md += `### Duplication #${index + 1}\n\n`;
      md += `- **Size:** ${dup.lines} lines, ${dup.tokens} tokens\n`;
      md += `- **Found in ${dup.occurrences.length} locations:**\n\n`;

      dup.occurrences.forEach((occ, occIndex) => {
        const fileName = path.basename(occ.file);
        const dirName = path.basename(path.dirname(occ.file));
        md += `  ${occIndex + 1}. \`${dirName}/${fileName}\`\n`;
        md += `     - Lines ${occ.startLine}-${occ.endLine}\n`;
      });

      if (dup.occurrences[0]?.codeFragment) {
        md += `\n#### Code Fragment:\n\n`;
        md += '```apex\n';
        md += dup.occurrences[0].codeFragment;
        md += '\n```\n';
      }

      md += '\n---\n\n';
    });

    return md;
  }

  /**
   * Generate PMD XML format for scan results
   */
  private static generatePMDXml(result: ScanResult): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml +=
      '<pmd version="' + (result as any).pmdVersion ||
      '7.0.0' + '" timestamp="' + result.timestamp.toISOString() + '">\n';

    // Group violations by file
    const violationsByFile = new Map<string, Violation[]>();
    for (const violation of result.violations) {
      if (!violationsByFile.has(violation.file)) {
        violationsByFile.set(violation.file, []);
      }
      violationsByFile.get(violation.file)!.push(violation);
    }

    for (const [file, violations] of violationsByFile) {
      xml += `  <file name="${this.escapeXml(file)}">\n`;

      for (const violation of violations) {
        xml += '    <violation';
        xml += ` beginline="${violation.beginLine}"`;
        if (violation.endLine) {
          xml += ` endline="${violation.endLine}"`;
        }
        if (violation.beginColumn) {
          xml += ` begincolumn="${violation.beginColumn}"`;
        }
        if (violation.endColumn) {
          xml += ` endcolumn="${violation.endColumn}"`;
        }
        xml += ` rule="${this.escapeXml(violation.rule)}"`;
        xml += ` ruleset="${this.escapeXml(violation.ruleset)}"`;
        xml += ` priority="${violation.priority}"`;
        if (violation.externalInfoUrl) {
          xml += ` externalInfoUrl="${this.escapeXml(violation.externalInfoUrl)}"`;
        }
        if (violation.className) {
          xml += ` class="${this.escapeXml(violation.className)}"`;
        }
        if (violation.methodName) {
          xml += ` method="${this.escapeXml(violation.methodName)}"`;
        }
        if (violation.variableName) {
          xml += ` variable="${this.escapeXml(violation.variableName)}"`;
        }
        xml += '>\n';
        xml += `      ${this.escapeXml(violation.message)}\n`;
        xml += '    </violation>\n';
      }

      xml += '  </file>\n';
    }

    xml += '</pmd>\n';
    return xml;
  }

  /**
   * Generate CPD XML format for duplicate results
   */
  private static generateCPDXml(result: DuplicateResult): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<pmd-cpd>\n';

    for (const dup of result.duplications) {
      xml += `  <duplication lines="${dup.lines}" tokens="${dup.tokens}">\n`;

      for (const occ of dup.occurrences) {
        xml += `    <file path="${this.escapeXml(occ.file)}" line="${occ.startLine}" endline="${occ.endLine}"/>\n`;
      }

      if (dup.occurrences[0]?.codeFragment) {
        xml += '    <codefragment>\n';
        xml += `      <![CDATA[${dup.occurrences[0].codeFragment}]]>\n`;
        xml += '    </codefragment>\n';
      }

      xml += '  </duplication>\n';
    }

    xml += '</pmd-cpd>\n';
    return xml;
  }

  /**
   * Generate CSV format for scan results
   */
  private static generateScanCsv(result: ScanResult): string {
    const headers = [
      'File',
      'Line',
      'End Line',
      'Priority',
      'Rule',
      'Ruleset',
      'Message',
    ];
    const rows = [headers.join(',')];

    for (const violation of result.violations) {
      const row = [
        `"${violation.file}"`,
        violation.beginLine,
        violation.endLine || '',
        violation.priority,
        `"${violation.rule}"`,
        `"${violation.ruleset}"`,
        `"${violation.message.replace(/"/g, '""')}"`,
      ];
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  /**
   * Generate CSV format for duplicate results
   */
  private static generateDuplicateCsv(result: DuplicateResult): string {
    const headers = [
      'Duplication #',
      'Lines',
      'Tokens',
      'File',
      'Start Line',
      'End Line',
    ];
    const rows = [headers.join(',')];

    result.duplications.forEach((dup, dupIndex) => {
      dup.occurrences.forEach(occ => {
        const row = [
          dupIndex + 1,
          dup.lines,
          dup.tokens,
          `"${occ.file}"`,
          occ.startLine,
          occ.endLine,
        ];
        rows.push(row.join(','));
      });
    });

    return rows.join('\n');
  }

  /**
   * Generate text format for scan results
   */
  private static generateScanText(result: ScanResult): string {
    let text = `Code Scan Results - ${result.packageName}\n`;
    text += '='.repeat(50) + '\n\n';
    text += `Total Violations: ${result.totalViolations}\n`;
    text += `Scan Date: ${result.timestamp.toLocaleString()}\n`;
    text += `Scan Duration: ${result.scanDuration}ms\n\n`;

    if (result.totalViolations === 0) {
      text += 'No violations found!\n';
      return text;
    }

    // Group by file
    const violationsByFile = new Map<string, Violation[]>();
    for (const violation of result.violations) {
      if (!violationsByFile.has(violation.file)) {
        violationsByFile.set(violation.file, []);
      }
      violationsByFile.get(violation.file)!.push(violation);
    }

    for (const [file, violations] of violationsByFile) {
      const relativePath = path.relative(result.packagePath, file);
      text += `\nFile: ${relativePath}\n`;
      text += '-'.repeat(relativePath.length + 6) + '\n';

      for (const violation of violations) {
        const line = violation.endLine
          ? `${violation.beginLine}-${violation.endLine}`
          : `${violation.beginLine}`;
        text += `  Line ${line}: [Priority ${violation.priority}] ${violation.rule}\n`;
        text += `    ${violation.message}\n`;
      }
    }

    return text;
  }

  /**
   * Generate text format for duplicate results
   */
  private static generateDuplicateText(result: DuplicateResult): string {
    let text = `Duplicate Code Analysis - ${result.packageName}\n`;
    text += '='.repeat(50) + '\n\n';
    text += `Total Duplications: ${result.totalDuplications}\n`;
    text += `Total Duplicated Lines: ${result.totalDuplicatedLines}\n`;
    text += `Total Duplicated Tokens: ${result.totalDuplicatedTokens}\n`;
    text += `Cross-Package Duplicates: ${result.hasCrossPackageDuplicates ? 'Yes' : 'No'}\n`;
    text += `Scan Date: ${result.timestamp.toLocaleString()}\n\n`;

    if (result.totalDuplications === 0) {
      text += 'No duplicate code found!\n';
      return text;
    }

    result.duplications.forEach((dup, index) => {
      text += `\nDuplication #${index + 1}\n`;
      text += '-'.repeat(20) + '\n';
      text += `Size: ${dup.lines} lines, ${dup.tokens} tokens\n`;
      text += `Found in ${dup.occurrences.length} locations:\n`;

      dup.occurrences.forEach((occ, occIndex) => {
        text += `  ${occIndex + 1}. ${occ.file}\n`;
        text += `     Lines ${occ.startLine}-${occ.endLine}\n`;
      });

      if (dup.occurrences[0]?.codeFragment) {
        text += `\nCode Fragment:\n`;
        text += dup.occurrences[0].codeFragment
          .split('\n')
          .map(line => '  ' + line)
          .join('\n');
        text += '\n';
      }
    });

    return text;
  }

  /**
   * Generate HTML format for scan results
   */
  private static generateScanHtml(result: ScanResult): string {
    const html = `<!DOCTYPE html>
<html>
<head>
    <title>Code Scan Results - ${result.packageName}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #333; margin-bottom: 10px; }
        .summary { background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0; }
        .summary-item { margin: 5px 0; }
        .file-section { margin: 30px 0; }
        .file-header { font-size: 18px; font-weight: 600; color: #1976d2; margin: 20px 0 10px 0; padding: 10px; background: #e3f2fd; border-radius: 4px; }
        .violation { margin: 10px 0; padding: 15px; border-left: 4px solid; background: #fafafa; border-radius: 4px; }
        .priority-1 { border-left-color: #d32f2f; background: #ffebee; }
        .priority-2 { border-left-color: #f57c00; background: #fff3e0; }
        .priority-3 { border-left-color: #fbc02d; background: #fffde7; }
        .priority-4 { border-left-color: #1976d2; background: #e3f2fd; }
        .priority-5 { border-left-color: #616161; background: #fafafa; }
        .violation-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .violation-location { font-weight: 600; color: #333; }
        .violation-rule { font-size: 14px; color: #666; }
        .violation-message { color: #444; line-height: 1.5; }
        .no-violations { text-align: center; color: #4caf50; font-size: 24px; padding: 50px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Code Scan Results - ${result.packageName}</h1>
        <div class="summary">
            <div class="summary-item"><strong>Total Violations:</strong> ${result.totalViolations}</div>
            <div class="summary-item"><strong>Scan Date:</strong> ${result.timestamp.toLocaleString()}</div>
            <div class="summary-item"><strong>Scan Duration:</strong> ${result.scanDuration}ms</div>
        </div>
        ${
          result.totalViolations === 0
            ? '<div class="no-violations">✅ No violations found!</div>'
            : this.generateScanHtmlViolations(result)
        }
    </div>
</body>
</html>`;
    return html;
  }

  private static generateScanHtmlViolations(result: ScanResult): string {
    // Group by file
    const violationsByFile = new Map<string, Violation[]>();
    for (const violation of result.violations) {
      if (!violationsByFile.has(violation.file)) {
        violationsByFile.set(violation.file, []);
      }
      violationsByFile.get(violation.file)!.push(violation);
    }

    let html = '';
    for (const [file, violations] of violationsByFile) {
      const relativePath = path.relative(result.packagePath, file);
      html += `<div class="file-section">`;
      html += `<div class="file-header">${relativePath} (${violations.length} violations)</div>`;

      // Sort by line number
      violations.sort((a, b) => a.beginLine - b.beginLine);

      for (const violation of violations) {
        const line = violation.endLine
          ? `${violation.beginLine}-${violation.endLine}`
          : `${violation.beginLine}`;

        html += `<div class="violation priority-${violation.priority}">`;
        html += `<div class="violation-header">`;
        html += `<span class="violation-location">Line ${line}</span>`;
        html += `<span class="violation-rule">${violation.rule} (Priority ${violation.priority})</span>`;
        html += `</div>`;
        html += `<div class="violation-message">${this.escapeHtml(violation.message)}</div>`;
        html += `</div>`;
      }
      html += `</div>`;
    }

    return html;
  }

  /**
   * Generate SARIF format for scan results (for GitHub/VS Code integration)
   */
  private static generateScanSarif(result: ScanResult): string {
    const sarif = {
      version: '2.1.0',
      runs: [
        {
          tool: {
            driver: {
              name: 'PMD',
              informationUri: 'https://pmd.github.io/',
              version: '7.0.0',
              rules: this.extractRules(result.violations),
            },
          },
          results: result.violations.map(violation => ({
            ruleId: violation.rule,
            level: this.getPrioritySarifLevel(violation.priority),
            message: {
              text: violation.message,
            },
            locations: [
              {
                physicalLocation: {
                  artifactLocation: {
                    uri: violation.file,
                  },
                  region: {
                    startLine: violation.beginLine,
                    endLine: violation.endLine || violation.beginLine,
                    startColumn: violation.beginColumn,
                    endColumn: violation.endColumn,
                  },
                },
              },
            ],
          })),
        },
      ],
    };

    return JSON.stringify(sarif, null, 2);
  }

  private static extractRules(violations: Violation[]): any[] {
    const rulesMap = new Map<string, any>();

    for (const violation of violations) {
      if (!rulesMap.has(violation.rule)) {
        rulesMap.set(violation.rule, {
          id: violation.rule,
          name: violation.rule,
          helpUri: violation.externalInfoUrl || undefined,
          properties: {
            category: violation.ruleset,
          },
        });
      }
    }

    return Array.from(rulesMap.values());
  }

  private static getPrioritySarifLevel(priority: number): string {
    switch (priority) {
      case 1:
      case 2:
        return 'error';
      case 3:
        return 'warning';
      case 4:
      case 5:
        return 'note';
      default:
        return 'none';
    }
  }

  private static getPriorityEmoji(priority: number): string {
    switch (priority) {
      case 1:
        return '🔴';
      case 2:
        return '🟠';
      case 3:
        return '🟡';
      case 4:
        return '🔵';
      case 5:
        return '⚪';
      default:
        return '⚫';
    }
  }

  private static escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private static escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
}
