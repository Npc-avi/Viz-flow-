'use client';

import React, { useState } from 'react';
import FlowCanvas from '@/components/canvas/FlowCanvas';
import CodeInspector from '@/components/inspector/CodeInspector';
import { RouteNodeData, GraphPayload } from '@/lib/types/graph';
import {
  GitGraph,
  FolderGit2,
  GitBranch,
  Loader2,
  Sparkles,
  AlertCircle,
  FileCode,
  Layers,
  ArrowLeft,
  Info,
} from 'lucide-react';

interface AnalysisState {
  repoName: string;
  repoId: string;
  graph: GraphPayload;
}

export default function Home() {
  const [repoUrl, setRepoUrl] = useState('https://github.com/santiq/bulletproof-nodejs');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusStep, setStatusStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<AnalysisState | null>(null);
  const [selectedNode, setSelectedNode] = useState<RouteNodeData | null>(null);

  const presets = [
    { label: 'santiq/bulletproof-nodejs (Live TS Repo)', url: 'https://github.com/santiq/bulletproof-nodejs' },
    { label: 'Local Fixture (Instant Offline)', url: 'fixture:sample-express-app' },
  ];

  const handleStartAnalysis = async (urlToUse?: string) => {
    const targetUrl = urlToUse || repoUrl;
    if (!targetUrl.trim()) {
      setErrorMessage('Please enter a GitHub repository URL.');
      return;
    }

    setErrorMessage(null);
    setIsProcessing(true);
    setStatusStep('Step 1/2: Cloning repository & inspecting files...');

    try {
      // 1. Clone & Sanity Check
      const cloneRes = await fetch('/api/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: targetUrl }),
      });

      const cloneData = await cloneRes.json();
      if (!cloneRes.ok || !cloneData.success) {
        throw new Error(cloneData.error || 'Failed to clone repository.');
      }

      // 2. Parse AST & Build Graph
      setStatusStep('Step 2/2: Parsing Express AST & slicing source code...');
      const analyzeRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoId: cloneData.repoId }),
      });

      const analyzeData = await analyzeRes.json();
      if (!analyzeRes.ok || !analyzeData.success) {
        throw new Error(analyzeData.error || 'Failed to parse repository AST.');
      }

      if (analyzeData.graph.nodes.length === 0) {
        throw new Error('No Express route definitions could be detected in this repository.');
      }

      setAnalysisData({
        repoName: cloneData.repoName,
        repoId: cloneData.repoId,
        graph: analyzeData.graph,
      });
      setSelectedNode(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred during analysis.';
      setErrorMessage(msg);
    } finally {
      setIsProcessing(false);
      setStatusStep('');
    }
  };

  return (
    <main className="h-screen w-screen flex flex-col bg-[#090d16] text-slate-100 overflow-hidden">
      {/* Top Header */}
      <header className="h-14 border-b border-slate-800/80 bg-[#090d16]/95 backdrop-blur-md px-4 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center shadow-md shadow-indigo-500/20">
            <GitGraph className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-bold text-sm text-white">GitCode Flow</span>
            <span className="ml-2 text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
              MVP Canvas
            </span>
          </div>
        </div>

        {analysisData && (
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 font-mono">
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                {analysisData.graph.stats.totalRoutes} Routes
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                {analysisData.graph.stats.filesCount} Files
              </span>
            </div>

            <button
              onClick={() => {
                setAnalysisData(null);
                setSelectedNode(null);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Change Repo</span>
            </button>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      {!analysisData ? (
        /* Ingestion Screen */
        <div className="flex-1 flex flex-col items-center justify-center px-4 overflow-y-auto py-12 relative">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-indigo-600/15 via-cyan-500/10 to-transparent blur-3xl pointer-events-none -z-10" />

          <div className="max-w-2xl w-full text-center space-y-6">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                AST Visualizer for Express & TypeScript
              </span>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                Visualize Code Architecture in Flowcharts
              </h1>
              <p className="text-sm text-slate-400 max-w-lg mx-auto">
                Paste a public repository URL. We clone it, parse the AST, and render interactive
                route handlers mapped to real, unmodified code blocks.
              </p>
            </div>

            {/* Ingestion Box */}
            <div className="glass-panel rounded-2xl p-3 shadow-2xl border border-white/10 space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex items-center gap-2 flex-1 px-3">
                  <FolderGit2 className="w-5 h-5 text-indigo-400 shrink-0" />
                  <input
                    type="text"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="https://github.com/owner/repository"
                    disabled={isProcessing}
                    className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none py-1.5"
                  />
                </div>

                <button
                  onClick={() => handleStartAnalysis()}
                  disabled={isProcessing}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white font-medium text-sm rounded-xl transition-all shadow-lg shadow-indigo-500/25 active:scale-95 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <GitBranch className="w-4 h-4" />
                      <span>Analyze Flow</span>
                    </>
                  )}
                </button>
              </div>

              {/* Status or Error Banner */}
              {isProcessing && (
                <div className="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-500/20 text-xs text-indigo-300 font-mono text-left animate-pulse">
                  {statusStep}
                </div>
              )}

              {errorMessage && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-xs text-red-300 text-left">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>

            {/* Test Presets */}
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400 flex-wrap">
              <span className="text-slate-500">Quick demo:</span>
              {presets.map((preset) => (
                <button
                  key={preset.url}
                  disabled={isProcessing}
                  onClick={() => {
                    setRepoUrl(preset.url);
                    handleStartAnalysis(preset.url);
                  }}
                  className="px-3 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors text-xs"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Canvas & Inspector Interactive View */
        <div className="flex-1 flex relative overflow-hidden">
          {/* Main Flow Canvas */}
          <div className="flex-1 h-full relative">
            <FlowCanvas
              initialNodes={analysisData.graph.nodes}
              initialEdges={analysisData.graph.edges}
              onSelectNode={(node) => setSelectedNode(node)}
            />

            {/* Instruction tooltip overlay */}
            {!selectedNode && (
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full glass-panel text-xs text-slate-300 shadow-xl border border-white/10 pointer-events-none flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-indigo-400" />
                <span>Click any route node to inspect its real unmodified source code</span>
              </div>
            )}
          </div>

          {/* Click-to-inspect Code Drawer */}
          {selectedNode && (
            <CodeInspector
              nodeData={selectedNode}
              onClose={() => setSelectedNode(null)}
            />
          )}
        </div>
      )}
    </main>
  );
}
