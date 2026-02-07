const https = require('https');
const fs = require('fs');
const path = require('path');

// Load .env.local manually since we are running with plain node
const envPath = path.resolve(__dirname, '.env.local');
let apiKey = '';
try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/NEWS_API_KEY=(.*)/);
    if (match) apiKey = match[1].trim();
} catch (e) {
    console.error("Could not read .env.local");
    process.exit(1);
}

if (!apiKey) {
    console.error("No API Key found in .env.local");
    process.exit(1);
}

const CHILE_LEFT = [
    'elmostrador.cl', 'eldesconcierto.cl', 'theclinic.cl', 'elciudadano.com',
    'laizquierdadiario.cl', 'cooperativa.cl', 'cnnchile.com', 'radio.uchile.cl',
    'interferencia.cl', 'ciperchile.cl'
].join(',');

const CHILE_RIGHT = [
    'latercera.com', 'biobiochile.cl', 'emol.com', '24horas.cl', 't13.cl',
    'radioagricultura.cl', 'adnradio.cl', 'meganoticias.cl'
].join(',');

function fetchStats(name, domains) {
    const url = `https://newsapi.org/v2/everything?domains=${domains}&language=es&sortBy=publishedAt&pageSize=20&apiKey=${apiKey}`;

    console.log(`\nTesting ${name}...`);
    // console.log(`URL: ${url}`); // Don't print API key in logs

    https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                if (json.status === 'error') {
                    console.error("API Error:", json.message);
                } else {
                    console.log(`Found ${json.totalResults} articles.`);
                    console.log("Sources found:");
                    const sources = {};
                    json.articles.forEach(a => {
                        const s = a.source.name;
                        sources[s] = (sources[s] || 0) + 1;
                    });
                    console.log(sources);
                }
            } catch (e) {
                console.error("Parse error", e);
            }
        });
    }).on('error', (e) => {
        console.error("Request error", e);
    });
}

fetchStats("CHILE LEFT", CHILE_LEFT);
fetchStats("CHILE RIGHT", CHILE_RIGHT);
