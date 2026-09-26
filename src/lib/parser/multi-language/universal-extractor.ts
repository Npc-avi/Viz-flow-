import fs from 'fs';
import path from 'path';
import { ExtractedRouteNode, HttpMethod } from '../../types/ast';
import { sliceSourceLines } from '../code-slicer';
import { Project } from 'ts-morph';
import { extractExpressRoutes } from '../express-extractor';
import { extractGoRoutesTreeSitter } from '../treesitter/go-extractor';

export type DetectedLanguage = 'typescript' | 'javascript' | 'python' | 'go' | 'java' | 'rust' | 'polyglot' | 'unknown';

export interface MultiLangExtractionResult {
  language: DetectedLanguage;
  framework: string;
  routes: ExtractedRouteNode[];
  scannedFilesCount: number;
}

/**
 * Accurately detects primary repository language by comparing total source file counts
 */
export function detectRepoLanguage(sourceFiles: string[]): DetectedLanguage {
  const counts: Record<DetectedLanguage, number> = {
    typescript: 0,
    javascript: 0,
    python: 0,
    go: 0,
    java: 0,
    rust: 0,
    polyglot: 0,
    unknown: 0,
  };

  for (const f of sourceFiles) {
    const ext = path.extname(f).toLowerCase();
    if (ext === '.ts' || ext === '.tsx') counts.typescript++;
    else if (ext === '.js' || ext === '.jsx' || ext === '.mjs' || ext === '.cjs') counts.javascript++;
    else if (ext === '.py') counts.python++;
    else if (ext === '.go') counts.go++;
    else if (ext === '.java') counts.java++;
    else if (ext === '.rs') counts.rust++;
  }

  const entries = Object.entries(counts) as [DetectedLanguage, number][];
  entries.sort((a, b) => b[1] - a[1]);

  if (entries[0][1] > 0) {
    return entries[0][0];
  }

  return 'unknown';
}

/**
 * Universal Route Extractor across multiple languages (Python, Go, Java, Rust, TS/JS).
 * Sweeps all present languages in the repository and aggregates routes so mixed repos
 * (e.g. Python backend + Node/Express services) never silently hide routes from either language.
 */
export async function extractUniversalRoutes(
  repoDir: string,
  sourceFiles: string[],
  tsProject?: Project
): Promise<MultiLangExtractionResult> {
  const primaryLang = detectRepoLanguage(sourceFiles);
  const aggregatedRoutes: ExtractedRouteNode[] = [];
  const detectedFrameworks: string[] = [];
  const activeLanguages = new Set<DetectedLanguage>();

  // 1. Python Extraction (FastAPI, Flask, Django)
  const pythonFiles = sourceFiles.filter((f) => f.endsWith('.py'));
  if (pythonFiles.length > 0) {
    const pythonResult = extractPythonRoutes(repoDir, pythonFiles);
    if (pythonResult.routes.length > 0) {
      aggregatedRoutes.push(...pythonResult.routes);
      detectedFrameworks.push(pythonResult.framework);
      activeLanguages.add('python');
    }
  }

  // 2. TypeScript & JavaScript Extraction (Express, Fastify, Next.js, NestJS)
  const jsTsFiles = sourceFiles.filter((f) => /\.(ts|js|mjs|cjs|jsx|tsx)$/i.test(f));
  if (jsTsFiles.length > 0) {
    let jsRoutesFound = false;

    if (tsProject) {
      try {
        const astResult = extractExpressRoutes(tsProject, repoDir);
        if (astResult.routes.length > 0) {
          aggregatedRoutes.push(...astResult.routes);
          detectedFrameworks.push('Express.js');
          activeLanguages.add(primaryLang === 'typescript' ? 'typescript' : 'javascript');
          jsRoutesFound = true;
        }
      } catch {
        // Fallback to direct JS/TS scanner
      }
    }

    if (!jsRoutesFound) {
      const directRoutes = extractJsTsRoutes(repoDir, jsTsFiles);
      if (directRoutes.length > 0) {
        aggregatedRoutes.push(...directRoutes);
        detectedFrameworks.push('Node / Express');
        activeLanguages.add(primaryLang === 'typescript' ? 'typescript' : 'javascript');
      }
    }
  }

  // 3. Go Extraction (Gin, Fiber, Echo, Chi, net/http via Tree-sitter AST)
  const goFiles = sourceFiles.filter((f) => f.endsWith('.go'));
  if (goFiles.length > 0) {
    let treeSitterSuccess = false;
    try {
      const tsResult = await extractGoRoutesTreeSitter(repoDir, goFiles);
      if (tsResult.routes.length > 0) {
        aggregatedRoutes.push(...tsResult.routes);
        detectedFrameworks.push(tsResult.framework);
        activeLanguages.add('go');
        treeSitterSuccess = true;
      }
    } catch (err) {
      console.warn('[Go Tree-sitter] Fallback to regex scanner due to error:', err);
    }

    // Fallback to regex scanner only if Tree-sitter found nothing or encountered an error
    if (!treeSitterSuccess) {
      const goRoutes = extractGoRoutes(repoDir, goFiles);
      if (goRoutes.length > 0) {
        aggregatedRoutes.push(...goRoutes);
        detectedFrameworks.push('Go (Gin/net)');
        activeLanguages.add('go');
      }
    }
  }

  // 4. Java / Kotlin Extraction (Spring Boot)
  const javaFiles = sourceFiles.filter((f) => f.endsWith('.java') || f.endsWith('.kt'));
  if (javaFiles.length > 0) {
    const javaRoutes = extractJavaRoutes(repoDir, javaFiles);
    if (javaRoutes.length > 0) {
      aggregatedRoutes.push(...javaRoutes);
      detectedFrameworks.push('Spring Boot');
      activeLanguages.add('java');
    }
  }

  // 5. Rust Extraction (Actix-web, Axum)
  const rustFiles = sourceFiles.filter((f) => f.endsWith('.rs'));
  if (rustFiles.length > 0) {
    const rustRoutes = extractRustRoutes(repoDir, rustFiles);
    if (rustRoutes.length > 0) {
      aggregatedRoutes.push(...rustRoutes);
      detectedFrameworks.push('Rust (Actix/Axum)');
      activeLanguages.add('rust');
    }
  }

  // If no routes detected anywhere, return graceful empty result
  if (aggregatedRoutes.length === 0) {
    return {
      language: primaryLang,
      framework: 'Generic Service',
      routes: [],
      scannedFilesCount: sourceFiles.length,
    };
  }

  // Resolve combined framework and language labels
  const finalLanguage: DetectedLanguage =
    activeLanguages.size > 1 ? 'polyglot' : activeLanguages.values().next().value || primaryLang;
  const finalFramework = Array.from(new Set(detectedFrameworks)).join(' + ');

  return {
    language: finalLanguage,
    framework: finalFramework,
    routes: aggregatedRoutes,
    scannedFilesCount: sourceFiles.length,
  };
}

/**
 * Extracts Python routes across Django, FastAPI, and Flask
 */
function extractPythonRoutes(
  repoDir: string,
  pythonFiles: string[]
): { routes: ExtractedRouteNode[]; framework: string } {
  const routes: ExtractedRouteNode[] = [];
  let counter = 1;
  let framework = 'Python API';

  for (const relFile of pythonFiles) {
    // Skip test files, migrations, virtual environments
    if (relFile.includes('/tests/') || relFile.includes('/test_') || relFile.includes('/migrations/')) {
      continue;
    }

    const fullPath = path.join(repoDir, relFile);
    if (!fs.existsSync(fullPath)) continue;

    let content: string;
    try {
      content = fs.readFileSync(fullPath, 'utf-8');
    } catch {
      continue;
    }

    const lines = content.split(/\r?\n/);

    // Look for router prefix if defined in this file (e.g. router = APIRouter(prefix="/api/v1/auth"))
    let filePrefix = '';
    const prefixMatch = content.match(/APIRouter\s*\(\s*prefix\s*=\s*["']([^"']+)["']/);
    if (prefixMatch) {
      filePrefix = prefixMatch[1].replace(/\/$/, '');
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check for start of route decorator or Django route declaration
      const isRouteStart =
        line.startsWith('@') ||
        line.startsWith('re_path(') ||
        line.startsWith('path(') ||
        line.startsWith('url(');

      if (!isRouteStart) continue;

      // Join a multi-line window of up to 10 lines to handle multi-line arguments
      const windowStr = lines.slice(i, Math.min(lines.length, i + 10)).join(' ');

      // 1. FastAPI: @(router|app|api).get(...) or @(router|app|api).post(...)
      const fastApiMatch = windowStr.match(/@(?:app|router|api|api_router|[a-zA-Z0-9_]*router)\.(get|post|put|delete|patch)\s*\(\s*(?:path\s*=\s*)?["']([^"']+)["']/i);
      if (fastApiMatch) {
        framework = 'FastAPI';
        const method = fastApiMatch[1].toUpperCase() as HttpMethod;
        let routePath = fastApiMatch[2];
        if (filePrefix && !routePath.startsWith(filePrefix)) {
          routePath = filePrefix + (routePath.startsWith('/') ? routePath : '/' + routePath);
        }

        const startLine = i + 1;
        let endLine = Math.min(lines.length, startLine + 10);

        let handlerName = 'handler';
        for (let k = i + 1; k < Math.min(lines.length, i + 8); k++) {
          const fnMatch = lines[k].match(/(?:async\s+)?def\s+([a-zA-Z0-9_]+)\s*\(/);
          if (fnMatch) {
            handlerName = fnMatch[1];
            endLine = k + 1;
            break;
          }
        }

        routes.push({
          id: `py-fastapi-${counter++}`,
          httpMethod: method,
          routePath,
          handlerName,
          location: { filePath: relFile, startLine, endLine },
          codeSnippet: sliceSourceLines(repoDir, relFile, startLine, endLine + 6),
          calledFunctions: [handlerName],
        });
        continue;
      }

      // 2. Django: path(...) or re_path(...) or url(...)
      const djangoMatch = windowStr.match(/(?:re_path|path|url)\s*\(\s*(?:r?["']([^"']+)["'])\s*,\s*([a-zA-Z0-9_.]+)/);
      if (djangoMatch) {
        framework = 'Django / REST Framework';
        const rawPattern = djangoMatch[1];
        const handlerName = djangoMatch[2].replace(/\.as_view\(\)?/, '').replace(/csrf_exempt\(/, '');

        let cleanRoute = rawPattern
          .replace(/^\^/, '/')
          .replace(/\$$/, '')
          .replace(/\(\?P<[a-zA-Z0-9_]+>[^)]+\)/g, ':$1')
          .replace(/[\\?^$]/g, '');

        if (!cleanRoute.startsWith('/')) cleanRoute = '/' + cleanRoute;

        const startLine = i + 1;
        let endLine = startLine;
        let balance = (windowStr.match(/\(/g) || []).length - (windowStr.match(/\)/g) || []).length;
        for (let j = i + 1; j < Math.min(lines.length, i + 12); j++) {
          if (balance <= 0) break;
          balance += (lines[j].match(/\(/g) || []).length - (lines[j].match(/\)/g) || []).length;
          endLine = j + 1;
        }

        routes.push({
          id: `py-django-${counter++}`,
          httpMethod: 'ALL',
          routePath: cleanRoute,
          handlerName: handlerName.split('.').pop() || handlerName,
          location: { filePath: relFile, startLine, endLine },
          codeSnippet: sliceSourceLines(repoDir, relFile, startLine, endLine),
          calledFunctions: [handlerName.split('.').pop() || handlerName],
        });
        continue;
      }

      // 3. Flask: @app.route(...) or @bp.route(...)
      const flaskMatch = windowStr.match(/@(?:[a-zA-Z0-9_]*app|[a-zA-Z0-9_]*bp|api)\.route\s*\(\s*["']([^"']+)["'](?:.*methods=\[([^\]]+)\])?/i);
      if (flaskMatch) {
        framework = 'Flask';
        const routePath = flaskMatch[1];
        let method: HttpMethod = 'GET';
        if (flaskMatch[2]) {
          const m = flaskMatch[2].match(/(GET|POST|PUT|DELETE|PATCH)/i);
          if (m) method = m[1].toUpperCase() as HttpMethod;
        }

        const startLine = i + 1;
        let endLine = Math.min(lines.length, startLine + 8);
        let handlerName = 'handler';
        for (let k = i + 1; k < Math.min(lines.length, i + 6); k++) {
          const fnMatch = lines[k].match(/def\s+([a-zA-Z0-9_]+)\s*\(/);
          if (fnMatch) {
            handlerName = fnMatch[1];
            endLine = k + 1;
            break;
          }
        }

        routes.push({
          id: `py-flask-${counter++}`,
          httpMethod: method,
          routePath,
          handlerName,
          location: { filePath: relFile, startLine, endLine },
          codeSnippet: sliceSourceLines(repoDir, relFile, startLine, endLine + 5),
          calledFunctions: [handlerName],
        });
      }
    }
  }

  return { routes, framework };
}

/**
 * Direct JavaScript and TypeScript route extractor (Express, Fastify, Next.js)
 */
function extractJsTsRoutes(repoDir: string, sourceFiles: string[]): ExtractedRouteNode[] {
  const routes: ExtractedRouteNode[] = [];
  let counter = 1;

  for (const relFile of sourceFiles) {
    if (!/\.(ts|js|mjs|cjs)$/i.test(relFile)) continue;
    if (/\.(test|spec)\.[a-z]+$/i.test(relFile)) continue;

    const fullPath = path.join(repoDir, relFile);
    if (!fs.existsSync(fullPath)) continue;

    let content: string;
    try {
      content = fs.readFileSync(fullPath, 'utf-8');
    } catch {
      continue;
    }

    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Express / Fastify: router.post('/...', ...) or app.get('/...', ...)
      const expressMatch = line.match(/(?:app|router|[a-zA-Z0-9_]*route[a-zA-Z0-9_]*)\.(get|post|put|delete|patch|all)\(\s*['"`]([^'"`]+)['"`]/i);
      if (expressMatch) {
        const method = expressMatch[1].toUpperCase() as HttpMethod;
        const routePath = expressMatch[2];
        const startLine = i + 1;

        let endLine = startLine;
        let balance = (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
        for (let j = i + 1; j < Math.min(lines.length, i + 20); j++) {
          if (balance <= 0) break;
          balance += (lines[j].match(/\(/g) || []).length - (lines[j].match(/\)/g) || []).length;
          endLine = j + 1;
        }

        const combined = lines.slice(i, endLine).join(' ');
        const calledFunctions: string[] = [];
        const fnMatches = combined.matchAll(/,\s*([a-zA-Z0-9_]+)/g);
        for (const match of fnMatches) {
          const fn = match[1];
          if (!['req', 'res', 'next', 'true', 'false', 'null'].includes(fn)) {
            calledFunctions.push(fn);
          }
        }

        routes.push({
          id: `route-${method.toLowerCase()}-${counter++}`,
          httpMethod: method,
          routePath,
          handlerName: calledFunctions[calledFunctions.length - 1] || 'handler',
          location: { filePath: relFile, startLine, endLine },
          codeSnippet: sliceSourceLines(repoDir, relFile, startLine, endLine),
          calledFunctions,
        });
        continue;
      }

      // Next.js App Router: export async function GET(req) { ... }
      const nextJsMatch = line.match(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)\s*\(/i);
      if (nextJsMatch && relFile.includes('api')) {
        const method = nextJsMatch[1].toUpperCase() as HttpMethod;
        const startLine = i + 1;
        const endLine = Math.min(lines.length, startLine + 10);

        const apiIndex = relFile.indexOf('api');
        let inferredPath = '/' + relFile.slice(apiIndex).replace(/\/route\.[a-z]+$/i, '');

        routes.push({
          id: `route-${method.toLowerCase()}-${counter++}`,
          httpMethod: method,
          routePath: inferredPath,
          handlerName: method.toLowerCase() + 'Handler',
          location: { filePath: relFile, startLine, endLine },
          codeSnippet: sliceSourceLines(repoDir, relFile, startLine, endLine),
          calledFunctions: [],
        });
      }
    }
  }

  return routes;
}

/**
 * Extracts Go routes (Gin r.GET('/path', handler), net/http http.HandleFunc('/path', handler))
 */
function extractGoRoutes(repoDir: string, sourceFiles: string[]): ExtractedRouteNode[] {
  const routes: ExtractedRouteNode[] = [];
  let counter = 1;

  for (const relFile of sourceFiles) {
    if (!relFile.endsWith('.go')) continue;
    const fullPath = path.join(repoDir, relFile);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      const ginMatch = line.match(/(?:r|router|api|group|v1)\.(GET|POST|PUT|DELETE|PATCH)\(\s*"([^"]+)"\s*,\s*([a-zA-Z0-9_.]+)/);
      const httpMatch = line.match(/http\.HandleFunc\(\s*"([^"]+)"\s*,\s*([a-zA-Z0-9_.]+)/);

      if (ginMatch) {
        const method = ginMatch[1].toUpperCase() as HttpMethod;
        const routePath = ginMatch[2];
        const handlerName = ginMatch[3];
        const startLine = i + 1;

        routes.push({
          id: `go-route-${counter++}`,
          httpMethod: method,
          routePath,
          handlerName,
          location: { filePath: relFile, startLine, endLine: startLine },
          codeSnippet: sliceSourceLines(repoDir, relFile, startLine, startLine + 4),
          calledFunctions: [handlerName],
        });
      } else if (httpMatch) {
        const routePath = httpMatch[1];
        const handlerName = httpMatch[2];
        const startLine = i + 1;

        routes.push({
          id: `go-route-${counter++}`,
          httpMethod: 'GET',
          routePath,
          handlerName,
          location: { filePath: relFile, startLine, endLine: startLine },
          codeSnippet: sliceSourceLines(repoDir, relFile, startLine, startLine + 4),
          calledFunctions: [handlerName],
        });
      }
    }
  }

  return routes;
}

/**
 * Extracts Spring Boot Java routes (@GetMapping('/path'), @PostMapping('/path'))
 */
function extractJavaRoutes(repoDir: string, sourceFiles: string[]): ExtractedRouteNode[] {
  const routes: ExtractedRouteNode[] = [];
  let counter = 1;

  for (const relFile of sourceFiles) {
    if (!relFile.endsWith('.java') && !relFile.endsWith('.kt')) continue;
    const fullPath = path.join(repoDir, relFile);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const match = line.match(/@(Get|Post|Put|Delete|Patch)Mapping\(\s*(?:value\s*=\s*)?["']([^"']+)["']/i);

      if (match) {
        const method = match[1].toUpperCase() as HttpMethod;
        const routePath = match[2];
        const startLine = i + 1;

        let handlerName = 'controllerMethod';
        if (i + 1 < lines.length) {
          const fnMatch = lines[i + 1].match(/(?:public|private|protected)?\s+[A-Za-z0-9_<>]+\s+([a-zA-Z0-9_]+)\s*\(/);
          if (fnMatch) handlerName = fnMatch[1];
        }

        routes.push({
          id: `java-route-${counter++}`,
          httpMethod: method,
          routePath,
          handlerName,
          location: { filePath: relFile, startLine, endLine: startLine + 6 },
          codeSnippet: sliceSourceLines(repoDir, relFile, startLine, startLine + 6),
          calledFunctions: [handlerName],
        });
      }
    }
  }

  return routes;
}

/**
 * Extracts Rust Actix / Axum routes
 */
function extractRustRoutes(repoDir: string, sourceFiles: string[]): ExtractedRouteNode[] {
  const routes: ExtractedRouteNode[] = [];
  let counter = 1;

  for (const relFile of sourceFiles) {
    if (!relFile.endsWith('.rs')) continue;
    const fullPath = path.join(repoDir, relFile);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const actixMatch = line.match(/#\[(get|post|put|delete|patch)\(\s*"([^"]+)"\s*\)\]/i);
      const axumMatch = line.match(/\.route\(\s*"([^"]+)"\s*,\s*(get|post|put|delete|patch)\(([a-zA-Z0-9_]+)\)\)/i);

      if (actixMatch) {
        const method = actixMatch[1].toUpperCase() as HttpMethod;
        const routePath = actixMatch[2];
        const startLine = i + 1;

        routes.push({
          id: `rust-route-${counter++}`,
          httpMethod: method,
          routePath,
          handlerName: 'handler',
          location: { filePath: relFile, startLine, endLine: startLine + 5 },
          codeSnippet: sliceSourceLines(repoDir, relFile, startLine, startLine + 5),
          calledFunctions: [],
        });
      } else if (axumMatch) {
        const routePath = axumMatch[1];
        const method = axumMatch[2].toUpperCase() as HttpMethod;
        const handlerName = axumMatch[3];
        const startLine = i + 1;

        routes.push({
          id: `rust-route-${counter++}`,
          httpMethod: method,
          routePath,
          handlerName,
          location: { filePath: relFile, startLine, endLine: startLine },
          codeSnippet: sliceSourceLines(repoDir, relFile, startLine, startLine + 3),
          calledFunctions: [handlerName],
        });
      }
    }
  }

  return routes;
}
