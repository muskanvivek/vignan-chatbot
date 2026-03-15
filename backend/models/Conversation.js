const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer: { type: Object, required: true }, // Store the JSON response
  timestamp: { type: Date, default: Date.now },
  language: { type: String, default: 'en' }
});

module.exports = mongoose.model('Conversation', conversationSchema);
