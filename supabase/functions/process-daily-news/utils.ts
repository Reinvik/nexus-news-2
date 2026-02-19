// Copia de analyzer.ts adaptada para Deno

// CHILE LISTS
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


export type BiasType = 'left' | 'center-left' | 'center' | 'center-right' | 'right';

const SOURCE_BIAS: Record<string, BiasType> = {
    'El Mercurio': 'right',
    'Emol': 'right',
    'Radio Agricultura': 'right',
    'La Tercera': 'center-right',
    'Meganoticias': 'center-right',
    'T13': 'center-right',
    'BioBioChile': 'center',
    '24horas.cl': 'center',
    'CNN Chile': 'center',
    'ADN Radio': 'center',
    'Cooperativa.cl': 'center-left',
    'El Mostrador': 'center-left',
    'El Desconcierto': 'left',
    'La Izquierda Diario': 'left',
    'El Ciudadano': 'left',
    'The Clinic': 'left',
    'Radio Universidad de Chile': 'left',
    'Interferencia': 'left',
    'CIPER': 'center-left',
    // International
    'RT': 'left',
    'Página/12': 'left',
    'El País': 'center-left',
    'Infobae': 'right',
    'Clarín': 'center-right',
    'La Nación': 'right',
    'ABC': 'right',
    'El Mundo': 'right'
};

export function getBiasForSource(sourceName: string): BiasType {
    const cleanName = sourceName.trim();
    // Direct match
    if (SOURCE_BIAS[cleanName]) return SOURCE_BIAS[cleanName];

    // Heuristic match
    const lower = cleanName.toLowerCase();

    // RIGHT
    if (lower.includes('mercurio') || lower.includes('emol') || lower.includes('agricultura') ||
        lower.includes('infobae') || lower.includes('lanacion') || lower.includes('abc') ||
        lower.includes('foxnews') || lower.includes('wsj') || lower.includes('nypost') || lower.includes('elmundo')) return 'right';

    // CENTER-RIGHT
    if (lower.includes('tercera') || lower.includes('meganoticias') || lower.includes('t13') ||
        lower.includes('clarin') || lower.includes('lavanguardia')) return 'center-right';

    // LEFT
    if (lower.includes('desconcierto') || lower.includes('izquierda') || lower.includes('ciudadano') ||
        lower.includes('pagina12') || lower.includes('rt.com') || lower === 'rt' || lower.includes('guardian') || lower.includes('clinic')) return 'left';

    // CENTER-LEFT
    if (lower.includes('mostrador') || lower.includes('cooperativa') || lower.includes('uchile') ||
        lower.includes('interferencia') || lower.includes('ciper') || lower.includes('elpais') ||
        lower.includes('nytimes') || lower.includes('aljazeera')) return 'center-left';

    // CENTER / NEUTRAL Fallback
    return 'center';
}
