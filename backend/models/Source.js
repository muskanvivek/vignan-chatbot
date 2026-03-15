const mongoose = require('mongoose');

const sourceSchema = new mongoose.Schema({
  type: { type: String, enum: ['pdf', 'url', 'faq', 'contact'], required: true },
  name: { type: String, required: true },
  answer: { type: String }, // For FAQs
  folder: { type: String, default: '/' },
  createdAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'processed', 'error'], default: 'pending' }
});

module.exports = mongoose.model('Source', sourceSchema);
