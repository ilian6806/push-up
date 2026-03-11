import * as fs from "fs";
import SftpClient from "ssh2-sftp-client";
import { BaseUploader, FileEntry } from "./uploader";
import { PushUpConfig } from "./config";

export class SftpUploader extends BaseUploader {
  private client: SftpClient;
  private config: PushUpConfig;
  private password: string | undefined;

  constructor(config: PushUpConfig, password?: string) {
    super();
    this.client = new SftpClient();
    this.config = config;
    this.password = password;
  }

  async doConnect(): Promise<void> {
    const options: SftpClient.ConnectOptions = {
      host: this.config.host,
      port: this.config.port,
      username: this.config.username,
      readyTimeout: 10_000,
    };

    if (this.config.privateKeyPath) {
      options.privateKey = fs.readFileSync(this.config.privateKeyPath);
      if (this.config.passphrase) {
        options.passphrase = this.config.passphrase;
      } else if (this.password) {
        options.passphrase = this.password;
      }
    } else {
      options.password = this.config.password ?? this.password;
    }

    await this.client.connect(options);
  }

  async doDisconnect(): Promise<void> {
    await this.client.end();
  }

  isConnected(): boolean {
    return !!(this.client as unknown as Record<string, unknown>).sftp;
  }

  async uploadFile(localPath: string, remotePath: string): Promise<void> {
    this.resetIdleTimer();
    await this.client.put(localPath, remotePath);
  }

  async downloadFile(remotePath: string, localPath: string): Promise<void> {
    this.resetIdleTimer();
    await this.client.get(remotePath, localPath);
  }

  async ensureDir(remotePath: string): Promise<void> {
    this.resetIdleTimer();
    await this.client.mkdir(remotePath, true);
  }

  async listDir(remotePath: string): Promise<FileEntry[]> {
    this.resetIdleTimer();
    const entries = await this.client.list(remotePath);
    return entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.type === "d",
    }));
  }
}
