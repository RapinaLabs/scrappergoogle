import * as cheerio from 'cheerio';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
const WA_LINK_REGEX = /(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=|whatsapp\.com\/send\?phone=)(\d{10,13})/i;
const BR_PHONE_REGEX = /(?:\+?55\s?)?(?:\(?([1-9][0-9])\)?\s?)?(?:9\s?[0-9]{4}[-\s]?[0-9]{4}|[2-8][0-9]{3}[-\s]?[0-9]{4})/g;

const IGNORED_EMAIL_DOMAINS = [
  'wixpress.com',
  'sentry.io',
  'example.com',
  'domain.com',
  'google.com',
  'schema.org',
  'wordpress.org',
  'w3.org'
];

const IGNORED_EMAIL_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.css', '.js'];

/**
 * Extracts emails and WhatsApp numbers from raw HTML and text
 */
export function extractContactsFromHtml(html, baseUrl = '') {
  if (!html || typeof html !== 'string') {
    return { email: '', whatsapp: '', allEmails: [], allPhones: [] };
  }

  const $ = cheerio.load(html);
  
  // Remove scripts, styles and hidden elements that may contain junk
  $('script, style, noscript, svg').remove();
  
  const pageText = $('body').text() || '';
  const htmlContent = $.html();

  // 1. Extração de E-mails
  const rawEmails = [];
  
  // Extrai de links mailto:
  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const mail = href.replace(/^mailto:/i, '').split('?')[0].trim();
    if (mail) rawEmails.push(mail);
  });

  // Extrai do texto e HTML
  const matches = htmlContent.match(EMAIL_REGEX) || [];
  rawEmails.push(...matches);

  const cleanEmails = [...new Set(
    rawEmails
      .map(e => e.trim().toLowerCase())
      .filter(e => {
        if (!e.includes('@')) return false;
        const [user, domain] = e.split('@');
        if (!user || !domain) return false;
        if (IGNORED_EMAIL_DOMAINS.some(d => domain.includes(d))) return false;
        if (IGNORED_EMAIL_EXTENSIONS.some(ext => e.endsWith(ext))) return false;
        return true;
      })
  )];

  // 2. Extração de WhatsApp
  let whatsapp = '';
  const allPhones = [];

  // Procura links de WhatsApp
  $('a[href*="wa.me"], a[href*="whatsapp.com"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const waMatch = href.match(WA_LINK_REGEX);
    if (waMatch && waMatch[1]) {
      const cleanWa = waMatch[1].replace(/\D/g, '');
      if (cleanWa.length >= 10 && cleanWa.length <= 13) {
        allPhones.push(cleanWa);
      }
    }
  });

  // Procura telefones no texto
  const phoneMatches = pageText.match(BR_PHONE_REGEX) || [];
  for (const p of phoneMatches) {
    const clean = p.replace(/\D/g, '');
    if (clean.length >= 10 && clean.length <= 13) {
      allPhones.push(clean);
    }
  }

  const cleanPhones = [...new Set(
    allPhones.map(p => {
      let digits = p.replace(/\D/g, '');
      if (digits.length === 10 || digits.length === 11) {
        digits = '55' + digits;
      }
      return digits;
    })
  )];

  return {
    email: cleanEmails[0] || '',
    whatsapp: cleanPhones[0] || '',
    allEmails: cleanEmails,
    allPhones: cleanPhones
  };
}
