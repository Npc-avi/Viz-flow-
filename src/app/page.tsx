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
  ArrowLeft,
  Info,
  Lock,
  Key,
  Globe2,
  HelpCircle,
  FileCode2,
  CheckCircle2,
} from 'lucide-react';

interface AnalysisState {
  repoName: string;
  repoId: string;
  language?: string;
  framework?: string;
  graph: GraphPayload;
  empty?: boolean;
  emptyMessage?: string;
}

export default function Home() {
  const [repoUrl, setRepoUrl] = useState('https://github.com/santiq/bulletproof-nodejs');
  const [authToken, setAuthToken] = useState('');
  const [showAuthField, setShowAuthField] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<AnalysisState | null>(null);
  const [selectedNode, setSelectedNode] = useState<RouteNodeData | null>(null);

  const loadingSteps = [
    'Connecting & performing shallow clone...',
    'Traversing repository file tree & detecting languages...',
    'Parsing AST & extracting backend route handlers...',
    'Calculating hierarchical Dagre graph layout...',
  ];

  const presets = [
    { label: 'Express (TypeScript)', url: 'https://github.com/santiq/bulletproof-nodejs' },
    { label: 'Local Fixture (Instant)', url: 'fixture:sample-express-app' },
    { label: 'FastAPI / Flask (Python)', url: 'https://github.com/tiangolo/fastapi' },
  ];

  const handleStartAnalysis = async (urlToUse?: string) => {
    const targetUrl = urlToUse || repoUrl;
    if (!targetUrl.trim()) {
      setErrorMessage('Please enter a GitHub repository URL.');
      return;
    }

    setErrorMessage(null);
    setIsProcessing(true);
    setCurrentStep(0);

    try {
      // Step 1: Clone & Inspect
      const cloneRes = await fetch('/api/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl: targetUrl,
          authToken: authToken.trim() || undefined,
        }),
      });

      const cloneData = await cloneRes.json();
      if (!cloneRes.ok || !cloneData.success) {
        throw new Error(cloneData.error || 'Failed to clone repository.');
      }

      setCurrentStep(1);

      // Step 2 & 3: Parse AST & Multi-language Analysis
      setCurrentStep(2);
      const analyzeRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoId: cloneData.repoId }),
      });

      const analyzeData = await analyzeRes.json();
      if (!analyzeRes.ok || !analyzeData.success) {
        throw new Error(analyzeData.error || 'Failed to analyze repository AST.');
      }

      setCurrentStep(3);

      // Handle Step 13: Empty routes gracefully
      if (analyzeData.empty) {
        setAnalysisData({
          repoName: cloneData.repoName,
          repoId: cloneData.repoId,
          language: analyzeData.language,
          framework: analyzeData.framework,
          graph: analyzeData.graph,
          empty: true,
          emptyMessage: analyzeData.message,
        });
        return;
      }

      setAnalysisData({
        repoName: cloneData.repoName,
        repoId: cloneData.repoId,
        language: analyzeData.language,
        framework: analyzeData.framework,
        graph: analyzeData.graph,
        empty: false,
      });
      setSelectedNode(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred during analysis.';
      setErrorMessage(msg);
    } finally {
      setIsProcessing(false);
      setCurrentStep(0);
    }
  };

  return (
    <main className="h-screen w-screen flex flex-col bg-[#090d16] text-slate-100 overflow-hidden font-sans">
      {/* Top Navigation */}
      <header className="h-14 border-b border-slate-800/80 bg-[#090d16]/95 backdrop-blur-md px-4 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center shadow-md shadow-indigo-500/20">
            <GitGraph className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-bold text-sm text-white">GitCode Flow</span>
            <span className="ml-2 text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
              Multi-Language
            </span>
          </div>
        </div>

        {analysisData && (
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono">
              {analysisData.framework && (
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px]">
                  {analysisData.framework}
                </span>
              )}
              {!analysisData.empty && (
                <>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]">
                    {analysisData.graph.stats.totalRoutes} Routes
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]">
                    {analysisData.graph.stats.filesCount} Files
                  </span>
                </>
              )}
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
                Universal Code Architecture & Route Flow Visualizer
              </span>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                Turn Repositories into Interactive Architecture Graphs
              </h1>
              <p className="text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
                Parse TypeScript, Python, Go, Java, and Rust backend services into visual,
                hierarchical flowcharts with exact source code inspection.
              </p>
            </div>

            {/* Ingestion Panel */}
            <div className="glass-panel rounded-2xl p-4 shadow-2xl border border-white/10 space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex items-center gap-2 flex-1 px-3 bg-slate-900/60 rounded-xl border border-slate-800">
                  <FolderGit2 className="w-5 h-5 text-indigo-400 shrink-0" />
                  <input
                    type="text"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="https://github.com/owner/repository"
                    disabled={isProcessing}
                    className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none py-2.5"
                  />
                </div>

                <button
                  onClick={() => handleStartAnalysis()}
                  disabled={isProcessing}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white font-medium text-sm rounded-xl transition-all shadow-lg shadow-indigo-500/25 active:scale-95 disabled:opacity-50 shrink-0"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <GitBranch className="w-4 h-4" />
                      <span>Visualize Flow</span>
                    </>
                  )}
                </button>
              </div>

              {/* Private Repo OAuth / Token Toggle (Step 15) */}
              <div className="pt-1 text-left">
                <button
                  type="button"
                  onClick={() => setShowAuthField(!showAuthField)}
                  className="text-xs text-slate-400 hover:text-indigo-300 flex items-center gap-1.5 transition-colors"
                >
                  <Lock className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{showAuthField ? 'Hide Private Repo Token' : 'Analyzing a private repository? Add GitHub Token'}</span>
                </button>

                {showAuthField && (
                  <div className="mt-2 p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1.5 animate-in fade-in">
                    <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-amber-400" />
                      GitHub Personal Access Token / OAuth Token
                    </label>
                    <input
                      type="password"
                      value={authToken}
                      onChange={(e) => setAuthToken(e.target.value)}
                      placeholder="ghp_xxxxxxxxxxxxxx"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                    />
                    <p className="text-[10px] text-slate-500">
                      Used only server-side during shallow clone. Never stored.
                    </p>
                  </div>
                )}
              </div>

              {/* Multi-stage Animated Loading State (Step 14) */}
              {isProcessing && (
                <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/20 text-left space-y-2 animate-in fade-in">
                  <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300">
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                    <span>Processing Pipeline...</span>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-400 font-mono">
                    {loadingSteps.map((step, idx) => (
                      <div
                        key={step}
                        className={`flex items-center gap-2 transition-all ${
                          idx === currentStep
                            ? 'text-indigo-300 font-semibold'
                            : idx < currentStep
                            ? 'text-emerald-400 line-through opacity-70'
                            : 'opacity-40'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Error Alert */}
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

            {/* Supported Ecosystems Strip */}
            <div className="pt-6 border-t border-slate-800/60 flex items-center justify-center gap-6 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400"></span> TypeScript/Express
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-yellow-400"></span> Python (FastAPI/Flask)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400"></span> Go (Gin/net)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-400"></span> Rust & Java
              </span>
            </div>
          </div>
        </div>
      ) : analysisData.empty ? (
        /* Graceful Empty State (Step 13) */
        <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
          <div className="max-w-md w-full glass-card rounded-2xl p-6 border border-amber-500/30 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 mx-auto flex items-center justify-center text-amber-400">
              <HelpCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-slate-100 text-base">No Routes Detected</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {analysisData.emptyMessage}
              </p>
            </div>
            <button
              onClick={() => setAnalysisData(null)}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-medium transition-all"
            >
              Try Another Repository
            </button>
          </div>
        </div>
      ) : (
        /* Connected Hierarchical Canvas & Code Inspector */
        <div
          style={{ height: 'calc(100vh - 56px)', width: '100%', position: 'relative' }}
          className="flex-1 flex relative overflow-hidden w-full h-[calc(100vh-3.5rem)] min-h-0"
        >
          {/* Main Canvas */}
          <div
            style={{ height: '100%', width: '100%', position: 'relative' }}
            className="flex-1 h-full w-full relative min-h-0"
          >
            <FlowCanvas
              initialNodes={analysisData.graph.nodes}
              initialEdges={analysisData.graph.edges}
              onSelectNode={(node) => setSelectedNode(node)}
            />

            {/* Instruction tooltip overlay */}
            {!selectedNode && (
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full glass-panel text-xs text-slate-300 shadow-xl border border-white/10 pointer-events-none flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-indigo-400" />
                <span>Click any route or function block to inspect its real unmodified code</span>
              </div>
            )}
          </div>

          {/* Side Code Inspector Drawer */}
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
