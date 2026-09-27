import fs from 'fs';
import path from 'path';

export interface FileTreeSanityCheck {
  totalFiles: number;
  sourceFiles: string[];
  allFiles: string[];
  isReadable: boolean;
  hasTypeScript: boolean;
  hasPackageJson: boolean;
  hasExpressDependency: boolean;
}

const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'out',
  '.next',
  'coverage',
  '.github',
  '.vscode',
  '.idea',
  'frontend',
  'client',
  'docs',
  'documentation',
  'vendor',
  'migrations',
  'static',
  'assets',
  'public',
  'tests',
  'test',
  'spec',
  'venv',
  '.venv',
  'env',
  '.env',
  '__pycache__',
  'target',
  'bin',
  'obj',
  '.turbo',
  '.cache',
  'storybook-static',
]);

const SOURCE_EXTENSIONS = new Set([
  '.ts', '.js', '.tsx', '.jsx', '.mjs', '.cjs',
  '.py', '.pyw',
  '.go',
  '.java', '.kt',
  '.rs',
  '.rb',
  '.php',
  '.cs',
]);

/**
 * Traverses a repository directory, checks readability, and collects file paths
 */
export function inspectRepoFiles(repoDir: string): FileTreeSanityCheck {
  if (!fs.existsSync(repoDir)) {
    throw new Error(`Directory does not exist: ${repoDir}`);
  }

  const allFiles: string[] = [];
  const sourceFiles: string[] = [];
  let hasTypeScript = false;
  let hasPackageJson = false;
  let hasExpressDependency = false;

  function traverse(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          traverse(path.join(currentDir, entry.name));
        }
      } else if (entry.isFile()) {
        const fullPath = path.join(currentDir, entry.name);
        const relativePath = path.relative(repoDir, fullPath).replace(/\\/g, '/');
        
        allFiles.push(relativePath);

        const ext = path.extname(entry.name).toLowerCase();
        if (SOURCE_EXTENSIONS.has(ext)) {
          sourceFiles.push(relativePath);
          if (ext === '.ts' || ext === '.tsx') {
            hasTypeScript = true;
          }
        }

        if (entry.name === 'package.json') {
          hasPackageJson = true;
          try {
            const pkgContent = fs.readFileSync(fullPath, 'utf-8');
            const pkgJson = JSON.parse(pkgContent);
            const deps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
            if (deps && deps['express']) {
              hasExpressDependency = true;
            }
          } catch {
            // Ignore parse errors in package.json
          }
        }
      }
    }
  }

  traverse(repoDir);

  // Sanity check readability on a sample source file if present
  let isReadable = true;
  if (sourceFiles.length > 0) {
    try {
      const sampleFile = path.join(repoDir, sourceFiles[0]);
      fs.readFileSync(sampleFile, 'utf-8');
    } catch {
      isReadable = false;
    }
  }

  return {
    totalFiles: allFiles.length,
    sourceFiles,
    allFiles,
    isReadable,
    hasTypeScript,
    hasPackageJson,
    hasExpressDependency,
  };
}
