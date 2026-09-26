'use client';

import React, { useState } from 'react';
import RepoInputBar, { CloneSanityData } from '@/components/repo-input/RepoInputBar';
import { GitGraph, ArrowRight, ShieldCheck, Cpu, Code2 } from 'lucide-react';

export default function Home() {
  const [clonedRepo, setClonedRepo] = useState<CloneSanityData | null>(null);

  return (
    <main className="min-h-screen flex flex-col bg-[#090d16] text-slate-100 relative overflow-hidden">
      {/* Background glowing ambient effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] bg-gradient-to-b from-indigo-600/15 via-cyan-500/10 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* Top Navigation */}
      <header className="w-full border-b border-white/5 bg-[#090d16]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <GitGraph className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-white">GitCode Flow</span>
              <span className="ml-2 text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
                Phase 1 Active
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              AST Pipeline Ready
            </span>
          </div>
        </div>
      </header>

      {/* Hero & Ingestion Section */}
      <section className="flex-1 flex flex-col justify-start items-center px-4 sm:px-6 pt-12 pb-16 max-w-5xl mx-auto w-full space-y-8">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-medium text-indigo-300">
            <Cpu className="w-3.5 h-3.5" />
            <span>Interactive Codebase Visualizer & AST Route Slicer</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-400">
            Visualize Backend Codebases as Interactive Flows
          </h1>

          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Paste any public Express + TypeScript repository URL. We clone it server-side,
            parse its AST, and generate interactive route handler flows with exact, unmodified source code blocks.
          </p>
        </div>

        {/* Phase 1 Repo Input & Sanity Check */}
        <div className="w-full pt-2">
          <RepoInputBar onClonedSuccess={(data) => setClonedRepo(data)} />
        </div>

        {/* Phase Checklist Tracker */}
        <div className="w-full max-w-4xl pt-8 border-t border-white/5">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 text-center">
            Pipeline Milestones
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-card rounded-xl p-4 border border-emerald-500/30 bg-emerald-950/10 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400">Phase 0: Setup</span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">Completed</span>
              </div>
              <p className="text-xs text-slate-300">Next.js, ts-morph, simple-git, @xyflow/react</p>
            </div>

            <div className={`glass-card rounded-xl p-4 transition-all space-y-1.5 ${clonedRepo ? 'border-emerald-500/30 bg-emerald-950/10' : 'border-indigo-500/30 bg-indigo-950/10'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold ${clonedRepo ? 'text-emerald-400' : 'text-indigo-400'}`}>
                  Phase 1: Ingestion & Sanity
                </span>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${clonedRepo ? 'bg-emerald-500/20 text-emerald-300' : 'bg-indigo-500/20 text-indigo-300'}`}>
                  {clonedRepo ? 'Verified ✓' : 'Live / Active'}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {clonedRepo ? `Cloned ${clonedRepo.sourceFiles.length} readable files` : 'Shallow clone + disk readability check'}
              </p>
            </div>

            <div className="glass-card rounded-xl p-4 border border-white/5 opacity-60 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Phase 2: AST Parser</span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-400">Next Up</span>
              </div>
              <p className="text-xs text-slate-400">Extract Express routes, methods & call edges</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
