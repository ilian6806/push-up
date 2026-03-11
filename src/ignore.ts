import picomatch from "picomatch";

export class IgnoreChecker {
  private matcher: picomatch.Matcher;

  constructor(patterns: string[]) {
    this.matcher = picomatch(patterns, { dot: true });
  }

  isIgnored(relativePath: string): boolean {
    // Normalize backslashes to forward slashes for cross-platform support
    const normalized = relativePath.replace(/\\/g, "/");
    return this.matcher(normalized);
  }
}
