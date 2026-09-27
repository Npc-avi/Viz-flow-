'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { CanvasRouteNode } from '@/lib/types/graph';
import { Globe, Cpu } from 'lucide-react';

function GatewayNodeComponent({ data, selected }: NodeProps<CanvasRouteNode>) {
  return (
    <div
      style={{ width: 280 }}
      className={`group rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950/70 to-slate-900 p-4 border transition-all duration-200 cursor-pointer shadow-2xl relative select-none ${
        selected
          ? 'border-indigo-400 ring-2 ring-indigo-500/50 shadow-indigo-500/30'
          : 'border-indigo-500/50 hover:border-indigo-400 shadow-indigo-950/50'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center shrink-0 shadow-inner">
          <Globe className="w-5 h-5 text-indigo-300 animate-pulse" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/25 text-indigo-300 border border-indigo-400/30">
              Gateway
            </span>
          </div>
          <h3 className="font-semibold text-sm text-slate-100 truncate mt-1">
            {data.label || 'API Gateway'}
          </h3>
        </div>
      </div>

      <div className="mt-2.5 pt-2 border-t border-indigo-500/20 flex items-center justify-between text-[11px] text-indigo-200/70 font-mono">
        <span className="flex items-center gap-1">
          <Cpu className="w-3 h-3 text-indigo-400" />
          <span>Dispatcher Root</span>
        </span>
        <span className="text-[10px] text-indigo-300/80 bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-500/30">
          /
        </span>
      </div>

      {/* Outgoing edge handle to Domain Hubs */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-indigo-400 !w-3 !h-3 !border-2 !border-slate-900 !-bottom-1.5"
      />
    </div>
  );
}

export default memo(GatewayNodeComponent);
