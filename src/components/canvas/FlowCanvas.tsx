'use client';

import React, { useMemo, useCallback } from 'react';
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
import { CanvasRouteNode, RouteNodeData } from '@/lib/types/graph';
import { Maximize2, ZoomIn, ZoomOut, Layers } from 'lucide-react';

interface FlowCanvasProps {
  initialNodes: CanvasRouteNode[];
  initialEdges: Edge[];
  onSelectNode: (data: RouteNodeData | null) => void;
}

function CanvasInner({ initialNodes, initialEdges, onSelectNode }: FlowCanvasProps) {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);
  const { fitView, zoomIn, zoomOut } = useReactFlow();

  const nodeTypes: NodeTypes = useMemo(
    () => ({
      routeNode: RouteNode,
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
      {/* Top Floating Canvas Toolbar */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2 glass-panel px-3 py-1.5 rounded-xl border border-slate-800 text-xs shadow-xl">
        <div className="flex items-center gap-1.5 text-slate-400 font-mono pr-2 border-r border-slate-800">
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          <span>{nodes.length} Blocks</span>
          <span className="text-slate-600">•</span>
          <span>{edges.length} Links</span>
        </div>

        <button
          onClick={() => fitView({ padding: 0.15, duration: 400 })}
          className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-[11px]"
          title="Fit full architecture on screen"
        >
          <Maximize2 className="w-3 h-3 text-cyan-400" />
          <span>Fit Screen</span>
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
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
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
          nodeColor={(node) => {
            if (node.type === 'routeNode') {
              const data = node.data as RouteNodeData;
              if (data?.httpMethod === 'GET') return '#10b981';
              if (data?.httpMethod === 'POST') return '#6366f1';
              if (data?.httpMethod === 'DELETE') return '#f43f5e';
              return '#38bdf8';
            }
            if (node.id.startsWith('module-')) return '#0284c7';
            if (node.id === 'gateway-root') return '#818cf8';
            return '#475569';
          }}
          className="!bg-slate-950/80 !border-slate-800 !rounded-xl overflow-hidden"
          maskColor="rgba(9, 13, 22, 0.7)"
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
