import * as vscode from "vscode";

export class StatusBar {
  private item: vscode.StatusBarItem;
  private resetTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      0
    );
    this.item.command = "pushup.showOutput";
    this.idle();
    this.item.show();
  }

  idle(): void {
    this.clearTimer();
    this.item.text = "$(cloud) PushUp";
    this.item.tooltip = "PushUp — Idle";
  }

  uploading(): void {
    this.clearTimer();
    this.item.text = "$(sync~spin) PushUp";
    this.item.tooltip = "PushUp — Uploading…";
  }

  success(): void {
    this.clearTimer();
    this.item.text = "$(check) PushUp";
    this.item.tooltip = "PushUp — Success";
    this.resetTimer = setTimeout(() => this.idle(), 3000);
  }

  error(): void {
    this.clearTimer();
    this.item.text = "$(error) PushUp";
    this.item.tooltip = "PushUp — Error";
    this.resetTimer = setTimeout(() => this.idle(), 5000);
  }

  dispose(): void {
    this.clearTimer();
    this.item.dispose();
  }

  private clearTimer(): void {
    if (this.resetTimer !== undefined) {
      clearTimeout(this.resetTimer);
      this.resetTimer = undefined;
    }
  }
}
