import * as path from "path";
import { PushUpConfig } from "./config";

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
