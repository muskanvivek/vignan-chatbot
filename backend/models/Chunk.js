const mongoose = require('mongoose');

const chunkSchema = new mongoose.Schema({
  text: { type: String, required: true },
  embedding: { type: [Number], required: true },
  sourceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Source', required: true },
  metadata: { type: Object }
});

module.exports = mongoose.model('Chunk', chunkSchema);
