import { vi } from "vitest";

// ── Mock objects exported for test assertions ──

export const mockOutputChannel = {
  appendLine: vi.fn(),
  show: vi.fn(),
  dispose: vi.fn(),
};

export const mockStatusBarItem = {
  text: "",
  tooltip: "",
  command: undefined as string | undefined,
  show: vi.fn(),
  dispose: vi.fn(),
};

export const mockFileSystemWatcher = {
  onDidChange: vi.fn(),
  onDidCreate: vi.fn(),
  onDidDelete: vi.fn(),
  dispose: vi.fn(),
};

// ── Mock the virtual 'vscode' module ──

vi.mock("vscode", () => ({
  window: {
    createOutputChannel: vi.fn(() => mockOutputChannel),
    createStatusBarItem: vi.fn(() => mockStatusBarItem),
    showErrorMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    showInputBox: vi.fn(),
    showTextDocument: vi.fn(),
    showWorkspaceFolderPick: vi.fn(),
    activeTextEditor: undefined,
    withProgress: vi.fn(),
  },
  workspace: {
    createFileSystemWatcher: vi.fn(() => mockFileSystemWatcher),
    workspaceFolders: undefined,
    openTextDocument: vi.fn(),
    onDidSaveTextDocument: vi.fn(),
  },
  commands: {
    registerCommand: vi.fn(),
  },
  StatusBarAlignment: {
    Left: 1,
    Right: 2,
  },
  ProgressLocation: {
    Notification: 15,
  },
  Uri: {
    file: (f: string) => ({ fsPath: f }),
  },
}));
