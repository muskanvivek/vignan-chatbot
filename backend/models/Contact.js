const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  department: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  folder: { type: String, default: '/' }
});

module.exports = mongoose.model('Contact', contactSchema);
