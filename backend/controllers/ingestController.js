const Source = require('../models/Source');
const Chunk = require('../models/Chunk');
const { extractTextFromPDF } = require('../utils/pdfParser');
const { extractTextFromURL, discoverLinks } = require('../utils/webScraper');
const { splitIntoChunks } = require('../services/chunkService');
const { generateEmbedding } = require('../services/embeddingService');
const { generateFAQsFromText } = require('../services/llmService');

const ingestPDF = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No PDF file uploaded' });
  }

  const { originalname, buffer } = req.file;
  const { folder } = req.body;
  
  console.log(`[Ingest] Received PDF: ${originalname} (${buffer.length} bytes) for folder: ${folder}`);

  try {
    // 1. Create source entry
    const source = await Source.create({ 
      type: 'pdf', 
      name: originalname, 
      folder: folder || '/', 
      status: 'pending' 
    });

    // 2. Extract text (with OCR fallback)
    const text = await extractTextFromPDF(buffer);
    
    if (!text || text.trim().length < 10) {
      source.status = 'error';
      await source.save();
      return res.status(422).json({ error: 'Could not extract meaningful text from PDF. Ensure it is not password protected or corrupted.' });
    }

    // 3. Chunk and Embed
    const chunks = splitIntoChunks(text);
    console.log(`[Ingest] PDF split into ${chunks.length} chunks. Generating embeddings...`);
    
    for (const chunkText of chunks) {
      try {
        const embedding = await generateEmbedding(chunkText);
        await Chunk.create({ text: chunkText, embedding, sourceId: source._id });
      } catch (embErr) {
        console.error(`[Ingest] Embedding failed for a chunk in ${originalname}:`, embErr.message);
      }
    }
    
    // 4. AI-Generated FAQs (New Feature)
    console.log('[Ingest] Generating AI FAQs from document...');
    const aiFaqs = await generateFAQsFromText(text);
    for (const faq of aiFaqs) {
      try {
        const faqSource = await Source.create({
          type: 'faq',
          name: faq.question,
          answer: faq.answer,
          folder: (folder || '/') + '/AI-Generated-FAQs',
          status: 'processed'
        });
        const faqText = `Question: ${faq.question}\nAnswer: ${faq.answer}`;
        const embedding = await generateEmbedding(faqText);
        await Chunk.create({ text: faqText, embedding, sourceId: faqSource._id });
      } catch (faqErr) {
        console.warn('[Ingest] Failed to create AI FAQ:', faqErr.message);
      }
    }
    
    source.status = 'processed';
    await source.save();
    
    console.log(`[Ingest] PDF ${originalname} processed successfully with ${aiFaqs.length} AI FAQs`);
    res.json({ message: 'PDF ingested and trained successfully', sourceId: source._id, chunkCount: chunks.length, aiFaqCount: aiFaqs.length });
  } catch (error) {
    console.error('PDF ingestion FATAL error:', error.message);
    res.status(500).json({ error: 'Server error during PDF processing: ' + error.message });
  }
};

const ingestURL = async (req, res) => {
  const { url, name, folder } = req.body;
  
  try {
    const source = await Source.create({ 
      type: 'url', 
      name: name || url, 
      folder: folder || '/', 
      status: 'pending' 
    });
    const text = await extractTextFromURL(url);
    const chunks = splitIntoChunks(text);
    
    for (const chunkText of chunks) {
      const embedding = await generateEmbedding(chunkText);
      await Chunk.create({ text: chunkText, embedding, sourceId: source._id });
    }
    
    source.status = 'processed';
    await source.save();

    // AI-Generated FAQs for URL
    console.log('[Ingest] Generating AI FAQs from URL...');
    const aiFaqs = await generateFAQsFromText(text);
    for (const faq of aiFaqs) {
      try {
        const faqSource = await Source.create({
          type: 'faq',
          name: faq.question,
          answer: faq.answer,
          folder: (folder || '/') + '/AI-Generated-FAQs',
          status: 'processed'
        });
        const faqText = `Question: ${faq.question}\nAnswer: ${faq.answer}`;
        const embedding = await generateEmbedding(faqText);
        await Chunk.create({ text: faqText, embedding, sourceId: faqSource._id });
      } catch (faqErr) {
        console.warn('[Ingest] Failed to create AI FAQ:', faqErr.message);
      }
    }
    
    res.json({ message: 'URL ingested successfully', sourceId: source._id, aiFaqCount: aiFaqs.length });
  } catch (error) {
    console.error('URL ingestion failed:', error.message);
    res.status(500).json({ error: error.message });
  }
};

const ingestFAQ = async (req, res) => {
  const { question, answer, folder } = req.body;
  
  try {
    const source = await Source.create({ 
      type: 'faq', 
      name: question, 
      answer: answer,
      folder: folder || '/', 
      status: 'pending' 
    });
    const text = `Question: ${question}\nAnswer: ${answer}`;
    const embedding = await generateEmbedding(text);
    
    await Chunk.create({ text, embedding, sourceId: source._id });
    
    source.status = 'processed';
    await source.save();
    
    res.json({ message: 'FAQ ingested successfully', sourceId: source._id });
  } catch (error) {
    console.error('FAQ ingestion failed:', error.message);
    res.status(500).json({ error: error.message });
  }
};

const ingestDeepURL = async (req, res) => {
  const { url, folder } = req.body;
  
  try {
    console.log(`[DeepIngest] Starting deep crawl for: ${url}`);
    
    // 1. Discover all sub-links
    const links = await discoverLinks(url);
    const allLinks = [url, ...links];
    
    const results = [];
    
    // 2. Process each link (limit to first 10 for safety/speed)
    const limitedLinks = allLinks.slice(0, 15);
    
    for (const targetUrl of limitedLinks) {
      try {
        console.log(`[DeepIngest] Processing: ${targetUrl}`);
        
        const source = await Source.create({ 
          type: 'url', 
          name: targetUrl, 
          folder: folder || '/', 
          status: 'pending' 
        });

        const text = await extractTextFromURL(targetUrl);
        if (!text || text.length < 100) {
          source.status = 'error';
          await source.save();
          continue;
        }

        const chunks = splitIntoChunks(text);
        
        for (const chunkText of chunks) {
          const embedding = await generateEmbedding(chunkText);
          await Chunk.create({ text: chunkText, embedding, sourceId: source._id });
        }
        
        source.status = 'processed';
        await source.save();
        results.push(targetUrl);
      } catch (err) {
        console.error(`[DeepIngest] Failed for ${targetUrl}:`, err.message);
      }
    }
    
    res.json({ 
      message: 'Deep URL ingestion completed', 
      processedCount: results.length,
      links: results 
    });
  } catch (error) { 
    console.error('Deep URL ingestion failed:', error.message);
    res.status(500).json({ error: error.message });
  }
};

module.exports = { ingestPDF, ingestURL, ingestFAQ, ingestDeepURL };
