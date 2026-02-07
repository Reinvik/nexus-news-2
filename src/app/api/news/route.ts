import { NextResponse } from 'next/server';
import {
    clusterStories,
    filterDiverseClusters,
    type StoryCluster,
    type NewsItem,
    CHILE_LEFT, CHILE_RIGHT_CENTER,
    INTL_LEFT, INTL_RIGHT_CENTER,
    ANGLO_LEFT, ANGLO_RIGHT_CENTER
} from '@/lib/analyzer';
import { MOCK_CLUSTERS } from '@/lib/mockData';
import { GeminiProcessor } from '@/lib/gemini';
import { getBiasForSource } from '@/lib/analyzer';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope') || 'nacional';
    const query = searchParams.get('q') || '';
    const category = searchParams.get('category') || '';
    const dateParam = searchParams.get('date'); // YYYY-MM-DD or empty
    const sourceParam = searchParams.get('source'); // Specific domain
    const provider = searchParams.get('provider') || 'auto'; // 'newsapi', 'currents', 'gnews', 'auto'

    // LOG REQUEST PARAMS
    console.log(`[API START] Scope: ${scope}, Query: "${query}", Category: "${category}", Provider: ${provider}`);

    const CATEGORY_QUERIES: Record<string, string> = {
        'general': '',
        'politica': '(politica OR gobierno OR congreso OR boric OR senado OR diputados OR constitucion OR ministro)',
        'economia': '(economia OR inflacion OR dolar OR ipc OR banco central OR hacienda OR mercado)',
        'deportes': '(futbol OR deporte OR colo-colo OR u de chile OR alexis OR vidal OR garin OR panamericanos)',
        'tecnologia': '(tecnologia OR inteligencia artificial OR ciencia OR nasa OR celular OR app OR software)',
        'salud': '(salud OR minsal OR virus OR vacuna OR hospital OR medico)',
        'cultura': '(cultura OR arte OR musica OR cine OR libro OR concierto)'
    };

    // REMOVED LOCAL MOCK_CLUSTERS in favor of shared import

    // REMOVED LOCAL MOCK_CLUSTERS in favor of shared import


    try {
        const apiKey = process.env.NEWS_API_KEY;
        const currentsApiKey = process.env.CURRENTS_API_KEY;
        const gnewsKey = process.env.GNEWS_API_KEY;
        const newsDataKey = process.env.NEWSDATA_API_KEY;
        const worldNewsKey = process.env.WORLD_NEWS_API_KEY;

        console.log(`[ENV CHECK] NewsAPI: ${apiKey ? 'OK' : 'MISSING'}, Currents: ${currentsApiKey ? 'OK' : 'MISSING'}, GNews: ${gnewsKey ? 'OK' : 'MISSING'}, NewsData: ${newsDataKey ? 'OK' : 'MISSING'}, WorldNews: ${worldNewsKey ? 'OK' : 'MISSING'}`);

        let limitReached = false;
        if (!apiKey) limitReached = true;

        // 1. Select Domain Sets based on Scope for BALANCED FETCHING
        let leftDomains = '';
        let rightDomains = '';
        let language = 'es';

        if (scope === 'espanol') {
            // MERGE CHILE + INTL SPANISH
            leftDomains = `${CHILE_LEFT},${INTL_LEFT}`;
            rightDomains = `${CHILE_RIGHT_CENTER},${INTL_RIGHT_CENTER}`;
        } else if (scope === 'nacional') { // KEEP Sane Fallback just in case
            leftDomains = CHILE_LEFT;
            rightDomains = CHILE_RIGHT_CENTER;
        } else if (scope === 'internacional') { // KEEP Sane Fallback
            leftDomains = INTL_LEFT;
            rightDomains = INTL_RIGHT_CENTER;
        } else if (scope === 'anglo') {
            leftDomains = ANGLO_LEFT;
            rightDomains = ANGLO_RIGHT_CENTER;
            language = 'en';
        }

        // OVERRIDE if specific source is selected
        if (sourceParam) {
            leftDomains = sourceParam;
            rightDomains = '';
        }

        // 2. Time/Date Calculation
        let dateFilter = '';
        if (dateParam) {
            // If user selected a specific date
            dateFilter = `&from=${dateParam}&to=${dateParam}`;
        }
        // If no date selected, we don't send 'from'/'to' to get the latest news available (API default)

        // 3. Construct URLs (Balanced Strategy)
        const pageSize = 100;
        const TIMEOUT_MS = 15000; // 15 seconds timeout

        let articles: NewsItem[] = []; // Changed to NewsItem[]
        let leftArticles: NewsItem[] = [];
        let rightArticles: NewsItem[] = [];

        // Definition of fetchNewsAPI (Renamed from fetchNews for clarity)
        const fetchNewsAPI = async (domains: string): Promise<NewsItem[]> => {
            if (!apiKey) return [];
            if (!domains) return [];
            let url = '';

            // Build the specific query
            let finalQuery = query;
            if (!finalQuery && category && CATEGORY_QUERIES[category]) {
                finalQuery = CATEGORY_QUERIES[category];
            }

            if (finalQuery) {
                // strict match on domains is cleaner without 'domains=' sometimes if query is complex, 
                // but we need to restrict to OUR domains to ensure bias balance.
                url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(finalQuery)}&domains=${domains}&language=${language}&sortBy=publishedAt&pageSize=${pageSize}&apiKey=${apiKey}${dateFilter}`;
            } else {
                url = `https://newsapi.org/v2/everything?domains=${domains}&language=${language}&sortBy=publishedAt&pageSize=${pageSize}&apiKey=${apiKey}${dateFilter}`;
            }

            try {
                console.log(`[NewsAPI Request] URL: ${url}`); // DEBUG log
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

                const res = await fetch(url, {
                    next: { revalidate: 0 },
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                console.log(`[NewsAPI Response] Status: ${res.status}`); // DEBUG log

                if (res.status === 429) {
                    console.warn("API Rate Limit Reached");
                    limitReached = true;
                    return [];
                }

                if (!res.ok) {
                    const errHeader = JSON.stringify(await res.json());
                    console.error(`[NewsAPI Error Body]: ${errHeader}`);
                    return [];
                }

                const data = await res.json();
                console.log(`[NewsAPI Results] Count: ${data.articles?.length}`); // DEBUG log
                // Transform to NewsItem format
                return (data.articles || [])
                    .filter((article: any) => article.title && article.source.name && article.title !== '[Removed]')
                    .map((article: any) => ({
                        url: article.url,
                        title: article.title.split(' - ')[0],
                        source: article.source.name,
                        publishedAt: article.publishedAt,
                        description: article.description,
                        urlToImage: article.urlToImage
                    }));
            } catch (error: any) {
                if (error.name === 'AbortError') {
                    console.error('NewsAPI Timed Out');
                } else {
                    console.error('NewsAPI Error:', error);
                }
                return [];
            }
        };

        // Definition of fetchCurrentsAPI
        const fetchCurrentsAPI = async (queryText: string): Promise<NewsItem[]> => {
            if (!currentsApiKey) return [];

            let url = `https://api.currentsapi.services/v1/search?apiKey=${currentsApiKey}&language=es&limit=30`;

            if (queryText) {
                url += `&keywords=${encodeURIComponent(queryText)}`;
            }

            if (!queryText && category) {
                url += `&category=${category}`;
            }

            try {
                console.log(`[CurrentsAPI Request] URL: ${url}`);
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

                const res = await fetch(url, {
                    next: { revalidate: 0 },
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (!res.ok) {
                    console.error(`[CurrentsAPI Error] Status: ${res.status}`);
                    return [];
                }
                const data = await res.json();
                console.log(`[CurrentsAPI Results] Count: ${data.news?.length}`);

                return (data.news || []).map((article: any) => ({
                    url: article.url,
                    title: article.title,
                    source: article.author || 'CurrentsAPI',
                    publishedAt: article.published,
                    description: article.description,
                    urlToImage: article.image === 'None' ? undefined : article.image
                }));

            } catch (error: any) {
                if (error.name === 'AbortError') {
                    console.error('CurrentsAPI Timed Out');
                } else {
                    console.error('CurrentsAPI Error:', error);
                }
                return [];
            }
        }

        // Definition of fetchGNews (Fallback)
        const fetchGNews = async (queryText: string, categoryText: string, country?: string): Promise<NewsItem[]> => {
            if (!gnewsKey) return [];

            let url = `https://gnews.io/api/v4/search?token=${gnewsKey}&lang=es&max=10&sortby=publishedAt`;

            if (country) {
                url += `&country=${country}`;
            }

            let q = queryText;
            if (!q && categoryText) {
                q = categoryText;
            }
            if (!q) q = 'chile'; // default fallback query if everything empty

            url += `&q=${encodeURIComponent(q)}`;

            try {
                console.log(`[GNews Request] URL: ${url}`);
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

                const res = await fetch(url, {
                    next: { revalidate: 0 },
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (!res.ok) {
                    console.error(`[GNews Error] Status: ${res.status}`);
                    return [];
                }

                const data = await res.json();
                console.log(`[GNews Results] Count: ${data.articles?.length}`);

                return (data.articles || []).map((article: any) => ({
                    url: article.url,
                    title: article.title,
                    source: article.source.name,
                    publishedAt: article.publishedAt,
                    description: article.description,
                    urlToImage: article.image
                }));
            } catch (error: any) {
                if (error.name === 'AbortError') {
                    console.error('GNews Timed Out');
                } else {
                    console.error('GNews Error:', error);
                }
                return [];
            }
        };

        // Definition of fetchNewsDataIO
        const fetchNewsDataIO = async (queryText: string, categoryText: string): Promise<NewsItem[]> => {
            // Assuming newsDataApiKey is available in scope
            // Assuming language and scope are available in scope
            if (!newsDataKey) return [];

            let url = `https://newsdata.io/api/1/latest?apikey=${newsDataKey}&language=${language}&size=10`;

            if (queryText) {
                url += `&q=${encodeURIComponent(queryText)}`;
            } else if (categoryText) {
                url += `&category=${categoryText}`;
            }

            // Add country based on scope and language
            // For 'espanol' we DO NOT limit by country, only language=es is enough
            if (scope === 'nacional' && language === 'es') {
                url += `&country=cl`;
            } else if ((scope === 'espanol') && language === 'es') {
                // No country filter -> all spanish speaking countries
                // URL already has language=es
            }
            // else if (scope === 'internacional' && language === 'en') {
            //     url += `&country=us`; 
            // }

            try {
                console.log(`[NewsData.io Request] URL: ${url}`);
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

                const res = await fetch(url, {
                    next: { revalidate: 0 },
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (!res.ok) {
                    console.error(`[NewsData.io Error] Status: ${res.status}`);
                    return [];
                }

                const data = await res.json();
                console.log(`[NewsData.io Results] Count: ${data.results?.length}`);

                return (data.results || []).map((article: any) => ({
                    url: article.link,
                    title: article.title,
                    source: article.source_id,
                    publishedAt: article.pubDate,
                    description: article.description,
                    urlToImage: article.image_url
                }));
            } catch (error: any) {
                if (error.name === 'AbortError') {
                    console.error('NewsData.io Timed Out');
                } else {
                    console.error('NewsData.io Error:', error);
                }
                return [];
            }
        };

        // Definition of fetchWorldNewsAPI
        const fetchWorldNewsAPI = async (text: string): Promise<NewsItem[]> => {
            if (!worldNewsKey) return [];

            // https://worldnewsapi.com/api/search-news?text=...
            // Mandatory: text or source-countries or language
            let url = `https://api.worldnewsapi.com/search-news?api-key=${worldNewsKey}&language=${language}&number=15`;

            // Fallback if no text: use a generic keyword based on scope
            const searchText = text || (scope === 'nacional' ? 'chile' : (scope === 'espanol' ? 'noticias' : 'world'));
            url += `&text=${encodeURIComponent(searchText)}`;

            if (scope === 'nacional') {
                url += '&source-countries=cl';
            } else if (scope === 'espanol') {
                // No specific source country for general spanish
                // But WorldNewsAPI might need it? "source-countries" matches origin
                // Let's try comma separated major spanish countries to relevant results
                url += '&source-countries=cl,ar,es,co,mx,pe';
            } else if (scope === 'anglo') {
                url += '&source-countries=us,gb';
            }

            try {
                console.log(`[WorldNewsAPI Request] URL: ${url}`);
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

                const res = await fetch(url, {
                    next: { revalidate: 0 },
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (res.status === 429) {
                    console.warn("WorldNewsAPI Rate Limit Reached");
                    return [];
                }

                if (!res.ok) {
                    console.error(`[WorldNewsAPI Error] Status: ${res.status}`);
                    return [];
                }

                const data = await res.json();
                console.log(`[WorldNewsAPI Results] Count: ${data.news?.length}`);

                return (data.news || []).map((article: any) => ({
                    url: article.url,
                    title: article.title,
                    source: article.source_country ? `${article.source_country.toUpperCase()} Source` : 'WorldNewsAPI', // API doesn't always give nice source name in free tier?
                    publishedAt: article.publish_date,
                    description: article.text ? article.text.substring(0, 200) + '...' : '', // 'text' is content
                    urlToImage: article.image
                }));

            } catch (error: any) {
                console.error('WorldNewsAPI Error:', error);
                return [];
            }
        };

        // --- EXECUTION STRATEGY ---

        if (provider === 'newsapi') {
            console.log("Fetching NewsAPI (Manual Provider)...");
            [leftArticles, rightArticles] = await Promise.all([
                fetchNewsAPI(leftDomains),
                fetchNewsAPI(rightDomains)
            ]);
            articles = [...leftArticles, ...rightArticles];
        } else if (provider === 'currents') {
            console.log("Fetching Currents API (Manual Provider)...");
            articles = await fetchCurrentsAPI(query || category || 'chile');
        } else if (provider === 'newsdata') {
            console.log(`Fetching NewsData.io (Manual) for ${scope}...`);
            // Map category to NewsData format if needed, or pass directly
            articles = await fetchNewsDataIO(query, category);
        } else if (provider === 'worldnews') {
            console.log("Fetching World News API (Manual)...");
            articles = await fetchWorldNewsAPI(query || category);
        } else if (provider === 'gnews') {
            console.log("Fetching GNews (Manual Provider)...");
            let gnewsQuery = query;
            if (!gnewsQuery) gnewsQuery = category || 'general'; // Ensure query isn't empty

            const countryParam = scope === 'nacional' ? 'cl' : undefined; // For 'espanol' we leave undefined to get all spanish
            articles = await fetchGNews(gnewsQuery, category, countryParam);
        } else {
            // AUTO / FALLBACK MODE

            // 1. Try NewsAPI (PRIMARY - Best for .cl domains)
            if (!limitReached) {
                console.log(`[Fallbacks] 1. Fetching Balanced NewsAPI for ${scope}...`);
                // For 'espanol', fetchNewsAPI will use the MERGED lists of domains (leftDomains/rightDomains)
                // This is perfect.
                [leftArticles, rightArticles] = await Promise.all([
                    fetchNewsAPI(leftDomains),
                    fetchNewsAPI(rightDomains)
                ]);
                articles = [...leftArticles, ...rightArticles];
            }

            // 2. Try NewsData.io (Secondary)
            if (articles.length === 0) {
                console.log(`[Fallbacks] 2. NewsAPI failed/empty. Fetching NewsData.io for ${scope}...`);
                articles = await fetchNewsDataIO(query || category, category);
            }

            // 3. Try GNews (Tertiary)
            if (articles.length === 0) {
                console.log(`[Fallbacks] 3. NewsData.io failed/empty. Fetching GNews for ${scope}...`);
                let gnewsQuery = query;
                if (!gnewsQuery) gnewsQuery = category || 'general';
                const countryParam = scope === 'nacional' ? 'cl' : undefined;
                articles = await fetchGNews(gnewsQuery, category, countryParam);
            }

            // 4. Try World News API (Quaternary)
            if (articles.length === 0) {
                console.log(`[Fallbacks] 4. GNews failed/empty. Fetching World News API for ${scope}...`);
                articles = await fetchWorldNewsAPI(query || category);
            }

            // 5. Try Currents (Fallback 5)
            if (articles.length === 0) {
                console.log("[Fallbacks] 5. WorldNewsAPI failed/empty. Trying Currents API Fallback...");
                articles = await fetchCurrentsAPI(query || category || (scope === 'nacional' ? 'chile' : 'world'));
            }
        }

        // --- MOCK FALLBACK (Only if EVERYTHING failed) ---
        if (articles.length === 0) {
            console.warn("⚠️ ALL APIs failed. Serving MOCK DATA.");
            if (MOCK_CLUSTERS && MOCK_CLUSTERS.length > 0) {
                const diverseMocks = filterDiverseClusters(MOCK_CLUSTERS);
                return NextResponse.json({
                    clusters: diverseMocks,
                    warning: "All APIs Failed - Serving Mock Data"
                });
            }
        }

        // --- DEDUPLICATION & CLUSTERING ---
        // ... rest of the file ...

        // MOCK DATA Fallback if EVERYTHING failed
        if (articles.length === 0) {
            console.log("⚠️ ALL APIs failed/empty. Returning MOCK DATA.");
            return NextResponse.json({ clusters: MOCK_CLUSTERS, warning: "All APIs Limited/Empty - Showing Mock Data" });
        }

        console.log(`[API FINISH] Fetched: ${articles.length} raw articles.`);

        // Deduplicate
        const uniqueArticles = Array.from(new Map(articles.map((item: any) => [item.url, item])).values());

        // Transform
        const newsItems: NewsItem[] = uniqueArticles
            .filter((article: any) => article.title && article.source && article.title !== '[Removed]')
            .map((article: any) => ({
                url: article.url,
                title: article.title.split(' - ')[0],
                source: article.source,
                publishedAt: article.publishedAt,
                description: article.description,
                urlToImage: article.urlToImage
            }));

        // Cluster (With Bias 2.0 & Blindspots) -- Now with Gemini Option
        let clusters: any[] = [];

        // Try Gemini Smart Clustering first if Key exists
        if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
            try {
                // gemini matches imported class
                const gemini = new GeminiProcessor();
                const groupedIndices = await gemini.smartCluster(newsItems);

                if (groupedIndices && groupedIndices.length > 0) {
                    console.log(`[GEMINI] Smart Clustering success. Found ${groupedIndices.length} clusters.`);

                    // Reconstruct clusters from indices and Calculate Bias Stats
                    // We reuse the logic from clusterStories but apply it to the grouped indices
                    clusters = groupedIndices.map((indices: number[]) => {
                        const items = indices.map(i => newsItems[i]).filter(Boolean);
                        if (items.length === 0) return null;

                        // Sort by date desc
                        items.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

                        const mainStory = items[0];

                        // Calculate Bias Distrib
                        const biasDist: Record<string, number> = {
                            'left': 0, 'center-left': 0, 'center': 0, 'center-right': 0, 'right': 0
                        };

                        items.forEach(item => {
                            // We need to re-calculate bias here since it was done inside clusterStories before
                            const bias = getBiasForSource(item.source);
                            item.bias = bias; // Attach to item
                            if (bias && biasDist[bias] !== undefined) {
                                biasDist[bias]++;
                            }
                        });

                        // Check Blindspots (Reused logic)
                        let blindspot = false;
                        let blindspotSide: 'left' | 'right' | undefined = undefined;
                        const leftBlock = biasDist['left'] + biasDist['center-left'];
                        const rightBlock = biasDist['right'] + biasDist['center-right'];
                        const total = leftBlock + rightBlock + biasDist['center'];

                        if (total > 0) {
                            if (leftBlock > 0 && rightBlock === 0) {
                                blindspot = true; blindspotSide = 'right';
                            } else if (rightBlock > 0 && leftBlock === 0) {
                                blindspot = true; blindspotSide = 'left';
                            }
                        }

                        return {
                            id: crypto.randomUUID(),
                            mainTitle: mainStory.title,
                            summary: mainStory.description || mainStory.title,
                            items: items,
                            biasDistribution: biasDist,
                            firstPublishedAt: mainStory.publishedAt,
                            blindspot,
                            blindspotSide
                        };
                    }).filter((Boolean) as any) as StoryCluster[];

                    // --- APPLY DIVERSITY FILTER TO GEMINI CLUSTERS ---
                    const initialCount = clusters.length;
                    clusters = filterDiverseClusters(clusters);
                    console.log(`[GEMINI DIVERSITY] Dropped ${initialCount - clusters.length} clusters. Kept ${clusters.length}.`);
                }
            } catch (e) {
                console.error("[GEMINI] Failed to cluster:", e);
                // Fallthrough to standard clustering
            }
        }

        // Fallback or Standard Logic
        if (clusters.length === 0) {
            console.log("[CLUSTERING] Using Standard Jaccard Logic...");
            clusters = clusterStories(newsItems);
        }

        console.log(`[CLUSTERING] Produced ${clusters.length} clusters from ${newsItems.length} items.`);

        return NextResponse.json({ clusters });

    } catch (error: any) {
        console.error("API Route Error:", error);
        return NextResponse.json({ error: error.message || 'Failed to fetch news' }, { status: 500 });
    }
}
