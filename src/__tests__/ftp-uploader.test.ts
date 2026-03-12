import { describe, it, expect, vi, beforeEach } from "vitest";
import { PushUpConfig } from "../config";

// Mock basic-ftp
const mockFtpClient = {
  access: vi.fn(),
  close: vi.fn(),
  uploadFrom: vi.fn(),
  downloadTo: vi.fn(),
  remove: vi.fn(),
  ensureDir: vi.fn(),
  list: vi.fn(),
  cd: vi.fn(),
  closed: true,
};

vi.mock("basic-ftp", () => ({
  Client: vi.fn(() => mockFtpClient),
}));

import { FtpUploader } from "../ftp-uploader";

function makeConfig(overrides: Partial<PushUpConfig> = {}): PushUpConfig {
  return {
    protocol: "ftp",
    host: "ftp.example.com",
    port: 21,
    username: "ftpuser",
    remotePath: "/public",
    uploadOnSave: true,
    ignore: [],
    configPath: "/project/.pushup.json",
    localRoot: "/project",
    ...overrides,
  };
}

describe("FtpUploader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFtpClient.closed = true;
  });

  it("doConnect() calls client.access with correct options", async () => {
    const config = makeConfig({ password: "pass123" });
    const uploader = new FtpUploader(config, "pass123");
    await uploader.doConnect();
    expect(mockFtpClient.access).toHaveBeenCalledWith({
      host: "ftp.example.com",
      port: 21,
      user: "ftpuser",
      password: "pass123",
    });
  });

  it("isConnected() returns !client.closed", () => {
    const uploader = new FtpUploader(makeConfig());
    expect(uploader.isConnected()).toBe(false);
    mockFtpClient.closed = false;
    expect(uploader.isConnected()).toBe(true);
  });

  it("uploadFile() calls ensureDir then uploadFrom", async () => {
    const uploader = new FtpUploader(makeConfig());
    await uploader.uploadFile("/local/file.txt", "/public/sub/file.txt");
    expect(mockFtpClient.ensureDir).toHaveBeenCalledWith("/public/sub");
    expect(mockFtpClient.uploadFrom).toHaveBeenCalledWith("/local/file.txt", "/public/sub/file.txt");
  });

  it("ensureDir() calls client.ensureDir then cd('/')", async () => {
    const uploader = new FtpUploader(makeConfig());
    await uploader.ensureDir("/public/path");
    expect(mockFtpClient.ensureDir).toHaveBeenCalledWith("/public/path");
    expect(mockFtpClient.cd).toHaveBeenCalledWith("/");
  });

  it("downloadFile() delegates to client.downloadTo", async () => {
    const uploader = new FtpUploader(makeConfig());
    await uploader.downloadFile("/remote/file.txt", "/local/file.txt");
    expect(mockFtpClient.downloadTo).toHaveBeenCalledWith("/local/file.txt", "/remote/file.txt");
  });

  it("deleteFile() delegates to client.remove", async () => {
    const uploader = new FtpUploader(makeConfig());
    await uploader.deleteFile("/public/file.txt");
    expect(mockFtpClient.remove).toHaveBeenCalledWith("/public/file.txt");
  });

  it("listDir() maps type 2 to isDirectory: true", async () => {
    mockFtpClient.list.mockResolvedValue([
      { name: "subdir", type: 2 },
      { name: "file.txt", type: 1 },
    ]);
    const uploader = new FtpUploader(makeConfig());
    const entries = await uploader.listDir("/public");
    expect(entries).toEqual([
      { name: "subdir", isDirectory: true },
      { name: "file.txt", isDirectory: false },
    ]);
  });
});
