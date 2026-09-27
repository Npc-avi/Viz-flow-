'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { CanvasRouteNode } from '@/lib/types/graph';
import { FolderGit2, Layers } from 'lucide-react';

function DomainHubNodeComponent({ data, selected }: NodeProps<CanvasRouteNode>) {
  const domainColor = (data.domainColor as string) || '#38bdf8';
  const endpointCount = (data.endpointCount as number) || 0;

  return (
    <div
      style={{
        width: 220,
        borderColor: selected ? '#818cf8' : `${domainColor}80`,
        boxShadow: selected
          ? `0 0 24px -4px ${domainColor}80`
          : `0 8px 24px -6px rgba(0, 0, 0, 0.5)`,
      }}
      className="group rounded-xl bg-slate-900/95 backdrop-blur-md p-3.5 border transition-all duration-200 cursor-pointer shadow-xl relative select-none"
    >
      {/* Target handle from Central Gateway */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-indigo-400 !w-2.5 !h-2.5 !border-2 !border-slate-900 !-top-1.5"
      />

      <div className="flex items-center gap-2.5">
        <div
          style={{ backgroundColor: `${domainColor}20`, borderColor: `${domainColor}40` }}
          className="w-9 h-9 rounded-lg border flex items-center justify-center shrink-0"
        >
          <FolderGit2 style={{ color: domainColor }} className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              style={{ color: domainColor, backgroundColor: `${domainColor}15`, borderColor: `${domainColor}30` }}
              className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border"
            >
              Domain Hub
            </span>
          </div>
          <h4 className="font-semibold text-xs text-slate-100 truncate mt-1">
            {data.domainName || data.label || 'Subsystem'}
          </h4>
        </div>
      </div>

      <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
        <span className="flex items-center gap-1">
          <Layers className="w-3 h-3 text-slate-500" />
          <span>Cluster</span>
        </span>
        <span
          style={{ color: domainColor }}
          className="text-[10px] font-semibold bg-slate-800/80 px-2 py-0.5 rounded"
        >
          {endpointCount} route{endpointCount === 1 ? '' : 's'}
        </span>
      </div>

      {/* Source handle to child Route Nodes */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-indigo-400 !w-2.5 !h-2.5 !border-2 !border-slate-900 !-right-1.5"
      />
    </div>
  );
}

export default memo(DomainHubNodeComponent);
