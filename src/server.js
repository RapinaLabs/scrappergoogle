import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { scrapeGoogleMaps } from './scrapers/googleMaps.js';
import { scrapeInstagram } from './scrapers/instagram.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static public assets (avatars, icons, signatures)
app.use('/public', express.static(path.join(__dirname, '../public'), {
  maxAge: '30d',
  immutable: true
}));

// Healthcheck
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'crawlee-scraper-service',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  });
});

// Endpoint: Scrape Google Maps
app.post('/api/scrape/maps', async (req, res) => {
  const { query, maxResults, scrapeContacts } = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({
      error: 'Parâmetro "query" é obrigatório (ex: "construtora em Porto Alegre")'
    });
  }

  const limit = Math.min(Math.max(parseInt(maxResults, 10) || 20, 1), 100);

  console.log(`[API] Requisição recebida: POST /api/scrape/maps | Query: "${query}" | Limite: ${limit}`);

  try {
    const leads = await scrapeGoogleMaps(query, {
      maxResults: limit,
      scrapeContacts: scrapeContacts !== false
    });

    return res.json(leads);
  } catch (err) {
    console.error(`[API] Erro ao raspar Google Maps: ${err.message}`, err);
    return res.status(500).json({
      error: 'Falha ao executar raspagem no Google Maps',
      message: err.message
    });
  }
});

// Endpoint: Scrape Instagram
app.post('/api/scrape/instagram', async (req, res) => {
  const { query, maxResults } = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({
      error: 'Parâmetro "query" é obrigatório (ex: "advocacia Porto Alegre")'
    });
  }

  const limit = Math.min(Math.max(parseInt(maxResults, 10) || 20, 1), 50);

  console.log(`[API] Requisição recebida: POST /api/scrape/instagram | Query: "${query}" | Limite: ${limit}`);

  try {
    const leads = await scrapeInstagram(query, {
      maxResults: limit
    });

    return res.json(leads);
  } catch (err) {
    console.error(`[API] Erro ao raspar Instagram: ${err.message}`, err);
    return res.status(500).json({
      error: 'Falha ao executar raspagem no Instagram',
      message: err.message
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Crawlee Scraper Service rodando em http://0.0.0.0:${PORT}`);
  console.log(`📌 Endpoints disponíveis:`);
  console.log(`   - GET  /health`);
  console.log(`   - GET  /public/*`);
  console.log(`   - POST /api/scrape/maps`);
  console.log(`   - POST /api/scrape/instagram`);
});
