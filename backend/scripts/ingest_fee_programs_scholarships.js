require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');
const mongoose = require('mongoose');

const Source = require('../models/Source');
const Chunk = require('../models/Chunk');
const { extractTextFromURL } = require('../utils/webScraper');
const { splitIntoChunks } = require('../services/chunkService');
const { generateEmbedding } = require('../services/embeddingService');

const SITEMAP_URL = 'https://www.vignan.ac.in/sitemap.xml';

const MUST_INCLUDE = [
  'https://www.vignan.ac.in/ug.php',
  'https://www.vignan.ac.in/lateralentry.php',
  'https://www.vignan.ac.in/inadproc.php',
  'https://www.vignan.ac.in/curscholorships.php',
  'https://www.vignan.ac.in/feesbtech.php',
  'https://www.vignan.ac.in/feesbba.php',
  'https://www.vignan.ac.in/feesbca.php',
  'https://www.vignan.ac.in/feesbsc.php',
  'https://www.vignan.ac.in/feesmtech.php',
  'https://www.vignan.ac.in/feesmba.php',
  'https://www.vignan.ac.in/feesmca.php',
  'https://www.vignan.ac.in/feesphd.php'
];

const URL_KEYWORDS = /fee|fees|schol|scholar|ug|lateral|admission|course|btech|mba|mtech|bba|bca|phd/i;

async function getSitemapUrls() {
  const { data } = await axios.get(SITEMAP_URL, {
    timeout: 30000,
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });

  const $xml = cheerio.load(String(data), { xmlMode: true });
  const urls = [];
  $xml('loc').each((_, el) => {
    const value = $xml(el).text().trim();
    if (value) urls.push(value);
  });

  const filtered = urls.filter(url => URL_KEYWORDS.test(url));
  return Array.from(new Set([...MUST_INCLUDE, ...filtered]));
}

async function sourceExists(url) {
  const existing = await Source.findOne({
    type: 'url',
    name: `Targeted: ${url}`,
    folder: '/fee-program-scholarship'
  }).select('_id');
  return existing;
}

async function ingestUrl(url) {
  const existing = await sourceExists(url);
  if (existing) {
    return { status: 'skipped-existing', url, chunks: 0 };
  }

  let text;
  try {
    text = await extractTextFromURL(url);
  } catch (err) {
    return { status: 'failed-fetch', url, error: err.message, chunks: 0 };
  }

  if (!text || text.trim().length < 180) {
    return { status: 'skipped-low-content', url, chunks: 0 };
  }

  const source = await Source.create({
    type: 'url',
    name: `Targeted: ${url}`,
    folder: '/fee-program-scholarship',
    status: 'pending'
  });

  const chunks = splitIntoChunks(text);
  let stored = 0;

  for (const chunkText of chunks) {
    try {
      const embedding = await generateEmbedding(chunkText);
      await Chunk.create({ text: chunkText, embedding, sourceId: source._id });
      stored++;
    } catch (err) {
      console.warn(`[TargetIngest] Chunk embedding failed for ${url}: ${err.message}`);
    }
  }

  source.status = 'processed';
  await source.save();

  return { status: 'ingested', url, chunks: stored };
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const urls = await getSitemapUrls();
  const candidates = urls
    .filter(url => /vignan\.ac\.in/i.test(url))
    .filter(url => !/\.pdf(\?|$)/i.test(url))
    .slice(0, 80);

  console.log(`[TargetIngest] Candidate URLs: ${candidates.length}`);

  const results = [];
  for (const url of candidates) {
    console.log(`[TargetIngest] Processing ${url}`);
    const result = await ingestUrl(url);
    results.push(result);
  }

  const summary = results.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    acc.totalChunks += row.chunks || 0;
    return acc;
  }, { totalChunks: 0 });

  console.log(JSON.stringify({ summary, results: results.slice(0, 25) }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('[TargetIngest] Fatal:', err.message);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
