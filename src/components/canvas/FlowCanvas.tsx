'use client';

import React, { useMemo, useCallback, useState, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  Node,
  Edge,
  NodeTypes,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import RouteNode from './RouteNode';
import GatewayNode from './GatewayNode';
import DomainHubNode from './DomainHubNode';
import FunctionNode from './FunctionNode';
import { CanvasRouteNode, RouteNodeData } from '@/lib/types/graph';
import { Maximize2, ZoomIn, ZoomOut, Layers, Eye, EyeOff, Filter } from 'lucide-react';

interface FlowCanvasProps {
  initialNodes: CanvasRouteNode[];
  initialEdges: Edge[];
  onSelectNode: (data: RouteNodeData | null) => void;
}

function CanvasInner({ initialNodes, initialEdges, onSelectNode }: FlowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { fitView, zoomIn, zoomOut } = useReactFlow();

  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [allExpanded, setAllExpanded] = useState<boolean>(false);
  const [expandedRouteIds, setExpandedRouteIds] = useState<Set<string>>(new Set());

  // Extract list of domain subsystems for filter bar
  const domainList = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    initialNodes.forEach((n) => {
      if (n.type === 'routeNode') {
        const data = n.data as RouteNodeData;
        const dId = data?.domainId || 'default';
        const dName = data?.domainName || 'General';
        if (!map.has(dId)) {
          map.set(dId, { id: dId, name: dName.replace(/ Domain/i, ''), count: 0 });
        }
        map.get(dId)!.count++;
      }
    });
    return Array.from(map.values());
  }, [initialNodes]);

  // Toggle single route dependencies (progressive disclosure)
  const handleToggleRouteExpand = useCallback((routeId: string) => {
    setExpandedRouteIds((prev) => {
      const next = new Set(prev);
      if (next.has(routeId)) {
        next.delete(routeId);
      } else {
        next.add(routeId);
      }
      return next;
    });
  }, []);

  // Toggle all dependencies globally
  const handleToggleAllDependencies = useCallback(() => {
    setAllExpanded((prev) => !prev);
  }, []);

  // Synchronize node/edge visibility based on selected domain and expanded routes
  useEffect(() => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        const data = node.data as RouteNodeData;

        // Route Node: inject onToggleExpand callback and isExpanded state
        if (node.type === 'routeNode') {
          const isDomainMatch = selectedDomain === 'all' || data?.domainId === selectedDomain;
          const isRouteExpanded = allExpanded || expandedRouteIds.has(node.id);

          return {
            ...node,
            hidden: !isDomainMatch,
            data: {
              ...data,
              isExpanded: isRouteExpanded,
              onToggleExpand: handleToggleRouteExpand,
            },
          };
        }

        // Function Node: visible only if parent route is expanded and domain matches
        if (data?.parentRouteId) {
          const isDomainMatch = selectedDomain === 'all' || data?.domainId === selectedDomain;
          const isParentExpanded = allExpanded || expandedRouteIds.has(data.parentRouteId);

          return {
            ...node,
            hidden: !isDomainMatch || !isParentExpanded,
          };
        }

        // Gateway root: always visible
        if (node.id === 'gateway-root') {
          return { ...node, hidden: false };
        }

        // Domain Container / Domain Hub: match selected domain
        const nodeDomainId = (data?.domainId as string) || node.id;
        const isDomainMatch = selectedDomain === 'all' || nodeDomainId === selectedDomain || node.id.includes(selectedDomain);

        return {
          ...node,
          hidden: !isDomainMatch,
        };
      })
    );

    setEdges((currentEdges) =>
      currentEdges.map((edge) => {
        const edgeData = edge.data as { parentRouteId?: string; domainId?: string } | undefined;

        // Function edge: visible only if parent route is expanded
        if (edgeData?.parentRouteId) {
          const isDomainMatch = selectedDomain === 'all' || edgeData?.domainId === selectedDomain;
          const isParentExpanded = allExpanded || expandedRouteIds.has(edgeData.parentRouteId);

          return {
            ...edge,
            hidden: !isDomainMatch || !isParentExpanded,
          };
        }

        // Domain edge: match selected domain
        if (edgeData?.domainId) {
          const isDomainMatch = selectedDomain === 'all' || edgeData.domainId === selectedDomain;
          return {
            ...edge,
            hidden: !isDomainMatch,
          };
        }

        return edge;
      })
    );
  }, [selectedDomain, allExpanded, expandedRouteIds, handleToggleRouteExpand, setNodes, setEdges]);

  // Handle Domain Tab Click
  const handleDomainSelect = (domainId: string) => {
    setSelectedDomain(domainId);
    setTimeout(() => {
      fitView({ padding: 0.2, duration: 400 });
    }, 50);
  };

  const nodeTypes: NodeTypes = useMemo(
    () => ({
      routeNode: RouteNode,
      gatewayNode: GatewayNode,
      domainHub: DomainHubNode,
      functionNode: FunctionNode,
    }),
    []
  );

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onSelectNode(node.data as RouteNodeData);
    },
    [onSelectNode]
  );

  const handlePaneClick = useCallback(() => {
    onSelectNode(null);
  }, [onSelectNode]);

  return (
    <div className="w-full h-full relative bg-[#090d16]">
      {/* Top Floating Canvas Controls & Domain Filters */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Left: Toolbar Controls */}
        <div className="flex items-center gap-2 glass-panel px-3 py-1.5 rounded-xl border border-slate-800 text-xs shadow-xl pointer-events-auto">
          <div className="flex items-center gap-1.5 text-slate-400 font-mono pr-2 border-r border-slate-800">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>{nodes.filter((n) => !n.hidden).length} Visible</span>
            <span className="text-slate-600">•</span>
            <span>{edges.filter((e) => !e.hidden).length} Links</span>
          </div>

          <button
            onClick={() => fitView({ padding: 0.15, duration: 400 })}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-[11px]"
            title="Fit view on screen"
          >
            <Maximize2 className="w-3 h-3 text-cyan-400" />
            <span>Fit Screen</span>
          </button>

          {/* Progressive Disclosure Toggle */}
          <button
            onClick={handleToggleAllDependencies}
            className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] transition-colors ${allExpanded
                ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-300'
                : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700/60 text-slate-300 hover:text-white'
              }`}
            title="Toggle downstream function dependencies"
          >
            {allExpanded ? <EyeOff className="w-3 h-3 text-indigo-400" /> : <Eye className="w-3 h-3 text-amber-400" />}
            <span>{allExpanded ? 'Fold Calls' : 'Trace Calls'}</span>
          </button>

          <button
            onClick={() => zoomIn({ duration: 300 })}
            className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => zoomOut({ duration: 300 })}
            className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Domain Subsystem Filter Bar */}
        {domainList.length > 1 && (
          <div className="flex items-center gap-1.5 glass-panel px-2 py-1 rounded-xl border border-slate-800 text-xs shadow-xl pointer-events-auto overflow-x-auto max-w-xl">
            <span className="text-[10px] text-slate-500 font-mono px-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-slate-400" />
              <span>Clusters:</span>
            </span>

            <button
              onClick={() => handleDomainSelect('all')}
              className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${selectedDomain === 'all'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
            >
              All ({initialNodes.filter((n) => n.type === 'routeNode').length})
            </button>

            {domainList.map((d) => (
              <button
                key={d.id}
                onClick={() => handleDomainSelect(d.id)}
                className={`px-2 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all ${selectedDomain === d.id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
              >
                {d.name} ({d.count})
              </button>
            ))}
          </div>
        )}
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.08}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        onlyRenderVisibleElements={true}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.2}
          color="#1e293b"
        />
        <Controls
          showInteractive={false}
          className="!bg-slate-900 !border-slate-800 !shadow-xl !rounded-xl !overflow-hidden [&>button]:!bg-slate-900 [&>button]:!border-slate-800 [&>button]:!fill-slate-300 hover:[&>button]:!fill-white"
        />
        <MiniMap
          position="bottom-right"
          nodeColor={(node) => {
            if (node.hidden) return 'transparent';
            if (node.type === 'routeNode') {
              const data = node.data as RouteNodeData;
              if (data?.httpMethod === 'GET') return '#10b981';
              if (data?.httpMethod === 'POST') return '#6366f1';
              if (data?.httpMethod === 'PUT') return '#f59e0b';
              if (data?.httpMethod === 'DELETE') return '#f43f5e';
              if (data?.httpMethod === 'PATCH') return '#a855f7';
              return '#38bdf8';
            }
            if (node.type === 'domainHub' || node.id.startsWith('domain-hub-')) return '#818cf8';
            if (node.type === 'gatewayNode' || node.id === 'gateway-root') return '#6366f1';
            if (node.type === 'functionNode') return '#06b6d4';
            return '#334155';
          }}
          nodeStrokeColor={(node) => {
            if (node.hidden) return 'transparent';
            if (node.type === 'routeNode') {
              const data = node.data as RouteNodeData;
              if (data?.httpMethod === 'GET') return '#34d399';
              if (data?.httpMethod === 'POST') return '#818cf8';
              if (data?.httpMethod === 'PUT') return '#fbbf24';
              if (data?.httpMethod === 'DELETE') return '#fb7185';
              if (data?.httpMethod === 'PATCH') return '#c084fc';
              return '#38bdf8';
            }
            if (node.type === 'domainHub') return '#a5b4fc';
            if (node.type === 'gatewayNode') return '#a5b4fc';
            if (node.type === 'functionNode') return '#22d3ee';
            return '#475569';
          }}
          nodeStrokeWidth={1.5}
          nodeBorderRadius={4}
          pannable={true}
          zoomable={true}
          className="!bg-slate-950/90 !border !border-slate-800 !rounded-xl !shadow-2xl overflow-hidden"
          maskColor="rgba(9, 13, 22, 0.75)"
          maskStrokeColor="#6366f1"
          maskStrokeWidth={1.5}
        />
      </ReactFlow>
    </div>
  );
}

export default function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
