import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { type NewsItem } from "./analyzer";

const API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

export class GeminiProcessor {
    private genAI: GoogleGenerativeAI | null = null;
    private model: GenerativeModel | null = null;

    constructor() {
        if (API_KEY) {
            this.genAI = new GoogleGenerativeAI(API_KEY);
            // Using stable 2.0 flash
            this.model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        }
    }

    async smartCluster(articles: NewsItem[]): Promise<number[][]> {
        if (!this.model || articles.length === 0) return [];

        const simplifiedList = articles.map((a, index) => ({
            id: index,
            title: a.title,
            desc: a.description?.substring(0, 100) || ""
        }));

        const prompt = `
        You are an expert news aggregator. Group the following news articles into clusters based on the EVENT they are reporting.
        Articles about the EXACT SAME event/topic should be in the same cluster.
        If an article is unique, it should be in its own cluster.
        
        Input Articles:
        ${JSON.stringify(simplifiedList)}

        Return a STRICT JSON array of arrays of IDs. Each inner array is a cluster.
        Example: [[0, 2], [1], [3, 4, 5]]
        Return ONLY the JSON. No markdown formatting.
        `;

        try {
            const result = await this.model.generateContent(prompt);
            const text = result.response.text();
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanText);
        } catch (error) {
            console.error("Gemini Clustering Error:", error);
            return [];
        }
    }

    async analyzeCluster(articles: NewsItem[]): Promise<any> {
        if (!this.model || articles.length === 0) return null;

        const simplifiedList = articles.map(a =>
            `- Fuente: ${a.source} (${a.bias || 'Unknown'})\n  Titular: ${a.title}\n  Resumen: ${a.description || ''}`
        ).join('\n\n');

        const prompt = `
        Act├║a como un Auditor de Datos y Analista Pol├¡tico Senior experto en el ecosistema de medios chileno.
        Se te entrega un grupo de art├¡culos sobre un mismo evento. Tu misi├│n es exponer las discrepancias y los puntos ciegos.

        ART├ìCULOS:
        ${simplifiedList}

        FORMATO DE SALIDA (STRICT JSON):
        {
            "resumen_ejecutivo": "Patr├│n detectado...",
            "auditoria_lineal": [
                {
                    "meta": { "sesgo": "...", "medio": "...", "titular": "..." },
                    "analisis_especifico": { "framing": "...", "puntos_ciegos": "...", "adjetivo_critico": "..." },
                    "kpis": { "polarizacion": 1, "neutralidad": 1, "sensacionalismo": 1 }
                }
            ],
            "kpis": { "polarizacion": 5.0, "diversidad": "ALTA" }
        }

        Retorna SOLO el JSON. Sin markdown.
        `;

        try {
            const result = await this.model.generateContent(prompt);
            const text = result.response.text();
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanText);
        } catch (error) {
            console.error("Gemini Analysis Error:", error);
            return null;
        }
    }
}
