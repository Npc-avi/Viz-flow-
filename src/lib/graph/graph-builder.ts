import { ExtractedRouteNode } from '../types/ast';
import { CanvasRouteNode, GraphPayload } from '../types/graph';
import { Edge } from '@xyflow/react';

export function buildRouteGraph(routes: ExtractedRouteNode[]): GraphPayload {
  const nodes: CanvasRouteNode[] = [];
  const edges: Edge[] = [];

  const methodsCount: Record<string, number> = {
    GET: 0,
    POST: 0,
    PUT: 0,
    DELETE: 0,
    PATCH: 0,
    ALL: 0,
  };

  const filesSet = new Set<string>();

  // Function nodes map to avoid duplicates
  const functionNodesMap = new Map<string, { id: string; name: string }>();

  // Layout parameters
  const HORIZONTAL_SPACING = 340;
  const VERTICAL_SPACING = 160;
  const ROUTES_PER_ROW = 3;

  // 1. Create Route Nodes
  routes.forEach((route, index) => {
    methodsCount[route.httpMethod] = (methodsCount[route.httpMethod] || 0) + 1;
    filesSet.add(route.location.filePath);

    const col = index % ROUTES_PER_ROW;
    const row = Math.floor(index / ROUTES_PER_ROW);

    const x = col * HORIZONTAL_SPACING;
    const y = row * VERTICAL_SPACING;

    const label = `${route.httpMethod} ${route.routePath}`;

    const routeNode: CanvasRouteNode = {
      id: route.id,
      type: 'routeNode',
      position: { x, y },
      data: {
        httpMethod: route.httpMethod,
        routePath: route.routePath,
        handlerName: route.handlerName,
        location: route.location,
        codeSnippet: route.codeSnippet,
        calledFunctions: route.calledFunctions,
        label,
      },
    };

    nodes.push(routeNode);

    // 2. Process function calls and create edges
    route.calledFunctions.forEach((funcName) => {
      let fnNode = functionNodesMap.get(funcName);

      if (!fnNode) {
        const fnNodeId = `fn-${funcName.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
        fnNode = { id: fnNodeId, name: funcName };
        functionNodesMap.set(funcName, fnNode);

        // Place function node to the right / below
        const fnIndex = functionNodesMap.size;
        const fnX = (ROUTES_PER_ROW * HORIZONTAL_SPACING) + 60;
        const fnY = (fnIndex - 1) * 110;

        nodes.push({
          id: fnNodeId,
          type: 'default',
          position: { x: fnX, y: fnY },
          data: {
            label: `⚙️ ${funcName}()`,
            httpMethod: 'ALL',
            routePath: funcName,
            location: route.location,
            codeSnippet: `// Function call reference:\n${funcName}()`,
            calledFunctions: [],
          },
          style: {
            background: '#1e293b',
            color: '#93c5fd',
            border: '1px solid #3b82f6',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 500,
            padding: '8px 12px',
          },
        });
      }

      edges.push({
        id: `edge-${route.id}->${fnNode.id}`,
        source: route.id,
        target: fnNode.id,
        animated: true,
        style: { stroke: '#6366f1', strokeWidth: 1.5 },
      });
    });
  });

  return {
    nodes,
    edges,
    stats: {
      totalRoutes: routes.length,
      methodsCount,
      filesCount: filesSet.size,
    },
  };
}
