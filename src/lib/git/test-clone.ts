import { cloneRepository } from './clone';
import { inspectRepoFiles } from './file-tree';
import path from 'path';

async function runSanityTest() {
  console.log('--- Testing Step 4 Sanity Check with Local Fixture ---');
  const fixturePath = path.resolve(process.cwd(), 'fixtures/sample-express-app');
  const fixtureSanity = inspectRepoFiles(fixturePath);
  console.log('Fixture Files Detected:', fixtureSanity.totalFiles);
  console.log('Source Files:', fixtureSanity.sourceFiles);
  console.log('Is Readable on Disk:', fixtureSanity.isReadable);
  console.log('Has TypeScript:', fixtureSanity.hasTypeScript);
  console.log('Has Express:', fixtureSanity.hasExpressDependency);

  if (!fixtureSanity.isReadable || fixtureSanity.sourceFiles.length === 0) {
    throw new Error('Local fixture sanity check failed!');
  }

  console.log('\n--- Testing Step 3 & 4 with Live Public Repo Clone ---');
  const testRepo = 'https://github.com/santiq/bulletproof-nodejs';
  console.log(`Cloning test repo: ${testRepo}...`);
  const cloneResult = await cloneRepository(testRepo);
  console.log(`Cloned to: ${cloneResult.targetDir} in ${cloneResult.cloneDurationMs}ms`);

  const repoSanity = inspectRepoFiles(cloneResult.targetDir);
  console.log(`Total files cloned: ${repoSanity.totalFiles}`);
  console.log(`Source files detected: ${repoSanity.sourceFiles.length}`);
  console.log(`Sample source files:`, repoSanity.sourceFiles.slice(0, 8));
  console.log(`Is disk readable: ${repoSanity.isReadable}`);
  console.log(`Has TypeScript: ${repoSanity.hasTypeScript}`);
  console.log(`Has Express: ${repoSanity.hasExpressDependency}`);

  if (!repoSanity.isReadable || repoSanity.sourceFiles.length === 0) {
    throw new Error('Live repo clone sanity check failed!');
  }

  console.log('\n>>> SUCCESS: Phase 1 (Step 3 & Step 4) fully verified and working! <<<');
}

runSanityTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
