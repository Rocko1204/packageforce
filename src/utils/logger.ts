import * as vscode from 'vscode';

export class Logger {
  private static instance: Logger;
  private outputChannel: vscode.OutputChannel;
  private logLevel: LogLevel = LogLevel.INFO;

  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Packageforce');
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  public debug(message: string, ...args: any[]): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      this.log('DEBUG', message, ...args);
    }
  }

  public info(message: string, ...args: any[]): void {
    if (this.logLevel <= LogLevel.INFO) {
      this.log('INFO', message, ...args);
    }
  }

  public warn(message: string, ...args: any[]): void {
    if (this.logLevel <= LogLevel.WARN) {
      this.log('WARN', message, ...args);
    }
  }

  public error(message: string, error?: Error | unknown, ...args: any[]): void {
    if (this.logLevel <= LogLevel.ERROR) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const stackTrace = error instanceof Error ? error.stack : '';

      this.log('ERROR', message, errorMessage, stackTrace, ...args);
    }
  }

  public show(): void {
    this.outputChannel.show();
  }

  public clear(): void {
    this.outputChannel.clear();
  }

  private log(level: string, message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    const formattedMessage = this.formatMessage(message, ...args);
    const logEntry = `[${timestamp}] [${level}] ${formattedMessage}`;

    this.outputChannel.appendLine(logEntry);
  }

  private formatMessage(message: string, ...args: any[]): string {
    if (args.length === 0) {
      return message;
    }

    // Convert objects to readable strings
    const formattedArgs = args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    });

    return `${message} ${formattedArgs.join(' ')}`;
  }

  public dispose(): void {
    this.outputChannel.dispose();
  }
}

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

// Export a singleton instance for convenience
export const logger = Logger.getInstance();
