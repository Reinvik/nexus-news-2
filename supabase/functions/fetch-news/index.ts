
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'npm:@google/generative-ai@^0.12.0'
import { CHILE_DOMAINS, getBiasForSource } from './utils.ts'

// Configuration
const NEWS_API_KEY = Deno.env.get('NEWS_API_KEY')
const GEMINI_API_KEY = Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

Deno.serve(async (req) => {
    console.log("Starting fetch-news job...")

    if (!NEWS_API_KEY || !GEMINI_API_KEY) {
        return new Response(JSON.stringify({ error: 'Missing API Keys' }), { status: 500 })
    }

    try {
        // 1. Fetch News
        const url = `https://newsapi.org/v2/everything?domains=${CHILE_DOMAINS}&language=es&sortBy=publishedAt&pageSize=40&apiKey=${NEWS_API_KEY}`
        const newsRes = await fetch(url)
        const newsData = await newsRes.json()

        if (newsData.status !== 'ok') {
            throw new Error(`NewsAPI Error: ${newsData.message}`)
        }

        const articles = newsData.articles.map((a: any) => ({
            title: a.title,
            url: a.url,
            source: a.source.name,
            published_at: a.publishedAt,
            bias: getBiasForSource(a.source.name),
            // Use URL as unique ID to prevent duplicates
        }))

        // 2. Store in DB (Upsert)
        // We ignore duplicates on conflict of 'url'
        const { error: insertError } = await supabase
            .from('News_Articles')
            .upsert(articles, { onConflict: 'url', ignoreDuplicates: true })

        if (insertError) {
            console.error('Insert Error:', insertError)
        } else {
            console.log(`Processed ${articles.length} articles.`)
        }

        // 3. Analyze (Simplified for MVP: Analyze latest cluster)
        // For this demonstration, we'll pick the top 5 latest articles and ask Gemini for a quick summary/analysis if not done recently.
        // In production, we'd check if we already analyzed this "hour" or "cluster".

        // Check if we need to analyze (e.g. check last analysis time or just do it every run since it's 24/day)
        // We'll analyze the top 5 articles just fetched.
        if (articles.length > 0) {
            const topArticles = articles.slice(0, 5)

            const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" }) // Using Flash as per context

            const prompt = `
      Analiza estas 5 noticias recientes de Chile:
      ${JSON.stringify(topArticles.map((a: any) => ({ title: a.title, source: a.source, bias: a.bias })))}

      Genera un breve JSON con:
      {
        "resumen_hora": "Resumen de lo que está pasando...",
        "tendencia": "Derecha/Izquierda/Neutro",
        "tema_principal": "..."
      }
      SOLO JSON.
      `

            const result = await model.generateContent(prompt)
            const response = await result.response
            const text = response.text()
            const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim()

            await supabase.from('News_Analysis').insert({
                analysis_json: JSON.parse(cleanJson),
                cluster_id: 'hourly-digest-' + new Date().toISOString()
            })
            console.log("Analysis saved.")
        }

        // 4. Cleanup Logic
        // Delete articles older than 7 days
        const { error: cleanupError } = await supabase
            .from('News_Articles')
            .delete()
            .lt('published_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

        if (cleanupError) console.error("Cleanup Error:", cleanupError)
        else console.log("Cleanup performed.")

        return new Response(JSON.stringify({ success: true, count: articles.length }), {
            headers: { 'Content-Type': 'application/json' },
        })

    } catch (error: any) {
        console.error("Job Failed:", error)
        return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
})

// Configure Cron
/* 
  config.toml or dashboard:
  [functions.fetch-news]
  schedule = "0 * * * *"
*/
