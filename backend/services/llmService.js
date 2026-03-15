const { Groq } = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

console.log('LLM Service Initialized');
console.log('Groq Key starts with:', process.env.GROQ_API_KEY?.substring(0, 5));
console.log('Gemini Key starts with:', process.env.GEMINI_API_KEY?.substring(0, 5));

const cleanJSONResponse = (text) => {
  try {
    // 1. Try to find JSON block if LLM wrapped it in markdown
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    let jsonStr = jsonMatch[0];
    
    // 2. Remove problematic control characters but keep newlines
    jsonStr = jsonStr.replace(/[\u0000-\u001F\u007F-\u009F]/g, (match) => {
      if (match === '\n' || match === '\r' || match === '\t') return match;
      return '';
    });

    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('[LLM] JSON Clean/Parse failed:', e.message);
    return null;
  }
};

const generateAnswerWithGroq = async (prompt) => {
  try {
    console.log('[LLM] Attempting Groq call...');
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.1-8b-instant',
      temperature: 0.2, // Lower temperature for more stable JSON
      response_format: { type: 'json_object' }
    });
    
    const content = chatCompletion.choices[0].message.content;
    const parsed = cleanJSONResponse(content);
    
    if (!parsed || !parsed.detailed_answer || parsed.detailed_answer.length < 5) {
      console.warn('[LLM] Groq response invalid or empty');
      return null;
    }
    
    console.log('[LLM] Groq call successful');
    return parsed;
  } catch (error) {
    console.error('[LLM] Groq LLM call failed:', error.message);
    return null;
  }
};

const generateAnswerWithGemini = async (prompt) => {
  try {
    console.log('[LLM] Attempting Gemini fallback...');
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { 
        responseMimeType: 'application/json',
        temperature: 0.2
      }
    });
    
    const response = await result.response;
    const text = response.text();
    const parsed = cleanJSONResponse(text);

    if (!parsed || !parsed.detailed_answer || parsed.detailed_answer.length < 5) {
      throw new Error('Gemini response invalid or empty');
    }

    console.log('[LLM] Gemini fallback successful');
    return parsed;
  } catch (error) {
    console.error('[LLM] Gemini LLM call failed:', error.message);
    // Ultimate fallback if both AI models fail to format JSON correctly
    return {
      short_answer: "I apologize for the technical difficulty.",
      detailed_answer: "I was able to find information about Vignan University, but I'm having trouble formatting it as a professional response. Please try asking again or contact the university directly for official details.",
      important_contacts: [],
      sources: [],
      suggested_faq: ["Admission Process", "Fee Structure"],
      confidence: "low"
    };
  }
};

const generateAnswer = async (context, question, contacts, history = []) => {
  const historyText = history.map(h => `${h.role === 'user' ? 'Student' : 'Assistant'}: ${h.text}`).join('\n');

  const systemPrompt = `
    You are the Senior Academic Counselor and Personal AI Assistant for Vignan University. 
    Your mission is to provide students with 100% accurate, document-backed information about Vignan University.

    PERSONA:
    - You are helpful, professional, and knowledgeable.
    - You act as a mentor who guides students through their academic journey.
    - You represent the values of Vignan University: Excellence, Discipline, and Innovation.

    KNOWLEDGE BASE USAGE RULES:
    1. SOURCE FIDELITY: Your ONLY source of truth is the "Knowledge Base Context" provided below. 
    2. STRICT ACCURACY: If the context contains specific numbers (fees, dates, percentages), you MUST use them exactly. Do NOT approximate.
    3. CITATION: When you provide information from a document, mention the source (e.g., "According to the Admission Brochure...").
    4. MISSING INFO: If the context does NOT contain the answer, do not guess. Instead, say: "I couldn't find specific information about [Topic] in our current records. I recommend contacting [Relevant Department] for official details."
    5. NO GENERALIZATIONS: Never give general advice about "college fees" or "university life" unless it is specifically mentioned in the context for Vignan University.

    CRITICAL DATA (Always Available):
    - University: Vignan's Foundation for Science, Technology & Research (Deemed to be University).
    - Location: Vadlamudi, Guntur, Andhra Pradesh.
    - Leadership: Dr. Lavu Rathaiah (Chairman), Sri Lavu Srikrishnadevarayalu (Vice Chairman).

    CONVERSATION HISTORY (Contextual Awareness):
    ${historyText || "No previous messages."}

    INSTRUCTIONS FOR RESPONSE:
    - ALWAYS start with a warm, personalized greeting if it's the start of a conversation.
    - Use Markdown tables for any structured data like fee structures, eligibility criteria, or program lists.
    - Keep your tone supportive but authoritative.
    - Ensure your response is formatted clearly with headers and bullet points.

    Knowledge Base Context:
    ${context || 'No specific university documents found for this query.'}
    
    Important Contacts (Use these if info is missing):
    ${JSON.stringify(contacts)}
    
    Current Question from Student:
    ${question}
    
    Return the response ONLY as a JSON object:
    {
      "short_answer": "A concise 1-2 sentence summary of the answer.",
      "detailed_answer": "The comprehensive, professionally formatted Markdown response.",
      "important_contacts": ["Department Name: Phone/Email"],
      "sources": ["Name of the PDF or Website Link used"],
      "suggested_faq": ["Question 1?", "Question 2?"],
      "confidence": "high|medium|low"
    }
  `;

  let response = await generateAnswerWithGroq(systemPrompt);
  if (!response) {
    response = await generateAnswerWithGemini(systemPrompt);
  }
  return response;
};

const rerankContext = async (question, chunks) => {
  if (!chunks || chunks.length <= 1) return [0];
  
  try {
    const prompt = `
      You are an AI search specialist. Below is a list of text chunks retrieved from a university database.
      Your task is to identify which chunks are MOST RELEVANT to the student's question.
      
      QUESTION: "${question}"
      
      CHUNKS:
      ${chunks.map((c, i) => `[${i}] ${c.substring(0, 300)}...`).join('\n\n')}
      
      Return ONLY a JSON array of indices (integers) in order of relevance (best first).
      Example: [3, 0, 15, 2]
      Limit to top 10 indices.
    `;

    // Use Gemini for re-ranking as it's very fast and smart with large contexts
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { 
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    });
    
    const response = await result.response;
    const text = response.text();
    const indices = JSON.parse(text);
    
    if (Array.isArray(indices)) {
      return indices.filter(idx => typeof idx === 'number' && idx >= 0 && idx < chunks.length);
    }
    return null;
  } catch (error) {
    console.warn('[LLM] Re-ranking failed:', error.message);
    return null;
  }
};

module.exports = { generateAnswer, rerankContext };
