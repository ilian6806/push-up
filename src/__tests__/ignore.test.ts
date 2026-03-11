import { describe, it, expect } from "vitest";
import { IgnoreChecker } from "../ignore";

describe("IgnoreChecker", () => {
  it("matches a single glob pattern", () => {
    const checker = new IgnoreChecker(["*.log"]);
    expect(checker.isIgnored("error.log")).toBe(true);
    expect(checker.isIgnored("info.log")).toBe(true);
    expect(checker.isIgnored("readme.md")).toBe(false);
  });

  it("matches directory glob for nested files", () => {
    const checker = new IgnoreChecker(["node_modules/**"]);
    expect(checker.isIgnored("node_modules/pkg/index.js")).toBe(true);
    expect(checker.isIgnored("node_modules/a/b/c.js")).toBe(true);
    expect(checker.isIgnored("src/index.js")).toBe(false);
  });

  it("matches dot-files with dot: true", () => {
    const checker = new IgnoreChecker([".*"]);
    expect(checker.isIgnored(".env")).toBe(true);
    expect(checker.isIgnored(".gitignore")).toBe(true);
    expect(checker.isIgnored("file.txt")).toBe(false);
  });

  it("normalizes backslashes to forward slashes", () => {
    const checker = new IgnoreChecker(["path/to/**"]);
    expect(checker.isIgnored("path\\to\\file.txt")).toBe(true);
    expect(checker.isIgnored("path\\to\\deep\\file.js")).toBe(true);
  });

  it("supports multiple patterns", () => {
    const checker = new IgnoreChecker(["*.log", "dist/**", ".env"]);
    expect(checker.isIgnored("error.log")).toBe(true);
    expect(checker.isIgnored("dist/bundle.js")).toBe(true);
    expect(checker.isIgnored(".env")).toBe(true);
    expect(checker.isIgnored("src/index.ts")).toBe(false);
  });

  it("ignores nothing with empty patterns", () => {
    const checker = new IgnoreChecker([]);
    expect(checker.isIgnored("anything.txt")).toBe(false);
    expect(checker.isIgnored("node_modules/pkg/index.js")).toBe(false);
  });
});
