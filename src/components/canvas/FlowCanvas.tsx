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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import RouteNode from './RouteNode';
import { CanvasRouteNode, RouteNodeData } from '@/lib/types/graph';

interface FlowCanvasProps {
  initialNodes: CanvasRouteNode[];
  initialEdges: Edge[];
  onSelectNode: (data: RouteNodeData | null) => void;
}

export default function FlowCanvas({ initialNodes, initialEdges, onSelectNode }: FlowCanvasProps) {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

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
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#1e293b"
        />
        <Controls
          className="!bg-slate-900 !border-slate-800 !shadow-xl !rounded-xl !overflow-hidden [&>button]:!bg-slate-900 [&>button]:!border-slate-800 [&>button]:!fill-slate-300 hover:[&>button]:!fill-white"
        />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === 'routeNode') {
              const data = node.data as RouteNodeData;
              if (data?.httpMethod === 'GET') return '#10b981';
              if (data?.httpMethod === 'POST') return '#6366f1';
              if (data?.httpMethod === 'DELETE') return '#ef4444';
              return '#38bdf8';
            }
            return '#475569';
          }}
          className="!bg-slate-950/80 !border-slate-800 !rounded-xl overflow-hidden"
          maskColor="rgba(9, 13, 22, 0.7)"
        />
      </ReactFlow>
    </div>
  );
}
