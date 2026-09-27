import fs from 'fs';
import path from 'path';
import { Parser, Language } from '@vscode/tree-sitter-wasm';

let isParserInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Resolves the absolute directory path containing tree-sitter.wasm and language wasm files.
 * Handles Next.js / Turbopack virtual path tokens ([project]) and falls back to public/treesitter.
 */
export function getWasmDir(): string {
  // 1. Direct project node_modules path
  const nodeModulesPath = path.join(process.cwd(), 'node_modules', '@vscode', 'tree-sitter-wasm', 'wasm');
  if (fs.existsSync(nodeModulesPath) && fs.existsSync(path.join(nodeModulesPath, 'tree-sitter.wasm'))) {
    return nodeModulesPath;
  }

  // 2. Next.js public directory
  const publicPath = path.join(process.cwd(), 'public', 'treesitter');
  if (fs.existsSync(publicPath) && fs.existsSync(path.join(publicPath, 'tree-sitter.wasm'))) {
    return publicPath;
  }

  // 3. require.resolve with [project] stripping
  try {
    const rawPath = path.dirname(require.resolve('@vscode/tree-sitter-wasm'));
    const sanitized = rawPath.replace(/[\\/]\[project\]/g, '');
    if (fs.existsSync(sanitized) && fs.existsSync(path.join(sanitized, 'tree-sitter.wasm'))) {
      return sanitized;
    }
    if (fs.existsSync(rawPath) && fs.existsSync(path.join(rawPath, 'tree-sitter.wasm'))) {
      return rawPath;
    }
  } catch {}

  return nodeModulesPath;
}

/**
 * Ensures Parser.init() is called exactly once with correct WASM file location
 */
export async function ensureTreeSitterInitialized(): Promise<string> {
  const wasmDir = getWasmDir();

  if (isParserInitialized) {
    return wasmDir;
  }

  if (initPromise) {
    await initPromise;
    return wasmDir;
  }

  initPromise = (async () => {
    await Parser.init({
      locateFile(scriptName: string) {
        return path.join(wasmDir, scriptName);
      },
    });
    isParserInitialized = true;
  })();

  await initPromise;
  return wasmDir;
}

/**
 * Loads a language WASM by name (e.g. 'tree-sitter-go.wasm', 'tree-sitter-python.wasm')
 */
export async function loadLanguageWasm(wasmFileName: string): Promise<Language> {
  const wasmDir = await ensureTreeSitterInitialized();
  let wasmPath = path.join(wasmDir, wasmFileName);

  if (!fs.existsSync(wasmPath)) {
    // Check fallback in public/treesitter
    const publicFallback = path.join(process.cwd(), 'public', 'treesitter', wasmFileName);
    if (fs.existsSync(publicFallback)) {
      wasmPath = publicFallback;
    }
  }

  return await Language.load(wasmPath);
}
