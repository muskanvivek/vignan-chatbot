require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const axios = require('axios');
const cheerio = require('cheerio');
const mongoose = require('mongoose');
const Source = require('./models/Source');
const Chunk = require('./models/Chunk');
const { splitIntoChunks } = require('./services/chunkService');
const { generateEmbedding } = require('./services/embeddingService');
const { extractTextFromURL } = require('./utils/webScraper');

const BASE_URL = 'https://vignan.ac.in';
const MAX_PAGES = 50; // Limit for deep scrape
const MIN_TEXT_LENGTH = 120;

async function getSitemapUrls() {
  const sitemapCandidates = [
    'https://www.vignan.ac.in/sitemap.xml',
    'https://vignan.ac.in/sitemap.xml'
  ];

  for (const sitemapUrl of sitemapCandidates) {
    try {
      const { data } = await axios.get(sitemapUrl, {
        timeout: 30000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      const xml = String(data || '');
      const $xml = cheerio.load(xml, { xmlMode: true });
      const urls = [];

      $xml('loc').each((_, el) => {
        const value = $xml(el).text().trim();
        if (value && /vignan\.ac\.in/i.test(value)) {
          urls.push(value);
        }
      });

      if (urls.length > 0) {
        const uniqueUrls = Array.from(new Set(urls));
        console.log(`[DeepScrape] Loaded ${uniqueUrls.length} URLs from sitemap: ${sitemapUrl}`);
        return uniqueUrls;
      }
    } catch (error) {
      console.warn(`[DeepScrape] Sitemap fetch failed for ${sitemapUrl}: ${error.message}`);
    }
  }

  console.warn('[DeepScrape] No sitemap URLs found, falling back to homepage crawl only');
  return [];
}

async function scrapeVignan() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('--- Deep Scraping Vignan.ac.in ---');

    const visited = new Set();
    const sitemapUrls = await getSitemapUrls();
    const queue = [BASE_URL, ...sitemapUrls];
    let count = 0;
    let attempted = 0;
    let failed = 0;

    while (queue.length > 0 && count < MAX_PAGES) {
      const url = queue.shift();
      if (visited.has(url)) continue;
      visited.add(url);

      if (/\.pdf(\?|$)/i.test(url)) {
        console.log(`[DeepScrape] Skipping PDF URL in web crawl: ${url}`);
        continue;
      }

      attempted++;
      console.log(`[${attempted}] Scraping: ${url}`);
      
      try {
        const { data } = await axios.get(url, { 
          timeout: 30000,
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(data);

        // 1. Extract Links
        $('a').each((i, el) => {
          const href = $(el).attr('href');
          if (href) {
            try {
              const absUrl = new URL(href, BASE_URL).href.split('#')[0].replace(/\/$/, '');
              if (absUrl.startsWith(BASE_URL) && !visited.has(absUrl)) {
                queue.push(absUrl);
              }
            } catch (e) {}
          }
        });

        // 2. Extract Content using shared extractor for better quality
        const text = await extractTextFromURL(url);

        if (text.length > MIN_TEXT_LENGTH) {
          const source = await Source.create({
            type: 'url',
            name: `Scraped: ${url}`,
            folder: '/deep-scraped',
            status: 'processed'
          });

          const chunks = splitIntoChunks(text);
          for (const chunkText of chunks) {
            const embedding = await generateEmbedding(chunkText);
            await Chunk.create({
              text: chunkText,
              embedding,
              sourceId: source._id
            });
          }
          count++;
          console.log(`[DeepScrape] Stored ${chunks.length} chunks from ${url}`);
        } else {
          console.log(`[DeepScrape] Skipped low-content page (${text.length} chars): ${url}`);
        }
      } catch (err) {
        failed++;
        console.warn(`Failed to scrape ${url}:`, err.message);
      }
    }

    console.log(`--- Deep Scrape Completed --- processed=${count}, attempted=${attempted}, failed=${failed}`);
    process.exit(0);
  } catch (err) {
    console.error('Scrape failed:', err.message);
    process.exit(1);
  }
}

scrapeVignan();
