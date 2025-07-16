import * as fs from 'fs';
import * as path from 'path';

/**
 * Custom writer for sfdx-project.json that preserves original formatting
 */
export class SfdxProjectWriter {
  /**
   * Write sfdx-project.json with preserved formatting (2 spaces)
   */
  static async writeProject(
    projectPath: string,
    contents: any,
    indentSpaces: number = 2
  ): Promise<void> {
    const projectFilePath = path.join(projectPath, 'sfdx-project.json');
    const jsonContent = JSON.stringify(contents, null, indentSpaces);
    await fs.promises.writeFile(projectFilePath, jsonContent + '\n', 'utf8');
  }

  /**
   * Read and detect indentation from existing sfdx-project.json
   */
  static async detectIndentation(projectPath: string): Promise<number> {
    try {
      const projectFilePath = path.join(projectPath, 'sfdx-project.json');
      const content = await fs.promises.readFile(projectFilePath, 'utf8');

      // Try to detect indentation from the first indented line
      const lines = content.split('\n');
      for (const line of lines) {
        const match = line.match(/^(\s+)"/);
        if (match) {
          return match[1].length;
        }
      }
    } catch (error) {
      // If we can't detect, default to 2 spaces
    }

    return 2;
  }
}
