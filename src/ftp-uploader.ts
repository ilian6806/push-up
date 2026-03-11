import * as path from "path";
import { Client as FtpClient } from "basic-ftp";
import { BaseUploader, FileEntry } from "./uploader";
import { PushUpConfig } from "./config";

export class FtpUploader extends BaseUploader {
  private client: FtpClient;
  private config: PushUpConfig;
  private password: string | undefined;

  constructor(config: PushUpConfig, password?: string) {
    super();
    this.client = new FtpClient();
    this.config = config;
    this.password = password;
  }

  async doConnect(): Promise<void> {
    await this.client.access({
      host: this.config.host,
      port: this.config.port,
      user: this.config.username,
      password: this.config.password ?? this.password ?? "",
    });
  }

  async doDisconnect(): Promise<void> {
    this.client.close();
  }

  isConnected(): boolean {
    return !this.client.closed;
  }

  async uploadFile(localPath: string, remotePath: string): Promise<void> {
    this.resetIdleTimer();
    const dir = path.posix.dirname(remotePath);
    await this.ensureDir(dir);
    await this.client.uploadFrom(localPath, remotePath);
  }

  async downloadFile(remotePath: string, localPath: string): Promise<void> {
    this.resetIdleTimer();
    await this.client.downloadTo(localPath, remotePath);
  }

  async ensureDir(remotePath: string): Promise<void> {
    this.resetIdleTimer();
    await this.client.ensureDir(remotePath);
    // basic-ftp changes cwd as side effect of ensureDir — reset to root
    await this.client.cd("/");
  }

  async listDir(remotePath: string): Promise<FileEntry[]> {
    this.resetIdleTimer();
    const entries = await this.client.list(remotePath);
    return entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.type === 2,
    }));
  }
}
