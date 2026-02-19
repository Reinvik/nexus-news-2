'use client';

import React, { useState, useEffect } from 'react';
import StoryCard from '@/components/StoryCard';
import { type StoryCluster } from '@/lib/analyzer';

export default function NexusNews() {
    const [clusters, setClusters] = useState<StoryCluster[]>([]);
    const [loading, setLoading] = useState(true);
    const [scope, setScope] = useState('nacional');
    const [digestMeta, setDigestMeta] = useState<any>(null);

    const fetchNews = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/news?scope=${scope}`);
            const data = await res.json();
            if (data.clusters) {
                setClusters(data.clusters);
            }
            if (data.meta) {
                setDigestMeta(data.meta);
            }
        } catch (e) {
            console.error("Failed to fetch news", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNews();
    }, [scope]);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
            {/* Professional Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-900 rounded flex items-center justify-center text-white font-bold text-lg">N</div>
                        <h1 className="text-xl font-bold tracking-tight text-slate-900 uppercase">Nexus News</h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <select
                            className="bg-slate-100 border-none text-xs font-bold py-2 px-3 rounded text-slate-700 outline-none cursor-pointer"
                            value={scope}
                            onChange={(e) => setScope(e.target.value)}
                        >
                            <option value="nacional">NACIONAL</option>
                            <option value="espanol">ESPAÑOL</option>
                            <option value="anglo">ENGLISH</option>
                        </select>
                        <button
                            onClick={fetchNews}
                            className="bg-slate-900 text-white text-xs font-bold py-2 px-4 rounded hover:bg-slate-800 transition-colors"
                        >
                            ACTUALIZAR
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8">
                {/* Philosophical Signal Bar */}
                <div className="mb-8 p-4 bg-slate-900 text-slate-100 rounded-lg flex items-center justify-between">
                    <div>
                        <h2 className="text-xs font-black tracking-widest uppercase opacity-50 mb-1 text-cyan-400">Directriz Arquitecto</h2>
                        <p className="text-sm font-medium italic">"Menos ruido, mejor señal. Entendiendo el mundo con soberanía."</p>
                    </div>
                    <div className="hidden md:block text-right">
                        <span className="text-[10px] font-mono opacity-40">NEXUS_CORE_V2.7 // ARCHITECT_MODE</span>
                    </div>
                </div>

                {/* Validated Digest Info */}
                {digestMeta && (
                    <div className="flex items-center gap-2 mb-6 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-full w-fit">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">
                            DIGEST VALIDADO: {digestMeta.date} • {digestMeta.count} EVENTOS PROCESADOS
                        </span>
                    </div>
                )}

                {/* Content */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
                        <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin"></div>
                        <span className="text-xs font-mono font-bold uppercase tracking-widest">Analizando cobertura...</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {clusters.map(cluster => (
                            <StoryCard key={cluster.id} cluster={cluster} />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
