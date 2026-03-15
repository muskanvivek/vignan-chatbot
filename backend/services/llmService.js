const { Groq } = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

console.log('LLM Service Initialized');
console.log('Groq Key starts with:', process.env.GROQ_API_KEY?.substring(0, 5));
console.log('Gemini Key starts with:', process.env.GEMINI_API_KEY?.substring(0, 5));

const cleanJSONResponse = (text) => {
  if (!text) return null;
  
  try {
    // 1. Try to find JSON block if LLM wrapped it in markdown
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // If no JSON block found, maybe the whole thing is JSON
      return JSON.parse(text);
    }
    
    let jsonStr = jsonMatch[0];
    
    // 2. Remove problematic control characters but keep common ones
    // This regex targets control characters except \n, \r, \t
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
    1. PRIMARY KNOWLEDGE: Use the "Knowledge Base Context" provided below.
    2. SECONDARY KNOWLEDGE: If info is missing from context, use your internal AI knowledge about Vignan (Courses: B.Tech CSE, ECE, EEE, ME, Civil, Biotechnology, IT, AI&DS, CSBS; MBA; PhD; NAAC A+; Guntur/Vadlamudi campus).
    3. FALLBACK: If a detail is highly specific (like a particular date or fee not in context), say: "I don't have the exact current figure in my records, but usually it is [approximate if known]. Please check with the Admissions office for the 2024-25 update."
    4. NO HALLUCINATION: Do not make up facts. Be honest but helpful.

    FORMATTING:
    - Use Markdown tables for ANY data comparison or lists.
    - Keep "detailed_answer" structured with clear headings.
    - Keep "short_answer" friendly and voice-output ready.

    Knowledge Base Context:
    ${context || 'No specific university documents found for this query.'}
    
    Important Contacts:
    ${JSON.stringify(contacts)}
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
        const chatCompletion = await groq.chat.completions.create({
          messages: messages,
          model: 'llama-3.1-8b-instant',
          temperature: 0.2,
          response_format: { type: 'json_object' }
        });
        return cleanJSONResponse(chatCompletion.choices[0].message.content);
      } else {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        // Gemini uses 'parts' instead of 'content'
        const geminiMessages = messages.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.role === 'system' ? `SYSTEM: ${m.content}` : m.content }]
        }));
        
        const result = await model.generateContent({
          contents: geminiMessages,
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
        });
        return cleanJSONResponse(result.response.text());
      }
    } catch (e) {
      console.error(`[LLM] ${modelType} call failed:`, e.message);
      return null;
    }
  };

  let response = await callLLM('groq');
  if (!response) {
    console.log('[LLM] Groq failed, trying Gemini...');
    response = await callLLM('gemini');
  }

  // Final fallback if both fail
  if (!response) {
    response = {
      short_answer: "I'm here to help, but I'm having a technical issue.",
      detailed_answer: "I encountered an error processing your request. Please try asking in a different way or contact the support desk.",
      sentiment: "neutral",
      sources: ["Error Fallback"],
      suggested_faq: ["Admissions", "Fees"],
      confidence: "low"
    };
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

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { 
        responseMimeType: 'application/json',
        temperature: 0.3
      }
    });
    
    const response = await result.response;
    const json = cleanJSONResponse(response.text());
    return Array.isArray(json) ? json : [];
  } catch (error) {
    console.error('[LLM] FAQ generation failed:', error.message);
    return [];
  }
};

module.exports = { generateAnswer, rerankContext, generateFAQsFromText };
