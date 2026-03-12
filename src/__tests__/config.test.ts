import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  scaffoldConfig,
  findConfig,
  loadConfig,
  invalidateAllConfigs,
  createConfigWatcher,
} from "../config";
import { mockFileSystemWatcher } from "./setup";

vi.mock("fs");

describe("scaffoldConfig", () => {
  it("returns valid JSON with expected defaults", () => {
    const result = scaffoldConfig();
    const parsed = JSON.parse(result);
    expect(parsed.protocol).toBe("sftp");
    expect(parsed.host).toBe("example.com");
    expect(parsed.port).toBe(22);
    expect(parsed.username).toBe("deploy");
    expect(parsed.remotePath).toBe("/var/www/html");
    expect(parsed.uploadOnSave).toBe(true);
    expect(parsed.ignore).toEqual([".git/**", "node_modules/**"]);
  });
});

describe("findConfig", () => {
  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReset();
  });

  it("finds config in the same directory", () => {
    vi.mocked(fs.existsSync).mockImplementation((p: any) => {
      return String(p) === path.join("/project", ".pushup.json");
    });
    const result = findConfig("/project/file.txt");
    expect(result).toBe(path.join("/project", ".pushup.json"));
  });

  it("finds config in a parent directory", () => {
    vi.mocked(fs.existsSync).mockImplementation((p: any) => {
      return String(p) === path.join("/project", ".pushup.json");
    });
    const result = findConfig("/project/src/deep/file.txt");
    expect(result).toBe(path.join("/project", ".pushup.json"));
  });

  it("returns undefined when config is not found", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const result = findConfig("/project/src/file.txt");
    expect(result).toBeUndefined();
  });
});

describe("loadConfig / validateConfig", () => {
  beforeEach(() => {
    invalidateAllConfigs();
    vi.mocked(fs.readFileSync).mockReset();
  });

  const validSftp = JSON.stringify({
    protocol: "sftp",
    host: "example.com",
    port: 2222,
    username: "user",
    password: "secret",
    remotePath: "/deploy",
    uploadOnSave: true,
    ignore: ["*.log"],
  });

  const validFtp = JSON.stringify({
    protocol: "ftp",
    host: "ftp.example.com",
    username: "ftpuser",
    remotePath: "/public",
  });

  it("loads a valid SFTP config with all fields mapped correctly", () => {
    vi.mocked(fs.readFileSync).mockReturnValue(validSftp);
    const config = loadConfig("/project/.pushup.json");
    expect(config.protocol).toBe("sftp");
    expect(config.host).toBe("example.com");
    expect(config.port).toBe(2222);
    expect(config.username).toBe("user");
    expect(config.password).toBe("secret");
    expect(config.remotePath).toBe("/deploy");
    expect(config.uploadOnSave).toBe(true);
    expect(config.configPath).toBe("/project/.pushup.json");
    expect(config.localRoot).toBe(path.dirname("/project/.pushup.json"));
  });

  it("loads a valid FTP config with default port 21", () => {
    vi.mocked(fs.readFileSync).mockReturnValue(validFtp);
    const config = loadConfig("/ftp/.pushup.json");
    expect(config.protocol).toBe("ftp");
    expect(config.port).toBe(21);
  });

  it("defaults SFTP port to 22 when omitted", () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        protocol: "sftp",
        host: "h",
        username: "u",
        remotePath: "/r",
      })
    );
    const config = loadConfig("/sftp/.pushup.json");
    expect(config.port).toBe(22);
  });

  it("defaults uploadOnSave to true when omitted", () => {
    vi.mocked(fs.readFileSync).mockReturnValue(validFtp);
    const config = loadConfig("/default-onsave/.pushup.json");
    expect(config.uploadOnSave).toBe(true);
  });

  it("respects uploadOnSave: false", () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        protocol: "sftp",
        host: "h",
        username: "u",
        remotePath: "/r",
        uploadOnSave: false,
      })
    );
    const config = loadConfig("/onsave-false/.pushup.json");
    expect(config.uploadOnSave).toBe(false);
  });

  it("merges custom ignore patterns with defaults", () => {
    vi.mocked(fs.readFileSync).mockReturnValue(validSftp);
    const config = loadConfig("/merge-ignore/.pushup.json");
    expect(config.ignore).toContain(".git/**");
    expect(config.ignore).toContain(".vscode/**");
    expect(config.ignore).toContain("node_modules/**");
    expect(config.ignore).toContain(".pushup.json");
    expect(config.ignore).toContain("*.log");
  });

  it("throws on missing host", () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ protocol: "sftp", username: "u", remotePath: "/r" })
    );
    expect(() => loadConfig("/bad/.pushup.json")).toThrow('Missing required field "host"');
  });

  it("throws on missing username", () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ protocol: "sftp", host: "h", remotePath: "/r" })
    );
    expect(() => loadConfig("/bad2/.pushup.json")).toThrow('Missing required field "username"');
  });

  it("throws on missing remotePath", () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ protocol: "sftp", host: "h", username: "u" })
    );
    expect(() => loadConfig("/bad3/.pushup.json")).toThrow('Missing required field "remotePath"');
  });

  it("throws on invalid protocol", () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ protocol: "http", host: "h", username: "u", remotePath: "/r" })
    );
    expect(() => loadConfig("/bad4/.pushup.json")).toThrow('Invalid protocol "http"');
  });

  it("defaults watchFolders to empty array when absent", () => {
    vi.mocked(fs.readFileSync).mockReturnValue(validFtp);
    const config = loadConfig("/wf-absent/.pushup.json");
    expect(config.watchFolders).toEqual([]);
  });

  it("preserves valid watchFolders entries", () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        protocol: "sftp",
        host: "h",
        username: "u",
        remotePath: "/r",
        watchFolders: ["css", "dist/assets"],
      })
    );
    const config = loadConfig("/wf-valid/.pushup.json");
    expect(config.watchFolders).toEqual(["css", "dist/assets"]);
  });

  it("filters out non-string and empty watchFolders entries", () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        protocol: "sftp",
        host: "h",
        username: "u",
        remotePath: "/r",
        watchFolders: ["css", 123, "", null, "dist"],
      })
    );
    const config = loadConfig("/wf-filter/.pushup.json");
    expect(config.watchFolders).toEqual(["css", "dist"]);
  });

  it("caches config on second call", () => {
    vi.mocked(fs.readFileSync).mockReturnValue(validSftp);
    loadConfig("/cached/.pushup.json");
    loadConfig("/cached/.pushup.json");
    expect(fs.readFileSync).toHaveBeenCalledTimes(1);
  });

  it("re-reads config after invalidateAllConfigs", () => {
    vi.mocked(fs.readFileSync).mockReturnValue(validSftp);
    loadConfig("/invalidate/.pushup.json");
    invalidateAllConfigs();
    loadConfig("/invalidate/.pushup.json");
    expect(fs.readFileSync).toHaveBeenCalledTimes(2);
  });
});

describe("createConfigWatcher", () => {
  it("creates a file system watcher", async () => {
    const vscode = await import("vscode");
    const watcher = createConfigWatcher();
    expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalled();
  });
});
