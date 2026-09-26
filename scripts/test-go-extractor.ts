import path from 'path';
import { inspectRepoFiles } from '../src/lib/git/file-tree';
import { extractUniversalRoutes } from '../src/lib/parser/multi-language/universal-extractor';
import { buildRouteGraph } from '../src/lib/graph/graph-builder';

async function runTest() {
  const sampleDir = path.resolve(process.cwd(), 'fixtures/sample-go-app');
  console.log('--- Testing Go Tree-sitter Extractor on Fixture ---');
  console.log('Repo directory:', sampleDir);

  const fileTree = inspectRepoFiles(sampleDir);
  console.log('Source files found:', fileTree.sourceFiles);

  const extraction = await extractUniversalRoutes(sampleDir, fileTree.sourceFiles);
  console.log('\n--- Extraction Results ---');
  console.log('Language detected:', extraction.language);
  console.log('Framework detected:', extraction.framework);
  console.log('Total routes found:', extraction.routes.length);

  for (const r of extraction.routes) {
    console.log(`\n[${r.httpMethod}] ${r.routePath}`);
    console.log(`  Handler: ${r.handlerName}`);
    console.log(`  Location: ${r.location.filePath}:${r.location.startLine}-${r.location.endLine}`);
    console.log(`  Called Functions:`, r.calledFunctions);
    console.log(`  Code Snippet:\n  ` + r.codeSnippet.replace(/\n/g, '\n  '));
  }

  // Verify Graph Construction
  console.log('\n--- Building React Flow Graph ---');
  const graph = buildRouteGraph(extraction.routes);
  console.log(`Generated ${graph.nodes.length} nodes and ${graph.edges.length} edges.`);
  console.log('Method stats:', graph.stats.methodsCount);

  // Assertions
  if (extraction.routes.length < 8) {
    throw new Error(`Expected at least 8 routes, got ${extraction.routes.length}`);
  }

  // Check group prefixes
  const usersRoute = extraction.routes.find((r) => r.routePath === '/api/v1/users' && r.httpMethod === 'GET');
  if (!usersRoute) {
    throw new Error('Failed to find group-prefixed route /api/v1/users (GET)');
  }
  console.log('\n✅ Group prefix resolution verified: /api/v1/users found!');

  const ordersRoute = extraction.routes.find((r) => r.routePath === '/fiber/orders/checkout' && r.httpMethod === 'POST');
  if (!ordersRoute) {
    throw new Error('Failed to find Fiber group-prefixed route /fiber/orders/checkout');
  }
  console.log('✅ Fiber group prefix resolution verified: /fiber/orders/checkout found!');

  const inlinePingRoute = extraction.routes.find((r) => r.routePath === '/fiber/ping');
  if (!inlinePingRoute || !inlinePingRoute.calledFunctions.includes('trackMetric')) {
    throw new Error('Failed to extract called function from inline closure in /fiber/ping');
  }
  console.log('✅ Inline closure AST extraction verified: trackMetric detected inside closure!');

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
}

runTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
