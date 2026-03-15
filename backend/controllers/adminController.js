const Source = require('../models/Source');
const Contact = require('../models/Contact');
const Chunk = require('../models/Chunk');

const addContact = async (req, res) => {
  const { department, phone, email, folder } = req.body;
  try {
    const contact = await Contact.create({ department, phone, email, folder: folder || '/' });
    res.status(201).json(contact);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getContacts = async (req, res) => {
  try {
    const contacts = await Contact.find();
    res.json(contacts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getSources = async (req, res) => {
  try {
    const sources = await Source.find().sort({ createdAt: -1 });
    const contacts = await Contact.find();
    
    // Format contacts to match source structure for unified management
    const contactSources = contacts.map(c => ({
      _id: c._id,
      name: c.department,
      phone: c.phone,
      email: c.email,
      type: 'contact',
      folder: c.folder || '/',
      createdAt: c.createdAt || new Date(),
      status: 'processed'
    }));
    
    res.json([...sources, ...contactSources]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteSource = async (req, res) => {
  const { id } = req.params;
  try {
    // Check if it's a regular source
    const source = await Source.findByIdAndDelete(id);
    if (source) {
      await Chunk.deleteMany({ sourceId: id });
    } else {
      // If not a source, it might be a contact
      await Contact.findByIdAndDelete(id);
    }
    res.json({ message: 'Source deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateSource = async (req, res) => {
  const { id } = req.params;
  const { name, folder, question, answer, department, phone, email, refreshUrl } = req.body;
  const { generateEmbedding } = require('../services/embeddingService');
  const { extractTextFromURL } = require('../utils/webScraper');
  const { splitIntoChunks } = require('../services/chunkService');

  try {
    // 1. Try updating Source (PDF, URL, FAQ)
    let source = await Source.findById(id);
    if (source) {
      if (name) source.name = name;
      if (folder) source.folder = folder;
      
      // Special handling for FAQ
      if (source.type === 'faq' && (question || answer)) {
        if (question) source.name = question;
        if (answer) source.answer = answer;
        const text = `Question: ${question || source.name}\nAnswer: ${answer || source.answer}`;
        const embedding = await generateEmbedding(text);
        await Chunk.deleteMany({ sourceId: id });
        await Chunk.create({ text, embedding, sourceId: id });
      }

      // Special handling for URL Refresh
      if (source.type === 'url' && refreshUrl) {
        console.log(`[Admin] Refreshing URL content for: ${source.name}`);
        const newText = await extractTextFromURL(source.name); // source.name stores the URL
        const newChunks = splitIntoChunks(newText);
        
        await Chunk.deleteMany({ sourceId: id });
        for (const chunkText of newChunks) {
          const embedding = await generateEmbedding(chunkText);
          await Chunk.create({ text: chunkText, embedding, sourceId: id });
        }
        source.status = 'processed';
      }
      
      await source.save();
      return res.json(source);
    }

    // 2. Try updating Contact
    let contact = await Contact.findById(id);
    if (contact) {
      if (department) contact.department = department;
      if (phone) contact.phone = phone;
      if (email) contact.email = email;
      if (folder) contact.folder = folder;
      await contact.save();
      return res.json(contact);
    }

    res.status(404).json({ error: 'Source or Contact not found' });
  } catch (error) {
    console.error('Update failed:', error.message);
    res.status(500).json({ error: error.message });
  }
};

module.exports = { addContact, getContacts, getSources, deleteSource, updateSource };
