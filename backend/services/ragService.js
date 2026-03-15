const Source = require('../models/Source'); // Required for population
const Chunk = require('../models/Chunk');
const Contact = require('../models/Contact');
const { generateEmbedding } = require('./embeddingService');
const { generateAnswer, rerankContext } = require('./llmService');
const { performLiveWebSearch } = require('./searchService');

const STOPWORDS = new Set([
  'what', 'where', 'when', 'how', 'tell', 'about', 'please', 'give', 'details',
  'the', 'a', 'an', 'is', 'are', 'of', 'to', 'for', 'in', 'on', 'at', 'with', 'and',
  'my', 'can', 'i', 'be', 'will'
]);

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isLikelyNoisyChunk = (text = '') => {
  if (!text || text.length < 20) return true;
  const cleaned = String(text);
  const controlChars = (cleaned.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g) || []).length;
  const replacementChars = (cleaned.match(/�/g) || []).length;
  const controlRatio = controlChars / cleaned.length;
  const replacementRatio = replacementChars / cleaned.length;

  if (controlRatio > 0.03 || replacementRatio > 0.12) return true;
  if (!/[a-zA-Z]{3,}/.test(cleaned)) return true;
  return false;
};

const extractQueryKeywords = (queryText) => {
  const tokens = queryText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter(token => ((token.length >= 3 && !STOPWORDS.has(token)) || /^\d{2,3}$/.test(token)));

  if (tokens.length > 0) return tokens.slice(0, 8);

  return queryText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length >= 2)
    .slice(0, 5);
};

const performVectorSearch = async (queryEmbedding, queryText, limit = 15) => {
  try {
    console.log(`[RAG] Starting vector search. Embedding length: ${queryEmbedding.length}`);
    let results = await Chunk.aggregate([
      {
        $vectorSearch: {
          index: 'vector_index',
          path: 'embedding',
          queryVector: queryEmbedding,
          numCandidates: 300, // Even higher for better coverage
          limit: 25 // Retrieve more for re-ranking
        }
      },
      {
        $lookup: {
          from: 'sources',
          localField: 'sourceId',
          foreignField: '_id',
          as: 'source'
        }
      },
      {
        $addFields: {
          sourceType: { $arrayElemAt: ['$source.type', 0] },
          sourceName: { $arrayElemAt: ['$source.name', 0] },
          sourceFolder: { $arrayElemAt: ['$source.folder', 0] },
          score: { $meta: 'vectorSearchScore' }
        }
      }
    ]);

    const feeIntent = /\b(fee|fees|tuition|hostel|scholarship|payment)\b/i.test(queryText);
    const eligibilityIntent = /\b(eligible|eligibility|percentage|percent|marks|rank|board|intermediate|category|quota)\b/i.test(queryText);

    if (feeIntent) {
      const targetedSources = await Source.find({
        folder: '/fee-program-scholarship',
        type: 'url'
      }).select('_id');

      const targetedSourceIds = targetedSources.map(source => source._id);
      const targetedFeeChunks = targetedSourceIds.length > 0
        ? await Chunk.find({
            sourceId: { $in: targetedSourceIds },
            text: { $regex: /fee|fees|tuition|scholarship|hostel|refund|₹|rs\./i }
          })
            .limit(120)
            .populate('sourceId')
        : [];

      const targetedMapped = targetedFeeChunks
        .map(row => ({
          text: row.text,
          sourceType: row.sourceId?.type || 'url',
          sourceName: row.sourceId?.name || 'targeted-fee-source',
          sourceFolder: row.sourceId?.folder || '',
          score: 1.4
        }));

      if (targetedMapped.length > 0) {
        const seen = new Set(results.map(r => r.text));
        targetedMapped.forEach(item => {
          if (!seen.has(item.text)) {
            results.push(item);
          }
        });
      }
    }

    // Fallback: If Vector Search returned 0 or low-score results, try keyword search
    const topScore = results.length > 0 ? (results[0].score || 0) : 0;
    
    if (results.length === 0 || topScore < 0.35) {
      console.log(`[RAG] Vector results insufficient (Score: ${topScore}). Trying Text Search fallback...`);
      const keywords = extractQueryKeywords(queryText);
      const regexPattern = keywords.length > 0
        ? keywords.map(escapeRegex).join('|')
        : escapeRegex(queryText.trim());
      const regex = new RegExp(regexPattern, 'i');
      
      console.log(`[RAG] Keyword Search Regex: ${regex}`);
      
      const textResults = await Chunk.find({ text: { $regex: regex } })
        .limit(80)
        .populate('sourceId');
        
      const mappedTextResults = textResults.map(tr => {
        let textScore = 0.45;
        // Boost if multiple keywords match
        const lowerText = tr.text.toLowerCase();
        const sourceName = (tr.sourceId?.name || '').toLowerCase();
        const matches = keywords.filter(k => lowerText.includes(k)).length;
        textScore += (matches * 0.05);

        if (sourceName.includes('fee') || sourceName.includes('tuition')) {
          textScore += 0.2;
        }
        if (lowerText.includes('tuition fee') || lowerText.includes('fee structure') || lowerText.includes('hostel fee')) {
          textScore += 0.2;
        }

        return {
          text: tr.text,
          sourceType: tr.sourceId?.type || 'unknown',
          sourceName: tr.sourceId?.name || 'unknown',
          sourceFolder: tr.sourceId?.folder || '',
          score: textScore
        };
      });
      
      // Combine results and remove duplicates
      const seenTexts = new Set(results.map(r => r.text));
      mappedTextResults.forEach(tr => {
        if (!seenTexts.has(tr.text)) {
          results.push(tr);
        }
      });
    }

    // Drop noisy/binary chunks before scoring
    results = results.filter(r => !isLikelyNoisyChunk(r.text));

    // Apply prioritization scores
    results = results.map(r => {
      let priorityScore = r.score;
      if (r.sourceType === 'faq') priorityScore += 0.8; // Boost FAQs heavily
      else if (r.sourceType === 'pdf') priorityScore += 0.4;
      else if (r.sourceType === 'url') priorityScore += 0.3;
      
      // Additional boost for university-specific keywords
      const lowerText = r.text.toLowerCase();
      const lowerSourceName = (r.sourceName || '').toLowerCase();
      const lowerSourceFolder = (r.sourceFolder || '').toLowerCase();
      if (lowerText.includes('vignan') || lowerText.includes('admission')) {
        priorityScore += 0.15;
      }
      if (lowerText.includes('fee') || lowerText.includes('scholarship')) {
        priorityScore += 0.1;
      }
      if (feeIntent && (lowerText.includes('fee') || lowerText.includes('tuition') || lowerText.includes('hostel') || lowerSourceName.includes('fee'))) {
        priorityScore += 0.35;
      }
      if (feeIntent && (lowerSourceFolder.includes('/fee-program-scholarship') || lowerSourceName.includes('fee_str.php') || lowerSourceName.includes('targeted: https://vignan.ac.in/newvignan/fee_str.php'))) {
        priorityScore += 1.2;
      }
      if (eligibilityIntent && (lowerText.includes('eligible') || lowerText.includes('eligibility') || lowerText.includes('marks') || lowerText.includes('percent') || lowerText.includes('scholarship') || lowerText.includes('category'))) {
        priorityScore += 0.55;
      }
      
      return { ...r, priorityScore };
    });

    results.sort((a, b) => b.priorityScore - a.priorityScore);
    
    // Pick the top candidates for re-ranking
    const candidates = results.slice(0, 20);
    
    console.log(`[RAG] Re-ranking ${candidates.length} candidates...`);
    const rerankedIndices = await rerankContext(queryText, candidates.map(c => c.text));
    
    // Final check: If re-ranking fails or returns weird results, fallback to original top 10
    let finalResults = [];
    if (rerankedIndices && rerankedIndices.length > 0) {
      finalResults = rerankedIndices.map(idx => candidates[idx]).filter(Boolean);
    } else {
      finalResults = candidates.slice(0, 12);
    }

    // CRITICAL: Permanent Memory Boost
    // If a result contains exact keywords from the query, boost its priority for the LLM context
    const queryKeywords = extractQueryKeywords(queryText);
    finalResults = finalResults.map(r => {
      let finalBoost = 0;
      queryKeywords.forEach(k => {
        if (r.text.toLowerCase().includes(k)) finalBoost += 0.2;
      });
      return { ...r, finalBoost };
    }).sort((a, b) => (b.priorityScore + b.finalBoost) - (a.priorityScore + a.finalBoost));

    console.log(`[RAG] Top 5 Search Results after Re-ranking:`);
    finalResults.slice(0, 5).forEach((r, i) => {
      console.log(`  ${i+1}. [${r.sourceType}] ${r.sourceName} (Priority: ${r.priorityScore.toFixed(4)})`);
    });
    
    console.log(`[RAG] Search returned ${finalResults.length} total final results`);
    return finalResults;
  } catch (error) {
    console.error('[RAG] Search failed:', error.message);
    return [];
  }
};

const isGreeting = (text) => {
  const greetings = ['hi', 'hello', 'hy', 'hey', 'hola', 'namaste', 'good morning', 'good afternoon', 'good evening'];
  const cleanText = text.toLowerCase().trim();
  return greetings.some(g => cleanText === g || cleanText === g + '!');
};

const handleChat = async (question, history = []) => {
  // 0. Quick Greeting Check
  if (isGreeting(question)) {
    console.log('[RAG] Greeting detected, skipping search.');
    const greetingResponse = {
      short_answer: "Hello! I'm your Vignan AI Assistant. How can I help you today?",
      detailed_answer: "Hello! I'm your Vignan University Student Support Assistant. I can help you with admissions, fee details, academic calendars, campus support, and more. How can I assist you today?",
      sentiment: "friendly",
      sources: ["System"],
      suggested_faq: ["What are the B.Tech fees?", "How to apply for admission?", "Tell me about scholarships"],
      confidence: "high"
    };
    return greetingResponse;
  }

  // Generate query embedding
  console.log(`[RAG] Generating embedding for: "${question}"`);
  const queryEmbedding = await generateEmbedding(question);
  
  // 1. Retrieve relevant chunks from local Knowledge Base
  const relevantChunks = await performVectorSearch(queryEmbedding, question);
  let context = relevantChunks.map(c => `[Type: ${c.sourceType}] [Source: ${c.sourceName}] ${c.text}`).join('\n\n');
  
  // 2. Web Search Fallback
  const topScore = relevantChunks.length > 0 ? (relevantChunks[0].score || 0) : 0;
  
  if (relevantChunks.length === 0 || topScore < 0.45) {
    console.log(`[RAG] Local info insufficient (Score: ${topScore}). Triggering Live Web Search...`);
    const webResults = await performLiveWebSearch(question);
    
    if (webResults && !webResults.includes('unable to fetch real-time web results')) {
      context += `\n\n[Type: Live Web Search] [Source: Vignan University Portal]\n${webResults}`;
      
      // PERMANENT LEARNING: Store the web search result for future queries
      try {
        const learnedSource = await Source.create({
          type: 'url',
          name: `Auto-Learned: ${question.substring(0, 30)}`,
          folder: '/auto-learned',
          status: 'processed'
        });
        
        const webChunks = webResults.split('\n\n');
        for (const chunk of webChunks) {
          if (chunk.length > 50) {
            const embedding = await generateEmbedding(chunk);
            await Chunk.create({
              text: chunk,
              embedding: embedding,
              sourceId: learnedSource._id
            });
          }
        }
        console.log(`[RAG] Successfully stored ${webChunks.length} web chunks for future use`);
      } catch (learnErr) {
        console.warn('[RAG] Learning failed:', learnErr.message);
      }
    }
  }
  
  // Retrieve contacts (optionally filtering by relevance)
  const contacts = await Contact.find().limit(5);
  console.log(`[RAG] Found ${contacts.length} contacts`);
  
  // Generate answer with LLM, passing history
  console.log('[RAG] Generating answer with LLM...');
  const answer = await generateAnswer(context, question, contacts, history);
  
  if (!answer) {
    throw new Error('Could not generate answer from AI models (Groq/Gemini). Please check API keys or status.');
  }
  
  const sources = [...new Set(relevantChunks.map(c => c.sourceName))];
  if (context.includes('Live Web Search')) {
    sources.push('Vignan Official Website (Real-time)');
  }
  
  return {
    ...answer,
    sources,
    sentiment: answer.sentiment || 'neutral'
  };
};

module.exports = { handleChat };
