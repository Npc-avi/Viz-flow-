import { NextRequest, NextResponse } from 'next/server';
import { getRepoDirectory } from '@/lib/git/clone';
import { inspectRepoFiles } from '@/lib/git/file-tree';
import { createProjectForDirectory } from '@/lib/parser/project-loader';
import { extractUniversalRoutes } from '@/lib/parser/multi-language/universal-extractor';
import { buildRouteGraph } from '@/lib/graph/graph-builder';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { repoId } = body;

    if (!repoId || typeof repoId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Repository session ID (repoId) is required.' },
        { status: 400 }
      );
    }

    const repoDir = getRepoDirectory(repoId);
    if (!repoDir) {
      return NextResponse.json(
        { success: false, error: `Repository directory for session "${repoId}" not found or expired.` },
        { status: 404 }
      );
    }

    // Inspect files to determine languages and source files
    const fileTree = inspectRepoFiles(repoDir);

    // If TS/JS files are present, initialize ts-morph project
    let tsProject;
    if (fileTree.hasTypeScript || fileTree.sourceFiles.some((f) => f.endsWith('.js') || f.endsWith('.ts'))) {
      try {
        tsProject = createProjectForDirectory(repoDir);
      } catch {
        // Fallback to pattern matcher if project fails to load
      }
    }

    // Step 5 & 6 (Multi-language): Extract routes across TS/JS, Python, Go, Java, Rust
    const extraction = extractUniversalRoutes(repoDir, fileTree.sourceFiles, tsProject);

    // Step 13: Handle parsing failures gracefully
    if (extraction.routes.length === 0) {
      return NextResponse.json({
        success: true,
        empty: true,
        language: extraction.language,
        framework: extraction.framework,
        scannedFilesCount: extraction.scannedFilesCount,
        message: `Couldn't detect backend route handlers in this repository. We scanned ${fileTree.sourceFiles.length} source files (${extraction.language || 'unknown language'}). Supported patterns include Express.js, FastAPI, Flask, Gin, Spring Boot, and Actix/Axum.`,
        graph: {
          nodes: [],
          edges: [],
          stats: { totalRoutes: 0, methodsCount: {}, filesCount: fileTree.sourceFiles.length },
        },
      });
    }

    // Step 7: Build connected hierarchical graph with Dagre
    const graph = buildRouteGraph(extraction.routes, `${extraction.framework}`);

    return NextResponse.json({
      success: true,
      empty: false,
      repoId,
      language: extraction.language,
      framework: extraction.framework,
      scannedFilesCount: extraction.scannedFilesCount,
      graph,
      rawRoutes: extraction.routes,
      totalRoutes: extraction.routes.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown AST parsing error occurred';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
