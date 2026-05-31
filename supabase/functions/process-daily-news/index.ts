import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
    getBiasForSource,
    CHILE_LEFT, CHILE_RIGHT_CENTER,
    INTL_LEFT, INTL_RIGHT_CENTER,
    ANGLO_LEFT, ANGLO_RIGHT_CENTER,
    type BiasType,
} from "./utils.ts";

interface NewsItem {
    url: string;
    title: string;
    source: string;
    publishedAt: string;
    description?: string;
    bias?: BiasType;
}

const TIMEOUT_MS = 12000;

async function fetchWithTimeout(url: string): Promise<Response | null> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return res.ok ? res : null;
    } catch {
        clearTimeout(id);
        return null;
    }
}

// ----- Fetch from different APIs -----

async function fetchNewsAPI(apiKey: string, domains: string, language: string): Promise<NewsItem[]> {
    if (!apiKey || !domains) return [];
    const url = `https://newsapi.org/v2/everything?domains=${domains}&language=${language}&sortBy=publishedAt&pageSize=100&apiKey=${apiKey}`;
    const res = await fetchWithTimeout(url);
    if (!res) return [];
    const data = await res.json();
    return (data.articles || [])
        .filter((a: any) => a.title && a.source?.name && a.title !== '[Removed]')
        .map((a: any) => ({
            url: a.url, title: a.title.split(' - ')[0], source: a.source.name,
            publishedAt: a.publishedAt, description: a.description,
        }));
}

async function fetchGNews(apiKey: string, query: string, lang: string): Promise<NewsItem[]> {
    if (!apiKey) return [];
    const url = `https://gnews.io/api/v4/search?token=${apiKey}&lang=${lang}&max=10&sortby=publishedAt&q=${encodeURIComponent(query)}`;
    const res = await fetchWithTimeout(url);
    if (!res) return [];
    const data = await res.json();
    return (data.articles || []).map((a: any) => ({
        url: a.url, title: a.title, source: a.source?.name || 'GNews',
        publishedAt: a.publishedAt, description: a.description,
    }));
}

async function fetchNewsDataIO(apiKey: string, lang: string, country?: string): Promise<NewsItem[]> {
    if (!apiKey) return [];
    let url = `https://newsdata.io/api/1/latest?apikey=${apiKey}&language=${lang}&size=10`;
    if (country) url += `&country=${country}`;
    const res = await fetchWithTimeout(url);
    if (!res) return [];
    const data = await res.json();
    return (data.results || []).map((a: any) => ({
        url: a.link, title: a.title, source: a.source_id,
        publishedAt: a.pubDate, description: a.description,
    }));
}

async function fetchWorldNews(apiKey: string, lang: string, countries?: string): Promise<NewsItem[]> {
    if (!apiKey) return [];
    let url = `https://api.worldnewsapi.com/search-news?api-key=${apiKey}&language=${lang}&number=15&text=noticias`;
    if (countries) url += `&source-countries=${countries}`;
    const res = await fetchWithTimeout(url);
    if (!res) return [];
    const data = await res.json();
    return (data.news || []).map((a: any) => ({
        url: a.url, title: a.title, source: a.source_country?.toUpperCase() || 'WorldNews',
        publishedAt: a.publish_date, description: a.text?.substring(0, 200),
    }));
}

// ----- Scope Config -----
interface ScopeConfig {
    leftDomains: string; rightDomains: string; language: string;
    gnewsQuery: string; country?: string; worldCountries?: string;
}

function getScopeConfig(scope: string): ScopeConfig {
    switch (scope) {
        case 'nacional': return { leftDomains: CHILE_LEFT, rightDomains: CHILE_RIGHT_CENTER, language: 'es', gnewsQuery: 'chile', country: 'cl', worldCountries: 'cl' };
        case 'espanol': return { leftDomains: `${CHILE_LEFT},${INTL_LEFT}`, rightDomains: `${CHILE_RIGHT_CENTER},${INTL_RIGHT_CENTER}`, language: 'es', gnewsQuery: 'noticias', worldCountries: 'cl,ar,es,co,mx,pe' };
        case 'anglo': return { leftDomains: ANGLO_LEFT, rightDomains: ANGLO_RIGHT_CENTER, language: 'en', gnewsQuery: 'world news', worldCountries: 'us,gb' };
        default: return { leftDomains: CHILE_LEFT, rightDomains: CHILE_RIGHT_CENTER, language: 'es', gnewsQuery: 'chile', country: 'cl', worldCountries: 'cl' };
    }
}


// ----- Resilient Fallback Clustering Algorithm -----

function getFallbackClusters(allArticles: NewsItem[]): any[] {
    const stopWords = new Set(["el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "en", "y", "o", "con", "para", "por", "sobre", "a", "al", "se", "es", "su", "sus", "the", "of", "and", "in", "to", "a", "for", "on"]);
    
    const clusters: any[] = [];
    const used = new Set<string>();
    
    // Group by title similarity
    for (let i = 0; i < allArticles.length; i++) {
        const a = allArticles[i];
        if (used.has(a.url)) continue;
        
        const clusterItems = [a];
        used.add(a.url);
        
        // Get words of current article title
        const wordsA = a.title.toLowerCase()
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "")
            .split(/\s+/)
            .filter(w => w.length > 3 && !stopWords.has(w));
            
        for (let j = i + 1; j < allArticles.length; j++) {
            const b = allArticles[j];
            if (used.has(b.url)) continue;
            
            const wordsB = b.title.toLowerCase()
                .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "")
                .split(/\s+/)
                .filter(w => w.length > 3 && !stopWords.has(w));
                
            // Check intersection of words
            const commonWords = wordsA.filter(w => wordsB.includes(w));
            if (commonWords.length >= 2) { // 2 or more common words
                clusterItems.push(b);
                used.add(b.url);
            }
        }
        
        if (clusterItems.length >= 2) {
            clusterItems.sort((x, y) => new Date(y.publishedAt).getTime() - new Date(x.publishedAt).getTime());
            const main = clusterItems[0];
            
            const biasDist: Record<string, number> = { left: 0, "center-left": 0, center: 0, "center-right": 0, right: 0 };
            clusterItems.forEach(it => { if (it.bias && biasDist[it.bias] !== undefined) biasDist[it.bias]++; });
            
            let blindspot = false, blindspotSide: string | undefined;
            const leftBlock = biasDist.left + biasDist["center-left"];
            const rightBlock = biasDist.right + biasDist["center-right"];
            if (leftBlock > 0 && rightBlock === 0) { blindspot = true; blindspotSide = "right"; }
            else if (rightBlock > 0 && leftBlock === 0) { blindspot = true; blindspotSide = "left"; }
            
            clusters.push({
                id: crypto.randomUUID(),
                mainTitle: main.title,
                summary: main.description || main.title,
                items: clusterItems,
                biasDistribution: biasDist,
                firstPublishedAt: main.publishedAt,
                blindspot,
                blindspotSide,
                analysis: {
                    resumen_ejecutivo: "Análisis automático (Fallback). Se agruparon las noticias por coincidencia de palabras clave en el titular. Se requiere renovar o actualizar la API Key de Gemini en los secretos de Supabase para obtener el análisis político e interpretativo completo.",
                    kpis: { polarizacion: 3.0, diversidad: "MEDIA" }
                }
            });
        }
    }
    
    // Sort clusters by size
    clusters.sort((a, b) => b.items.length - a.items.length);
    return clusters;
}

// ----- Main Processing -----

Deno.serve(async (_req) => {
    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const newsApiKey = Deno.env.get("NEWS_API_KEY") || "";
        const gnewsKey = Deno.env.get("GNEWS_API_KEY") || "";
        const newsDataKey = Deno.env.get("NEWSDATA_API_KEY") || "";
        const worldNewsKey = Deno.env.get("WORLD_NEWS_API_KEY") || "";
        const geminiKey = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY") || "";

        const scopes = ["nacional", "espanol", "anglo"];
        const results: Record<string, any> = {};

        for (const scope of scopes) {
            console.log(`\n=== Processing scope: ${scope} ===`);
            try {
                const config = getScopeConfig(scope);

                // 1) Fetch from multiple APIs in parallel
                const [leftArticles, rightArticles, gnewsArticles, newsDataArticles, worldArticles] = await Promise.all([
                    fetchNewsAPI(newsApiKey, config.leftDomains, config.language),
                    fetchNewsAPI(newsApiKey, config.rightDomains, config.language),
                    fetchGNews(gnewsKey, config.gnewsQuery, config.language),
                    fetchNewsDataIO(newsDataKey, config.language, config.country),
                    fetchWorldNews(worldNewsKey, config.language, config.worldCountries),
                ]);

                let allArticles = [...leftArticles, ...rightArticles, ...gnewsArticles, ...newsDataArticles, ...worldArticles];

                // 2) Deduplicate
                const seen = new Set<string>();
                allArticles = allArticles.filter(a => {
                    if (!a.title || !a.url || seen.has(a.url)) return false;
                    seen.add(a.url);
                    return true;
                });

                // 3) Assign bias
                allArticles.forEach(a => { a.bias = getBiasForSource(a.source); });

                console.log(`[${scope}] Total unique articles: ${allArticles.length}`);

                if (allArticles.length === 0) {
                    await supabase.from("news_daily_digest").upsert({
                        scope, digest_date: new Date().toISOString().split("T")[0],
                        clusters: [], raw_article_count: 0, cluster_count: 0,
                        processing_status: "complete", error_message: "No articles found from any API",
                    }, { onConflict: "scope,digest_date" });
                    results[scope] = { status: "empty", articles: 0 };
                    continue;
                }

                // 4) Gemini Clustering
                let clusters: any[] = [];
                let usingFallback = false;
                let clusteringErrorMsg: string | null = null;

                if (geminiKey) {
                    try {
                        const genAI = new GoogleGenerativeAI(geminiKey);
                        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

                        const simplified = allArticles.map((a, i) => ({ id: i, title: a.title, desc: a.description?.substring(0, 80) || "" }));
                        const clusterPrompt = `You are an expert news aggregator. Group these articles into clusters by EVENT.\nArticles: ${JSON.stringify(simplified)}\nReturn STRICT JSON array of arrays of IDs. Example: [[0,2],[1],[3,4,5]]\nReturn ONLY the JSON. No markdown.`;

                        const result = await model.generateContent(clusterPrompt);
                        const text = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
                        const groupedIndices: number[][] = JSON.parse(text);

                        // Build clusters from indices
                        for (const indices of groupedIndices) {
                            const items = indices.map(i => allArticles[i]).filter(Boolean);
                            if (items.length === 0) continue;

                            items.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
                            const main = items[0];

                            const biasDist: Record<string, number> = { left: 0, "center-left": 0, center: 0, "center-right": 0, right: 0 };
                            items.forEach(it => { if (it.bias && biasDist[it.bias] !== undefined) biasDist[it.bias]++; });

                            let blindspot = false, blindspotSide: string | undefined;
                            const leftBlock = biasDist.left + biasDist["center-left"];
                            const rightBlock = biasDist.right + biasDist["center-right"];
                            if (leftBlock > 0 && rightBlock === 0) { blindspot = true; blindspotSide = "right"; }
                            else if (rightBlock > 0 && leftBlock === 0) { blindspot = true; blindspotSide = "left"; }

                            clusters.push({
                                id: crypto.randomUUID(),
                                mainTitle: main.title,
                                summary: main.description || main.title,
                                items,
                                biasDistribution: biasDist,
                                firstPublishedAt: main.publishedAt,
                                blindspot,
                                blindspotSide,
                            });
                        }

                        // Filter: keep clusters with >=2 articles
                        clusters = clusters.filter(c => c.items.length >= 2);

                        // 5) Gemini Analysis per cluster (top 8)
                        const toAnalyze = clusters.slice(0, 8);
                        for (const cluster of toAnalyze) {
                            try {
                                const articleList = cluster.items.map((a: NewsItem) =>
                                    `- Fuente: ${a.source} (${a.bias || "center"})\n  Titular: ${a.title}\n  Resumen: ${a.description || ""}`
                                ).join("\n\n");

                                const analysisPrompt = `Actúa como un Auditor de Datos y Analista Político Senior experto en medios.
Se te entrega un grupo de artículos sobre un mismo evento. Expón las discrepancias y puntos ciegos.

ARTÍCULOS:
${articleList}

FORMATO DE SALIDA (STRICT JSON):
{
  "resumen_ejecutivo": "Patrón detectado...",
  "kpis": { "polarizacion": 5.0, "diversidad": "ALTA" }
}

Retorna SOLO el JSON. Sin markdown.`;

                                const analysisResult = await model.generateContent(analysisPrompt);
                                const analysisText = analysisResult.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
                                cluster.analysis = JSON.parse(analysisText);
                            } catch (e) {
                                console.error(`[${scope}] Analysis failed for cluster:`, e);
                            }
                        }

                        console.log(`[${scope}] Gemini produced ${clusters.length} clusters`);
                    } catch (e: any) {
                        console.error(`[${scope}] Gemini clustering failed, using fallback:`, e);
                        usingFallback = true;
                        clusteringErrorMsg = e.message || String(e);
                        clusters = getFallbackClusters(allArticles);
                    }
                } else {
                    console.log(`[${scope}] No geminiKey provided, using fallback clustering`);
                    usingFallback = true;
                    clusteringErrorMsg = "No GOOGLE_GENERATIVE_AI_API_KEY secret configured";
                    clusters = getFallbackClusters(allArticles);
                }


                // 6) Save to Supabase
                const digestDate = new Date().toISOString().split("T")[0];
                await supabase.from("news_daily_digest").upsert({
                    scope,
                    digest_date: digestDate,
                    clusters,
                    raw_article_count: allArticles.length,
                    cluster_count: clusters.length,
                    processing_status: "complete",
                    error_message: clusteringErrorMsg,
                }, { onConflict: "scope,digest_date" });

                results[scope] = { status: "complete", articles: allArticles.length, clusters: clusters.length };

            } catch (scopeError: any) {
                console.error(`[${scope}] Error:`, scopeError);
                const digestDate = new Date().toISOString().split("T")[0];
                await supabase.from("news_daily_digest").upsert({
                    scope, digest_date: digestDate, clusters: [],
                    raw_article_count: 0, cluster_count: 0,
                    processing_status: "error", error_message: scopeError.message,
                }, { onConflict: "scope,digest_date" });
                results[scope] = { status: "error", error: scopeError.message };
            }
        }

        // 7) Cleanup old digests (>7 days)
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 7);
        await supabase.from("news_daily_digest").delete().lt("digest_date", cutoff.toISOString().split("T")[0]);

        return new Response(JSON.stringify({ success: true, results }), {
            headers: { "Content-Type": "application/json" },
        });

    } catch (error: any) {
        console.error("Fatal error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
});
