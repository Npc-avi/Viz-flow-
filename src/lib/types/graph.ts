import type { Node, Edge } from '@xyflow/react';
import type { HttpMethod, CodeLocation } from './ast';

export interface RouteNodeData {
  httpMethod: HttpMethod;
  routePath: string;
  handlerName?: string;
  location: CodeLocation;
  codeSnippet: string;
  calledFunctions: string[];
  [key: string]: unknown;
}

export type CanvasRouteNode = Node<RouteNodeData, 'routeNode' | 'functionNode' | 'default'>;

export interface GraphPayload {
  nodes: CanvasRouteNode[];
  edges: Edge[];
  stats: {
    totalRoutes: number;
    methodsCount: Record<string, number>;
    filesCount: number;
  };
}
