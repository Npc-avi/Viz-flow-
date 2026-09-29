'use client';

import React, { useState } from 'react';
import { GitBranch, FolderGit2, CheckCircle2, AlertCircle, Loader2, Sparkles, FileCode, Check } from 'lucide-react';

export interface CloneSanityData {
  success: boolean;
  repoId: string;
  repoName: string;
  cloneDurationMs: number;
  totalFiles: number;
  sourceFiles: string[];
  allFiles: string[];
  isReadable: boolean;
  hasTypeScript: boolean;
  hasPackageJson: boolean;
  hasExpressDependency: boolean;
  error?: string;
}

interface RepoInputBarProps {
  onClonedSuccess?: (data: CloneSanityData) => void;
  isLoading?: boolean;
}

export default function RepoInputBar({ onClonedSuccess, isLoading: externalLoading }: RepoInputBarProps) {
  const [repoUrl, setRepoUrl] = useState('https://github.com/santiq/bulletproof-nodejs');
  const [isCloning, setIsCloning] = useState(false);
  const [sanityResult, setSanityResult] = useState<CloneSanityData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showFileList, setShowFileList] = useState(false);

  const presets = [
    { label: 'santiq/bulletproof-nodejs', url: 'https://github.com/santiq/bulletproof-nodejs' },
    { label: 'Local Fixture (Instant)', url: 'fixture:sample-express-app' },
  ];

  const handleClone = async (urlToUse?: string) => {
    const targetUrl = urlToUse || repoUrl;
    if (!targetUrl.trim()) {
      setErrorMessage('Please enter a GitHub repository URL.');
      return;
    }

    setErrorMessage(null);
    setIsCloning(true);

    try {
      const response = await fetch('/api/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: targetUrl }),
      });

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(
          `Server returned ${response.status} (${response.statusText || 'Error'}). If you recently added routes, please restart 'npm run dev'. Detail: ${text.slice(0, 100)}`
        );
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to clone repository.');
      }

      setSanityResult(data);
      if (onClonedSuccess) {
        onClonedSuccess(data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred while cloning.';
      setErrorMessage(msg);
      setSanityResult(null);
    } finally {
      setIsCloning(false);
    }
  };

  const loading = isCloning || externalLoading;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* Input Form */}
      <div className="glass-panel rounded-2xl p-3 shadow-2xl border border-white/10 transition-all focus-within:border-indigo-500/50 focus-within:ring-2 focus-within:ring-indigo-500/20">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1 px-3">
            <FolderGit2 className="w-5 h-5 text-indigo-400 shrink-0" />
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="Paste public GitHub repository URL (e.g. https://github.com/owner/repo)"
              disabled={loading}
              className="w-full bg-transparent text-sm sm:text-base text-slate-100 placeholder-slate-500 focus:outline-none py-1.5"
            />
          </div>

          <button
            onClick={() => handleClone()}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white font-medium text-sm rounded-xl transition-all shadow-lg shadow-indigo-500/25 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Cloning & Verifying...</span>
              </>
            ) : (
              <>
                <GitBranch className="w-4 h-4" />
                <span>Clone & Inspect</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Quick Preset Buttons */}
      <div className="flex items-center gap-2 text-xs text-slate-400 px-2 flex-wrap">
        <span className="flex items-center gap-1 text-slate-500">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          Test presets:
        </span>
        {presets.map((preset) => (
          <button
            key={preset.url}
            type="button"
            disabled={loading}
            onClick={() => {
              setRepoUrl(preset.url);
              handleClone(preset.url);
            }}
            className="px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-200 text-sm">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Cloning Failed</p>
            <p className="text-xs text-red-300/90 mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Sanity Check Result (Step 4) */}
      {sanityResult && (
        <div className="glass-card rounded-2xl p-5 border border-emerald-500/20 shadow-xl space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="font-semibold text-slate-100 text-sm sm:text-base">
                  {sanityResult.repoName}
                </h3>
                <p className="text-xs text-slate-400">
                  Cloned session ID: <span className="font-mono text-indigo-300">{sanityResult.repoId}</span> ({sanityResult.cloneDurationMs}ms)
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              <Check className="w-3.5 h-3.5" /> Disk Readability Verified
            </span>
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
              <p className="text-xs text-slate-400 uppercase tracking-wider">Total Files</p>
              <p className="text-xl font-bold text-slate-100 mt-1">{sanityResult.totalFiles}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
              <p className="text-xs text-slate-400 uppercase tracking-wider">Source Files</p>
              <p className="text-xl font-bold text-indigo-400 mt-1">{sanityResult.sourceFiles.length}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
              <p className="text-xs text-slate-400 uppercase tracking-wider">TypeScript</p>
              <p className="text-xl font-bold text-emerald-400 mt-1">
                {sanityResult.hasTypeScript ? 'Yes' : 'No'}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
              <p className="text-xs text-slate-400 uppercase tracking-wider">Express.js</p>
              <p className="text-xl font-bold text-cyan-400 mt-1">
                {sanityResult.hasExpressDependency ? 'Detected' : 'Not declared'}
              </p>
            </div>
          </div>

          {/* Source files collapsible list */}
          <div>
            <button
              type="button"
              onClick={() => setShowFileList(!showFileList)}
              className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 transition-colors"
            >
              <FileCode className="w-4 h-4" />
              <span>{showFileList ? 'Hide source files list' : `View ${sanityResult.sourceFiles.length} readable source files`}</span>
            </button>

            {showFileList && (
              <div className="mt-2.5 max-h-48 overflow-y-auto rounded-xl bg-slate-950/80 p-3 border border-white/5 font-mono text-xs text-slate-300 space-y-1">
                {sanityResult.sourceFiles.map((file) => (
                  <div key={file} className="flex items-center gap-2 hover:text-white transition-colors">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                    <span>{file}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
