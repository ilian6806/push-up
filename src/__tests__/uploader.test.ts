import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BaseUploader, FileEntry } from "../uploader";

class TestUploader extends BaseUploader {
  connected = false;
  doConnect = vi.fn(async () => {
    this.connected = true;
  });
  doDisconnect = vi.fn(async () => {
    this.connected = false;
  });
  isConnected = vi.fn(() => this.connected);
  uploadFile = vi.fn();
  downloadFile = vi.fn();
  ensureDir = vi.fn();
  listDir = vi.fn();
}

describe("BaseUploader", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("connect() calls doConnect() when disconnected", async () => {
    const uploader = new TestUploader();
    await uploader.connect();
    expect(uploader.doConnect).toHaveBeenCalledOnce();
    expect(uploader.connected).toBe(true);
  });

  it("connect() is a no-op when already connected", async () => {
    const uploader = new TestUploader();
    uploader.connected = true;
    await uploader.connect();
    expect(uploader.doConnect).not.toHaveBeenCalled();
  });

  it("deduplicates concurrent connect() calls", async () => {
    const uploader = new TestUploader();
    // Make doConnect take some time
    uploader.doConnect.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 100));
      uploader.connected = true;
    });

    const p1 = uploader.connect();
    const p2 = uploader.connect();

    vi.advanceTimersByTime(100);
    await Promise.all([p1, p2]);

    expect(uploader.doConnect).toHaveBeenCalledOnce();
  });

  it("disconnect() calls doDisconnect() when connected", async () => {
    const uploader = new TestUploader();
    uploader.connected = true;
    await uploader.disconnect();
    expect(uploader.doDisconnect).toHaveBeenCalledOnce();
    expect(uploader.connected).toBe(false);
  });

  it("disconnect() is a no-op when not connected", async () => {
    const uploader = new TestUploader();
    await uploader.disconnect();
    expect(uploader.doDisconnect).not.toHaveBeenCalled();
  });

  it("ensureConnected() calls connect() when disconnected", async () => {
    const uploader = new TestUploader();
    await uploader.ensureConnected();
    expect(uploader.doConnect).toHaveBeenCalledOnce();
  });

  it("auto-disconnects after 30s idle timeout", async () => {
    const uploader = new TestUploader();
    await uploader.connect();
    expect(uploader.connected).toBe(true);

    vi.advanceTimersByTime(30_000);
    // Need to flush the microtask from the disconnect promise
    await vi.runAllTimersAsync();

    expect(uploader.doDisconnect).toHaveBeenCalled();
  });
});
