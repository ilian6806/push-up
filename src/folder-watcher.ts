import * as vscode from "vscode";
import * as path from "path";
import { PushUpConfig } from "./config";
import { IgnoreChecker } from "./ignore";
import { toRelativePath } from "./utils";

export interface FolderWatcherDeps {
  config: PushUpConfig;
  uploadFn: (filePath: string) => Promise<boolean>;
  deleteFn: (filePath: string) => Promise<boolean>;
  getIgnoreChecker: () => IgnoreChecker;
  logger: { info(msg: string): void; error(msg: string): void };
}

const DEBOUNCE_MS = 300;
const RECENTLY_UPLOADED_TTL = 2000;

export class FolderWatcher {
  private watchers: vscode.FileSystemWatcher[] = [];
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private recentlyUploaded = new Map<string, number>();
  private deps: FolderWatcherDeps;

  constructor(deps: FolderWatcherDeps) {
    this.deps = deps;
  }

  start(): void {
    const { config, logger } = this.deps;

    for (const folder of config.watchFolders) {
      const resolved = path.resolve(config.localRoot, folder);
      const absoluteRoot = path.resolve(config.localRoot);
      const normalizedResolved = resolved.replace(/\\/g, "/");
      const normalizedRoot = absoluteRoot.replace(/\\/g, "/");

      // Prevent path traversal outside localRoot
      if (!normalizedResolved.startsWith(normalizedRoot + "/") && normalizedResolved !== normalizedRoot) {
        logger.error(`watchFolders: "${folder}" resolves outside project root, skipping.`);
        continue;
      }

      const pattern = new vscode.RelativePattern(resolved, "**/*");
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);

      watcher.onDidChange((uri) => this.debouncedUpload(uri.fsPath));
      watcher.onDidCreate((uri) => this.debouncedUpload(uri.fsPath));
      watcher.onDidDelete((uri) => this.debouncedDelete(uri.fsPath));

      this.watchers.push(watcher);
      logger.info(`watchFolders: watching "${folder}"`);
    }
  }

  wasRecentlyUploaded(filePath: string): boolean {
    const timestamp = this.recentlyUploaded.get(filePath);
    if (timestamp === undefined) {
      return false;
    }
    if (Date.now() - timestamp < RECENTLY_UPLOADED_TTL) {
      return true;
    }
    this.recentlyUploaded.delete(filePath);
    return false;
  }

  dispose(): void {
    for (const watcher of this.watchers) {
      watcher.dispose();
    }
    this.watchers = [];

    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.recentlyUploaded.clear();
  }

  private debouncedUpload(filePath: string): void {
    const existing = this.debounceTimers.get(filePath);
    if (existing !== undefined) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(filePath);
      this.handleUpload(filePath);
    }, DEBOUNCE_MS);

    this.debounceTimers.set(filePath, timer);
  }

  private debouncedDelete(filePath: string): void {
    const existing = this.debounceTimers.get(filePath);
    if (existing !== undefined) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(filePath);
      this.handleDelete(filePath);
    }, DEBOUNCE_MS);

    this.debounceTimers.set(filePath, timer);
  }

  private async handleUpload(filePath: string): Promise<void> {
    const { config, getIgnoreChecker, logger } = this.deps;
    const relative = toRelativePath(filePath, config);
    const checker = getIgnoreChecker();

    if (checker.isIgnored(relative)) {
      return;
    }

    try {
      const ok = await this.deps.uploadFn(filePath);
      if (ok) {
        this.recentlyUploaded.set(filePath, Date.now());
        logger.info(`watchFolders: uploaded ${relative}`);
      }
    } catch (err) {
      logger.error(`watchFolders: upload failed for ${relative}: ${err}`);
    }
  }

  private async handleDelete(filePath: string): Promise<void> {
    const { config, getIgnoreChecker, logger } = this.deps;
    const relative = toRelativePath(filePath, config);
    const checker = getIgnoreChecker();

    if (checker.isIgnored(relative)) {
      return;
    }

    try {
      const ok = await this.deps.deleteFn(filePath);
      if (ok) {
        logger.info(`watchFolders: deleted remote ${relative}`);
      }
    } catch (err) {
      logger.error(`watchFolders: remote delete failed for ${relative}: ${err}`);
    }
  }
}
