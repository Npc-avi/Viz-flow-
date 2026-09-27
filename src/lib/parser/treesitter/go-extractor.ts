import fs from 'fs';
import path from 'path';
import { Parser, Language } from '@vscode/tree-sitter-wasm';
import { ExtractedRouteNode, HttpMethod } from '../../types/ast';
import { sliceSourceLines } from '../code-slicer';
import { loadLanguageWasm } from './wasm-loader';

let parserPromise: Promise<{ parser: Parser; language: Language }> | null = null;

/**
 * Initializes and returns a cached Tree-sitter Go parser instance
 */
export async function getGoParser(): Promise<{ parser: Parser; language: Language }> {
  if (parserPromise) {
    return parserPromise;
  }

  parserPromise = (async () => {
    const language = await loadLanguageWasm('tree-sitter-go.wasm');
    const parser = new Parser();
    parser.setLanguage(language);

    return { parser, language };
  })();

  return parserPromise;
}

interface GoFunctionDef {
  startLine: number;
  endLine: number;
  calledFunctions: string[];
}

const SUPPORTED_HTTP_METHODS: Record<string, HttpMethod> = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  PATCH: 'PATCH',
  OPTIONS: 'ALL',
  HEAD: 'ALL',
  Get: 'GET',
  Post: 'POST',
  Put: 'PUT',
  Delete: 'DELETE',
  Patch: 'PATCH',
  Options: 'ALL',
  Head: 'ALL',
};

const STANDARD_HANDLERS = new Set(['HandleFunc', 'Handle']);

/**
 * Extracts backend routes from Go source code files using real Tree-sitter AST queries and node traversal.
 * Supports Gin, Fiber, Echo, Chi, and net/http.
 * Scans every Go source file in the repository without pre-filter skipping.
 */
export async function extractGoRoutesTreeSitter(
  repoDir: string,
  sourceFiles: string[]
): Promise<{ routes: ExtractedRouteNode[]; framework: string; parsedFileCount: number }> {
  const { parser } = await getGoParser();
  const routes: ExtractedRouteNode[] = [];
  let routeCounter = 1;
  let parsedFileCount = 0;
  let detectedFramework = 'Go (net/http)';

  // Process all Go source files (excluding unit tests)
  const goFiles = sourceFiles.filter((f) => f.endsWith('.go') && !f.endsWith('_test.go'));

  const candidateFiles: { relFile: string; sourceCode: string }[] = [];

  for (const relFile of goFiles) {
    const fullPath = path.join(repoDir, relFile);
    if (!fs.existsSync(fullPath)) continue;

    try {
      const sourceCode = fs.readFileSync(fullPath, 'utf-8');
      if (sourceCode.trim()) {
        candidateFiles.push({ relFile, sourceCode });
      }
    } catch {}
  }

  // Process candidate files in parallel batches of 15
  const BATCH_SIZE = 15;
  for (let b = 0; b < candidateFiles.length; b += BATCH_SIZE) {
    const batch = candidateFiles.slice(b, b + BATCH_SIZE);

    for (const { relFile, sourceCode } of batch) {
      if (sourceCode.includes('github.com/gin-gonic/gin')) {
        detectedFramework = 'Gin';
      } else if (sourceCode.includes('github.com/gofiber/fiber')) {
        detectedFramework = 'Fiber';
      } else if (sourceCode.includes('github.com/labstack/echo')) {
        detectedFramework = 'Echo';
      } else if (sourceCode.includes('github.com/go-chi/chi')) {
        detectedFramework = 'Chi';
      }

      try {
        const tree = parser.parse(sourceCode);
        if (!tree) continue;
        parsedFileCount++;

      // 1. Index all function and method declarations in this file for called-function resolution
      const fileFunctionDefs = new Map<string, GoFunctionDef>();

      function indexFunctions(node: any) {
        if (node.type === 'function_declaration' || node.type === 'method_declaration') {
          const nameNode = node.childForFieldName('name');
          const bodyNode = node.childForFieldName('body');
          if (nameNode && bodyNode) {
            const called: string[] = [];

            function collectCalls(n: any) {
              if (n.type === 'call_expression') {
                const callFn = n.childForFieldName('function');
                if (callFn) {
                  const fnText = callFn.text.trim();
                  if (fnText && !['make', 'new', 'len', 'append', 'panic', 'print', 'println'].includes(fnText)) {
                    called.push(fnText);
                  }
                }
              }
              for (let i = 0; i < n.namedChildCount; i++) {
                collectCalls(n.namedChild(i));
              }
            }

            collectCalls(bodyNode);

            fileFunctionDefs.set(nameNode.text, {
              startLine: node.startPosition.row + 1,
              endLine: node.endPosition.row + 1,
              calledFunctions: Array.from(new Set(called)),
            });
          }
        }

        for (let i = 0; i < node.namedChildCount; i++) {
          indexFunctions(node.namedChild(i));
        }
      }

      indexFunctions(tree.rootNode);

      // 2. Index Router Groups (e.g. v1 := r.Group("/api/v1"), api := r.Route("/api", ...))
      const groupPrefixes = new Map<string, string>();

      function indexGroups(node: any) {
        if (node.type === 'short_var_declaration' || node.type === 'var_spec' || node.type === 'assignment_statement') {
          const left = node.childForFieldName('left') || node.childForFieldName('name');
          const right = node.childForFieldName('right') || node.childForFieldName('value');

          if (left && right) {
            const varName = left.text.trim();
            for (let i = 0; i < right.namedChildCount; i++) {
              const expr = right.namedChild(i);
              if (expr.type === 'call_expression') {
                const fn = expr.childForFieldName('function');
                const args = expr.childForFieldName('arguments');

                if (fn && fn.type === 'selector_expression') {
                  const operand = fn.childForFieldName('operand')?.text.trim();
                  const field = fn.childForFieldName('field')?.text.trim();

                  if (field === 'Group' || field === 'Route' || field === 'Mount') {
                    const firstArg = args?.namedChild(0);
                    if (firstArg && (firstArg.type === 'interpreted_string_literal' || firstArg.type === 'raw_string_literal')) {
                      const prefix = firstArg.text.replace(/^["`]|["`]$/g, '').trim();
                      const parentPrefix = (operand && groupPrefixes.get(operand)) || '';
                      const combined = (parentPrefix + (prefix.startsWith('/') ? prefix : '/' + prefix)).replace(/\/+/g, '/');
                      groupPrefixes.set(varName, combined);
                    }
                  }
                }
              }
            }
          }
        }

        for (let i = 0; i < node.namedChildCount; i++) {
          indexGroups(node.namedChild(i));
        }
      }

      indexGroups(tree.rootNode);

      // 3. Search for Route Registrations (r.GET, app.Post, http.HandleFunc, etc.)
      function searchRoutes(node: any) {
        if (node.type === 'call_expression') {
          const fn = node.childForFieldName('function');
          const args = node.childForFieldName('arguments');

          if (fn && fn.type === 'selector_expression' && args && args.namedChildCount >= 1) {
            const operand = fn.childForFieldName('operand')?.text.trim();
            const field = fn.childForFieldName('field')?.text.trim();

            if (field) {
              const matchedMethod = SUPPORTED_HTTP_METHODS[field];
              const isStandardHandler = STANDARD_HANDLERS.has(field);

              if (matchedMethod || isStandardHandler) {
                // Find path argument (first string literal argument)
                let pathArgNode: any = null;
                let handlerArgNode: any = null;

                for (let i = 0; i < args.namedChildCount; i++) {
                  const arg = args.namedChild(i);
                  if (!pathArgNode && (arg.type === 'interpreted_string_literal' || arg.type === 'raw_string_literal')) {
                    pathArgNode = arg;
                  } else if (pathArgNode && !handlerArgNode) {
                    handlerArgNode = arg;
                  }
                }

                if (args.namedChildCount >= 2) {
                  handlerArgNode = args.namedChild(args.namedChildCount - 1);
                }

                if (pathArgNode) {
                  const rawPath = pathArgNode.text.replace(/^["`]|["`]$/g, '').trim();
                  const groupPrefix = (operand && groupPrefixes.get(operand)) || '';
                  const normalizedPath = (groupPrefix + (rawPath.startsWith('/') ? rawPath : '/' + rawPath)).replace(/\/+/g, '/');

                  const httpMethod: HttpMethod = matchedMethod || 'GET';

                  let handlerName = 'anonymousHandler';
                  const calledFunctions: string[] = [];

                  if (handlerArgNode) {
                    if (handlerArgNode.type === 'identifier') {
                      handlerName = handlerArgNode.text.trim();
                      const def = fileFunctionDefs.get(handlerName);
                      if (def) {
                        calledFunctions.push(...def.calledFunctions);
                      } else {
                        calledFunctions.push(handlerName);
                      }
                    } else if (handlerArgNode.type === 'selector_expression') {
                      handlerName = handlerArgNode.text.trim();
                      calledFunctions.push(handlerName);
                    } else if (handlerArgNode.type === 'func_literal') {
                      handlerName = 'inlineClosure';

                      function extractInlineCalls(n: any) {
                        if (n.type === 'call_expression') {
                          const callFn = n.childForFieldName('function');
                          if (callFn) {
                            const callText = callFn.text.trim();
                            if (callText && !['make', 'new', 'len', 'append', 'panic'].includes(callText)) {
                              calledFunctions.push(callText);
                            }
                          }
                        }
                        for (let j = 0; j < n.namedChildCount; j++) {
                          extractInlineCalls(n.namedChild(j));
                        }
                      }

                      extractInlineCalls(handlerArgNode);
                    }
                  }

                  const startLine = node.startPosition.row + 1;
                  const endLine = node.endPosition.row + 1;

                  routes.push({
                    id: `go-ast-${routeCounter++}`,
                    httpMethod,
                    routePath: normalizedPath || '/',
                    handlerName,
                    location: {
                      filePath: relFile,
                      startLine,
                      endLine,
                    },
                    codeSnippet: sliceSourceLines(repoDir, relFile, startLine, endLine),
                    calledFunctions: Array.from(new Set(calledFunctions)),
                  });
                }
              }
            }
          }
        }

        for (let i = 0; i < node.namedChildCount; i++) {
          searchRoutes(node.namedChild(i));
        }
      }

      searchRoutes(tree.rootNode);
    } catch (err) {
      console.warn(`[Tree-sitter Go] Error parsing file ${relFile}:`, err);
    }
  }
}

return {
    routes,
    framework: detectedFramework,
    parsedFileCount,
  };
}
