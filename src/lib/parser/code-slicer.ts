import fs from 'fs';
import path from 'path';

/**
 * Extracts exact unmodified source code lines from a file on disk.
 * startLine and endLine are 1-indexed.
 */
export function sliceSourceLines(
  repoDir: string,
  relativeFilePath: string,
  startLine: number,
  endLine: number
): string {
  const fullPath = path.isAbsolute(relativeFilePath)
    ? relativeFilePath
    : path.join(repoDir, relativeFilePath);

  if (!fs.existsSync(fullPath)) {
    return `// Error: File not found at ${relativeFilePath}`;
  }

  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split(/\r?\n/);

    const startIdx = Math.max(0, startLine - 1);
    const endIdx = Math.min(lines.length, endLine);

    return lines.slice(startIdx, endIdx).join('\n');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return `// Error reading source file: ${msg}`;
  }
}
