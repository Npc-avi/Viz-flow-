import path from 'path';
import fs from 'fs';
import { inspectRepoFiles } from '../src/lib/git/file-tree';
import { extractUniversalRoutes } from '../src/lib/parser/multi-language/universal-extractor';
import { buildRouteGraph } from '../src/lib/graph/graph-builder';

async function runPythonTests() {
  console.log('=== Running Python Tree-sitter AST Extractor Test ===\n');

  // Test 1: Real-world FastAPI repo if present in Temp
  const tempDir = process.env.TEMP || '';
  const fastapiRepoDir = path.join(tempDir, 'github-analyzer', 'repo-full-stack-fastapi-template-7ef72a27');

  if (fs.existsSync(fastapiRepoDir)) {
    console.log('1. Testing on real-world repo: full-stack-fastapi-template');
    const fileTree = inspectRepoFiles(fastapiRepoDir);
    const extraction = await extractUniversalRoutes(fastapiRepoDir, fileTree.sourceFiles);

    console.log('Language detected:', extraction.language);
    console.log('Framework detected:', extraction.framework);
    console.log('Total routes extracted:', extraction.routes.length);

    console.log('\nSample extracted routes:');
    extraction.routes.slice(0, 10).forEach((r) => {
      console.log(`[${r.httpMethod}] ${r.routePath} -> ${r.handlerName} (${r.location.filePath}:${r.location.startLine})`);
      if (r.calledFunctions.length > 0) {
        console.log(`   Calls:`, r.calledFunctions);
      }
    });

    if (extraction.routes.length === 0) {
      throw new Error('Failed to extract routes from full-stack-fastapi-template');
    }

    const graph = buildRouteGraph(extraction.routes);
    console.log(`\nGenerated React Flow Graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges.`);
    console.log('✅ Real-world FastAPI test passed!\n');
  }

  // Test 2: Synthetic multi-framework Python test
  const sampleDir = path.resolve(process.cwd(), 'fixtures/sample-python-app');
  if (fs.existsSync(sampleDir)) {
    console.log('2. Testing on fixtures/sample-python-app');
    const fileTree = inspectRepoFiles(sampleDir);
    const extraction = await extractUniversalRoutes(sampleDir, fileTree.sourceFiles);

    console.log('Language detected:', extraction.language);
    console.log('Framework detected:', extraction.framework);
    console.log('Total routes extracted:', extraction.routes.length);

    extraction.routes.forEach((r) => {
      console.log(`[${r.httpMethod}] ${r.routePath} -> ${r.handlerName} (${r.location.filePath}:${r.location.startLine})`);
      console.log('   Calls:', r.calledFunctions);
    });
    console.log('✅ Fixture test passed!\n');
  }

  console.log('🎉 ALL PYTHON TREE-SITTER TESTS PASSED!');
}

runPythonTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
