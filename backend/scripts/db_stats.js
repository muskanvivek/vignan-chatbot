require('dotenv').config();
const mongoose = require('mongoose');
const Source = require('../models/Source');
const Chunk = require('../models/Chunk');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const totalSources = await Source.countDocuments();
  const totalChunks = await Chunk.countDocuments();
  const byType = await Source.aggregate([
    { $group: { _id: '$type', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  const topSourceChunks = await Chunk.aggregate([
    { $group: { _id: '$sourceId', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 12 },
    {
      $lookup: {
        from: 'sources',
        localField: '_id',
        foreignField: '_id',
        as: 'src'
      }
    },
    {
      $project: {
        count: 1,
        name: { $arrayElemAt: ['$src.name', 0] },
        type: { $arrayElemAt: ['$src.type', 0] },
        folder: { $arrayElemAt: ['$src.folder', 0] }
      }
    }
  ]);

  const sampleChunks = await Chunk.aggregate([
    { $sort: { _id: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: 'sources',
        localField: 'sourceId',
        foreignField: '_id',
        as: 'src'
      }
    },
    {
      $project: {
        text: { $substrCP: ['$text', 0, 240] },
        sourceName: { $arrayElemAt: ['$src.name', 0] },
        sourceType: { $arrayElemAt: ['$src.type', 0] },
        folder: { $arrayElemAt: ['$src.folder', 0] }
      }
    }
  ]);

  console.log(JSON.stringify({ totalSources, totalChunks, byType, topSourceChunks, sampleChunks }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
