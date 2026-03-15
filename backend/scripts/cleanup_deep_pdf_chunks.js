require('dotenv').config();
const mongoose = require('mongoose');
const Source = require('../models/Source');
const Chunk = require('../models/Chunk');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const pdfSources = await Source.find({
    folder: '/deep-scraped',
    name: { $regex: /\.pdf/i }
  }).select('_id name');

  const sourceIds = pdfSources.map(s => s._id);
  const chunkDelete = sourceIds.length
    ? await Chunk.deleteMany({ sourceId: { $in: sourceIds } })
    : { deletedCount: 0 };

  const sourceDelete = sourceIds.length
    ? await Source.deleteMany({ _id: { $in: sourceIds } })
    : { deletedCount: 0 };

  console.log(JSON.stringify({
    deepScrapedPdfSources: pdfSources.length,
    deletedChunks: chunkDelete.deletedCount || 0,
    deletedSources: sourceDelete.deletedCount || 0
  }, null, 2));

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
