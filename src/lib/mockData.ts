import { StoryCluster } from "./analyzer";

export const MOCK_CLUSTERS: StoryCluster[] = [
    {
        id: "mock-1",
        mainTitle: "Debate Constitucional: Nuevas Propuestas (MOCK)",
        summary: "Diversos sectores políticos presentan sus enmiendas al anteproyecto constitucional, centrando el debate en derechos sociales y sistema político. (Datos simulados por límite de API)",
        items: [
            {
                url: "https://www.latercera.com/mock-article-1",
                title: "Consejo Constitucional intensifica votaciones",
                source: "latercera.com",
                publishedAt: new Date().toISOString(),
                bias: "center-right",
                urlToImage: "https://placehold.co/600x400?text=Politica"
            },
            {
                url: "https://www.elmostrador.cl/mock-article-2",
                title: "Oficialismo critica enmiendas de la oposición",
                source: "elmostrador.cl",
                publishedAt: new Date().toISOString(),
                bias: "left",
                urlToImage: "https://placehold.co/600x400?text=Debate"
            }
        ],
        biasDistribution: { "left": 1, "center-right": 1, "center": 0, "center-left": 0, "right": 0 },
        firstPublishedAt: new Date().toISOString()
    },
    {
        id: "mock-2",
        mainTitle: "Economía Chilena: IPC del mes (MOCK)",
        summary: "El IPC sorprende con una variación menor a la esperada, dando respiro a la inflación anual. Expertos analizan el impacto en la UF.",
        items: [
            {
                url: "https://www.emol.com/mock-article-3",
                title: "IPC sube menos de lo esperado en el último mes",
                source: "emol.com",
                publishedAt: new Date().toISOString(),
                bias: "center-right",
                urlToImage: "https://placehold.co/600x400?text=Economia"
            },
            {
                url: "https://www.eldesconcierto.cl/mock-article-4",
                title: "Ministro de Hacienda destaca control inflacionario",
                source: "eldesconcierto.cl",
                publishedAt: new Date().toISOString(),
                bias: "left",
                urlToImage: "https://placehold.co/600x400?text=Hacienda"
            }
        ],
        biasDistribution: { "left": 1, "center-right": 1, "center": 0, "center-left": 0, "right": 0 },
        firstPublishedAt: new Date().toISOString()
    },
    {
        id: "mock-3",
        mainTitle: "Fútbol Nacional: Colo-Colo vs U. de Chile (MOCK)",
        summary: "Se acerca el superclásico del fútbol chileno con ambos equipos peleando la punta del campeonato.",
        items: [
            {
                url: "https://www.t13.cl/mock-article-5",
                title: "La previa del Superclásico: Formaciones probables",
                source: "t13.cl",
                publishedAt: new Date().toISOString(),
                bias: "center-right",
                urlToImage: "https://placehold.co/600x400?text=Futbol"
            },
            {
                url: "https://www.biobiochile.cl/mock-article-6",
                title: "Entradas agotadas para el duelo en el Monumental",
                source: "biobiochile.cl",
                publishedAt: new Date().toISOString(),
                bias: "center-right",
                urlToImage: "https://placehold.co/600x400?text=Estadio"
            }
        ],
        biasDistribution: { "center-right": 2, "left": 0, "center": 0, "center-left": 0, "right": 0 },
        blindspot: true,
        blindspotSide: 'left',
        firstPublishedAt: new Date().toISOString()
    }
];
