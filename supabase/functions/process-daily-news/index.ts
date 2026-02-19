import { createClient } from 'jsr:@supabase/supabase-js'
import { GoogleGenerativeAI } from 'npm:@google/generative-ai'
import {
    CHILE_LEFT, CHILE_RIGHT_CENTER,
    INTL_LEFT, INTL_RIGHT_CENTER,
    ANGLO_LEFT, ANGLO_RIGHT_CENTER,
    getBiasForSource
} from './utils.ts'

// --- CONFIG ---
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GEMINI_API_KEY = Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY')!

const NEWS_API_KEY = Deno.env.get('NEWS_API_KEY')
const NEWS_DATA_KEY = Deno.env.get('NEWSDATA_API_KEY')
const GNEWS_KEY = Deno.env.get('GNEWS_API_KEY')
const WORLD_NEWS_KEY = Deno.env.get('WORLD_NEWS_API_KEY')
const CURRENTS_KEY = Deno.env.get('CURRENTS_API_KEY')

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
// Using 2.0 Flash for speed & cost/performance
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })

// --- TYPES ---
interface NewsItem {
    url: string
    title: string
    source: string
    publishedAt: string
    description?: string
    urlToImage?: string
    bias?: string
}

interface StoryCluster {
    id: string
    mainTitle: string
    summary: string
    items: NewsItem[]
    biasDistribution: Record<string, number>
    firstPublishedAt: string
    blindspot?: boolean
    blindspotSide?: 'left' | 'right'
    // Analysis
    analysis?: {
        resumen_ejecutivo: string
        kpis: {
            polarizacion: number
            diversidad: string
        }
    }
}

// --- WORKER ---

Deno.serve(async (req) => {
    console.log("[JOB START] process-daily-news starting...")

    if (!GEMINI_API_KEY) return new Response("Missing GEMINI_API_KEY", { status: 500 })

    try {
        // Run for all scopes concurrently
        const scopes = ['nacional', 'espanol', 'anglo']
        const results = await Promise.all(scopes.map(processScope))

        return new Response(JSON.stringify({ success: true, results }), {
            headers: { 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        console.error("CRITICAL JOB ERROR:", error)
        return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
})

async function processScope(scope: string) {
    console.log(`[SCOPE: ${scope}] Starting processing...`)

    // 1. Fetch News (Multi-source parallel fetch)
    const rawArticles = await fetchNewsForScope(scope)
    console.log(`[SCOPE: ${scope}] Fetched ${rawArticles.length} raw articles.`)

    if (rawArticles.length === 0) {
        return { scope, status: 'skipped', reason: 'no articles found' }
    }

    // 2. Prepare for Gemini Clustering
    // We send a simplified list to save tokens
    const simplifiedList = rawArticles.slice(0, 150).map((a, idx) => ({
        id: idx,
        title: a.title,
        source: a.source,
        desc: a.description?.substring(0, 100) || ""
    }))

    // 3. Gemini Clustering
    const clusters = await performGeminiClustering(simplifiedList, rawArticles)

    // 4. Gemini Analysis (Per cluster)
    // Only analyze significant clusters (>= 2 items) to save time/tokens
    const significantClusters = clusters.filter(c => c.items.length >= 2)

    console.log(`[SCOPE: ${scope}] Analyzing ${significantClusters.length} significant clusters...`)

    for (const cluster of significantClusters) {
        try {
            const analysis = await analyzeCluster(cluster)
            if (analysis) {
                cluster.analysis = analysis
            }
        } catch (e) {
            console.error(`[SCOPE: ${scope}] Cluster analysis failed:`, e)
        }
    }

    // 5. Store in DB
    const digest = {
        scope,
        digest_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        clusters: clusters, // JSONB
        raw_article_count: rawArticles.length,
        cluster_count: clusters.length,
        processing_status: 'complete'
    }

    const { error } = await supabase
        .from('news_daily_digest')
        .upsert(digest, { onConflict: 'scope, digest_date' })

    if (error) {
        console.error(`[SCOPE: ${scope}] DB Upsert Error:`, error)
        throw error
    }

    console.log(`[SCOPE: ${scope}] Success. Stored ${clusters.length} clusters.`)
    return { scope, status: 'success', clusterCount: clusters.length }
}

// --- FETCHING LOGIC (Simplified from frontend) ---

async function fetchNewsForScope(scope: string): Promise<NewsItem[]> {
    let domains = ''
    let language = 'es'

    if (scope === 'nacional') {
        domains = `${CHILE_LEFT},${CHILE_RIGHT_CENTER}`
    } else if (scope === 'espanol') {
        domains = `${CHILE_LEFT},${INTL_LEFT},${CHILE_RIGHT_CENTER},${INTL_RIGHT_CENTER}`
    } else if (scope === 'anglo') {
        domains = `${ANGLO_LEFT},${ANGLO_RIGHT_CENTER}`
        language = 'en'
    }

    // Parallel fetch from multiple providers if keys exist
    const promises: Promise<NewsItem[]>[] = []

    // 1. NewsAPI (Primary)
    if (NEWS_API_KEY) {
        promises.push(fetchNewsAPI(domains, language))
    }

    // 2. GNews (Secondary)
    if (GNEWS_KEY) {
        // Simplified fallback query
        const q = scope === 'nacional' ? 'chile' : (scope === 'espanol' ? 'noticias' : 'news')
        promises.push(fetchGNews(q, language))
    }

    // 3. NewsData (Tertiary)
    if (NEWS_DATA_KEY) {
        promises.push(fetchNewsData(scope, language))
    }

    const results = await Promise.all(promises)
    const allArticles = results.flat()

    // Deduplicate by URL
    const seen = new Set()
    return allArticles.filter(a => {
        if (seen.has(a.url)) return false
        seen.add(a.url)
        return true
    })
}

async function fetchNewsAPI(domains: string, lang: string): Promise<NewsItem[]> {
    try {
        const url = `https://newsapi.org/v2/everything?domains=${domains}&language=${lang}&sortBy=publishedAt&pageSize=100&apiKey=${NEWS_API_KEY}`
        const res = await fetch(url)
        const data = await res.json()
        if (data.status !== 'ok') return []

        return data.articles
            .filter((a: any) => a.title !== '[Removed]')
            .map((a: any) => ({
                url: a.url,
                title: a.title,
                source: a.source.name,
                publishedAt: a.publishedAt,
                description: a.description,
                urlToImage: a.urlToImage,
                bias: getBiasForSource(a.source.name)
            }))
    } catch (e) {
        console.error("NewsAPI Error:", e)
        return []
    }
}

async function fetchGNews(query: string, lang: string): Promise<NewsItem[]> {
    try {
        const url = `https://gnews.io/api/v4/search?q=${query}&lang=${lang}&max=10&token=${GNEWS_KEY}`
        const res = await fetch(url)
        const data = await res.json()
        if (!data.articles) return []

        return data.articles.map((a: any) => ({
            url: a.url,
            title: a.title,
            source: a.source.name,
            publishedAt: a.publishedAt,
            description: a.description,
            urlToImage: a.image,
            bias: getBiasForSource(a.source.name)
        }))
    } catch (e) {
        console.error("GNews Error:", e)
        return []
    }
}

async function fetchNewsData(scope: string, lang: string): Promise<NewsItem[]> {
    try {
        let url = `https://newsdata.io/api/1/latest?apikey=${NEWS_DATA_KEY}&language=${lang}`
        if (scope === 'nacional') url += '&country=cl'

        const res = await fetch(url)
        const data = await res.json()
        if (!data.results) return []

        return data.results.map((a: any) => ({
            url: a.link,
            title: a.title,
            source: a.source_id,
            publishedAt: a.pubDate,
            description: a.description,
            urlToImage: a.image_url,
            bias: getBiasForSource(a.source_id)
        }))
    } catch (e) {
        console.error("NewsData Error:", e)
        return []
    }
}

// --- AI LOGIC ---

async function performGeminiClustering(simplifiedList: any[], originalArticles: NewsItem[]): Promise<StoryCluster[]> {
    const prompt = `
    You are an expert news aggregator. Group the following news articles into clusters based on the EVENT they are reporting.
    Articles about the EXACT SAME event/topic should be in the same cluster.
    
    Input Articles:
    ${JSON.stringify(simplifiedList)}

    Return a STRICT JSON array of arrays of IDs (indices).
    Example: [[0, 2], [1], [3, 4, 5]]
    Return ONLY the JSON. No markdown.
    `

    try {
        const result = await model.generateContent(prompt)
        const text = result.response.text()
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim()
        const groups: number[][] = JSON.parse(cleanText)

        // Convert indices back to full cluster objects
        return groups.map(indices => {
            const items = indices.map(i => originalArticles[i]).filter(Boolean)
            if (items.length === 0) return null

            // Calc Bias Distribution
            const biasDist: Record<string, number> = { 'left': 0, 'center-left': 0, 'center': 0, 'center-right': 0, 'right': 0 }
            items.forEach(i => {
                if (i.bias && biasDist[i.bias] !== undefined) biasDist[i.bias]++
            })

            // Calc Blindspot
            let blindspot = false
            let blindspotSide: 'left' | 'right' | undefined = undefined
            const leftCount = biasDist['left'] + biasDist['center-left']
            const rightCount = biasDist['right'] + biasDist['center-right']

            if ((leftCount > 0 && rightCount === 0)) { blindspot = true; blindspotSide = 'right' }
            else if ((rightCount > 0 && leftCount === 0)) { blindspot = true; blindspotSide = 'left' }

            // Title selection (Prefer longer title or first one)
            const mainStory = items[0]

            return {
                id: crypto.randomUUID(),
                mainTitle: mainStory.title,
                summary: mainStory.description || mainStory.title,
                items: items,
                biasDistribution: biasDist,
                firstPublishedAt: mainStory.publishedAt,
                blindspot,
                blindspotSide
            }
        }).filter(Boolean) as StoryCluster[]

    } catch (error) {
        console.error("Gemini Clustering Error:", error)
        return [] // Fail safe
    }
}

async function analyzeCluster(cluster: StoryCluster): Promise<any> {
    const summaryList = cluster.items.map(a =>
        `- Fuente: ${a.source} (${getBiasForSource(a.source)})\n  Titular: ${a.title}`
    ).join('\n')

    const prompt = `
    Analista Senior de Medios:
    Analiza este grupo de noticias sobre el MISMO evento.
    
    NOTICIAS:
    ${summaryList}

    OUTPUT JSON (Minified):
    {
        "resumen_ejecutivo": "Sintesis de 30 palabras del hecho y cómo lo cubren los medios.",
        "kpis": { "polarizacion": 1-10, "diversidad": "ALTA/MEDIA/BAJA" }
    }
    ONLY JSON.
    `

    try {
        const result = await model.generateContent(prompt)
        const text = result.response.text()
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim()
        return JSON.parse(cleanText)
    } catch (e) {
        return null
    }
}
