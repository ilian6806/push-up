import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StatusBar } from "../status-bar";
import { mockStatusBarItem } from "./setup";

describe("StatusBar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockStatusBarItem.text = "";
    mockStatusBarItem.tooltip = "";
    mockStatusBarItem.command = undefined;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("constructor creates item, sets command, calls idle() and show()", () => {
    const bar = new StatusBar();
    expect(mockStatusBarItem.command).toBe("pushup.showOutput");
    expect(mockStatusBarItem.text).toBe("$(cloud) PushUp");
    expect(mockStatusBarItem.tooltip).toBe("PushUp — Idle");
    expect(mockStatusBarItem.show).toHaveBeenCalled();
  });

  it("idle() sets correct text and tooltip", () => {
    const bar = new StatusBar();
    bar.uploading(); // change state first
    bar.idle();
    expect(mockStatusBarItem.text).toBe("$(cloud) PushUp");
    expect(mockStatusBarItem.tooltip).toBe("PushUp — Idle");
  });

  it("uploading() sets spin icon", () => {
    const bar = new StatusBar();
    bar.uploading();
    expect(mockStatusBarItem.text).toBe("$(sync~spin) PushUp");
    expect(mockStatusBarItem.tooltip).toBe("PushUp — Uploading…");
  });

  it("success() sets check icon and auto-resets to idle after 3000ms", () => {
    const bar = new StatusBar();
    bar.success();
    expect(mockStatusBarItem.text).toBe("$(check) PushUp");
    expect(mockStatusBarItem.tooltip).toBe("PushUp — Success");

    vi.advanceTimersByTime(3000);
    expect(mockStatusBarItem.text).toBe("$(cloud) PushUp");
    expect(mockStatusBarItem.tooltip).toBe("PushUp — Idle");
  });

  it("error() sets error icon and auto-resets to idle after 5000ms", () => {
    const bar = new StatusBar();
    bar.error();
    expect(mockStatusBarItem.text).toBe("$(error) PushUp");
    expect(mockStatusBarItem.tooltip).toBe("PushUp — Error");

    vi.advanceTimersByTime(5000);
    expect(mockStatusBarItem.text).toBe("$(cloud) PushUp");
    expect(mockStatusBarItem.tooltip).toBe("PushUp — Idle");
  });

  it("uploading() after success() cancels the 3s reset timer", () => {
    const bar = new StatusBar();
    bar.success();
    bar.uploading();

    vi.advanceTimersByTime(3000);
    // Should still be uploading, not reset to idle
    expect(mockStatusBarItem.text).toBe("$(sync~spin) PushUp");
  });

  it("dispose() clears timer and disposes item", () => {
    const bar = new StatusBar();
    bar.success(); // sets a timer
    bar.dispose();

    vi.advanceTimersByTime(3000);
    // Should not have reset to idle after dispose
    expect(mockStatusBarItem.text).toBe("$(check) PushUp");
    expect(mockStatusBarItem.dispose).toHaveBeenCalled();
  });
});
