'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { CanvasRouteNode } from '@/lib/types/graph';
import { FileCode, FunctionSquare } from 'lucide-react';

const METHOD_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  GET: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  POST: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  PUT: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  DELETE: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' },
  PATCH: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
  ALL: { bg: 'bg-slate-500/15', text: 'text-slate-300', border: 'border-slate-500/30' },
};

function RouteNodeComponent({ data, selected }: NodeProps<CanvasRouteNode>) {
  const methodStyle = METHOD_COLORS[data.httpMethod] || METHOD_COLORS.ALL;

  return (
    <div
      className={`min-w-[240px] max-w-[320px] rounded-xl bg-slate-900/90 backdrop-blur-md p-3.5 border transition-all duration-200 cursor-pointer shadow-xl ${
        selected
          ? 'border-indigo-400 ring-2 ring-indigo-500/40 shadow-indigo-500/20'
          : 'border-slate-700/80 hover:border-slate-500'
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-indigo-400 !w-2.5 !h-2.5 !border-2 !border-slate-900"
      />

      {/* Header: Method Badge + Route Path */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border tracking-wider ${methodStyle.bg} ${methodStyle.text} ${methodStyle.border}`}
        >
          {data.httpMethod}
        </span>
        <span className="font-mono text-xs font-semibold text-slate-100 truncate" title={data.routePath}>
          {data.routePath}
        </span>
      </div>

      {/* Handler name or inline indication */}
      {data.handlerName && data.handlerName !== 'inlineHandler' && (
        <div className="flex items-center gap-1.5 text-xs text-indigo-300 mb-2 font-mono">
          <FunctionSquare className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
          <span className="truncate">{data.handlerName}()</span>
        </div>
      )}

      {/* Footer: File location & line numbers */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5 truncate mr-2" title={data.location.filePath}>
          <FileCode className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="truncate font-mono">{data.location.filePath.split('/').pop()}</span>
        </div>
        <span className="font-mono text-[10px] text-slate-500 shrink-0">
          L{data.location.startLine}:{data.location.endLine}
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-indigo-400 !w-2.5 !h-2.5 !border-2 !border-slate-900"
      />
    </div>
  );
}

export default memo(RouteNodeComponent);
