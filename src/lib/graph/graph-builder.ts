import { ExtractedRouteNode } from '../types/ast';
import { CanvasRouteNode, GraphPayload } from '../types/graph';
import { Edge, MarkerType } from '@xyflow/react';

const METHOD_EDGE_COLORS: Record<string, string> = {
  GET: '#10b981',
  POST: '#6366f1',
  PUT: '#f59e0b',
  DELETE: '#f43f5e',
  PATCH: '#a855f7',
  ALL: '#38bdf8',
};

// Domain palette for distinctive visual island themes
const DOMAIN_THEMES = [
  { border: '#38bdf8', glow: 'rgba(56, 189, 248, 0.25)', text: '#7dd3fc', bg: '#0c2340' },
  { border: '#818cf8', glow: 'rgba(129, 140, 248, 0.25)', text: '#c7d2fe', bg: '#1e1b4b' },
  { border: '#34d399', glow: 'rgba(52, 211, 153, 0.25)', text: '#a7f3d0', bg: '#064e3b' },
  { border: '#fbbf24', glow: 'rgba(251, 191, 36, 0.25)', text: '#fde68a', bg: '#451a03' },
  { border: '#f472b6', glow: 'rgba(244, 114, 182, 0.25)', text: '#fbcfe8', bg: '#500724' },
  { border: '#a78bfa', glow: 'rgba(167, 139, 250, 0.25)', text: '#ddd6fe', bg: '#2e1065' },
];

/**
 * Builds a balanced 2D Domain-Clustered "Island" Architecture graph.
 * Routes are grouped into self-contained feature islands so arrows never criss-cross
 * the entire canvas and 2D space is used efficiently in both X and Y dimensions.
 */
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

  // 1. Group routes by Domain / Feature (based on route file or URL prefix)
  const domainMap = new Map<string, ExtractedRouteNode[]>();

  routes.forEach((route) => {
    methodsCount[route.httpMethod] = (methodsCount[route.httpMethod] || 0) + 1;
    filesSet.add(route.location.filePath);

    // Extract clean domain name: e.g. "routes/auth.route.js" -> "Auth Domain"
    let domainName = 'Core Service';
    const filePath = route.location.filePath;
    const fileBase = filePath.split('/').pop() || '';

    const cleanBase = fileBase
      .replace(/\.(route|controller|router|routes|api|service)\.[a-z]+$/i, '')
      .replace(/\.[a-z]+$/i, '');

    if (cleanBase && cleanBase !== 'app' && cleanBase !== 'server' && cleanBase !== 'index') {
      domainName = cleanBase.charAt(0).toUpperCase() + cleanBase.slice(1) + ' Domain';
    } else {
      // Fallback to top-level URL path segment: e.g. "/auth/login" -> "Auth Domain"
      const segments = route.routePath.split('/').filter(Boolean);
      if (segments.length > 0 && segments[0] !== 'api' && segments[0] !== 'v1') {
        domainName = segments[0].charAt(0).toUpperCase() + segments[0].slice(1) + ' Domain';
      }
    }

    if (!domainMap.has(domainName)) {
      domainMap.set(domainName, []);
    }
    domainMap.get(domainName)!.push(route);
  });

  const domains = Array.from(domainMap.entries());
  const numDomains = domains.length;

  // 2. Calculate Balanced 2D Grid Layout for Islands
  // For example: 4 domains -> 2x2 grid; 6 domains -> 3x2 grid; 9 domains -> 3x3 grid
  const ISLAND_COLS = numDomains <= 2 ? numDomains : numDomains <= 6 ? 2 : 3;
  const ISLAND_WIDTH = 680;   // Width allocated to each island (Hub + Routes + Functions)
  const ISLAND_SPACING_X = 80;
  const ISLAND_SPACING_Y = 60;

  // Track max height per row of islands to ensure no vertical overlap between rows
  const rowHeights: number[] = [];

  domains.forEach(([_, domainRoutes], dIndex) => {
    const rowIndex = Math.floor(dIndex / ISLAND_COLS);
    const islandHeight = Math.max(160, domainRoutes.length * 115);
    rowHeights[rowIndex] = Math.max(rowHeights[rowIndex] || 0, islandHeight);
  });

  // Calculate cumulative Y positions for island rows
  const rowYPositions: number[] = [0];
  for (let r = 0; r < rowHeights.length; r++) {
    rowYPositions[r + 1] = rowYPositions[r] + rowHeights[r] + ISLAND_SPACING_Y;
  }

  // 3. Central Gateway Node
  const totalGridWidth = ISLAND_COLS * (ISLAND_WIDTH + ISLAND_SPACING_X);
  const rootNodeId = 'gateway-root';
  const rootNode: CanvasRouteNode = {
    id: rootNodeId,
    type: 'default',
    position: { x: totalGridWidth / 2 - 120, y: -120 },
    data: {
      label: `🌐 ${entrypointLabel} Gateway`,
      httpMethod: 'ALL',
      routePath: '/',
      location: { filePath: 'app-entrypoint', startLine: 1, endLine: 1 },
      codeSnippet: `// Central API Gateway & Dispatcher\n// Orchestrates incoming requests across ${numDomains} domain cluster(s)`,
      calledFunctions: [],
    },
    style: {
      background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
      color: '#e0e7ff',
      border: '2px solid #818cf8',
      borderRadius: '14px',
      fontSize: '13px',
      fontWeight: 700,
      padding: '12px 20px',
      boxShadow: '0 12px 30px -5px rgba(99, 102, 241, 0.5)',
      width: 240,
    },
  };
  nodes.push(rootNode);

  // 4. Populate Each Domain Island
  domains.forEach(([domainName, domainRoutes], dIndex) => {
    const colIndex = dIndex % ISLAND_COLS;
    const rowIndex = Math.floor(dIndex / ISLAND_COLS);

    const islandX = colIndex * (ISLAND_WIDTH + ISLAND_SPACING_X);
    const islandY = rowYPositions[rowIndex];

    const theme = DOMAIN_THEMES[dIndex % DOMAIN_THEMES.length];
    const domainHubId = `domain-hub-${dIndex + 1}`;

    // A. Domain Hub Node (The anchor of this island)
    nodes.push({
      id: domainHubId,
      type: 'default',
      position: { x: islandX, y: islandY + 20 },
      data: {
        label: `📁 ${domainName}`,
        httpMethod: 'ALL',
        routePath: `/${domainName.toLowerCase().replace(/ domain/g, '')}`,
        location: domainRoutes[0].location,
        codeSnippet: `// ${domainName} Cluster\n// Contains ${domainRoutes.length} route endpoint(s)`,
        calledFunctions: [],
      },
      style: {
        background: theme.bg,
        color: theme.text,
        border: `2px solid ${theme.border}`,
        borderRadius: '12px',
        fontSize: '13px',
        fontWeight: 600,
        padding: '10px 16px',
        boxShadow: `0 8px 20px -4px ${theme.glow}`,
        width: 210,
      },
    });

    // B. Edge from Central Gateway to Domain Hub (Clean, long-distance curve)
    edges.push({
      id: `edge-${rootNodeId}->${domainHubId}`,
      source: rootNodeId,
      target: domainHubId,
      type: 'default', // Smooth curved Bezier
      animated: true,
      style: {
        stroke: theme.border,
        strokeWidth: 2,
        strokeOpacity: 0.85,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: theme.border,
        width: 14,
        height: 14,
      },
    });

    // C. Route Nodes localized inside this Island
    domainRoutes.forEach((route, rIndex) => {
      const routeX = islandX + 260;
      const routeY = islandY + (rIndex * 115);

      const routeNode: CanvasRouteNode = {
        id: route.id,
        type: 'routeNode',
        position: { x: routeX, y: routeY },
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

      // Local Island Edge: Hub -> Route (Short, completely isolated, zero overlap with other domains!)
      const edgeColor = METHOD_EDGE_COLORS[route.httpMethod] || '#818cf8';
      edges.push({
        id: `edge-${domainHubId}->${route.id}`,
        source: domainHubId,
        target: route.id,
        type: 'default', // Graceful curve
        style: {
          stroke: edgeColor,
          strokeWidth: 2,
          strokeOpacity: 0.9,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edgeColor,
          width: 12,
          height: 12,
        },
      });

      // D. Function nodes invoked by this route (Placed to the right of the route within the island)
      const uniqueFuncs = Array.from(new Set(route.calledFunctions)).filter(Boolean);
      uniqueFuncs.forEach((funcName, fIndex) => {
        const cleanFn = funcName.replace(/[^a-zA-Z0-9_-]/g, '-');
        const fnNodeId = `fn-${route.id}-${cleanFn}`;

        const fnX = routeX + 310;
        const fnY = routeY + (fIndex * 50);

        nodes.push({
          id: fnNodeId,
          type: 'default',
          position: { x: fnX, y: fnY },
          data: {
            label: `⚙️ ${funcName}()`,
            httpMethod: 'ALL',
            routePath: funcName,
            location: route.location,
            codeSnippet: `// Invoked handler function:\n${funcName}()`,
            calledFunctions: [],
          },
          style: {
            background: 'rgba(15, 23, 42, 0.95)',
            color: '#93c5fd',
            border: '1px solid #38bdf8',
            borderRadius: '8px',
            fontSize: '11px',
            fontFamily: 'monospace',
            padding: '6px 10px',
            width: 190,
          },
        });

        // Local Edge: Route -> Function
        edges.push({
          id: `edge-${route.id}->${fnNodeId}`,
          source: route.id,
          target: fnNodeId,
          type: 'default',
          style: {
            stroke: '#94a3b8',
            strokeWidth: 1.5,
            strokeDasharray: '4 4',
            strokeOpacity: 0.7,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#94a3b8',
            width: 10,
            height: 10,
          },
        });
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
