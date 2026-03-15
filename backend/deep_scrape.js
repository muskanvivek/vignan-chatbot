require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');
const mongoose = require('mongoose');
const Source = require('./models/Source');
const Chunk = require('./models/Chunk');
const { splitIntoChunks } = require('./services/chunkService');
const { generateEmbedding } = require('./services/embeddingService');

const BASE_URL = 'https://vignan.ac.in';
const MAX_PAGES = 50; // Limit for deep scrape

async function scrapeVignan() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('--- Deep Scraping Vignan.ac.in ---');

    const visited = new Set();
    const queue = [BASE_URL];
    let count = 0;

    while (queue.length > 0 && count < MAX_PAGES) {
      const url = queue.shift();
      if (visited.has(url)) continue;
      visited.add(url);

      console.log(`[${count+1}/${MAX_PAGES}] Scraping: ${url}`);
      
      try {
        const { data } = await axios.get(url, { 
          timeout: 10000,
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

        // 2. Extract Content
        $('script, style, nav, footer, header').remove();
        const text = $('body').text().replace(/\s+/g, ' ').trim();

        if (text.length > 500) {
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
        }
      } catch (err) {
        console.warn(`Failed to scrape ${url}:`, err.message);
      }
    }

    console.log('--- Deep Scrape Completed ---');
    process.exit(0);
  } catch (err) {
    console.error('Scrape failed:', err.message);
    process.exit(1);
  }
}

scrapeVignan();
