import { ExtractedRouteNode } from '../types/ast';
import { CanvasRouteNode, GraphPayload } from '../types/graph';
import { Edge, MarkerType } from '@xyflow/react';
import dagre from 'dagre';

const ROUTE_WIDTH = 270;
const ROUTE_HEIGHT = 90;
const MODULE_WIDTH = 220;
const MODULE_HEIGHT = 65;
const FN_WIDTH = 200;
const FN_HEIGHT = 55;

export function buildRouteGraph(
  routes: ExtractedRouteNode[],
  entrypointLabel: string = 'App Server'
): GraphPayload {
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

  // 1. Root Gateway / Entrypoint Node
  const rootNodeId = 'gateway-root';
  const rootNode: CanvasRouteNode = {
    id: rootNodeId,
    type: 'default',
    position: { x: 0, y: 0 },
    data: {
      label: `🌐 ${entrypointLabel}`,
      httpMethod: 'ALL',
      routePath: '/',
      location: { filePath: 'app-entrypoint', startLine: 1, endLine: 1 },
      codeSnippet: `// Server Gateway & HTTP Dispatcher\n// Orchestrates incoming requests to modular domain routers`,
      calledFunctions: [],
    },
    style: {
      background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
      color: '#e0e7ff',
      border: '1.5px solid #818cf8',
      borderRadius: '12px',
      fontSize: '13px',
      fontWeight: 600,
      padding: '12px 16px',
      boxShadow: '0 10px 25px -5px rgba(99, 102, 241, 0.4)',
      width: 220,
    },
  };
  nodes.push(rootNode);

  // 2. Group Routes into Modular Feature Clusters (by router file or prefix)
  // This prevents vertical blowout and keeps arrows grouped logically
  const moduleMap = new Map<string, ExtractedRouteNode[]>();

  routes.forEach((route) => {
    methodsCount[route.httpMethod] = (methodsCount[route.httpMethod] || 0) + 1;
    filesSet.add(route.location.filePath);

    // Derive clean module name: e.g. "routes/auth.route.js" -> "Auth Service"
    const fileBase = route.location.filePath.split('/').pop() || 'Core';
    const cleanModuleName = fileBase
      .replace(/\.(route|controller|router|routes|api)\.[a-z]+$/i, '')
      .replace(/\.[a-z]+$/i, '');
    const moduleName = cleanModuleName.charAt(0).toUpperCase() + cleanModuleName.slice(1) + ' Router';

    if (!moduleMap.has(moduleName)) {
      moduleMap.set(moduleName, []);
    }
    moduleMap.get(moduleName)!.push(route);
  });

  const shouldCreateModuleNodes = moduleMap.size > 1 && routes.length > 3;
  const functionNodesMap = new Map<string, string>();

  // 3. Construct Nodes and Grouped Edges
  let moduleCounter = 1;

  moduleMap.forEach((moduleRoutes, moduleName) => {
    let parentSourceId = rootNodeId;

    if (shouldCreateModuleNodes) {
      const moduleId = `module-${moduleCounter++}-${moduleName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      parentSourceId = moduleId;

      // Module intermediary router node
      nodes.push({
        id: moduleId,
        type: 'default',
        position: { x: 0, y: 0 },
        data: {
          label: `📁 ${moduleName}`,
          httpMethod: 'ALL',
          routePath: `/${moduleName.toLowerCase().replace(/ router/g, '')}`,
          location: moduleRoutes[0].location,
          codeSnippet: `// Module router grouping ${moduleRoutes.length} route endpoint(s)\n// Defined in ${moduleRoutes[0].location.filePath}`,
          calledFunctions: [],
        },
        style: {
          background: 'rgba(30, 41, 59, 0.95)',
          color: '#38bdf8',
          border: '1.5px solid #0284c7',
          borderRadius: '10px',
          fontSize: '12px',
          fontWeight: 600,
          padding: '10px 14px',
          width: MODULE_WIDTH,
        },
      });

      // Edge from Root Gateway to Module
      edges.push({
        id: `edge-${rootNodeId}->${moduleId}`,
        source: rootNodeId,
        target: moduleId,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#6366f1', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1', width: 14, height: 14 },
      });
    }

    // Connect Routes to their parent module
    moduleRoutes.forEach((route) => {
      const routeNode: CanvasRouteNode = {
        id: route.id,
        type: 'routeNode',
        position: { x: 0, y: 0 },
        data: {
          httpMethod: route.httpMethod,
          routePath: route.routePath,
          handlerName: route.handlerName,
          location: route.location,
          codeSnippet: route.codeSnippet,
          calledFunctions: route.calledFunctions,
          label: `${route.httpMethod} ${route.routePath}`,
        },
      };
      nodes.push(routeNode);

      // Clean smoothstep edge from Module (or Root) to Route
      edges.push({
        id: `edge-${parentSourceId}->${route.id}`,
        source: parentSourceId,
        target: route.id,
        type: 'smoothstep',
        style: { stroke: '#38bdf8', strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#38bdf8', width: 12, height: 12 },
      });

      // Connect functions called by this route
      route.calledFunctions.forEach((funcName) => {
        let fnNodeId = functionNodesMap.get(funcName);

        if (!fnNodeId) {
          fnNodeId = `fn-${funcName.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
          functionNodesMap.set(funcName, fnNodeId);

          nodes.push({
            id: fnNodeId,
            type: 'default',
            position: { x: 0, y: 0 },
            data: {
              label: `⚙️ ${funcName}()`,
              httpMethod: 'ALL',
              routePath: funcName,
              location: route.location,
              codeSnippet: `// Function call reference:\n${funcName}()`,
              calledFunctions: [],
            },
            style: {
              background: 'rgba(15, 23, 42, 0.95)',
              color: '#a5b4fc',
              border: '1px solid #6366f1',
              borderRadius: '8px',
              fontSize: '11px',
              fontFamily: 'monospace',
              padding: '6px 10px',
              width: FN_WIDTH,
            },
          });
        }

        edges.push({
          id: `edge-${route.id}->${fnNodeId}`,
          source: route.id,
          target: fnNodeId,
          type: 'smoothstep',
          style: { stroke: '#818cf8', strokeWidth: 1.2, strokeDasharray: '3 3' },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#818cf8', width: 10, height: 10 },
        });
      });
    });
  });

  // 4. Dagre Horizontal Layout with optimal spacing
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: 'LR',        // Left-to-Right horizontal layout
    align: 'DL',
    nodesep: 35,          // Vertical separation between sibling nodes in a rank
    ranksep: 90,          // Horizontal separation between architecture ranks
    marginx: 40,
    marginy: 40,
  });
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((node) => {
    let width = ROUTE_WIDTH;
    let height = ROUTE_HEIGHT;

    if (node.id === rootNodeId) {
      width = 220;
      height = 65;
    } else if (node.id.startsWith('module-')) {
      width = MODULE_WIDTH;
      height = MODULE_HEIGHT;
    } else if (node.id.startsWith('fn-')) {
      width = FN_WIDTH;
      height = FN_HEIGHT;
    }

    g.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  // Apply computed coordinates
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPos = g.node(node.id);
    let width = ROUTE_WIDTH;
    let height = ROUTE_HEIGHT;

    if (node.id === rootNodeId) {
      width = 220;
      height = 65;
    } else if (node.id.startsWith('module-')) {
      width = MODULE_WIDTH;
      height = MODULE_HEIGHT;
    } else if (node.id.startsWith('fn-')) {
      width = FN_WIDTH;
      height = FN_HEIGHT;
    }

    return {
      ...node,
      position: {
        x: nodeWithPos.x - width / 2,
        y: nodeWithPos.y - height / 2,
      },
    };
  });

  return {
    nodes: layoutedNodes,
    edges,
    stats: {
      totalRoutes: routes.length,
      methodsCount,
      filesCount: filesSet.size,
    },
  };
}
