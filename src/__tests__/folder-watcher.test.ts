import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as vscode from "vscode";
import { PushUpConfig } from "../config";
import { FolderWatcher, FolderWatcherDeps } from "../folder-watcher";

type WatcherCallback = (uri: vscode.Uri) => void;

interface MockWatcher {
  onDidChange: ReturnType<typeof vi.fn>;
  onDidCreate: ReturnType<typeof vi.fn>;
  onDidDelete: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
}

function makeConfig(overrides: Partial<PushUpConfig> = {}): PushUpConfig {
  return {
    protocol: "sftp",
    host: "example.com",
    port: 22,
    username: "deploy",
    remotePath: "/var/www",
    uploadOnSave: true,
    ignore: [],
    watchFolders: [],
    configPath: "/project/.pushup.json",
    localRoot: "/project",
    ...overrides,
  };
}

function makeDeps(overrides: Partial<FolderWatcherDeps> = {}): FolderWatcherDeps {
  return {
    config: makeConfig({ watchFolders: ["css"], ...overrides.config }),
    uploadFn: vi.fn().mockResolvedValue(true),
    deleteFn: vi.fn().mockResolvedValue(true),
    getIgnoreChecker: () => ({ isIgnored: () => false }) as any,
    logger: { info: vi.fn(), error: vi.fn() },
    ...overrides,
  };
}

/** Get the most recently created mock watcher's callbacks */
function getWatcherCallbacks(callIndex = 0): {
  watcher: MockWatcher;
  fireChange: (filePath: string) => void;
  fireCreate: (filePath: string) => void;
  fireDelete: (filePath: string) => void;
} {
  const calls = vi.mocked(vscode.workspace.createFileSystemWatcher).mock.results;
  const watcher = calls[callIndex].value as MockWatcher;
  return {
    watcher,
    fireChange: (fp: string) => {
      const cb = watcher.onDidChange.mock.calls[0][0] as WatcherCallback;
      cb({ fsPath: fp } as vscode.Uri);
    },
    fireCreate: (fp: string) => {
      const cb = watcher.onDidCreate.mock.calls[0][0] as WatcherCallback;
      cb({ fsPath: fp } as vscode.Uri);
    },
    fireDelete: (fp: string) => {
      const cb = watcher.onDidDelete.mock.calls[0][0] as WatcherCallback;
      cb({ fsPath: fp } as vscode.Uri);
    },
  };
}

describe("FolderWatcher", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates no watchers when watchFolders is empty", () => {
    const deps = makeDeps({ config: makeConfig({ watchFolders: [] }) });
    const fw = new FolderWatcher(deps);
    fw.start();
    expect(vscode.workspace.createFileSystemWatcher).not.toHaveBeenCalled();
    fw.dispose();
  });

  it("creates one watcher per folder", () => {
    const deps = makeDeps({
      config: makeConfig({ watchFolders: ["css", "dist/assets"] }),
    });
    const fw = new FolderWatcher(deps);
    fw.start();
    expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledTimes(2);
    fw.dispose();
  });

  it("debounces rapid events into a single upload", async () => {
    const deps = makeDeps();
    const fw = new FolderWatcher(deps);
    fw.start();

    const { fireChange } = getWatcherCallbacks();
    fireChange("/project/css/style.css");
    fireChange("/project/css/style.css");
    fireChange("/project/css/style.css");

    // Before debounce fires
    expect(deps.uploadFn).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300);

    expect(deps.uploadFn).toHaveBeenCalledTimes(1);
    expect(deps.uploadFn).toHaveBeenCalledWith("/project/css/style.css");
    fw.dispose();
  });

  it("skips ignored files", async () => {
    const deps = makeDeps({
      getIgnoreChecker: () => ({ isIgnored: () => true }) as any,
    });
    const fw = new FolderWatcher(deps);
    fw.start();

    const { fireCreate } = getWatcherCallbacks();
    fireCreate("/project/css/ignored.css");

    await vi.advanceTimersByTimeAsync(300);

    expect(deps.uploadFn).not.toHaveBeenCalled();
    fw.dispose();
  });

  it("wasRecentlyUploaded returns true within TTL", async () => {
    const deps = makeDeps();
    const fw = new FolderWatcher(deps);
    fw.start();

    const { fireCreate } = getWatcherCallbacks();
    fireCreate("/project/css/style.css");

    await vi.advanceTimersByTimeAsync(300);

    expect(fw.wasRecentlyUploaded("/project/css/style.css")).toBe(true);

    // After 2s TTL
    await vi.advanceTimersByTimeAsync(2000);
    expect(fw.wasRecentlyUploaded("/project/css/style.css")).toBe(false);

    fw.dispose();
  });

  it("dispose clears all timers and watchers", async () => {
    const deps = makeDeps();
    const fw = new FolderWatcher(deps);
    fw.start();

    const { fireChange, watcher } = getWatcherCallbacks();
    fireChange("/project/css/style.css");

    fw.dispose();

    // Timer was cleared, so advancing time should not trigger upload
    await vi.advanceTimersByTimeAsync(300);
    expect(deps.uploadFn).not.toHaveBeenCalled();
    expect(watcher.dispose).toHaveBeenCalled();
  });

  it("rejects path traversal (../) entries", () => {
    const deps = makeDeps({
      config: makeConfig({ watchFolders: ["../outside"] }),
    });
    const fw = new FolderWatcher(deps);
    fw.start();

    expect(vscode.workspace.createFileSystemWatcher).not.toHaveBeenCalled();
    expect(deps.logger.error).toHaveBeenCalledWith(
      expect.stringContaining("resolves outside project root")
    );
    fw.dispose();
  });

  it("onDidDelete triggers remote delete", async () => {
    const deps = makeDeps();
    const fw = new FolderWatcher(deps);
    fw.start();

    const { fireDelete } = getWatcherCallbacks();
    fireDelete("/project/css/old.css");

    await vi.advanceTimersByTimeAsync(300);

    expect(deps.deleteFn).toHaveBeenCalledTimes(1);
    expect(deps.deleteFn).toHaveBeenCalledWith("/project/css/old.css");
    fw.dispose();
  });

  it("failed upload does not mark as recently uploaded", async () => {
    const deps = makeDeps({
      uploadFn: vi.fn().mockResolvedValue(false),
    });
    const fw = new FolderWatcher(deps);
    fw.start();

    const { fireCreate } = getWatcherCallbacks();
    fireCreate("/project/css/fail.css");

    await vi.advanceTimersByTimeAsync(300);

    expect(fw.wasRecentlyUploaded("/project/css/fail.css")).toBe(false);
    fw.dispose();
  });
});
