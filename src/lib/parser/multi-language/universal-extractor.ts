import fs from 'fs';
import path from 'path';
import { ExtractedRouteNode, HttpMethod } from '../../types/ast';
import { sliceSourceLines } from '../code-slicer';
import { Project } from 'ts-morph';
import { extractExpressRoutes } from '../express-extractor';

export type DetectedLanguage = 'typescript' | 'javascript' | 'python' | 'go' | 'java' | 'rust' | 'unknown';

export interface MultiLangExtractionResult {
  language: DetectedLanguage;
  framework: string;
  routes: ExtractedRouteNode[];
  scannedFilesCount: number;
}

/**
 * Detects repository primary language based on source file extensions
 */
export function detectRepoLanguage(sourceFiles: string[]): DetectedLanguage {
  const counts: Record<string, number> = {
    ts: 0,
    js: 0,
    py: 0,
    go: 0,
    java: 0,
    rs: 0,
  };

  for (const f of sourceFiles) {
    const ext = path.extname(f).toLowerCase();
    if (ext === '.ts' || ext === '.tsx') counts.ts++;
    else if (ext === '.js' || ext === '.jsx' || ext === '.mjs') counts.js++;
    else if (ext === '.py') counts.py++;
    else if (ext === '.go') counts.go++;
    else if (ext === '.java') counts.java++;
    else if (ext === '.rs') counts.rs++;
  }

  if (counts.ts > 0 || counts.js > 0) return counts.ts >= counts.js ? 'typescript' : 'javascript';
  if (counts.py > 0 && counts.py >= counts.go) return 'python';
  if (counts.go > 0) return 'go';
  if (counts.java > 0) return 'java';
  if (counts.rs > 0) return 'rust';

  return 'unknown';
}

/**
 * Universal Route Extractor across multiple languages (Python, Go, Java, Rust, TS/JS)
 */
export function extractUniversalRoutes(
  repoDir: string,
  sourceFiles: string[],
  tsProject?: Project
): MultiLangExtractionResult {
  const lang = detectRepoLanguage(sourceFiles);

  // 1. TypeScript & JavaScript: Try ts-morph AST parser first, then fallback to high-speed AST/regex scanner
  if (lang === 'typescript' || lang === 'javascript') {
    if (tsProject) {
      try {
        const astResult = extractExpressRoutes(tsProject, repoDir);
        if (astResult.routes.length > 0) {
          return {
            language: lang,
            framework: 'Express.js / Node',
            routes: astResult.routes,
            scannedFilesCount: astResult.scannedFilesCount,
          };
        }
      } catch {
        // Fallback to direct JS/TS scanner
      }
    }

    // Direct JS/TS Route Scanner (handles monorepos, backend/ folders, and non-tsconfig projects)
    const directRoutes = extractJsTsRoutes(repoDir, sourceFiles);
    if (directRoutes.length > 0) {
      return {
        language: lang,
        framework: 'Express.js / Node',
        routes: directRoutes,
        scannedFilesCount: sourceFiles.filter((f) => /\.(ts|js|mjs|cjs)$/i.test(f)).length,
      };
    }
  }

  // 2. Python: FastAPI, Flask, Django
  if (lang === 'python') {
    const pythonRoutes = extractPythonRoutes(repoDir, sourceFiles);
    return {
      language: 'python',
      framework: 'FastAPI / Flask',
      routes: pythonRoutes,
      scannedFilesCount: sourceFiles.filter((f) => f.endsWith('.py')).length,
    };
  }

  // 3. Go: Gin, Fiber, net/http
  if (lang === 'go') {
    const goRoutes = extractGoRoutes(repoDir, sourceFiles);
    return {
      language: 'go',
      framework: 'Gin / net/http',
      routes: goRoutes,
      scannedFilesCount: sourceFiles.filter((f) => f.endsWith('.go')).length,
    };
  }

  // 4. Java / Kotlin: Spring Boot
  if (lang === 'java') {
    const javaRoutes = extractJavaRoutes(repoDir, sourceFiles);
    return {
      language: 'java',
      framework: 'Spring Boot',
      routes: javaRoutes,
      scannedFilesCount: sourceFiles.filter((f) => f.endsWith('.java')).length,
    };
  }

  // 5. Rust: Actix-web, Axum
  if (lang === 'rust') {
    const rustRoutes = extractRustRoutes(repoDir, sourceFiles);
    return {
      language: 'rust',
      framework: 'Actix / Axum',
      routes: rustRoutes,
      scannedFilesCount: sourceFiles.filter((f) => f.endsWith('.rs')).length,
    };
  }

  // Fallback: Return empty routes
  return {
    language: lang,
    framework: 'Generic',
    routes: [],
    scannedFilesCount: sourceFiles.length,
  };
}

/**
 * Extracts Python routes (FastAPI @app.get('/path'), Flask @app.route('/path', methods=['GET']))
 */
function extractPythonRoutes(repoDir: string, sourceFiles: string[]): ExtractedRouteNode[] {
  const routes: ExtractedRouteNode[] = [];
  let counter = 1;

  for (const relFile of sourceFiles) {
    if (!relFile.endsWith('.py')) continue;
    const fullPath = path.join(repoDir, relFile);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // FastAPI / Flask decorator: @app.get('/path') or @router.post('/login')
      const fastApiMatch = line.match(/@(?:app|router|api|bp)\.(get|post|put|delete|patch)\(\s*["']([^"']+)["']/i);
      // Flask route: @app.route('/path', methods=['POST'])
      const flaskMatch = line.match(/@(?:app|bp|api)\.route\(\s*["']([^"']+)["'](?:.*methods=\[([^\]]+)\])?/i);

      if (fastApiMatch) {
        const method = fastApiMatch[1].toUpperCase() as HttpMethod;
        const routePath = fastApiMatch[2];
        const startLine = i + 1;
        const endLine = Math.min(lines.length, startLine + 10);

        // Find function name on next line
        let handlerName = 'handler';
        if (i + 1 < lines.length) {
          const fnMatch = lines[i + 1].match(/def\s+([a-zA-Z0-9_]+)\s*\(/);
          if (fnMatch) handlerName = fnMatch[1];
        }

        routes.push({
          id: `py-route-${counter++}`,
          httpMethod: method,
          routePath,
          handlerName,
          location: { filePath: relFile, startLine, endLine },
          codeSnippet: sliceSourceLines(repoDir, relFile, startLine, endLine),
          calledFunctions: [handlerName],
        });
      } else if (flaskMatch) {
        const routePath = flaskMatch[1];
        let method: HttpMethod = 'GET';
        if (flaskMatch[2]) {
          const m = flaskMatch[2].match(/(GET|POST|PUT|DELETE|PATCH)/i);
          if (m) method = m[1].toUpperCase() as HttpMethod;
        }

        const startLine = i + 1;
        const endLine = Math.min(lines.length, startLine + 8);
        let handlerName = 'handler';
        if (i + 1 < lines.length) {
          const fnMatch = lines[i + 1].match(/def\s+([a-zA-Z0-9_]+)\s*\(/);
          if (fnMatch) handlerName = fnMatch[1];
        }

        routes.push({
          id: `py-route-${counter++}`,
          httpMethod: method,
          routePath,
          handlerName,
          location: { filePath: relFile, startLine, endLine },
          codeSnippet: sliceSourceLines(repoDir, relFile, startLine, endLine),
          calledFunctions: [handlerName],
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

      // Gin / Fiber: r.GET("/path", handler)
      const ginMatch = line.match(/(?:r|router|api|group|v1)\.(GET|POST|PUT|DELETE|PATCH)\(\s*"([^"]+)"\s*,\s*([a-zA-Z0-9_.]+)/);
      // net/http: http.HandleFunc("/path", handler)
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
    if (!relFile.endsWith('.java')) continue;
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
      // Actix: #[get("/path")] or #[post("/path")]
      const actixMatch = line.match(/#\[(get|post|put|delete|patch)\(\s*"([^"]+)"\s*\)\]/i);
      // Axum: .route("/path", get(handler))
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

/**
 * Direct JavaScript and TypeScript route extractor.
 * Fast, resilient scanner for Express, Fastify, and Next.js App Router endpoints.
 */
function extractJsTsRoutes(repoDir: string, sourceFiles: string[]): ExtractedRouteNode[] {
  const routes: ExtractedRouteNode[] = [];
  let counter = 1;

  for (const relFile of sourceFiles) {
    if (!/\.(ts|js|mjs|cjs)$/i.test(relFile)) continue;
    // Skip test files, build output
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

    // 1. Check Express / Fastify style route definitions: (router|app).get('/path', ...)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Match: app.get('/...', ...), router.post('/...', ...), authRouter.get('/...', ...)
      const expressMatch = line.match(/(?:app|router|[a-zA-Z0-9_]*route[a-zA-Z0-9_]*)\.(get|post|put|delete|patch|all)\(\s*['"`]([^'"`]+)['"`]/i);
      
      if (expressMatch) {
        const method = expressMatch[1].toUpperCase() as HttpMethod;
        const routePath = expressMatch[2];
        const startLine = i + 1;

        // Determine multi-line statement end
        let endLine = startLine;
        let balance = (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
        for (let j = i + 1; j < Math.min(lines.length, i + 20); j++) {
          if (balance <= 0) break;
          balance += (lines[j].match(/\(/g) || []).length - (lines[j].match(/\)/g) || []).length;
          endLine = j + 1;
        }

        // Extract called handlers/functions from the line(s)
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
      }

      // 2. Check Next.js App Router style: export async function GET(req) { ... }
      const nextJsMatch = line.match(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)\s*\(/i);
      if (nextJsMatch && relFile.includes('api')) {
        const method = nextJsMatch[1].toUpperCase() as HttpMethod;
        const startLine = i + 1;
        const endLine = Math.min(lines.length, startLine + 10);
        
        // Infer route path from file path: e.g. src/app/api/users/route.ts -> /api/users
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
