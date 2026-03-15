const { GoogleGenerativeAI } = require('@google/generative-ai');
const Groq = require('groq-sdk');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const DEFAULT_GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-flash'];
const DEFAULT_GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
const GEMINI_RETRY_DELAY_MS = Number(process.env.GEMINI_RETRY_DELAY_MS || 10 * 60 * 1000);
const ENABLE_GROQ_VERIFICATION = String(process.env.ENABLE_GROQ_VERIFICATION || 'false').toLowerCase() === 'true';
let geminiBackoffUntil = 0;

const isGeminiCriticalError = (message = '') => {
  const lower = String(message).toLowerCase();
  return lower.includes('quota exceeded') || lower.includes('api key not found') || lower.includes('api_key_invalid');
};

const shouldSkipGemini = () => Date.now() < geminiBackoffUntil;

const markGeminiBackoff = () => {
  geminiBackoffUntil = Date.now() + GEMINI_RETRY_DELAY_MS;
  console.warn(`[LLM] Gemini disabled temporarily for ${Math.round(GEMINI_RETRY_DELAY_MS / 1000)}s due to critical API error`);
};

const getGeminiModels = () => {
  const configuredModels = (process.env.GEMINI_MODELS || '')
    .split(',')
    .map(model => model.trim())
    .filter(Boolean);

  return configuredModels.length > 0 ? configuredModels : DEFAULT_GEMINI_MODELS;
};

const getGroqModels = () => {
  const configuredModels = (process.env.GROQ_MODELS || '')
    .split(',')
    .map(model => model.trim())
    .filter(Boolean);

  return configuredModels.length > 0 ? configuredModels : DEFAULT_GROQ_MODELS;
};

const callGroqForJson = async ({ messages, temperature = 0.2, models }) => {
  const modelList = models && models.length > 0 ? models : getGroqModels();
  let lastError = null;

  for (const modelName of modelList) {
    try {
      const completion = await groq.chat.completions.create({
        messages,
        model: modelName,
        temperature,
        response_format: { type: 'json_object' }
      });

      const content = completion.choices?.[0]?.message?.content;
      const parsed = cleanJSONResponse(content);
      if (parsed) {
        return { parsed, modelName };
      }
    } catch (error) {
      lastError = error;
      console.warn(`[LLM] Groq model ${modelName} failed: ${error.message}`);
    }
  }

  throw lastError || new Error('All configured Groq models failed');
};

const generateGeminiText = async (payload) => {
  if (shouldSkipGemini()) {
    throw new Error('Gemini temporarily disabled due to recent API quota/auth failure');
  }

  const models = getGeminiModels();
  let lastError = null;

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(payload);
      const response = await result.response;
      return { text: response.text(), modelName };
    } catch (error) {
      lastError = error;
      console.warn(`[LLM] Gemini model ${modelName} failed: ${error.message}`);
      if (isGeminiCriticalError(error.message)) {
        markGeminiBackoff();
        break;
      }
    }
  }

  throw lastError || new Error('All configured Gemini models failed');
};

const normalizeRerankIndices = (raw, chunkLength) => {
  if (!Array.isArray(raw)) return null;
  return raw.filter(idx => typeof idx === 'number' && idx >= 0 && idx < chunkLength);
};

const isUsableAnswerResponse = (response) => {
  return !!(
    response &&
    typeof response === 'object' &&
    typeof response.short_answer === 'string' &&
    response.short_answer.trim().length > 0 &&
    typeof response.detailed_answer === 'string' &&
    response.detailed_answer.trim().length > 0
  );
};

const wantsDetailedAnswer = (question = '') => {
  const lower = String(question).toLowerCase();
  return /\b(detailed|in detail|detail explanation|full details|elaborate|explain clearly|step by step)\b/.test(lower);
};

const toPlainText = (text = '') => {
  let cleaned = String(text || '');

  cleaned = cleaned
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/^\s*\d+\.\s+/gm, '• ')
    .replace(/^\|\s*[-: ]+\|.*$/gm, '');

  cleaned = cleaned
    .split('\n')
    .map(line => {
      if (line.includes('|')) {
        return line
          .split('|')
          .map(part => part.trim())
          .filter(Boolean)
          .join(' - ');
      }
      return line.trim();
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return cleaned;
};

const splitIntoReadableBlocks = (text = '', preferDetailed = false) => {
  const cleaned = toPlainText(text);
  if (!cleaned) return cleaned;

  const lines = cleaned
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const merged = lines.join(' ');
  const sentences = merged
    .split(/(?<=[.!?])\s+/)
    .map(item => item.trim())
    .filter(Boolean);

  if (sentences.length === 0) return cleaned;

  const effectiveSentences = preferDetailed ? sentences : sentences.slice(0, 8);
  const grouped = [];
  let current = [];

  effectiveSentences.forEach((sentence, index) => {
    current.push(sentence);
    const shouldFlush = current.length >= 2 || index === effectiveSentences.length - 1;
    if (shouldFlush) {
      grouped.push(current.join(' '));
      current = [];
    }
  });

  return grouped.join('\n\n');
};

const ensureStructuredDetailedAnswer = (text = '') => {
  const cleaned = splitIntoReadableBlocks(text, true);
  if (!cleaned) {
    return 'I could not find enough details for this query in the current records.';
  }

  if (cleaned.length < 80) {
    return `${cleaned}\n\nI can share more details if you tell me the exact program or category.`;
  }

  return cleaned;
};

const normalizeAnswerPayload = (response = {}, preferDetailed = false) => {
  const normalized = { ...response };
  normalized.short_answer = toPlainText(response.short_answer || '');
  const detailedText = ensureStructuredDetailedAnswer(response.detailed_answer || '');
  normalized.detailed_answer = splitIntoReadableBlocks(detailedText, preferDetailed);

  if (!preferDetailed && normalized.detailed_answer.length > 1200) {
    normalized.detailed_answer = `${normalized.detailed_answer}\n\nIf you want, I can provide a more detailed breakdown.`;
  }

  return normalized;
};

const cleanJSONResponse = (text) => {
  if (!text) return null;
  
  try {
    // 1. Try to find JSON block if LLM wrapped it in markdown
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    let jsonStr = jsonMatch ? jsonMatch[0] : text;
    
    // 2. Remove problematic control characters but keep common ones
    jsonStr = jsonStr.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');

    // 3. Try parsing
    try {
      return JSON.parse(jsonStr);
    } catch (innerError) {
      // If direct parsing fails, try to fix common issues like trailing commas
      const fixedJsonStr = jsonStr
        .replace(/,\s*([\}\]])/g, '$1') // remove trailing commas
        .replace(/(\w+):/g, '"$1":'); // ensure keys are quoted if not
      return JSON.parse(fixedJsonStr);
    }
  } catch (e) {
    console.error('[LLM] JSON Clean/Parse failed:', e.message);
    // If it's not JSON at all, return a simple object with the text as detailed_answer
    if (text.length > 20) {
      return {
        short_answer: "I have found the information for you.",
        detailed_answer: text,
        sentiment: "neutral",
        sources: ["AI Generation"],
        suggested_faq: [],
        confidence: "medium"
      };
    }
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
    const { text, modelName } = await generateGeminiText({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { 
        responseMimeType: 'application/json',
        temperature: 0.2
      }
    });

    const parsed = cleanJSONResponse(text);

    if (!parsed || !parsed.detailed_answer || parsed.detailed_answer.length < 5) {
      throw new Error('Gemini response invalid or empty');
    }

    console.log(`[LLM] Gemini fallback successful with ${modelName}`);
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
  const preferDetailed = wantsDetailedAnswer(question);

  // Map history to standard OpenAI/GPT format for the LLM
  const historyMessages = history.map(h => ({
    role: h.role === 'user' ? 'user' : 'assistant',
    content: h.text
  }));

  const systemPrompt = `
    You are the Advanced Student Support AI Assistant for Vignan's Foundation for Science, Technology & Research (VFSTR). 
    Your goal is to provide 24/7 intelligent, professional, and accurate support.

    CORE IDENTITY:
    - You are helpful, professional, and knowledgeable.
    - You represent Vignan University's commitment to excellence.
    - You maintain context across the conversation (like ChatGPT).

    KNOWLEDGE PROTOCOLS:
    1. PRIMARY KNOWLEDGE: Use ONLY the "Knowledge Base Context" provided below.
    2. NO GUESSING: If exact details (especially fees, dates, eligibility, seat count) are not present in context, clearly say they are not available in current records.
    3. SAFE FALLBACK: Suggest the official admissions/helpdesk contact when exact data is missing.
    4. NO HALLUCINATION: Do not invent numbers, policies, or source names.
    5. ELIGIBILITY + FEES QUERIES: If user gives personal stats (e.g., board %, marks, rank, category), compare them with criteria found in context and explicitly state likely eligibility. Then provide relevant fee details from context for matching courses.

    FORMATTING:
    - Do NOT use markdown symbols like #, **, |, or code blocks.
    - Keep output in clean plain text.
    - Write one short summary sentence first, then clear bullet-style points in plain text.
    - Keep "short_answer" friendly and voice-output ready.
    - RESPONSE DEPTH: ${preferDetailed ? 'Provide detailed explanation with complete available data.' : 'Keep response concise and easy to scan.'}

    Knowledge Base Context:
    ${context || 'No specific university documents found for this query.'}
    
    Important Contacts:
    ${JSON.stringify(contacts)}

    OUTPUT INSTRUCTION:
    - You MUST return your response ONLY as a JSON object.
    - Use EXACTLY this schema:
      {
        "short_answer": "string",
        "detailed_answer": "string",
        "sentiment": "friendly|neutral|supportive",
        "sources": ["string"],
        "suggested_faq": ["string"],
        "confidence": "high|medium|low"
      }
    - Do NOT use any other top-level keys.
  `;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...historyMessages,
    { role: 'user', content: question }
  ];

  // Helper to call models with the full message array
  const callLLM = async (modelType) => {
    try {
      if (modelType === 'groq') {
        console.log('[LLM] Calling Groq (primary)...');
        const { parsed, modelName } = await callGroqForJson({ messages, temperature: 0.2 });
        console.log(`[LLM] Groq answer succeeded with ${modelName}`);
        return parsed;
      } else {
        console.log('[LLM] Calling Gemini...');
        // Use the most basic string prompt to avoid SDK version conflicts
        const prompt = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');

        const { text, modelName } = await generateGeminiText(prompt);
        console.log(`[LLM] Gemini call succeeded with ${modelName}`);
        return cleanJSONResponse(text);
      }
    } catch (e) {
      console.error(`[LLM] ${modelType} call failed:`, e.message);
      return null;
    }
  };

  let response = await callLLM('groq');
  if (!isUsableAnswerResponse(response)) {
    if (response) {
      console.warn('[LLM] Groq response shape invalid, trying Gemini fallback...');
    }
    console.log('[LLM] Groq failed, trying Gemini...');
    response = await callLLM('gemini');
  }

  if (ENABLE_GROQ_VERIFICATION && isUsableAnswerResponse(response)) {
    try {
      const verifyPrompt = `You are verifying an answer for factual grounding.
Return ONLY JSON with EXACT schema:
{
  "short_answer":"string",
  "detailed_answer":"string",
  "sentiment":"friendly|neutral|supportive",
  "sources":["string"],
  "suggested_faq":["string"],
  "confidence":"high|medium|low"
}

Rules:
- Keep only details supported by Knowledge Base Context.
- Remove unsupported claims and guessed numbers.
- If exact values are missing, clearly say so.

QUESTION:
${question}

KNOWLEDGE BASE CONTEXT:
${context || 'No context'}

CURRENT ANSWER JSON:
${JSON.stringify(response)}`;

      const { parsed, modelName } = await callGroqForJson({
        messages: [{ role: 'user', content: verifyPrompt }],
        temperature: 0
      });

      if (isUsableAnswerResponse(parsed)) {
        console.log(`[LLM] Groq verification succeeded with ${modelName}`);
        response = parsed;
      }
    } catch (verifyError) {
      console.warn('[LLM] Groq verification skipped:', verifyError.message);
    }
  }

  // Final fallback if both fail
  if (!isUsableAnswerResponse(response)) {
    response = {
      short_answer: "I'm here to help, but I'm having a technical issue.",
      detailed_answer: "I encountered an error processing your request. Please try asking in a different way or contact the support desk.",
      sentiment: "neutral",
      sources: ["Error Fallback"],
      suggested_faq: ["Admissions", "Fees"],
      confidence: "low"
    };
  }

  return normalizeAnswerPayload(response, preferDetailed);
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

    const rerankWithGroqPrompt = `${prompt}\n\nReturn a strict JSON object like: {"indices":[3,0,1]}`;
    try {
      const { parsed, modelName } = await callGroqForJson({
        messages: [{ role: 'user', content: rerankWithGroqPrompt }],
        temperature: 0,
        models: ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile']
      });

      const groqIndices = normalizeRerankIndices(parsed?.indices, chunks.length);
      if (groqIndices && groqIndices.length > 0) {
        console.log(`[LLM] Re-ranking used Groq model: ${modelName}`);
        return groqIndices;
      }
    } catch (groqError) {
      console.warn('[LLM] Groq re-ranking failed, trying Gemini fallback:', groqError.message);
    }

    try {
      const { text, modelName } = await generateGeminiText(prompt);
      console.log(`[LLM] Re-ranking Gemini fallback used model: ${modelName}`);
      const indices = normalizeRerankIndices(cleanJSONResponse(text), chunks.length);
      if (indices && indices.length > 0) {
        return indices;
      }
    } catch (geminiError) {
      console.warn('[LLM] Gemini re-ranking fallback failed:', geminiError.message);
    }

    return null;
  } catch (error) {
    console.warn('[LLM] Re-ranking failed:', error.message);
    return null;
  }
};

const generateFAQsFromText = async (text) => {
  try {
    const prompt = `
      You are an AI data analyst. I am providing you with a text document from a university.
      Your task is to generate 5 high-quality, frequently asked questions (FAQs) with detailed answers based on this text.
      
      TEXT:
      ${text.substring(0, 4000)}
      
      Return ONLY a JSON array of objects:
      [
        { "question": "Question text?", "answer": "Detailed answer based on text." },
        ...
      ]
    `;

    try {
      const groqPrompt = `${prompt}\n\nReturn strict JSON object like: {"items":[{"question":"...","answer":"..."}]}`;
      const { parsed, modelName } = await callGroqForJson({
        messages: [{ role: 'user', content: groqPrompt }],
        temperature: 0.2
      });
      console.log(`[LLM] FAQ generation used Groq model: ${modelName}`);
      const groqItems = Array.isArray(parsed?.items) ? parsed.items : parsed;
      if (Array.isArray(groqItems)) {
        return groqItems;
      }
    } catch (groqError) {
      console.warn('[LLM] FAQ generation Groq primary failed, trying Gemini fallback:', groqError.message);
    }

    const { text } = await generateGeminiText({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3
      }
    });

    const json = cleanJSONResponse(text);
    return Array.isArray(json) ? json : [];
  } catch (error) {
    console.error('[LLM] FAQ generation failed:', error.message);
    return [];
  }
};

module.exports = { generateAnswer, rerankContext, generateFAQsFromText };
