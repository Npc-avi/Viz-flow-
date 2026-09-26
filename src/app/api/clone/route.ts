import { NextRequest, NextResponse } from 'next/server';
import { cloneRepository } from '@/lib/git/clone';
import { inspectRepoFiles } from '@/lib/git/file-tree';
import path from 'path';
import fs from 'fs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { repoUrl } = body;

    if (!repoUrl || typeof repoUrl !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Repository URL is required.' },
        { status: 400 }
      );
    }

    const trimmedUrl = repoUrl.trim();

    // Check for offline test fixture
    if (trimmedUrl === 'fixture:sample-express-app' || trimmedUrl === 'local:sample-express-app') {
      const fixtureDir = path.resolve(process.cwd(), 'fixtures/sample-express-app');
      if (!fs.existsSync(fixtureDir)) {
        return NextResponse.json(
          { success: false, error: 'Local test fixture not found.' },
          { status: 404 }
        );
      }

      const sanity = inspectRepoFiles(fixtureDir);

      return NextResponse.json({
        success: true,
        repoId: 'fixture-sample-express-app',
        repoName: 'sample-express-app (Local Fixture)',
        cloneDurationMs: 0,
        ...sanity,
      });
    }

    // Step 3: Clone public GitHub repository into a temp folder
    const cloneResult = await cloneRepository(trimmedUrl);

    // Step 4: Sanity check - confirm files are readable on disk and log file list
    const sanity = inspectRepoFiles(cloneResult.targetDir);

    if (!sanity.isReadable) {
      return NextResponse.json(
        {
          success: false,
          error: 'Sanity check failed: Cloned files could not be read from disk.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      repoId: cloneResult.repoId,
      repoName: cloneResult.repoName,
      cloneDurationMs: cloneResult.cloneDurationMs,
      ...sanity,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown cloning error occurred';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
