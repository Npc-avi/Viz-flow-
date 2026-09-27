'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { CanvasRouteNode } from '@/lib/types/graph';
import { Cog } from 'lucide-react';

function FunctionNodeComponent({ data, selected }: NodeProps<CanvasRouteNode>) {
  return (
    <div
      style={{ width: 220 }}
      className={`group rounded-lg bg-slate-900/95 backdrop-blur-md px-3 py-2 border transition-all duration-200 cursor-pointer shadow-lg relative select-none ${
        selected
          ? 'border-cyan-400 ring-2 ring-cyan-500/50 shadow-cyan-500/25 bg-slate-850'
          : 'border-cyan-500/40 hover:border-cyan-400 hover:shadow-cyan-950/40'
      }`}
    >
      {/* Target handle on Left connected from Route Node's Right handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-cyan-400 !w-2 !h-2 !border-2 !border-slate-900 !-left-1"
      />

      <div className="flex items-center gap-2 overflow-hidden">
        <div className="w-5 h-5 rounded bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0">
          <Cog className="w-3 h-3 text-cyan-300" />
        </div>
        <span
          className="font-mono text-xs text-cyan-200 font-medium truncate flex-1 block"
          title={`${data.routePath || data.label}()`}
        >
          {data.routePath || data.label}()
        </span>
        <span className="text-[9px] font-mono uppercase text-slate-500 shrink-0">
          fn
        </span>
      </div>
    </div>
  );
}

export default memo(FunctionNodeComponent);
