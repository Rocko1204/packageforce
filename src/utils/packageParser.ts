import * as fs from 'fs';
import { Logger } from './logger';

const logger = Logger.getInstance();

export interface PackageInfo {
  name: string;
  path: string;
  lineNumber: number;
  versionNumber?: string;
  versionName?: string;
  dependencies?: any[];
}

export function parsePackagesFromJson(filePath: string): PackageInfo[] {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(content);
    const packages: PackageInfo[] = [];

    if (!json.packageDirectories || !Array.isArray(json.packageDirectories)) {
      return packages;
    }

    // Get all lines for line number calculation
    const lines = content.split('\n');

    json.packageDirectories.forEach((dir: any) => {
      if (dir.package) {
        // Find the line number of this package
        let lineNumber = 0;
        const packagePattern = new RegExp(
          `"package"\\s*:\\s*"${dir.package.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`
        );

        for (let i = 0; i < lines.length; i++) {
          if (packagePattern.test(lines[i])) {
            // Make sure this is not inside a dependencies array
            // by checking if we're inside packageDirectories
            const beforeText = lines.slice(0, i + 1).join('\n');
            const afterPackageDirectories = beforeText.lastIndexOf(
              '"packageDirectories"'
            );
            const afterDependencies = beforeText.lastIndexOf('"dependencies"');

            // If the last "dependencies" is after the last "packageDirectories",
            // and we haven't closed the dependencies array yet, skip this
            if (afterDependencies > afterPackageDirectories) {
              const textSinceDependencies =
                beforeText.substring(afterDependencies);
              const openBrackets = (textSinceDependencies.match(/\[/g) || [])
                .length;
              const closeBrackets = (textSinceDependencies.match(/\]/g) || [])
                .length;

              if (openBrackets > closeBrackets) {
                continue; // We're inside a dependencies array
              }
            }

            lineNumber = i + 1;
            break;
          }
        }

        packages.push({
          name: dir.package,
          path: dir.path,
          lineNumber: lineNumber,
          versionNumber: dir.versionNumber,
          versionName: dir.versionName,
          dependencies: dir.dependencies,
        });
      }
    });

    return packages;
  } catch (error) {
    logger.error('Error parsing packages:', error);
    return [];
  }
}

export function findPackageByLine(
  packages: PackageInfo[],
  lineNumber: number
): PackageInfo | undefined {
  // Find the package that contains this line number
  // This is useful when clicking on any line within a package definition
  return packages.find(pkg => Math.abs(pkg.lineNumber - lineNumber) <= 10);
}
