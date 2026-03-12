import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import { PushUpConfig } from "../config";

// Mock ssh2-sftp-client
const mockSftpClient = {
  connect: vi.fn(),
  end: vi.fn(),
  put: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
  mkdir: vi.fn(),
  list: vi.fn(),
  sftp: null as unknown,
};

vi.mock("ssh2-sftp-client", () => ({
  default: vi.fn(() => mockSftpClient),
}));

vi.mock("fs");

import { SftpUploader } from "../sftp-uploader";

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

describe("SftpUploader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSftpClient.sftp = null;
  });

  it("doConnect() calls connect with correct options", async () => {
    const config = makeConfig({ password: "secret" });
    const uploader = new SftpUploader(config, "secret");
    await uploader.doConnect();
    expect(mockSftpClient.connect).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "example.com",
        port: 22,
        username: "deploy",
        password: "secret",
      })
    );
  });

  it("doConnect() with privateKeyPath reads key file", async () => {
    const config = makeConfig({ privateKeyPath: "/home/user/.ssh/id_rsa" });
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from("key-content"));
    const uploader = new SftpUploader(config);
    await uploader.doConnect();
    expect(fs.readFileSync).toHaveBeenCalledWith("/home/user/.ssh/id_rsa");
    expect(mockSftpClient.connect).toHaveBeenCalledWith(
      expect.objectContaining({
        privateKey: Buffer.from("key-content"),
      })
    );
  });

  it("isConnected() returns true when sftp property is truthy", () => {
    const uploader = new SftpUploader(makeConfig());
    expect(uploader.isConnected()).toBe(false);
    mockSftpClient.sftp = {};
    expect(uploader.isConnected()).toBe(true);
  });

  it("uploadFile() delegates to client.put", async () => {
    const uploader = new SftpUploader(makeConfig());
    await uploader.uploadFile("/local/file.txt", "/remote/file.txt");
    expect(mockSftpClient.put).toHaveBeenCalledWith("/local/file.txt", "/remote/file.txt");
  });

  it("downloadFile() delegates to client.get", async () => {
    const uploader = new SftpUploader(makeConfig());
    await uploader.downloadFile("/remote/file.txt", "/local/file.txt");
    expect(mockSftpClient.get).toHaveBeenCalledWith("/remote/file.txt", "/local/file.txt");
  });

  it("ensureDir() delegates to client.mkdir with recursive", async () => {
    const uploader = new SftpUploader(makeConfig());
    await uploader.ensureDir("/remote/path");
    expect(mockSftpClient.mkdir).toHaveBeenCalledWith("/remote/path", true);
  });

  it("deleteFile() delegates to client.delete", async () => {
    const uploader = new SftpUploader(makeConfig());
    await uploader.deleteFile("/remote/file.txt");
    expect(mockSftpClient.delete).toHaveBeenCalledWith("/remote/file.txt");
  });

  it("listDir() maps entries correctly", async () => {
    mockSftpClient.list.mockResolvedValue([
      { name: "subdir", type: "d" },
      { name: "file.txt", type: "-" },
    ]);
    const uploader = new SftpUploader(makeConfig());
    const entries = await uploader.listDir("/remote");
    expect(entries).toEqual([
      { name: "subdir", isDirectory: true },
      { name: "file.txt", isDirectory: false },
    ]);
  });
});
