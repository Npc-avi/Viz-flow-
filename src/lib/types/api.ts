import type { ExtractedRouteNode } from './ast';
import type { GraphPayload } from './graph';

export interface CloneRequest {
  repoUrl: string;
}

export interface CloneResponse {
  success: boolean;
  repoId: string;
  repoName: string;
  files: string[];
  totalFiles: number;
  error?: string;
}

export interface AnalyzeRequest {
  repoUrl?: string;
  repoId?: string;
}

export interface AnalyzeResponse {
  success: boolean;
  repoName: string;
  graph: GraphPayload;
  rawRoutes: ExtractedRouteNode[];
  error?: string;
}
