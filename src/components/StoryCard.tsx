'use client';

import React, { useState } from 'react';
import { type StoryCluster } from '@/lib/analyzer';
import { BiasBar } from './BiasBar';

interface StoryCardProps {
    cluster: StoryCluster;
}

export default function StoryCard({ cluster }: StoryCardProps) {


    return (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
            {/* Header / Main Leaning */}
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cobertura Multipolar</span>
                {cluster.blindspot && (
                    <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-200 uppercase tracking-tighter">
                        Punto Ciego: {cluster.blindspotSide === 'left' ? 'Sector Izquierdo' : 'Sector Derecho'}
                    </span>
                )}
            </div>

            <div className="p-6 flex-1">
                <h3 className="text-lg font-bold text-slate-900 leading-tight mb-3">
                    {cluster.mainTitle}
                </h3>

                <p className="text-sm text-slate-600 mb-6 line-clamp-3">
                    {cluster.summary}
                </p>

                {/* Sources & Bias Visualizer */}
                <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        {cluster.items.map((item, idx) => (
                            <span key={idx} className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-tight">
                                {item.source}
                            </span>
                        ))}
                    </div>

                    <BiasBar distribution={cluster.biasDistribution} />
                </div>
            </div>

            {/* Pre-Computed Analysis (If Available) */}
            {cluster.analysis && (
                <div className="p-5 bg-slate-50 border-t border-slate-100">
                    <div className="space-y-4">
                        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-inner">
                            <h4 className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Sintesis Nexus</h4>
                            <p className="text-sm text-slate-700 leading-relaxed italic font-serif">
                                {cluster.analysis.resumen_ejecutivo}
                            </p>
                        </div>

                        {/* KPI Grid */}
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="p-2 bg-white rounded border border-slate-100">
                                <span className="block text-[9px] text-slate-400 uppercase font-bold">Polarización</span>
                                <span className="text-sm font-black text-slate-800">{cluster.analysis.kpis?.polarizacion || '-'}/10</span>
                            </div>
                            <div className="p-2 bg-white rounded border border-slate-100">
                                <span className="block text-[9px] text-slate-400 uppercase font-bold">Diversidad</span>
                                <span className="text-sm font-black text-slate-800 uppercase">{cluster.analysis.kpis?.diversidad || '-'}</span>
                            </div>
                            <div className="p-2 bg-white rounded border border-slate-100">
                                <span className="block text-[9px] text-slate-400 uppercase font-bold">IA Modelo</span>
                                <span className="text-sm font-black text-slate-800 uppercase">GEMINI 2.0</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
