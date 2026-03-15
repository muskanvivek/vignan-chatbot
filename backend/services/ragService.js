const Source = require('../models/Source'); // Required for population
const Chunk = require('../models/Chunk');
const Contact = require('../models/Contact');
const { generateEmbedding } = require('./embeddingService');
const { generateAnswer, rerankContext } = require('./llmService');
const { performLiveWebSearch } = require('./searchService');

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
          score: { $meta: 'vectorSearchScore' }
        }
      }
    ]);

    // Fallback: If Vector Search returned 0 or low-score results, try keyword search
    const topScore = results.length > 0 ? (results[0].score || 0) : 0;
    
    if (results.length === 0 || topScore < 0.35) {
      console.log(`[RAG] Vector results insufficient (Score: ${topScore}). Trying Text Search fallback...`);
      const keywords = queryText.toLowerCase().split(' ').filter(k => k.length > 3 && !['what', 'where', 'when', 'how', 'tell'].includes(k)).slice(0, 5);
      const regex = new RegExp(keywords.join('|'), 'i');
      
      console.log(`[RAG] Keyword Search Regex: ${regex}`);
      
      const textResults = await Chunk.find({ text: { $regex: regex } })
        .limit(50) // Even higher for text search
        .populate('sourceId');
        
      const mappedTextResults = textResults.map(tr => {
        let textScore = 0.45;
        // Boost if multiple keywords match
        const matches = keywords.filter(k => tr.text.toLowerCase().includes(k)).length;
        textScore += (matches * 0.05);

        return {
          text: tr.text,
          sourceType: tr.sourceId?.type || 'unknown',
          sourceName: tr.sourceId?.name || 'unknown',
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

    // Apply prioritization scores
    results = results.map(r => {
      let priorityScore = r.score;
      if (r.sourceType === 'faq') priorityScore += 0.8; // Boost FAQs heavily
      else if (r.sourceType === 'pdf') priorityScore += 0.4;
      else if (r.sourceType === 'url') priorityScore += 0.3;
      
      // Additional boost for university-specific keywords
      const lowerText = r.text.toLowerCase();
      if (lowerText.includes('vignan') || lowerText.includes('admission')) {
        priorityScore += 0.15;
      }
      if (lowerText.includes('fee') || lowerText.includes('scholarship')) {
        priorityScore += 0.1;
      }
      
      return { ...r, priorityScore };
    });

    results.sort((a, b) => b.priorityScore - a.priorityScore);
    
    // Pick the top 15 for re-ranking
    const candidates = results.slice(0, 15);
    
    console.log(`[RAG] Re-ranking ${candidates.length} candidates...`);
    const rerankedIndices = await rerankContext(queryText, candidates.map(c => c.text));
    
    // Sort candidates by the reranked order if available
    let finalResults = [];
    if (rerankedIndices && rerankedIndices.length > 0) {
      finalResults = rerankedIndices.map(idx => candidates[idx]).filter(Boolean);
    } else {
      finalResults = candidates;
    }

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
  
  if (relevantChunks.length === 0 || topScore < 0.4) {
    console.log(`[RAG] Local info insufficient (Score: ${topScore}). Triggering Live Web Search...`);
    const webResults = await performLiveWebSearch(question);
    
    if (webResults) {
      context += `\n\n[Type: Live Web Search] [Source: Vignan University Portal]\n${webResults}`;
      
      // OPTIONAL: Permanent Learning
      // We can automatically ingest the web search result as a "learned" source
      try {
        const Source = require('../models/Source');
        const Chunk = require('../models/Chunk');
        const learnedSource = await Source.create({
          type: 'url',
          name: `Auto-Learned: ${question.substring(0, 30)}...`,
          folder: '/auto-learned',
          status: 'processed'
        });
        await Chunk.create({
          text: webResults,
          embedding: queryEmbedding, // Re-use the query embedding for this chunk
          sourceId: learnedSource._id
        });
        console.log('[RAG] Successfully stored web results for future use');
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
    sources: answer.sources || sources,
    sentiment: answer.sentiment || 'neutral'
  };
};

module.exports = { handleChat };
