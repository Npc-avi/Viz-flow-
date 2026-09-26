import { Project, SourceFile, Node, SyntaxKind, CallExpression } from 'ts-morph';
import path from 'path';
import { ExtractedRouteNode, HttpMethod } from '../types/ast';
import { sliceSourceLines } from './code-slicer';

const HTTP_METHODS: Record<string, HttpMethod> = {
  get: 'GET',
  post: 'POST',
  put: 'PUT',
  delete: 'DELETE',
  patch: 'PATCH',
  all: 'ALL',
};

// Express/Node built-in methods we ignore when mapping custom function calls
const IGNORED_CALL_TARGETS = new Set([
  'res.json',
  'res.status',
  'res.send',
  'res.sendStatus',
  'res.redirect',
  'res.render',
  'res.cookie',
  'res.clearCookie',
  'res.set',
  'res.setHeader',
  'res.end',
  'req.header',
  'req.get',
  'next',
  'console.log',
  'console.error',
  'console.warn',
  'console.info',
  'Date.now',
  'JSON.stringify',
  'JSON.parse',
  'String',
  'Number',
  'Boolean',
  'Array.isArray',
  'Promise.resolve',
  'Promise.reject',
]);

export interface ExtractionOutput {
  routes: ExtractedRouteNode[];
  mountedRouters: Array<{ prefix: string; routerIdentifier: string; filePath: string }>;
  scannedFilesCount: number;
}

/**
 * Extracts route definitions, handlers, and called functions from a ts-morph Project
 */
export function extractExpressRoutes(project: Project, repoDir: string): ExtractionOutput {
  const sourceFiles = project.getSourceFiles();
  const routes: ExtractedRouteNode[] = [];
  const mountedRouters: Array<{ prefix: string; routerIdentifier: string; filePath: string }> = [];

  let routeCounter = 1;

  for (const sourceFile of sourceFiles) {
    const rawFilePath = sourceFile.getFilePath();
    const relativePath = path.relative(repoDir, rawFilePath).replace(/\\/g, '/');

    // Skip node_modules or build output if inadvertently included
    if (relativePath.startsWith('node_modules') || relativePath.startsWith('dist')) {
      continue;
    }

    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

    for (const callExpr of callExpressions) {
      const expr = callExpr.getExpression();

      // Check for property access: e.g. app.get(...), router.post(...)
      if (!Node.isPropertyAccessExpression(expr)) {
        continue;
      }

      const methodName = expr.getName().toLowerCase();
      const callerText = expr.getExpression().getText();

      const args = callExpr.getArguments();
      if (args.length === 0) {
        continue;
      }

      // Check for router mounting: e.g. app.use('/api', apiRouter)
      if (methodName === 'use' && args.length >= 2) {
        const firstArg = args[0];
        const secondArg = args[1];
        if (Node.isStringLiteral(firstArg)) {
          mountedRouters.push({
            prefix: firstArg.getLiteralText(),
            routerIdentifier: secondArg.getText(),
            filePath: relativePath,
          });
        }
        continue;
      }

      // Check for HTTP route handler methods (get, post, put, delete, patch, all)
      if (!HTTP_METHODS[methodName]) {
        continue;
      }

      // Express route definitions always take at least a path and a handler callback (args.length >= 2)
      if (args.length < 2) {
        continue;
      }

      // Filter out non-Express object callers (e.g. Container.get('logger'), map.get('x'), config.get('port'))
      const nonRouterCallers = /^(Container|map|Map|config|session|params|query|headers|cache|store|redis|db|serviceLocator)$/i;
      if (nonRouterCallers.test(callerText)) {
        continue;
      }

      const httpMethod = HTTP_METHODS[methodName];
      let routePath = '/';
      let handlerStartIndex = 1;

      const firstArg = args[0];
      if (Node.isStringLiteral(firstArg)) {
        routePath = firstArg.getLiteralText();
      } else if (Node.isNoSubstitutionTemplateLiteral(firstArg)) {
        routePath = firstArg.getLiteralText();
      } else {
        // If first argument is not a string literal, skip
        continue;
      }

      // Valid route paths in Express start with '/' or '*'
      if (!routePath.startsWith('/') && routePath !== '*') {
        continue;
      }

      // Handlers are arguments after the path
      const handlerArgs = args.slice(handlerStartIndex);
      const calledFunctionsSet = new Set<string>();
      let handlerName: string | undefined = undefined;

      for (const handlerArg of handlerArgs) {
        // Case 1: Direct function reference (e.g. loginHandler or authController.login)
        if (Node.isIdentifier(handlerArg) || Node.isPropertyAccessExpression(handlerArg)) {
          const name = handlerArg.getText();
          handlerName = name;
          calledFunctionsSet.add(name);

          // Find the function's definition in the project to extract its inner calls
          const innerCalls = findInnerCallsForIdentifier(handlerArg, project);
          innerCalls.forEach((call) => calledFunctionsSet.add(call));
        }

        // Case 2: Inline arrow function (req, res) => { ... } or function expression
        if (Node.isArrowFunction(handlerArg) || Node.isFunctionExpression(handlerArg)) {
          handlerName = 'inlineHandler';
          const innerCalls = findCallExpressionsInNode(handlerArg);
          innerCalls.forEach((call) => calledFunctionsSet.add(call));
        }
      }

      // Start and end lines (1-indexed)
      const startLine = callExpr.getStartLineNumber();
      const endLine = callExpr.getEndLineNumber();

      // Step 8: Sliced real unmodified source code block
      const codeSnippet = sliceSourceLines(repoDir, relativePath, startLine, endLine);

      const routeId = `route-${httpMethod.toLowerCase()}-${routeCounter++}-${cleanId(routePath)}`;

      routes.push({
        id: routeId,
        httpMethod,
        routePath,
        handlerName,
        location: {
          filePath: relativePath,
          startLine,
          endLine,
          startColumn: callExpr.getStart(),
          endColumn: callExpr.getEnd(),
        },
        codeSnippet,
        calledFunctions: Array.from(calledFunctionsSet),
      });
    }
  }

  return {
    routes,
    mountedRouters,
    scannedFilesCount: sourceFiles.length,
  };
}

/**
 * Extracts function/method names invoked inside an AST node
 */
function findCallExpressionsInNode(rootNode: Node): string[] {
  const calls: string[] = [];
  const descendants = rootNode.getDescendantsOfKind(SyntaxKind.CallExpression);

  for (const call of descendants) {
    const expr = call.getExpression();
    const callText = expr.getText();

    if (!IGNORED_CALL_TARGETS.has(callText)) {
      // Filter out chaining on 'res.' (e.g. res.status().json())
      if (!callText.startsWith('res.') && !callText.startsWith('req.')) {
        calls.push(callText);
      }
    }
  }

  return calls;
}

/**
 * Follows an identifier to its definition to find calls inside that function body
 */
function findInnerCallsForIdentifier(identifierNode: Node, project: Project): string[] {
  const calls: string[] = [];
  const targetName = identifierNode.getText();

  // Try to find function declaration with matching name in project files
  for (const file of project.getSourceFiles()) {
    // 1. Check FunctionDeclaration: function loginHandler(...) { ... }
    const func = file.getFunction(targetName);
    if (func) {
      return findCallExpressionsInNode(func);
    }

    // 2. Check VariableDeclaration: const loginHandler = (...) => { ... }
    const varDecl = file.getVariableDeclaration(targetName);
    if (varDecl) {
      const initializer = varDecl.getInitializer();
      if (initializer) {
        return findCallExpressionsInNode(initializer);
      }
    }
  }

  return calls;
}

function cleanId(str: string): string {
  return str.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'root';
}
