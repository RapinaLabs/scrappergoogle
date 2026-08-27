import { scrapeGoogleMaps } from '../src/scrapers/googleMaps.js';

async function main() {
  console.log('🧪 Iniciando teste do Scraper Google Maps...');
  try {
    const leads = await scrapeGoogleMaps('construtora em Torres RS', {
      maxResults: 3,
      scrapeContacts: true
    });

    console.log(`\n✅ Teste Concluído com Sucesso! Total de leads: ${leads.length}`);
    console.log(JSON.stringify(leads, null, 2));
  } catch (err) {
    console.error('❌ Erro no teste:', err);
  }
}

main();
