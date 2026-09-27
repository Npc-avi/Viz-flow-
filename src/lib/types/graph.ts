import type { Node, Edge } from '@xyflow/react';
import type { HttpMethod, CodeLocation } from './ast';

export interface RouteNodeData {
  id?: string;
  label?: string;
  httpMethod: HttpMethod;
  routePath: string;
  handlerName?: string;
  location: CodeLocation;
  codeSnippet: string;
  calledFunctions: string[];
  isExpanded?: boolean;
  onToggleExpand?: (routeId: string) => void;
  domainName?: string;
  domainId?: string;
  parentRouteId?: string;
  [key: string]: unknown;
}

export type CanvasRouteNode = Node<
  RouteNodeData,
  'routeNode' | 'functionNode' | 'default' | 'group' | 'gatewayNode' | 'domainHub'
>;

export interface GraphPayload {
  nodes: CanvasRouteNode[];
  edges: Edge[];
  stats: {
    totalRoutes: number;
    methodsCount: Record<string, number>;
    filesCount: number;
  };
}
