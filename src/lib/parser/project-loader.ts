import { Project, type ProjectOptions } from 'ts-morph';
import path from 'path';
import fs from 'fs';

/**
 * Loads a repository directory into a ts-morph Project instance.
 * Automatically checks for tsconfig.json or globs source files.
 */
export function createProjectForDirectory(repoDir: string): Project {
  if (!fs.existsSync(repoDir)) {
    throw new Error(`Repository directory does not exist: ${repoDir}`);
  }

  const tsconfigPath = path.join(repoDir, 'tsconfig.json');
  const hasTsConfig = fs.existsSync(tsconfigPath);

  let project: Project;

  if (hasTsConfig) {
    try {
      project = new Project({
        tsConfigFilePath: tsconfigPath,
        skipAddingFilesFromTsConfig: false,
        compilerOptions: {
          allowJs: true,
          noEmit: true,
        },
      });
    } catch {
      // Fallback if tsconfig has syntax/inheritance errors
      project = createFallbackProject(repoDir);
    }
  } else {
    project = createFallbackProject(repoDir);
  }

  // Ensure all TS/JS files are captured even if tsconfig had narrow include rules
  const sourceFilePatterns = [
    path.join(repoDir, '**/*.ts').replace(/\\/g, '/'),
    path.join(repoDir, '**/*.js').replace(/\\/g, '/'),
    path.join(repoDir, '**/*.tsx').replace(/\\/g, '/'),
    path.join(repoDir, '**/*.jsx').replace(/\\/g, '/'),
    `!${path.join(repoDir, 'node_modules/**').replace(/\\/g, '/')}`,
    `!${path.join(repoDir, '.git/**').replace(/\\/g, '/')}`,
    `!${path.join(repoDir, 'dist/**').replace(/\\/g, '/')}`,
    `!${path.join(repoDir, 'build/**').replace(/\\/g, '/')}`,
  ];

  try {
    project.addSourceFilesAtPaths(sourceFilePatterns);
  } catch {
    // Files already added or pattern handled
  }

  return project;
}

function createFallbackProject(repoDir: string): Project {
  const options: ProjectOptions = {
    compilerOptions: {
      allowJs: true,
      checkJs: false,
      noEmit: true,
      skipLibCheck: true,
      target: 99, // ESNext
    },
  };

  const project = new Project(options);
  return project;
}
