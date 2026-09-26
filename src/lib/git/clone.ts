import { simpleGit, SimpleGit, SimpleGitOptions } from 'simple-git';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';

export interface CloneResult {
  repoId: string;
  repoName: string;
  targetDir: string;
  cloneDurationMs: number;
}

/**
 * Validates and extracts repo details from a GitHub URL
 */
export function parseGitHubUrl(rawUrl: string): { owner: string; name: string; cleanUrl: string } {
  const trimmed = rawUrl.trim();
  
  // Support standard HTTPS GitHub URLs: https://github.com/owner/repo(.git)?
  const match = trimmed.match(/^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/#?]+?)(?:\.git)?$/i);
  if (!match) {
    throw new Error('Please enter a valid public GitHub URL (e.g., https://github.com/owner/repository)');
  }

  const owner = match[1];
  const name = match[2];
  const cleanUrl = `https://github.com/${owner}/${name}.git`;

  return { owner, name, cleanUrl };
}

/**
 * Clones a public repository into a safe temporary directory
 */
export async function cloneRepository(repoUrl: string): Promise<CloneResult> {
  const { name, cleanUrl } = parseGitHubUrl(repoUrl);
  
  // Unique deterministic/random ID for this clone session
  const randomSuffix = crypto.randomBytes(4).toString('hex');
  const repoId = `repo-${name.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}-${randomSuffix}`;
  
  const baseTempDir = path.join(os.tmpdir(), 'github-analyzer');
  if (!fs.existsSync(baseTempDir)) {
    fs.mkdirSync(baseTempDir, { recursive: true });
  }

  const targetDir = path.join(baseTempDir, repoId);

  const gitOptions: Partial<SimpleGitOptions> = {
    baseDir: baseTempDir,
    binary: 'git',
    maxConcurrentProcesses: 4,
    timeout: {
      block: 60000, // 60s timeout
    },
  };

  const git: SimpleGit = simpleGit(gitOptions);

  const startTime = Date.now();

  try {
    // Perform shallow clone (--depth 1) for speed and resource efficiency
    await git.clone(cleanUrl, targetDir, ['--depth', '1', '--single-branch']);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // Cleanup if partially cloned
    if (fs.existsSync(targetDir)) {
      try {
        fs.rmSync(targetDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup error
      }
    }
    throw new Error(`Failed to clone repository: ${message}`);
  }

  const cloneDurationMs = Date.now() - startTime;

  return {
    repoId,
    repoName: name,
    targetDir,
    cloneDurationMs,
  };
}

/**
 * Resolves repository directory by repoId from temp directory or fixtures
 */
export function getRepoDirectory(repoId: string): string | null {
  // Check if it's the offline fixture
  if (repoId === 'fixture-sample-express-app') {
    const fixturePath = path.resolve(process.cwd(), 'fixtures/sample-express-app');
    if (fs.existsSync(fixturePath)) {
      return fixturePath;
    }
  }

  const baseTempDir = path.join(os.tmpdir(), 'github-analyzer');
  const targetDir = path.join(baseTempDir, repoId);
  if (fs.existsSync(targetDir)) {
    return targetDir;
  }

  return null;
}
