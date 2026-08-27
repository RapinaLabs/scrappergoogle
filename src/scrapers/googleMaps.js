import { chromium } from 'playwright';
import { extractContactsFromHtml } from '../utils/contactExtractor.js';
import { parseAddress, formatPhoneNumber } from '../utils/normalizer.js';

/**
 * Scrapes Google Maps places using Playwright and deeply scrapes company websites for contacts.
 */
export async function scrapeGoogleMaps(query, options = {}) {
  const maxResults = options.maxResults || 20;
  const scrapeContacts = options.scrapeContacts !== false;
  const results = [];

  console.log(`[GoogleMaps] Iniciando busca para: "${query}" (Limite: ${maxResults})`);

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--lang=pt-BR,pt'
      ]
    });

    const context = await browser.newContext({
      locale: 'pt-BR',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 900 }
    });

    const page = await context.newPage();
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}?hl=pt-BR`;

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Consent button
    try {
      const consentBtn = page.locator('button[aria-label*="Aceitar"], button[aria-label*="Accept"], form[action*="consent"] button');
      if (await consentBtn.count() > 0) {
        await consentBtn.first().click();
        await page.waitForTimeout(1000);
      }
    } catch (_) {}

    // Scroll feed to load items
    const feed = page.locator('div[role="feed"]');
    let attempts = 0;

    while (attempts < 10) {
      const links = page.locator('a.hfpxzc, a[href*="/maps/place/"]');
      const count = await links.count();
      if (count >= maxResults || attempts > 5) break;

      try {
        if (await feed.count() > 0) {
          await feed.evaluate(el => el.scrollBy(0, 1500));
        } else {
          await page.mouse.wheel(0, 1500);
        }
        await page.waitForTimeout(1000);
      } catch (_) {
        break;
      }
      attempts++;
    }

    const placeLinks = page.locator('a.hfpxzc, a[href*="/maps/place/"]');
    const totalFound = await placeLinks.count();
    const countToScrape = Math.min(totalFound, maxResults);
    console.log(`[GoogleMaps] ${totalFound} locais encontrados. Processando ${countToScrape}...`);

    for (let i = 0; i < countToScrape; i++) {
      try {
        const link = placeLinks.nth(i);
        const ariaLabel = (await link.getAttribute('aria-label') || '').trim();
        const href = await link.getAttribute('href') || '';
        
        // Clica no link do card
        await link.click({ force: true });
        
        // Aguarda carregar o painel de detalhes (botão de endereço ou autoridade)
        try {
          await page.waitForSelector('button[data-item-id="address"], a[data-item-id="authority"], button[data-item-id*="phone"], div.fontBodyMedium', { timeout: 3500 });
        } catch (_) {}

        // Nome da Empresa
        let nome_empresa = ariaLabel;
        try {
          const mainH1 = page.locator('div[role="main"] h1, h1.DUwDvf').first();
          if (await mainH1.count() > 0) {
            const h1Text = (await mainH1.textContent() || '').trim();
            if (h1Text && !['resultados', 'results'].includes(h1Text.toLowerCase())) {
              nome_empresa = h1Text;
            }
          }
        } catch (_) {}

        if (!nome_empresa || ['resultados', 'results'].includes(nome_empresa.toLowerCase())) continue;

        // Categoria
        let categoria = '';
        try {
          const cat = page.locator('button[jsaction*="category"], div[role="main"] button.DkEaL').first();
          if (await cat.count() > 0) {
            categoria = (await cat.textContent() || '').trim();
          }
        } catch (_) {}

        // Endereço
        let enderecoRaw = '';
        try {
          const addr = page.locator('button[data-item-id="address"], [data-tooltip="Copiar endereço"], [data-tooltip*="endereço"]').first();
          if (await addr.count() > 0) {
            enderecoRaw = (await addr.textContent() || '').trim();
          }
        } catch (_) {}

        enderecoRaw = enderecoRaw.replace(/^[\s\uE000-\uF8FF\u2000-\u206F]+/, '').trim();

        // Telefone
        let telefoneRaw = '';
        try {
          const phone = page.locator('button[data-item-id*="phone"], [data-tooltip="Copiar número de telefone"], [data-tooltip*="telefone"]').first();
          if (await phone.count() > 0) {
            telefoneRaw = (await phone.textContent() || '').trim();
          }
        } catch (_) {}

        // Website
        let website = '';
        try {
          const web = page.locator('a[data-item-id="authority"], a[data-tooltip="Abrir website"], a[aria-label*="website"]').first();
          if (await web.count() > 0) {
            website = (await web.getAttribute('href') || '').trim();
          }
        } catch (_) {}

        const parsed = parseAddress(enderecoRaw);

        results.push({
          nome_empresa,
          categoria: categoria || 'Construtora',
          telefone: formatPhoneNumber(telefoneRaw),
          email: '',
          website,
          endereco: parsed.endereco,
          cidade: parsed.cidade,
          estado: parsed.estado,
          status_envio: '',
          data_envio: '',
          email_aberto: '',
          data_abertura: '',
          wordpress: ''
        });
      } catch (err) {
        console.warn(`[GoogleMaps] Erro ao extrair local #${i}: ${err.message}`);
      }
    }

    await browser.close();
    browser = null;

    // Deep Contact Extraction
    if (scrapeContacts && results.length > 0) {
      console.log(`[GoogleMaps] Varrendo ${results.length} websites para extrair e-mails...`);
      await Promise.all(
        results.map(async (lead) => {
          if (!lead.website || !lead.website.startsWith('http')) return;
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);

            const res = await fetch(lead.website, {
              signal: controller.signal,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
              }
            });
            clearTimeout(timeoutId);

            if (res.ok) {
              const html = await res.text();
              const contacts = extractContactsFromHtml(html, lead.website);
              if (contacts.email) lead.email = contacts.email;
              if (!lead.telefone && contacts.whatsapp) lead.telefone = contacts.whatsapp;

              // Fallback to /contato if email not on homepage
              if (!lead.email) {
                const subPages = ['/contato', '/fale-conosco', '/quem-somos', '/contatos'];
                const base = lead.website.replace(/\/+$/, '');
                for (const sub of subPages) {
                  try {
                    const subCtrl = new AbortController();
                    const subTimeout = setTimeout(() => subCtrl.abort(), 4000);
                    const subRes = await fetch(`${base}${sub}`, {
                      signal: subCtrl.signal,
                      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
                    });
                    clearTimeout(subTimeout);
                    if (subRes.ok) {
                      const subHtml = await subRes.text();
                      const subContacts = extractContactsFromHtml(subHtml, base);
                      if (subContacts.email) {
                        lead.email = subContacts.email;
                        break;
                      }
                    }
                  } catch (_) {}
                }
              }
            }
          } catch (_) {}
        })
      );
    }

    console.log(`[GoogleMaps] Sucesso! ${results.length} empresas processadas (com e-mail: ${results.filter(r => r.email).length}).`);
    return results;
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    throw err;
  }
}
