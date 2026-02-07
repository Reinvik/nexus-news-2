import { NextResponse } from 'next/server';
import { GeminiProcessor } from '@/lib/gemini';
import { type NewsItem } from '@/lib/analyzer';
import { supabase } from '@/lib/supabase';
import crypto from 'crypto';

export async function POST(request: Request) {
    try {
        const { clusterId, items } = await request.json();

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: 'Invalid items provided' }, { status: 400 });
        }

        // 1. Generate a deterministic key for this set of articles
        // (If clusterId is ephemeral, we should use content hash)
        const contentHash = crypto.createHash('md5').update(items.map(i => i.url).sort().join(',')).digest('hex');

        // 2. Check Database for existing analysis
        try {
            const { data, error } = await supabase
                .from('news_analysis')
                .select('analysis_result')
                .eq('content_hash', contentHash)
                .single();

            if (data && !error) {
                console.log("[CACHE] Serving analysis from database.");
                return NextResponse.json({ analysis: data.analysis_result });
            }
        } catch (dbError) {
            console.warn("DB Cache check failed (continuing with API):", dbError);
        }

        // 3. Call Gemini if not in cache
        const gemini = new GeminiProcessor();
        const analysis = await gemini.analyzeCluster(items as NewsItem[]);

        if (!analysis) {
            return NextResponse.json({ error: 'Failed to generate analysis' }, { status: 500 });
        }

        // 4. Persist to Database (Non-blocking)
        try {
            await supabase.from('news_analysis').insert({
                content_hash: contentHash,
                cluster_id: clusterId,
                analysis_result: analysis,
                created_at: new Date().toISOString()
            });
            console.log("[DB] Analysis persisted for future use.");
        } catch (saveError) {
            console.error("Failed to persist analysis:", saveError);
        }

        return NextResponse.json({ analysis });

    } catch (error: any) {
        console.error("Analyze API Error:", error);
        return NextResponse.json({ error: 'Failed to analyze cluster' }, { status: 500 });
    }
}
