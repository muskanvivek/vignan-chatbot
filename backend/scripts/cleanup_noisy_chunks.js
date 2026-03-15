require('dotenv').config();
const mongoose = require('mongoose');
const Source = require('../models/Source');
const Chunk = require('../models/Chunk');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const noisySources = await Source.find({
    folder: '/deep-scraped',
    name: { $regex: /(\.pdf|brochure)/i }
  }).select('_id');

  const noisySourceIds = noisySources.map(s => s._id);

  const deletedNoisyChunks = noisySourceIds.length
    ? await Chunk.deleteMany({ sourceId: { $in: noisySourceIds } })
    : { deletedCount: 0 };

  const deletedNoisySources = noisySourceIds.length
    ? await Source.deleteMany({ _id: { $in: noisySourceIds } })
    : { deletedCount: 0 };

  const orphanIds = await Chunk.aggregate([
    {
      $lookup: {
        from: 'sources',
        localField: 'sourceId',
        foreignField: '_id',
        as: 'src'
      }
    },
    { $match: { src: { $size: 0 } } },
    { $project: { _id: 1 } },
    { $limit: 20000 }
  ]);

  const orphanChunkIds = orphanIds.map(r => r._id);
  const deletedOrphans = orphanChunkIds.length
    ? await Chunk.deleteMany({ _id: { $in: orphanChunkIds } })
    : { deletedCount: 0 };

  console.log(JSON.stringify({
    deletedNoisySources: deletedNoisySources.deletedCount || 0,
    deletedNoisyChunks: deletedNoisyChunks.deletedCount || 0,
    deletedOrphanChunks: deletedOrphans.deletedCount || 0
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
