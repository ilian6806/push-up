import * as vscode from "vscode";

export class Logger {
  private channel: vscode.OutputChannel;

  constructor() {
    this.channel = vscode.window.createOutputChannel("PushUp");
  }

  info(message: string): void {
    this.log("INFO", message);
  }

  warn(message: string): void {
    this.log("WARN", message);
  }

  error(message: string): void {
    this.log("ERROR", message);
  }

  show(): void {
    this.channel.show();
  }

  dispose(): void {
    this.channel.dispose();
  }

  private log(level: string, message: string): void {
    const timestamp = new Date().toISOString();
    this.channel.appendLine(`[${timestamp}] [${level}] ${message}`);
  }
}
