import * as vscode from 'vscode';

export class DeployLogger {
  private static outputChannel: vscode.OutputChannel;
  
  private static getChannel(): vscode.OutputChannel {
    if (!this.outputChannel) {
      this.outputChannel = vscode.window.createOutputChannel('Packageforce Deploy');
    }
    return this.outputChannel;
  }
  
  static log(message: string): void {
    const channel = this.getChannel();
    channel.appendLine(message);
    channel.show(true);
  }
  
  static header(message: string): void {
    this.log(`\n${'='.repeat(60)}`);
    this.log(message);
    this.log(`${'='.repeat(60)}\n`);
  }
  
  static info(message: string): void {
    this.log(`ℹ️  ${message}`);
  }
  
  static success(message: string): void {
    this.log(`✅ ${message}`);
  }
  
  static warning(message: string): void {
    this.log(`⚠️  ${message}`);
  }
  
  static error(message: string): void {
    this.log(`❌ ${message}`);
  }
  
  static trace(message: string): void {
    this.log(`⏱️  ${message}`);
  }
  
  static notify(message: string): void {
    this.log(`📢 ${message}`);
  }
  
  static table(headers: string[], rows: any[][], colWidths?: number[]): void {
    // Simple table rendering for VS Code output
    const widths = colWidths || headers.map(() => 30);
    
    // Header
    this.log('+' + widths.map(w => '-'.repeat(w + 2)).join('+') + '+');
    this.log('| ' + headers.map((h, i) => h.padEnd(widths[i])).join(' | ') + ' |');
    this.log('+' + widths.map(w => '-'.repeat(w + 2)).join('+') + '+');
    
    // Rows
    rows.forEach(row => {
      const formattedRow = row.map((cell, i) => {
        const str = String(cell || '');
        if (str.length > widths[i]) {
          // Word wrap for long content
          return str.substring(0, widths[i] - 3) + '...';
        }
        return str.padEnd(widths[i]);
      });
      this.log('| ' + formattedRow.join(' | ') + ' |');
    });
    
    this.log('+' + widths.map(w => '-'.repeat(w + 2)).join('+') + '+');
  }
  
  static show(): void {
    this.getChannel().show(true);
  }
  
  static clear(): void {
    this.getChannel().clear();
  }
}