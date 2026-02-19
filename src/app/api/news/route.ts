import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope') || 'nacional';

    // Simplificación extrema: Leer el digest del día
    // O el último disponible si el cron no ha corrido hoy

    try {
        console.log(`[API] Fetching digest for scope: ${scope}`);

        const { data, error } = await supabase
            .from('news_daily_digest')
            .select('*')
            .eq('scope', scope)
            .order('digest_date', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            console.warn("Supabase fetch error:", error);
            return NextResponse.json({ clusters: [], warning: "No digest found" });
        }

        if (!data) {
            return NextResponse.json({ clusters: [], warning: "No digest found" });
        }

        console.log(`[API] Serving digest from ${data.digest_date} with ${data.cluster_count} clusters.`);

        return NextResponse.json({
            clusters: data.clusters,
            meta: {
                date: data.digest_date,
                count: data.cluster_count,
                status: data.processing_status
            }
        });

    } catch (error: any) {
        console.error("API Error:", error);
        return NextResponse.json({ error: 'Failed to fetch news digest' }, { status: 500 });
    }
}
