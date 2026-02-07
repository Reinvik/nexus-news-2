// Copia de analyzer.ts adaptada para Deno
export const CHILE_LEFT_LIST = [
    'elmostrador.cl',
    'eldesconcierto.cl',
    'theclinic.cl',
    'elciudadano.com',
    'laizquierdadiario.cl',
    'cooperativa.cl',
    'cnnchile.com',
    'radio.uchile.cl',
    'interferencia.cl',
    'ciperchile.cl'
];

export const CHILE_RIGHT_CENTER_LIST = [
    'latercera.com',
    'biobiochile.cl',
    'emol.com',
    '24horas.cl',
    't13.cl',
    'radioagricultura.cl',
    'adnradio.cl',
    'meganoticias.cl'
];

export const CHILE_DOMAINS = [...CHILE_LEFT_LIST, ...CHILE_RIGHT_CENTER_LIST].join(',');

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
    'CIPER': 'center-left'
};

export function getBiasForSource(sourceName: string): BiasType {
    const cleanName = sourceName.trim();
    if (SOURCE_BIAS[cleanName]) return SOURCE_BIAS[cleanName];
    const lower = cleanName.toLowerCase();

    if (lower.includes('tercera')) return 'center-right';
    if (lower.includes('mercurio') || lower.includes('emol') || lower.includes(' agricultura')) return 'right';
    if (lower.includes('mostrador') || lower.includes('cooperativa')) return 'center-left';
    if (lower.includes('izquierda') || lower.includes('ciudadano') || lower.includes('clinic')) return 'left';
    if (lower.includes('biobio') || lower.includes('cnn') || lower.includes('bbc') || lower.includes('reuters') || lower.includes('24horas')) return 'center';

    return 'center';
}
