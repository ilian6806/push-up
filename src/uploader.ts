export interface FileEntry {
  name: string;
  isDirectory: boolean;
}

export interface IUploader {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  uploadFile(localPath: string, remotePath: string): Promise<void>;
  downloadFile(remotePath: string, localPath: string): Promise<void>;
  deleteFile(remotePath: string): Promise<void>;
  ensureDir(remotePath: string): Promise<void>;
  listDir(remotePath: string): Promise<FileEntry[]>;
}

const IDLE_TIMEOUT = 30_000;

export abstract class BaseUploader implements IUploader {
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  private connectPromise: Promise<void> | undefined;

  abstract doConnect(): Promise<void>;
  abstract doDisconnect(): Promise<void>;
  abstract isConnected(): boolean;
  abstract uploadFile(localPath: string, remotePath: string): Promise<void>;
  abstract downloadFile(remotePath: string, localPath: string): Promise<void>;
  abstract deleteFile(remotePath: string): Promise<void>;
  abstract ensureDir(remotePath: string): Promise<void>;
  abstract listDir(remotePath: string): Promise<FileEntry[]>;

  async connect(): Promise<void> {
    this.resetIdleTimer();
    if (this.isConnected()) {
      return;
    }
    // Deduplicate concurrent connect calls
    if (this.connectPromise) {
      return this.connectPromise;
    }
    this.connectPromise = this.doConnect().finally(() => {
      this.connectPromise = undefined;
    });
    return this.connectPromise;
  }

  async disconnect(): Promise<void> {
    this.clearIdleTimer();
    if (this.isConnected()) {
      await this.doDisconnect();
    }
  }

  async ensureConnected(): Promise<void> {
    this.resetIdleTimer();
    if (!this.isConnected()) {
      await this.connect();
    }
  }

  protected resetIdleTimer(): void {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      this.disconnect().catch(() => {});
    }, IDLE_TIMEOUT);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer !== undefined) {
      clearTimeout(this.idleTimer);
      this.idleTimer = undefined;
    }
  }
}
