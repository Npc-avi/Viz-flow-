import { NextRequest, NextResponse } from 'next/server';
import { getRepoDirectory } from '@/lib/git/clone';
import { createProjectForDirectory } from '@/lib/parser/project-loader';
import { extractExpressRoutes } from '@/lib/parser/express-extractor';
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

    // Step 5: Load repository into ts-morph Project
    const project = createProjectForDirectory(repoDir);

    // Step 6 & 8: Find Express route definitions & slice source lines
    const { routes, mountedRouters, scannedFilesCount } = extractExpressRoutes(project, repoDir);

    // Step 7: Build nodes and edges data structure
    const graph = buildRouteGraph(routes);

    return NextResponse.json({
      success: true,
      repoId,
      scannedFilesCount,
      mountedRouters,
      graph,
      rawRoutes: routes,
      totalRoutes: routes.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown AST parsing error occurred';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
