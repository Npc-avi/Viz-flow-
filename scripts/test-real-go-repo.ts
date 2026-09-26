import path from 'path';
import { inspectRepoFiles } from '../src/lib/git/file-tree';
import { extractUniversalRoutes } from '../src/lib/parser/multi-language/universal-extractor';

async function testRealGo() {
  const repoDir = path.join(process.env.TEMP || '', 'github-analyzer', 'repo-golang-gin-realworld-example-app-6504576a');
  console.log('Testing on real repo:', repoDir);
  const fileTree = inspectRepoFiles(repoDir);
  const goFiles = fileTree.sourceFiles.filter(f => f.endsWith('.go'));
  console.log('Go files count:', goFiles.length);

  const res = await extractUniversalRoutes(repoDir, fileTree.sourceFiles);
  console.log('Language detected:', res.language);
  console.log('Framework detected:', res.framework);
  console.log('Routes detected count:', res.routes.length);
  for (const r of res.routes) {
    console.log(`[${r.httpMethod}] ${r.routePath} -> ${r.handlerName} (${r.location.filePath}:${r.location.startLine})`);
    if (r.calledFunctions.length > 0) {
      console.log('   Calls:', r.calledFunctions);
    }
  }
}

testRealGo().catch((err) => {
  console.error(err);
  process.exit(1);
});
