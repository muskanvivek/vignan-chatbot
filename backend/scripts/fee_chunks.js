require('dotenv').config();
const mongoose = require('mongoose');
const Chunk = require('../models/Chunk');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const rows = await Chunk.aggregate([
    { $match: { text: { $regex: /fee|fees|tuition|hostel|scholarship|refund|payment/i } } },
    { $limit: 20 },
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
        text: { $substrCP: ['$text', 0, 220] },
        sourceName: { $arrayElemAt: ['$src.name', 0] },
        sourceType: { $arrayElemAt: ['$src.type', 0] },
        folder: { $arrayElemAt: ['$src.folder', 0] }
      }
    }
  ]);

  console.log(JSON.stringify(rows, null, 2));
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
