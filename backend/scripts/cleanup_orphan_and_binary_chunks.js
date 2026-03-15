require('dotenv').config();
const mongoose = require('mongoose');
const Chunk = require('../models/Chunk');

function isBinaryLike(text = '') {
  if (!text || text.length < 20) return true;
  const nonPrintable = (String(text).match(/[^\x09\x0A\x0D\x20-\x7E]/g) || []).length;
  return (nonPrintable / text.length) > 0.08;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const candidates = await Chunk.aggregate([
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
        _id: 1,
        text: 1,
        isOrphan: { $eq: [{ $size: '$src' }, 0] }
      }
    },
    { $limit: 50000 }
  ]);

  const toDelete = candidates
    .filter(row => row.isOrphan || isBinaryLike(row.text))
    .map(row => row._id);

  const deleted = toDelete.length
    ? await Chunk.deleteMany({ _id: { $in: toDelete } })
    : { deletedCount: 0 };

  console.log(JSON.stringify({ scanned: candidates.length, deletedChunks: deleted.deletedCount || 0 }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
