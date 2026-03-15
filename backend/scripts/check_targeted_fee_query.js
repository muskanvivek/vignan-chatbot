require('dotenv').config();
const mongoose = require('mongoose');
const Chunk = require('../models/Chunk');
require('../models/Source');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const rows = await Chunk.find({
    text: { $regex: /fee|fees|tuition|scholarship|hostel|refund|₹|rs\./i }
  })
    .limit(80)
    .populate('sourceId');

  const filtered = rows.filter(r => (r.sourceId?.folder || '').includes('/fee-program-scholarship'));

  console.log(JSON.stringify({
    matchedRows: rows.length,
    targetedRows: filtered.length,
    sample: filtered.slice(0, 5).map(r => ({
      source: r.sourceId?.name,
      folder: r.sourceId?.folder,
      text: r.text.slice(0, 160)
    }))
  }, null, 2));

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
