import fs from 'fs';
import path from 'path';
import { Parser, Language, Query } from '@vscode/tree-sitter-wasm';
import { ExtractedRouteNode, HttpMethod } from '../../types/ast';
import { sliceSourceLines } from '../code-slicer';
import { loadLanguageWasm } from './wasm-loader';

let parserPromise: Promise<{ parser: Parser; language: Language }> | null = null;

/**
 * Initializes and returns a cached Tree-sitter Python parser instance
 */
export async function getPythonParser(): Promise<{ parser: Parser; language: Language }> {
  if (parserPromise) {
    return parserPromise;
  }

  parserPromise = (async () => {
    const language = await loadLanguageWasm('tree-sitter-python.wasm');
    const parser = new Parser();
    parser.setLanguage(language);

    return { parser, language };
  })();

  return parserPromise;
}

const SUPPORTED_HTTP_METHODS: Record<string, HttpMethod> = {
  get: 'GET',
  post: 'POST',
  put: 'PUT',
  delete: 'DELETE',
  patch: 'PATCH',
  options: 'ALL',
  head: 'ALL',
  api_route: 'ALL',
};

const PYTHON_BUILTINS = new Set([
  'print', 'len', 'range', 'dict', 'list', 'set', 'str', 'int', 'float',
  'bool', 'super', 'isinstance', 'issubclass', 'type', 'getattr', 'setattr',
  'hasattr', 'open', 'min', 'max', 'sum', 'enumerate', 'zip', 'map', 'filter',
]);

/**
 * Clean and unquote a Python string literal (supporting f"", r"", b"", etc.)
 */
function cleanPythonString(raw: string): string {
  return raw
    .trim()
    .replace(/^[furbFURB]*["']{1,3}/, '')
    .replace(/["']{1,3}$/, '')
    .trim();
}

/**
 * Normalizes Django regex routes into clean URL paths (e.g. ^users/(?P<id>[0-9]+)/$ -> /users/:id)
 */
function normalizeDjangoPattern(pattern: string): string {
  let clean = pattern
    .replace(/^\^/, '')
    .replace(/\$$/, '')
    .replace(/\(\?P<([a-zA-Z0-9_]+)>[^)]+\)/g, ':$1')
    .replace(/<([a-zA-Z0-9_]+:[a-zA-Z0-9_]+)>/g, ':$1')
    .replace(/[\\?^$]/g, '')
    .trim();

  if (!clean.startsWith('/')) {
    clean = '/' + clean;
  }
  return clean.replace(/\/+/g, '/');
}

/**
 * Recursively collects function/method calls inside a function definition AST block
 */
function collectCallsFromBlock(blockNode: any): string[] {
  const calls: string[] = [];

  function walk(node: any) {
    if (node.type === 'call') {
      const fnNode = node.childForFieldName('function');
      if (fnNode) {
        const fnText = fnNode.text.trim();
        if (fnText && !PYTHON_BUILTINS.has(fnText)) {
          calls.push(fnText);
        }
      }
    }
    for (let i = 0; i < node.namedChildCount; i++) {
      walk(node.namedChild(i));
    }
  }

  walk(blockNode);
  return Array.from(new Set(calls));
}

/**
 * Extracts backend routes from Python files using Tree-sitter AST queries.
 * Supports FastAPI, Flask, and Django.
 * Scans every Python source file in the repository without pre-filter skipping.
 */
export async function extractPythonRoutesTreeSitter(
  repoDir: string,
  pythonFiles: string[]
): Promise<{ routes: ExtractedRouteNode[]; framework: string; parsedFileCount: number }> {
  const { parser } = await getPythonParser();
  const routes: ExtractedRouteNode[] = [];
  let routeCounter = 1;
  let parsedFileCount = 0;
  const detectedFrameworks = new Set<string>();

  // Process all Python source files (excluding virtual environments and test files)
  const validFiles = pythonFiles.filter((relFile) => {
    return (
      !relFile.includes('/site-packages/') &&
      !relFile.includes('/migrations/') &&
      !relFile.includes('/tests/') &&
      !relFile.includes('/test_') &&
      !relFile.endsWith('_test.py')
    );
  });

  const candidateFiles: { relFile: string; sourceCode: string }[] = [];
  for (const relFile of validFiles) {
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
      try {
        const tree = parser.parse(sourceCode);
        if (!tree) continue;
        parsedFileCount++;

        // 1. Index router prefixes in this file (e.g. router = APIRouter(prefix="/api/v1"), bp = Blueprint("...", url_prefix="/users"))
      const routerPrefixes = new Map<string, string>();

      function indexPrefixes(node: any) {
        if (node.type === 'assignment') {
          const left = node.childForFieldName('left');
          const right = node.childForFieldName('right');
          if (left && right && right.type === 'call') {
            const varName = left.text.trim();
            const args = right.childForFieldName('arguments');
            if (args) {
              for (let i = 0; i < args.namedChildCount; i++) {
                const arg = args.namedChild(i);
                if (arg.type === 'keyword_argument') {
                  const kwName = arg.childForFieldName('name')?.text;
                  if (kwName === 'prefix' || kwName === 'url_prefix') {
                    const valNode = arg.childForFieldName('value');
                    if (valNode && valNode.type === 'string') {
                      const prefixStr = cleanPythonString(valNode.text);
                      routerPrefixes.set(varName, prefixStr);
                    }
                  }
                }
              }
            }
          }
        }
        for (let i = 0; i < node.namedChildCount; i++) {
          indexPrefixes(node.namedChild(i));
        }
      }

      indexPrefixes(tree.rootNode);

      // 2. Traverse decorated_definition AST nodes (FastAPI & Flask route decorators)
      function searchDecorators(node: any) {
        if (node.type === 'decorated_definition') {
          const fnDef = node.childForFieldName('definition');
          if (fnDef && fnDef.type === 'function_definition') {
            const fnNameNode = fnDef.childForFieldName('name');
            const fnBodyNode = fnDef.childForFieldName('body');
            const handlerName = fnNameNode ? fnNameNode.text.trim() : 'handler';
            const calledFunctions = fnBodyNode ? collectCallsFromBlock(fnBodyNode) : [handlerName];

            // A single function can have multiple decorators (e.g. @router.get(...) and @router.post(...))
            for (let i = 0; i < node.namedChildCount; i++) {
              const child = node.namedChild(i);
              if (child.type === 'decorator') {
                const callNode = child.namedChild(0);
                if (callNode && callNode.type === 'call') {
                  const fnExpr = callNode.childForFieldName('function');
                  const args = callNode.childForFieldName('arguments');

                  if (fnExpr && fnExpr.type === 'attribute') {
                    const receiverObj = fnExpr.childForFieldName('object')?.text.trim();
                    const methodName = fnExpr.childForFieldName('attribute')?.text.trim().toLowerCase();

                    // Check for FastAPI (@router.get, @app.post, etc.) or Flask (@app.route, @bp.route)
                    if (methodName && (SUPPORTED_HTTP_METHODS[methodName] || methodName === 'route')) {
                      // Extract route path (first string argument or path="..." keyword argument)
                      let rawPath = '';
                      let httpMethods: HttpMethod[] = [];

                      if (methodName === 'route') {
                        detectedFrameworks.add('Flask');
                        // Flask @app.route("/path", methods=["GET", "POST"])
                        if (args) {
                          for (let a = 0; a < args.namedChildCount; a++) {
                            const argNode = args.namedChild(a);
                            if (!rawPath && argNode.type === 'string') {
                              rawPath = cleanPythonString(argNode.text);
                            } else if (argNode.type === 'keyword_argument') {
                              const kw = argNode.childForFieldName('name')?.text;
                              if (kw === 'methods') {
                                const valList = argNode.childForFieldName('value');
                                if (valList && valList.type === 'list') {
                                  for (let m = 0; m < valList.namedChildCount; m++) {
                                    const mStr = cleanPythonString(valList.namedChild(m).text).toUpperCase();
                                    if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].includes(mStr)) {
                                      httpMethods.push(mStr as HttpMethod);
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                        if (httpMethods.length === 0) {
                          httpMethods.push('GET');
                        }
                      } else {
                        // FastAPI (@router.get, @app.post, etc.)
                        detectedFrameworks.add('FastAPI');
                        const mappedMethod = SUPPORTED_HTTP_METHODS[methodName] || 'GET';
                        httpMethods.push(mappedMethod);

                        if (args) {
                          for (let a = 0; a < args.namedChildCount; a++) {
                            const argNode = args.namedChild(a);
                            if (!rawPath && argNode.type === 'string') {
                              rawPath = cleanPythonString(argNode.text);
                            } else if (argNode.type === 'keyword_argument') {
                              const kw = argNode.childForFieldName('name')?.text;
                              if (kw === 'path' || kw === 'response_model') {
                                if (kw === 'path') {
                                  const val = argNode.childForFieldName('value');
                                  if (val && val.type === 'string') {
                                    rawPath = cleanPythonString(val.text);
                                  }
                                }
                              }
                            }
                          }
                        }
                      }

                      if (rawPath !== '') {
                        const filePrefix = (receiverObj && routerPrefixes.get(receiverObj)) || '';
                        let fullRoute = rawPath;
                        if (filePrefix && !fullRoute.startsWith(filePrefix)) {
                          fullRoute = filePrefix + (fullRoute.startsWith('/') ? fullRoute : '/' + fullRoute);
                        }
                        if (!fullRoute.startsWith('/')) {
                          fullRoute = '/' + fullRoute;
                        }
                        fullRoute = fullRoute.replace(/\/+/g, '/');

                        const startLine = child.startPosition.row + 1;
                        const endLine = fnDef.endPosition.row + 1;

                        for (const method of httpMethods) {
                          routes.push({
                            id: `py-ast-${routeCounter++}`,
                            httpMethod: method,
                            routePath: fullRoute,
                            handlerName,
                            location: {
                              filePath: relFile,
                              startLine,
                              endLine,
                            },
                            codeSnippet: sliceSourceLines(repoDir, relFile, startLine, endLine),
                            calledFunctions,
                          });
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }

        for (let i = 0; i < node.namedChildCount; i++) {
          searchDecorators(node.namedChild(i));
        }
      }

      searchDecorators(tree.rootNode);

      // 3. Search Django routes (path(...) / re_path(...) / url(...) inside urlpatterns)
      function searchDjangoRoutes(node: any) {
        if (node.type === 'call') {
          const fnNode = node.childForFieldName('function');
          const args = node.childForFieldName('arguments');

          if (fnNode && fnNode.type === 'identifier') {
            const fnName = fnNode.text.trim();
            if ((fnName === 'path' || fnName === 're_path' || fnName === 'url') && args && args.namedChildCount >= 2) {
              const firstArg = args.namedChild(0);
              const secondArg = args.namedChild(1);

              if (firstArg && firstArg.type === 'string' && secondArg) {
                detectedFrameworks.add('Django');
                const rawPath = cleanPythonString(firstArg.text);
                const normalizedPath = normalizeDjangoPattern(rawPath);

                let handlerName = secondArg.text.trim().replace(/\.as_view\(\)?/, '').replace(/csrf_exempt\(/, '');
                handlerName = handlerName.split('.').pop() || handlerName;

                const startLine = node.startPosition.row + 1;
                const endLine = node.endPosition.row + 1;

                routes.push({
                  id: `py-ast-${routeCounter++}`,
                  httpMethod: 'ALL',
                  routePath: normalizedPath,
                  handlerName,
                  location: {
                    filePath: relFile,
                    startLine,
                    endLine,
                  },
                  codeSnippet: sliceSourceLines(repoDir, relFile, startLine, endLine),
                  calledFunctions: [handlerName],
                });
              }
            }
          }
        }

        for (let i = 0; i < node.namedChildCount; i++) {
          searchDjangoRoutes(node.namedChild(i));
        }
      }

      searchDjangoRoutes(tree.rootNode);
    } catch (err) {
      console.warn(`[Tree-sitter Python] Error parsing file ${relFile}:`, err);
    }
  }
}

const framework = detectedFrameworks.size > 0 ? Array.from(detectedFrameworks).join(' + ') : 'Python API';

  return {
    routes,
    framework,
    parsedFileCount,
  };
}
