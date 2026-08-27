import { chromium } from 'playwright';
import { extractContactsFromHtml } from '../utils/contactExtractor.js';

/**
 * Scrapes Instagram profiles and contacts using Playwright.
 */
export async function scrapeInstagram(query, options = {}) {
  const maxResults = options.maxResults || 20;
  const results = [];

  console.log(`[Instagram] Iniciando busca para: "${query}" (Limite: ${maxResults})`);

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
      viewport: { width: 1280, height: 800 }
    });

    const page = await context.newPage();

    // 1. Usa o endpoint de TopSearch do Instagram via página web
    const searchUrl = `https://www.instagram.com/explore/tags/${encodeURIComponent(query.replace(/\s+/g, ''))}/`;
    
    // Ou busca via Google / Bing para contornar bloqueios de login no Instagram
    const dorkUrl = `https://www.google.com/search?q=site:instagram.com+"${encodeURIComponent(query)}"&hl=pt-BR&num=${maxResults + 10}`;
    
    await page.goto(dorkUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });

    // Handle Google Consent
    try {
      const consentBtn = page.locator('button[aria-label*="Aceitar"], button[aria-label*="Accept"], form[action*="consent"] button');
      if (await consentBtn.count() > 0) {
        await consentBtn.first().click();
        await page.waitForTimeout(1000);
      }
    } catch (_) {}

    // Extract search result links matching instagram.com/username
    const links = await page.$$eval('a[href*="instagram.com/"]', (anchors) => {
      return anchors
        .map(a => a.href)
        .filter(href => {
          const match = href.match(/instagram\.com\/([a-zA-Z0-9._]+)\/?(?:\?.*)?$/);
          if (!match) return false;
          const user = match[1].toLowerCase();
          const ignored = ['p', 'reel', 'explore', 'stories', 'direct', 'accounts', 'legal', 'about'];
          return !ignored.includes(user);
        });
    });

    const uniqueUsernames = [...new Set(
      links.map(l => {
        const m = l.match(/instagram\.com\/([a-zA-Z0-9._]+)/);
        return m ? m[1] : null;
      }).filter(Boolean)
    )].slice(0, maxResults);

    console.log(`[Instagram] ${uniqueUsernames.length} perfis únicos encontrados:`, uniqueUsernames);

    // 2. Extrai dados de cada perfil
    for (const username of uniqueUsernames) {
      try {
        const profileUrl = `https://www.instagram.com/${username}/`;
        await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(1500);

        const html = await page.content();
        const contacts = extractContactsFromHtml(html, profileUrl);

        // Extrai meta description que contém contagem de seguidores e bio
        let bio = '';
        let followers = 0;
        let fullName = username;

        try {
          const metaDesc = await page.getAttribute('meta[name="description"]', 'content');
          if (metaDesc) {
            // Ex: "1,234 Followers, 567 Following, 89 Posts - See Instagram photos and videos from Name (@username)"
            const followMatch = metaDesc.match(/([\d.,]+[kmKM]?)\s+Followers/i);
            if (followMatch) {
              const rawNum = followMatch[1].toLowerCase();
              if (rawNum.includes('k')) followers = parseFloat(rawNum) * 1000;
              else if (rawNum.includes('m')) followers = parseFloat(rawNum) * 1000000;
              else followers = parseInt(rawNum.replace(/\D/g, ''), 10) || 0;
            }
            bio = metaDesc;
          }

          const ogTitle = await page.getAttribute('meta[property="og:title"]', 'content');
          if (ogTitle) {
            fullName = ogTitle.split('(')[0].trim() || username;
          }
        } catch (_) {}

        if (contacts.email || contacts.whatsapp) {
          results.push({
            username: username,
            nome_empresa: fullName,
            whatsapp: contacts.whatsapp,
            email: contacts.email,
            instagram_url: profileUrl,
            biografia: bio.substring(0, 250).replace(/[\n\r]+/g, ' '),
            seguidores: followers,
            termo_busca: query,
            status_whatsapp: 'Pendente',
            status_email: 'Pendente'
          });
        }
      } catch (err) {
        console.warn(`[Instagram] Erro ao processar perfil @${username}: ${err.message}`);
      }
    }

    await browser.close();
    browser = null;

    console.log(`[Instagram] Finalizado! Total de leads com contato: ${results.length}`);
    return results;
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    throw err;
  }
}
