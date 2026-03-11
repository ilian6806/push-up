import { describe, it, expect, vi, beforeEach } from "vitest";
import * as path from "path";
import * as fs from "fs";
import { PushUpConfig } from "../config";
import { toRemotePath, toLocalPath, toRelativePath, collectFiles, collectRemoteFiles } from "../utils";
import { IgnoreChecker } from "../ignore";

vi.mock("fs");

function makeConfig(overrides: Partial<PushUpConfig> = {}): PushUpConfig {
  return {
    protocol: "sftp",
    host: "example.com",
    port: 22,
    username: "deploy",
    remotePath: "/var/www",
    uploadOnSave: true,
    ignore: [],
    configPath: "/project/.pushup.json",
    localRoot: "/project",
    ...overrides,
  };
}

// ── toRemotePath ──

describe("toRemotePath", () => {
  it("maps a local file to the remote path", () => {
    const config = makeConfig();
    const result = toRemotePath("/project/src/index.ts", config);
    expect(result).toBe("/var/www/src/index.ts");
  });

  it("handles nested subdirectories", () => {
    const config = makeConfig();
    const result = toRemotePath("/project/a/b/c.js", config);
    expect(result).toBe("/var/www/a/b/c.js");
  });

  it("strips trailing slash from remotePath", () => {
    const config = makeConfig({ remotePath: "/var/www/" });
    const result = toRemotePath("/project/file.txt", config);
    expect(result).toBe("/var/www/file.txt");
  });
});

// ── toLocalPath ──

describe("toLocalPath", () => {
  it("maps a remote file to the local path", () => {
    const config = makeConfig();
    const result = toLocalPath("/var/www/src/index.ts", config);
    expect(result).toBe(path.join("/project", "src/index.ts"));
  });

  it("handles remote path not starting with remoteBase", () => {
    const config = makeConfig();
    const result = toLocalPath("/other/path/file.txt", config);
    expect(result).toBe(path.join("/project", "/other/path/file.txt"));
  });

  it("handles nested remote paths", () => {
    const config = makeConfig();
    const result = toLocalPath("/var/www/a/b/c.js", config);
    expect(result).toBe(path.join("/project", "a/b/c.js"));
  });
});

// ── toRelativePath ──

describe("toRelativePath", () => {
  it("returns the relative path from localRoot", () => {
    const config = makeConfig();
    const result = toRelativePath("/project/src/index.ts", config);
    expect(result).toBe("src/index.ts");
  });

  it("normalizes backslashes to forward slashes", () => {
    // The function calls path.relative then replaces backslashes.
    // On any platform, if the relative path has backslashes they get normalized.
    // We test indirectly: on Linux path.relative returns forward slashes already,
    // so we just confirm the output uses forward slashes.
    const config = makeConfig();
    const result = toRelativePath("/project/src/deep/file.ts", config);
    expect(result).toBe("src/deep/file.ts");
    expect(result).not.toContain("\\");
  });
});

// ── collectFiles ──

describe("collectFiles", () => {
  beforeEach(() => {
    vi.mocked(fs.readdirSync).mockReset();
  });

  it("recursively collects files, excluding ignored ones", () => {
    const makeDirent = (name: string, isDir: boolean) => ({
      name,
      isDirectory: () => isDir,
      isFile: () => !isDir,
      isBlockDevice: () => false,
      isCharacterDevice: () => false,
      isFIFO: () => false,
      isSocket: () => false,
      isSymbolicLink: () => false,
      path: "",
      parentPath: "",
    });

    vi.mocked(fs.readdirSync).mockImplementation((dir: any) => {
      if (String(dir) === "/project") {
        return [
          makeDirent("src", true),
          makeDirent("readme.md", false),
          makeDirent(".git", true),
        ] as any;
      }
      if (String(dir) === path.join("/project", "src")) {
        return [makeDirent("index.ts", false)] as any;
      }
      return [] as any;
    });

    const config = makeConfig({ ignore: [".git/**"] });
    const checker = new IgnoreChecker(config.ignore);
    const files = collectFiles("/project", config, checker);

    expect(files).toContain(path.join("/project", "readme.md"));
    expect(files).toContain(path.join("/project", "src", "index.ts"));
    expect(files).not.toContain(expect.stringContaining(".git"));
    expect(files).toHaveLength(2);
  });
});

// ── collectRemoteFiles ──

describe("collectRemoteFiles", () => {
  it("recursively collects remote files", async () => {
    const mockUploader = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn(),
      uploadFile: vi.fn(),
      downloadFile: vi.fn(),
      ensureDir: vi.fn(),
      listDir: vi.fn(),
    };

    mockUploader.listDir.mockImplementation(async (remotePath: string) => {
      if (remotePath === "/remote") {
        return [
          { name: "sub", isDirectory: true },
          { name: "file1.txt", isDirectory: false },
        ];
      }
      if (remotePath === "/remote/sub") {
        return [{ name: "file2.txt", isDirectory: false }];
      }
      return [];
    });

    const files = await collectRemoteFiles(mockUploader, "/remote");

    expect(files).toContain("/remote/file1.txt");
    expect(files).toContain("/remote/sub/file2.txt");
    expect(files).toHaveLength(2);
  });
});
