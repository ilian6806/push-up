import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Logger } from "../logger";
import { mockOutputChannel } from "./setup";

describe("Logger", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00.000Z"));
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates an output channel named PushUp", async () => {
    const vscode = await import("vscode");
    new Logger();
    expect(vscode.window.createOutputChannel).toHaveBeenCalledWith("PushUp");
  });

  it("info() appends line with INFO level", () => {
    const logger = new Logger();
    logger.info("test message");
    expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
      "[2025-01-15T12:00:00.000Z] [INFO] test message"
    );
  });

  it("warn() appends line with WARN level", () => {
    const logger = new Logger();
    logger.warn("warning message");
    expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
      "[2025-01-15T12:00:00.000Z] [WARN] warning message"
    );
  });

  it("error() appends line with ERROR level", () => {
    const logger = new Logger();
    logger.error("error message");
    expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
      "[2025-01-15T12:00:00.000Z] [ERROR] error message"
    );
  });

  it("show() calls channel.show()", () => {
    const logger = new Logger();
    logger.show();
    expect(mockOutputChannel.show).toHaveBeenCalled();
  });

  it("dispose() calls channel.dispose()", () => {
    const logger = new Logger();
    logger.dispose();
    expect(mockOutputChannel.dispose).toHaveBeenCalled();
  });
});
