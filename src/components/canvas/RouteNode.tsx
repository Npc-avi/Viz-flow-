'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { CanvasRouteNode } from '@/lib/types/graph';
import { FileCode, FunctionSquare } from 'lucide-react';

const METHOD_STYLES: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  GET: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    border: 'border-emerald-500/40',
    glow: 'group-hover:border-emerald-500/60',
  },
  POST: {
    bg: 'bg-indigo-500/15',
    text: 'text-indigo-400',
    border: 'border-indigo-500/40',
    glow: 'group-hover:border-indigo-500/60',
  },
  PUT: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
    border: 'border-amber-500/40',
    glow: 'group-hover:border-amber-500/60',
  },
  DELETE: {
    bg: 'bg-rose-500/15',
    text: 'text-rose-400',
    border: 'border-rose-500/40',
    glow: 'group-hover:border-rose-500/60',
  },
  PATCH: {
    bg: 'bg-purple-500/15',
    text: 'text-purple-400',
    border: 'border-purple-500/40',
    glow: 'group-hover:border-purple-500/60',
  },
  ALL: {
    bg: 'bg-slate-500/15',
    text: 'text-slate-300',
    border: 'border-slate-500/40',
    glow: 'group-hover:border-slate-500/60',
  },
};

function RouteNodeComponent({ data, selected }: NodeProps<CanvasRouteNode>) {
  const methodStyle = METHOD_STYLES[data.httpMethod] || METHOD_STYLES.ALL;
  const fileName = data.location.filePath.split('/').pop() || data.location.filePath;

  return (
    <div
      style={{ width: 280 }}
      className={`group rounded-xl bg-slate-900/95 backdrop-blur-md p-3.5 border transition-all duration-200 cursor-pointer shadow-xl relative select-none ${
        selected
          ? 'border-indigo-400 ring-2 ring-indigo-500/50 shadow-indigo-500/25 bg-slate-850'
          : `border-slate-700/80 hover:border-slate-500 hover:shadow-2xl ${methodStyle.glow}`
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-indigo-400 !w-2.5 !h-2.5 !border-2 !border-slate-900 !-left-1.5"
      />

      {/* Method Badge + Path with guaranteed text containment */}
      <div className="flex items-center gap-2 mb-2 w-full overflow-hidden">
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border tracking-wider shrink-0 ${methodStyle.bg} ${methodStyle.text} ${methodStyle.border}`}
        >
          {data.httpMethod}
        </span>
        <span
          className="font-mono text-xs font-semibold text-slate-100 truncate flex-1 block"
          title={data.routePath}
        >
          {data.routePath}
        </span>
      </div>

      {/* Handler Name */}
      {data.handlerName && data.handlerName !== 'inlineHandler' && (
        <div className="flex items-center gap-1.5 text-xs text-indigo-300 mb-2 font-mono overflow-hidden">
          <FunctionSquare className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
          <span className="truncate flex-1" title={`${data.handlerName}()`}>
            {data.handlerName}()
          </span>
        </div>
      )}

      {/* File & Line Info Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px] text-slate-400 w-full overflow-hidden">
        <div className="flex items-center gap-1.5 min-w-0 mr-2 flex-1" title={data.location.filePath}>
          <FileCode className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="truncate font-mono">{fileName}</span>
        </div>
        <span className="font-mono text-[10px] text-slate-400 shrink-0 bg-slate-800/80 px-1.5 py-0.5 rounded">
          L{data.location.startLine}:{data.location.endLine}
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-indigo-400 !w-2.5 !h-2.5 !border-2 !border-slate-900 !-right-1.5"
      />
    </div>
  );
}

export default memo(RouteNodeComponent);
