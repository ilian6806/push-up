import * as fs from "fs";
import * as path from "path";
import { PushUpConfig } from "./config";
import { IgnoreChecker } from "./ignore";
import { IUploader } from "./uploader";

export function toRemotePath(localPath: string, config: PushUpConfig): string {
  const relative = path.relative(config.localRoot, localPath);
  const normalized = relative.replace(/\\/g, "/");
  const remote = config.remotePath.replace(/\/+$/, "") + "/" + normalized;
  return remote;
}

export function toLocalPath(remotePath: string, config: PushUpConfig): string {
  const remoteBase = config.remotePath.replace(/\/+$/, "");
  const relative = remotePath.startsWith(remoteBase)
    ? remotePath.slice(remoteBase.length + 1)
    : remotePath;
  return path.join(config.localRoot, relative);
}

export function toRelativePath(localPath: string, config: PushUpConfig): string {
  const relative = path.relative(config.localRoot, localPath);
  return relative.replace(/\\/g, "/");
}

export function collectFiles(dir: string, config: PushUpConfig, checker: IgnoreChecker): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relative = toRelativePath(fullPath, config);
    if (checker.isIgnored(relative)) {
      continue;
    }
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath, config, checker));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

export async function collectRemoteFiles(uploader: IUploader, remotePath: string): Promise<string[]> {
  const results: string[] = [];
  const entries = await uploader.listDir(remotePath);
  for (const entry of entries) {
    const fullRemote = remotePath.replace(/\/+$/, "") + "/" + entry.name;
    if (entry.isDirectory) {
      results.push(...(await collectRemoteFiles(uploader, fullRemote)));
    } else {
      results.push(fullRemote);
    }
  }
  return results;
}
