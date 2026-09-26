export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'USE' | 'ALL';

export interface CodeLocation {
  filePath: string;     // Relative path within repository, e.g. "src/routes/auth.ts"
  startLine: number;    // 1-indexed
  endLine: number;      // 1-indexed
  startColumn?: number;
  endColumn?: number;
}

export interface ExtractedRouteNode {
  id: string;                      // Unique ID (e.g. "route-post-signup-1")
  httpMethod: HttpMethod;          // 'GET', 'POST', etc.
  routePath: string;               // e.g. "/signup" or "/api/v1/users/:id"
  handlerName?: string;            // Identifier if named function or controller reference
  location: CodeLocation;          // File and exact line range
  codeSnippet: string;             // Exact, unmodified source code block
  calledFunctions: string[];       // Function/method calls invoked inside this route handler
}

export interface ParseResult {
  repoUrl: string;
  totalFilesScanned: number;
  routes: ExtractedRouteNode[];
  parseErrors: string[];
}
