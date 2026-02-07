import { NextResponse } from 'next/server';

export async function GET() {
    const apiKey = process.env.NEWS_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'Missing API Key in environment' }, { status: 500 });
    }

    try {
        // Simple request: Top headlines for Chile
        // Timestampt to prevent caching
        const url = `https://newsapi.org/v2/top-headlines?country=cl&apiKey=${apiKey}&t=${Date.now()}`;

        const res = await fetch(url);
        const data = await res.json();

        return NextResponse.json({
            status: res.status,
            ok: res.ok,
            headers: Object.fromEntries(res.headers.entries()),
            data: data
        });
    } catch (error: any) {
        return NextResponse.json({
            error: 'Fetch failed',
            details: error.message
        }, { status: 500 });
    }
}
