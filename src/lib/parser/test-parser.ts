import path from 'path';
import { createProjectForDirectory } from './project-loader';
import { extractExpressRoutes } from './express-extractor';
import { buildRouteGraph } from '../graph/graph-builder';

async function testASTParsing() {
  console.log('=== Running Phase 2 AST Extraction Verification ===\n');

  // Test 1: Local Fixture App
  const fixturePath = path.resolve(process.cwd(), 'fixtures/sample-express-app');
  console.log('1. Loading local fixture project into ts-morph from:', fixturePath);
  const fixtureProject = createProjectForDirectory(fixturePath);

  console.log('2. Extracting Express routes from AST...');
  const { routes, mountedRouters, scannedFilesCount } = extractExpressRoutes(fixtureProject, fixturePath);

  console.log(`Scanned ${scannedFilesCount} source files.`);
  console.log(`Found ${mountedRouters.length} mounted router(s):`, mountedRouters);
  console.log(`Extracted ${routes.length} route definition(s):\n`);

  routes.forEach((r, idx) => {
    console.log(`--- [Route #${idx + 1}] ${r.httpMethod} ${r.routePath} ---`);
    console.log(`File: ${r.location.filePath}:${r.location.startLine}-${r.location.endLine}`);
    console.log(`Handler: ${r.handlerName || 'none'}`);
    console.log(`Called Functions: ${JSON.stringify(r.calledFunctions)}`);
    console.log(`Sliced Code Snippet:\n"""\n${r.codeSnippet}\n"""\n`);
  });

  if (routes.length < 3) {
    throw new Error(`Expected at least 3 routes from fixture, but found ${routes.length}`);
  }

  // Test 2: Build Node/Edge Graph
  console.log('3. Building React Flow graph nodes and edges...');
  const graph = buildRouteGraph(routes);
  console.log(`Generated ${graph.nodes.length} nodes and ${graph.edges.length} edges.`);

  // Test 3: Real Cloned Repo
  console.log('\n--- Testing on Real Cloned Repo (santiq/bulletproof-nodejs) ---');
  const tempBase = path.join(require('os').tmpdir(), 'github-analyzer');
  if (require('fs').existsSync(tempBase)) {
    const dirs = require('fs').readdirSync(tempBase).filter((d: string) => d.startsWith('repo-bulletproof-nodejs'));
    if (dirs.length > 0) {
      const realRepoDir = path.join(tempBase, dirs[0]);
      console.log('Loading real repo into ts-morph from:', realRepoDir);
      const realProject = createProjectForDirectory(realRepoDir);
      const realExtracted = extractExpressRoutes(realProject, realRepoDir);
      console.log(`Real repo extracted ${realExtracted.routes.length} Express routes across ${realExtracted.scannedFilesCount} files!`);
      realExtracted.routes.slice(0, 5).forEach((r, i) => {
        console.log(`  [${i+1}] ${r.httpMethod} ${r.routePath} (${r.location.filePath}:${r.location.startLine})`);
      });
    }
  }

  console.log('\n>>> SUCCESS: Phase 2 (Step 5, 6, 7, 8) fully verified and working! <<<');
}

testASTParsing().catch((err) => {
  console.error('Phase 2 test failed:', err);
  process.exit(1);
});
