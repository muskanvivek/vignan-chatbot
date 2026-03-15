require('dotenv').config();
const mongoose = require('mongoose');

const Source = require('../models/Source');
const Chunk = require('../models/Chunk');
const { extractTextFromURL } = require('../utils/webScraper');
const { splitIntoChunks } = require('../services/chunkService');
const { generateEmbedding } = require('../services/embeddingService');

const targetUrl = process.argv[2];

async function main() {
  if (!targetUrl) {
    throw new Error('Usage: node scripts/ingest_single_url.js <url>');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const existing = await Source.findOne({
    type: 'url',
    name: `Targeted: ${targetUrl}`,
    folder: '/fee-program-scholarship'
  }).select('_id');

  if (existing) {
    console.log(JSON.stringify({ status: 'already-exists', url: targetUrl }, null, 2));
    await mongoose.disconnect();
    return;
  }

  const text = await extractTextFromURL(targetUrl);
  if (!text || text.trim().length < 120) {
    console.log(JSON.stringify({ status: 'low-content', url: targetUrl, length: (text || '').length }, null, 2));
    await mongoose.disconnect();
    return;
  }

  const source = await Source.create({
    type: 'url',
    name: `Targeted: ${targetUrl}`,
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
      console.warn(`[SingleIngest] Embedding failed for chunk: ${err.message}`);
    }
  }

  source.status = 'processed';
  await source.save();

  console.log(JSON.stringify({ status: 'ingested', url: targetUrl, textLength: text.length, chunkCount: stored, sourceId: source._id }, null, 2));

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('[SingleIngest] Fatal:', err.message);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
