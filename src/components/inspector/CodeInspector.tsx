'use client';

import React, { useState } from 'react';
import { RouteNodeData } from '@/lib/types/graph';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { X, Copy, Check, FileCode, ArrowUpRight, Zap, Code2 } from 'lucide-react';

interface CodeInspectorProps {
  nodeData: RouteNodeData | null;
  onClose: () => void;
}

export default function CodeInspector({ nodeData, onClose }: CodeInspectorProps) {
  const [copied, setCopied] = useState(false);

  if (!nodeData) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(nodeData.codeSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isTypeScript = nodeData.location.filePath.endsWith('.ts') || nodeData.location.filePath.endsWith('.tsx');
  const language = isTypeScript ? 'typescript' : 'javascript';

  return (
    <aside className="w-full sm:w-[460px] md:w-[520px] h-full flex flex-col bg-slate-950/95 backdrop-blur-xl border-l border-slate-800 shadow-2xl z-40 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800/80 bg-slate-900/40">
        <div className="flex items-center gap-2.5 truncate">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
            <Code2 className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="truncate">
            <h3 className="font-semibold text-slate-100 text-sm truncate">
              {nodeData.label || `${nodeData.httpMethod} ${nodeData.routePath}`}
            </h3>
            <p className="text-[11px] text-slate-400 font-mono truncate">
              {nodeData.location.filePath}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
          title="Close Inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Meta Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/20 border-b border-slate-800/60 text-xs">
        <div className="flex items-center gap-2 text-slate-400 font-mono">
          <FileCode className="w-3.5 h-3.5 text-indigo-400" />
          <span>Lines:</span>
          <span className="text-indigo-300 font-semibold">
            {nodeData.location.startLine} - {nodeData.location.endLine}
          </span>
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-slate-400" />
              <span>Copy snippet</span>
            </>
          )}
        </button>
      </div>

      {/* Called Dependencies Section */}
      {nodeData.calledFunctions && nodeData.calledFunctions.length > 0 && (
        <div className="px-4 py-2.5 bg-indigo-950/20 border-b border-indigo-500/10">
          <div className="flex items-center gap-1.5 text-xs font-medium text-indigo-300 mb-1.5">
            <Zap className="w-3.5 h-3.5 text-indigo-400" />
            <span>Invokes Functions ({nodeData.calledFunctions.length}):</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {nodeData.calledFunctions.map((fn) => (
              <span
                key={fn}
                className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono text-[11px]"
              >
                {fn}()
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Real Source Code Sliced Block */}
      <div className="flex-1 overflow-auto p-4 font-mono text-xs">
        <div className="rounded-xl overflow-hidden border border-slate-800 shadow-inner bg-[#1e1e1e]">
          <div className="px-3 py-1.5 bg-[#252526] border-b border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>{nodeData.location.filePath.split('/').pop()}</span>
            <span className="text-[10px] text-slate-500 uppercase">{language}</span>
          </div>
          <SyntaxHighlighter
            language={language}
            style={vscDarkPlus}
            startingLineNumber={nodeData.location.startLine}
            showLineNumbers={true}
            customStyle={{
              margin: 0,
              padding: '1rem',
              backgroundColor: 'transparent',
              fontSize: '12px',
              lineHeight: '1.6',
            }}
          >
            {nodeData.codeSnippet || '// No code snippet found'}
          </SyntaxHighlighter>
        </div>
      </div>
    </aside>
  );
}
