/**
 * Interface representing a normalized news item from an API
 */
export type BiasType = 'left' | 'center-left' | 'center' | 'center-right' | 'right';

export interface NewsItem {
    url: string;
    title: string;
    source: string;
    publishedAt: string; // ISO date string
    description?: string;
    urlToImage?: string;
    bias?: BiasType;
}

/**
 * Curated list of domains for reliable news fetching.
 */
export const CHILE_LEFT_LIST = [
    'elmostrador.cl', 'eldesconcierto.cl', 'theclinic.cl', 'elciudadano.com', 
    'laizquierdadiario.cl', 'cooperativa.cl', 'cnnchile.com', 'radio.uchile.cl', 
    'interferencia.cl', 'ciperchile.cl'
];
export const CHILE_LEFT = CHILE_LEFT_LIST.join(',');

export const CHILE_RIGHT_CENTER_LIST = [
    'latercera.com', 'biobiochile.cl', 'emol.com', '24horas.cl', 
    't13.cl', 'radioagricultura.cl', 'adnradio.cl', 'meganoticias.cl'
];
export const CHILE_RIGHT_CENTER = CHILE_RIGHT_CENTER_LIST.join(',');

export const CHILE_DOMAINS = `${CHILE_LEFT},${CHILE_RIGHT_CENTER}`;

// INTERNACIONAL (Spanish)
export const INTL_LEFT = [
    'elpais.com', 'rt.com', 'pagina12.com.ar', 'eldiario.es'
].join(',');

export const INTL_RIGHT_CENTER = [
    'infobae.com', 'clarin.com', 'lanacion.com.ar', 'elmundo.es', 
    'lavanguardia.com', 'abc.es', 'cnn.com', 'bbc.com', 'dw.com'
].join(',');

export const INTL_DOMAINS = `${INTL_LEFT},${INTL_RIGHT_CENTER}`;

// ANGLO (English)
export const ANGLO_LEFT_LIST = [
    'nytimes.com', 'cnn.com', 'theguardian.com', 'washingtonpost.com', 'aljazeera.com', 'msnbc.com'
];
export const ANGLO_LEFT = ANGLO_LEFT_LIST.join(',');

export const ANGLO_RIGHT_CENTER_LIST = [
    'foxnews.com', 'bbc.co.uk', 'reuters.com', 'apnews.com', 'usatoday.com', 'bloomberg.com', 'wsj.com', 'nypost.com'
];
export const ANGLO_RIGHT_CENTER = ANGLO_RIGHT_CENTER_LIST.join(',');

/**
 * Represents a cluster of stories about the same event
 */
export interface StoryCluster {
    id: string;
    mainTitle: string;
    summary: string;
    items: NewsItem[];
    biasDistribution: Record<BiasType, number>;
    firstPublishedAt: string;
    blindspot?: boolean; 
    blindspotSide?: 'left' | 'right'; 
}

/**
 * ROBUST BIAS MAPPING (V2.9 ARCHITECT)
 * Handles domains, slugs and names.
 */
export function getBiasForSource(sourceName: string): BiasType {
    const s = sourceName.toLowerCase();
    
    // LEFT
    if (s.includes('desconcierto') || s.includes('izquierda') || s.includes('ciudadano') || 
        s.includes('pagina12') || s.includes('rt.com') || s === 'rt' || s.includes('guardian')) return 'left';
    
    // CENTER-LEFT
    if (s.includes('mostrador') || s.includes('cooperativa') || s.includes('uchile') || 
        s.includes('interferencia') || s.includes('ciper') || s.includes('elpais') || 
        s.includes('nytimes') || s.includes('aljazeera')) return 'center-left';
    
    // CENTER-RIGHT
    if (s.includes('tercera') || s.includes('meganoticias') || s.includes('t13') || 
        s.includes('clarin') || s.includes('lavanguardia')) return 'center-right';
    
    // RIGHT
    if (s.includes('mercurio') || s.includes('emol') || s.includes('agricultura') || 
        s.includes('infobae') || s.includes('lanacion') || s.includes('abc') || 
        s.includes('foxnews') || s.includes('wsj') || s.includes('nypost') || s.includes('elmundo')) return 'right';

    // CENTER / NEUTRAL
    return 'center';
}

/**
 * Advanced Clustering Logic (V2.9 Architect)
 */
export function clusterStories(stories: NewsItem[]): StoryCluster[] {
    const clusters: StoryCluster[] = [];

    const enrichedStories = stories.map(s => ({
        ...s,
        bias: getBiasForSource(s.source)
    })).sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    for (const story of enrichedStories) {
        let foundCluster = false;

        for (const cluster of clusters) {
            const timeDiff = Math.abs(new Date(story.publishedAt).getTime() - new Date(cluster.firstPublishedAt).getTime());
            const hoursDiff = timeDiff / (1000 * 60 * 60);

            if (hoursDiff < 36) { 
                const similarity = jaccardSimilarity(story.title, cluster.mainTitle);
                const storyEntities = extractMeaningfulEntities(story.title);
                const clusterEntities = extractMeaningfulEntities(cluster.mainTitle);
                
                const sharedEntities = [...storyEntities].filter(e => clusterEntities.has(e));
                const sharedCount = sharedEntities.length;

                // Threshold: Meaningful match
                if (sharedCount >= 2 || (sharedCount >= 1 && similarity > 0.2) || similarity > 0.4) {
                    cluster.items.push(story);
                    if (story.bias) cluster.biasDistribution[story.bias]++;
                    
                    if (!cluster.mainTitle.includes('.cl') && story.url.includes('.cl')) {
                        cluster.mainTitle = story.title;
                        cluster.summary = story.description || story.title;
                    }
                    foundCluster = true;
                    break;
                }
            }
        }

        if (!foundCluster) {
            clusters.push({
                id: crypto.randomUUID(),
                mainTitle: story.title,
                summary: story.description || story.title,
                items: [story],
                biasDistribution: { 'left': 0, 'center-left': 0, 'center': 0, 'center-right': 0, 'right': 0 },
                firstPublishedAt: story.publishedAt
            });
            const last = clusters[clusters.length - 1];
            if (story.bias) last.biasDistribution[story.bias]++;
        }
    }

    // Process Blindspots
    clusters.forEach(c => {
        const leftCount = c.biasDistribution['left'] + c.biasDistribution['center-left'];
        const rightCount = c.biasDistribution['right'] + c.biasDistribution['center-right'];
        if (leftCount > 0 && rightCount === 0) { c.blindspot = true; c.blindspotSide = 'right'; }
        else if (rightCount > 0 && leftCount === 0) { c.blindspot = true; c.blindspotSide = 'left'; }
    });

    return filterDiverseClusters(clusters);
}

export function filterDiverseClusters(clusters: StoryCluster[]): StoryCluster[] {
    return clusters.filter(c => {
        if (c.items.length < 2) return false;
        const biasCount = Object.values(c.biasDistribution).filter(v => v > 0).length;
        const hasLeft = c.biasDistribution['left'] > 0 || c.biasDistribution['center-left'] > 0;
        const hasRight = c.biasDistribution['right'] > 0 || c.biasDistribution['center-right'] > 0;

        // Valid if:
        // 1. We have at least 2 distinct biases
        // 2. OR it's a significant event (more than 3 articles) from one side
        return (biasCount >= 2) || (c.items.length >= 4);
    });
}

function extractMeaningfulEntities(text: string): Set<string> {
    const generic = new Set(['MÉXICO', 'CHILE', 'SANTIAGO', 'MUNDO', 'PAÍS', 'NACIONAL', 'INTERNACIONAL', 'MINUTO', 'AHORA', 'ULTIMO', 'NOTICIAS', 'GOBIERNO', 'PARA', 'COMO', 'ESTE', 'ESTA', 'PERO']);
    const words = text.split(/\s+/);
    const entities = new Set<string>();
    for (const word of words) {
        const clean = word.replace(/[^\w\u00C0-\u00FF]/g, '');
        if (clean.length > 3 && /^[A-Z\u00D1]/.test(clean)) {
            const upper = clean.toUpperCase();
            if (!ignoredStrings.has(upper) && !generic.has(upper)) entities.add(clean.toLowerCase());
        }
    }
    return entities;
}

const ignoredStrings = new Set(['ESTE', 'ESTA', 'PARA', 'COMO', 'PORQUE', 'TIENE', 'ESTA', 'DESDE']);

function jaccardSimilarity(str1: string, str2: string): number {
    const clean = (s: string) => new Set(s.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2));
    const set1 = clean(str1); const set2 = clean(str2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return union.size === 0 ? 0 : intersection.size / union.size;
}
