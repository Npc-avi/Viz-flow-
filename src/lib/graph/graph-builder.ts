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
  { border: '#38bdf8', glow: 'rgba(56, 189, 248, 0.25)', text: '#7dd3fc', bg: '#0c2340', containerBg: 'rgba(12, 35, 64, 0.35)' },
  { border: '#818cf8', glow: 'rgba(129, 140, 248, 0.25)', text: '#c7d2fe', bg: '#1e1b4b', containerBg: 'rgba(30, 27, 75, 0.35)' },
  { border: '#34d399', glow: 'rgba(52, 211, 153, 0.25)', text: '#a7f3d0', bg: '#064e3b', containerBg: 'rgba(6, 78, 59, 0.35)' },
  { border: '#fbbf24', glow: 'rgba(251, 191, 36, 0.25)', text: '#fde68a', bg: '#451a03', containerBg: 'rgba(69, 26, 3, 0.35)' },
  { border: '#f472b6', glow: 'rgba(244, 114, 182, 0.25)', text: '#fbcfe8', bg: '#500724', containerBg: 'rgba(80, 7, 36, 0.35)' },
  { border: '#a78bfa', glow: 'rgba(167, 139, 250, 0.25)', text: '#ddd6fe', bg: '#2e1065', containerBg: 'rgba(46, 16, 101, 0.35)' },
];

interface DomainLayoutMeta {
  domainName: string;
  domainRoutes: ExtractedRouteNode[];
  hasFunctions: boolean;
  containerWidth: number;
  containerHeight: number;
  routeRowHeights: number[];
}

/**
 * Builds an Option 2 (Visual Group Containers / Bounded Islands) architecture graph.
 * Each domain is rendered inside a distinct bounded container with dynamic vertical clearance
 * to mathematically eliminate all card and arrow overlaps.
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

    if (cleanBase && cleanBase !== 'app' && cleanBase !== 'server' && cleanBase !== 'index' && cleanBase !== 'main') {
      domainName = cleanBase.charAt(0).toUpperCase() + cleanBase.slice(1) + ' Domain';
    } else {
      // Fallback to top-level URL path segment: e.g. "/auth/login" -> "Auth Domain"
      const segments = route.routePath.split('/').filter(Boolean);
      if (segments.length > 0 && segments[0] !== 'api' && segments[0] !== 'v1' && segments[0] !== 'v2') {
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

  // 2. Pre-calculate exact dynamic dimensions for every domain container
  const domainMetas: DomainLayoutMeta[] = domains.map(([domainName, domainRoutes]) => {
    let hasFunctions = false;
    const routeRowHeights: number[] = [];
    let cumulativeHeight = 65; // initial top offset for container badge

    domainRoutes.forEach((route) => {
      const uniqueFuncs = Array.from(new Set(route.calledFunctions)).filter(Boolean);
      if (uniqueFuncs.length > 0) {
        hasFunctions = true;
      }
      // Calculate row height: Route card (74px) + vertical stack of function cards (52px each)
      const rowHeight = Math.max(88, uniqueFuncs.length * 52);
      routeRowHeights.push(rowHeight);
      cumulativeHeight += rowHeight + 28; // 28px margin between route rows
    });

    const containerWidth = hasFunctions ? 890 : 640;
    const containerHeight = Math.max(220, cumulativeHeight + 20);

    return {
      domainName,
      domainRoutes,
      hasFunctions,
      containerWidth,
      containerHeight,
      routeRowHeights,
    };
  });

  // 3. Grid geometry: 2 columns for up to 6 domains, 3 columns for 7+
  const ISLAND_COLS = numDomains <= 2 ? numDomains : numDomains <= 6 ? 2 : 3;
  const DEFAULT_CONTAINER_WIDTH = 890;
  const ISLAND_SPACING_X = 140;
  const ISLAND_SPACING_Y = 120;

  // Calculate row heights across the 2D grid to ensure zero vertical collision between rows of islands
  const gridRowHeights: number[] = [];
  domainMetas.forEach((meta, dIndex) => {
    const rowIndex = Math.floor(dIndex / ISLAND_COLS);
    gridRowHeights[rowIndex] = Math.max(gridRowHeights[rowIndex] || 0, meta.containerHeight);
  });

  // Cumulative Y starting points for each grid row
  const rowYPositions: number[] = [0];
  for (let r = 0; r < gridRowHeights.length; r++) {
    rowYPositions[r + 1] = rowYPositions[r] + gridRowHeights[r] + ISLAND_SPACING_Y;
  }

  // 4. Central Gateway Node (Above the grid)
  const totalGridWidth = ISLAND_COLS * (DEFAULT_CONTAINER_WIDTH + ISLAND_SPACING_X);
  const rootNodeId = 'gateway-root';
  const rootNode: CanvasRouteNode = {
    id: rootNodeId,
    type: 'default',
    position: { x: totalGridWidth / 2 - 130, y: -140 },
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
      width: 260,
    },
  };
  nodes.push(rootNode);

  // 5. Build Each Bounded Domain Island Container & Contents
  domainMetas.forEach((meta, dIndex) => {
    const { domainName, domainRoutes, containerWidth, containerHeight, routeRowHeights } = meta;
    const colIndex = dIndex % ISLAND_COLS;
    const rowIndex = Math.floor(dIndex / ISLAND_COLS);

    const islandX = colIndex * (DEFAULT_CONTAINER_WIDTH + ISLAND_SPACING_X);
    const islandY = rowYPositions[rowIndex];

    const theme = DOMAIN_THEMES[dIndex % DOMAIN_THEMES.length];
    const containerId = `domain-container-${dIndex + 1}`;
    const domainHubId = `domain-hub-${dIndex + 1}`;

    // A. Visual Bounded Container Node (The Bounded Island Box)
    nodes.push({
      id: containerId,
      type: 'default',
      position: { x: islandX, y: islandY },
      data: {
        label: `📦 ${domainName} (${domainRoutes.length} Endpoint${domainRoutes.length > 1 ? 's' : ''})`,
        httpMethod: 'ALL',
        routePath: `/${domainName.toLowerCase().replace(/ domain/g, '')}`,
        location: domainRoutes[0].location,
        codeSnippet: `// ${domainName} Subsystem Container\n// Contains ${domainRoutes.length} routes with full dependency tracing`,
        calledFunctions: [],
      },
      style: {
        width: containerWidth,
        height: containerHeight,
        background: theme.containerBg,
        border: `1.5px dashed ${theme.border}`,
        borderRadius: '20px',
        boxShadow: `0 12px 36px -6px ${theme.glow}`,
        padding: '14px 18px',
        fontSize: '12px',
        fontWeight: 700,
        color: theme.text,
        letterSpacing: '0.04em',
        zIndex: -1,
        pointerEvents: 'none',
      },
    });

    // B. Domain Hub Node (Vertically centered inside the container on the left)
    const hubY = islandY + Math.max(65, (containerHeight / 2) - 30);
    nodes.push({
      id: domainHubId,
      type: 'default',
      position: { x: islandX + 35, y: hubY },
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

    // C. Gateway -> Domain Hub Curved Bezier Edge
    edges.push({
      id: `edge-${rootNodeId}->${domainHubId}`,
      source: rootNodeId,
      target: domainHubId,
      type: 'default',
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

    // D. Route Nodes & Function Nodes inside the Container
    let currentRelY = 65;

    domainRoutes.forEach((route, rIndex) => {
      const routeX = islandX + 295;
      const routeY = islandY + currentRelY;
      const rowHeight = routeRowHeights[rIndex];

      const routeNode: CanvasRouteNode = {
        id: route.id,
        type: 'routeNode',
        position: { x: routeX, y: routeY },
        data: {
          id: route.id,
          httpMethod: route.httpMethod,
          routePath: route.routePath,
          handlerName: route.handlerName,
          location: route.location,
          codeSnippet: route.codeSnippet,
          calledFunctions: route.calledFunctions,
          label: `${route.httpMethod} ${route.routePath}`,
          domainName,
          domainId: containerId,
          isExpanded: false,
        },
      };
      nodes.push(routeNode);

      // Hub -> Route Curved Edge
      const edgeColor = METHOD_EDGE_COLORS[route.httpMethod] || '#818cf8';
      edges.push({
        id: `edge-${domainHubId}->${route.id}`,
        source: domainHubId,
        target: route.id,
        type: 'default',
        data: {
          domainId: containerId,
        },
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

      // E. Function Nodes (Placed to the right of this route, folded by default)
      const uniqueFuncs = Array.from(new Set(route.calledFunctions)).filter(Boolean);
      uniqueFuncs.forEach((funcName, fIndex) => {
        const cleanFn = funcName.replace(/[^a-zA-Z0-9_-]/g, '-');
        const fnNodeId = `fn-${route.id}-${cleanFn}`;

        const fnX = routeX + 330;
        const fnY = routeY + (fIndex * 50);

        nodes.push({
          id: fnNodeId,
          type: 'default',
          hidden: true, // Progressive disclosure: folded by default
          position: { x: fnX, y: fnY },
          data: {
            id: fnNodeId,
            label: `⚙️ ${funcName}()`,
            httpMethod: 'ALL',
            routePath: funcName,
            location: route.location,
            codeSnippet: `// Invoked handler function:\n${funcName}()`,
            calledFunctions: [],
            parentRouteId: route.id,
            domainName,
            domainId: containerId,
          },
          style: {
            background: 'rgba(15, 23, 42, 0.95)',
            color: '#93c5fd',
            border: '1px solid #38bdf8',
            borderRadius: '8px',
            fontSize: '11px',
            fontFamily: 'monospace',
            padding: '6px 10px',
            width: 200,
          },
        });

        // Route -> Function Edge (Folded by default)
        edges.push({
          id: `edge-${route.id}->${fnNodeId}`,
          source: route.id,
          target: fnNodeId,
          type: 'default',
          hidden: true, // Progressive disclosure: folded by default
          data: {
            parentRouteId: route.id,
            domainId: containerId,
          },
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

      // Advance Y position with guaranteed clearance for all function nodes in this row
      currentRelY += rowHeight + 28;
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
