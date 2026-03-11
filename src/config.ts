import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export interface PushUpConfig {
  protocol: "sftp" | "ftp";
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKeyPath?: string;
  passphrase?: string;
  remotePath: string;
  uploadOnSave: boolean;
  ignore: string[];
  /** Absolute path to the .pushup.json file */
  configPath: string;
  /** Directory containing .pushup.json */
  localRoot: string;
}

const CONFIG_FILENAME = ".pushup.json";

const DEFAULT_IGNORE = [
  ".git/**",
  ".vscode/**",
  "node_modules/**",
  ".pushup.json",
];

const configCache = new Map<string, PushUpConfig>();

export function findConfig(filePath: string): string | undefined {
  let dir: string;
  try {
    dir = fs.statSync(filePath).isDirectory() ? filePath : path.dirname(filePath);
  } catch {
    dir = path.dirname(filePath);
  }
  const root = path.parse(dir).root;
  while (true) {
    const candidate = path.join(dir, CONFIG_FILENAME);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    if (dir === root) {
      return undefined;
    }
    dir = path.dirname(dir);
  }
}

export function loadConfig(configPath: string): PushUpConfig {
  const cached = configCache.get(configPath);
  if (cached) {
    return cached;
  }

  const raw = fs.readFileSync(configPath, "utf-8");
  const json = JSON.parse(raw);
  const config = validateConfig(json, configPath);
  configCache.set(configPath, config);
  return config;
}

function validateConfig(json: Record<string, unknown>, configPath: string): PushUpConfig {
  const protocol = json.protocol as string;
  if (protocol !== "sftp" && protocol !== "ftp") {
    throw new Error(`Invalid protocol "${protocol}". Must be "sftp" or "ftp".`);
  }

  const host = json.host as string;
  if (!host) {
    throw new Error('Missing required field "host".');
  }

  const username = json.username as string;
  if (!username) {
    throw new Error('Missing required field "username".');
  }

  const remotePath = json.remotePath as string;
  if (!remotePath) {
    throw new Error('Missing required field "remotePath".');
  }

  const defaultPort = protocol === "sftp" ? 22 : 21;

  return {
    protocol,
    host,
    port: typeof json.port === "number" ? json.port : defaultPort,
    username,
    password: typeof json.password === "string" ? json.password : undefined,
    privateKeyPath: typeof json.privateKeyPath === "string" ? json.privateKeyPath : undefined,
    passphrase: typeof json.passphrase === "string" ? json.passphrase : undefined,
    remotePath,
    uploadOnSave: json.uploadOnSave !== false,
    ignore: Array.isArray(json.ignore) ? [...DEFAULT_IGNORE, ...(json.ignore as string[])] : DEFAULT_IGNORE,
    configPath,
    localRoot: path.dirname(configPath),
  };
}

export function invalidateConfig(configPath: string): void {
  configCache.delete(configPath);
}

export function invalidateAllConfigs(): void {
  configCache.clear();
}

export function createConfigWatcher(): vscode.FileSystemWatcher {
  const watcher = vscode.workspace.createFileSystemWatcher(`**/${CONFIG_FILENAME}`);
  watcher.onDidChange((uri) => invalidateConfig(uri.fsPath));
  watcher.onDidCreate((uri) => invalidateConfig(uri.fsPath));
  watcher.onDidDelete((uri) => invalidateConfig(uri.fsPath));
  return watcher;
}

export function scaffoldConfig(): string {
  return JSON.stringify(
    {
      protocol: "sftp",
      host: "example.com",
      port: 22,
      username: "deploy",
      remotePath: "/var/www/html",
      uploadOnSave: true,
      ignore: [".git/**", "node_modules/**"],
    },
    null,
    2
  );
}
