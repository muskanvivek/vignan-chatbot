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
  const historyText = history.map(h => `${h.role === 'user' ? 'Student' : 'Assistant'}: ${h.text}`).join('\n');

  const systemPrompt = `
    You are the Advanced Student Support AI Assistant for Vignan's Foundation for Science, Technology & Research (VFSTR). 
    Your goal is to provide 24/7 intelligent support across all functional modules.

    FUNCTIONAL MODULES YOU SUPPORT:
    1. Admission Assistance: Program info, eligibility, application tracking.
    2. Academic Support: Course registration, credits, academic calendar.
    3. Financial Assistance: Fee structures, scholarships, loan assistance.
    4. Campus Support: Hostels, transport, navigation.
    5. Mental Health: Counseling appointments, stress management.

    CORE PROTOCOLS:
    - SENTIMENT ANALYSIS: Analyze the student's tone. If they are stressed, anxious, or upset, respond with extra empathy and prioritize mental health resources if relevant.
    - KNOWLEDGE FALLBACK: 
        * PRIMARY: Use the "Knowledge Base Context" provided below. 
        * SECONDARY: If information is missing from the context, you MAY use your general AI knowledge about Vignan University or standard university procedures, but you MUST add a disclaimer: "Note: This information is based on general records/procedures as the specific document was not found in my current library."
    - VOICE-ENABLED DESIGN: Keep your "short_answer" extremely clear and concise for voice output. Avoid complex symbols or long tables in the short answer.
    - ACCURACY: Use exact figures for fees and dates when provided in the context.

    VIGNAN UNIVERSITY DATA:
    - University Name: Vignan's Foundation for Science, Technology & Research (VFSTR)
    - Deemed to be University, Accredited with NAAC 'A+' Grade
    - Chairman: Dr. Lavu Rathaiah
    - Vice Chairman: Sri Lavu Srikrishnadevarayalu
    - Main Campus: Vadlamudi, Guntur, AP
    - Social Media: @VignanUniversity (Facebook, Instagram, LinkedIn, X/Twitter)
    
    CORE PROTOCOLS:
    - SENTIMENT ANALYSIS: Analyze the student's tone. If they are stressed, anxious, or upset (e.g., "I'm so stressed", "This is too hard"), respond with deep empathy: "I hear you, and it's completely normal to feel this way. Vignan is here to support you." Immediately suggest "Counseling appointments" or "Stress management resources" from the Mental Health module.
    - KNOWLEDGE FALLBACK: 
        * PRIMARY: Use the "Knowledge Base Context" provided below. 
        * SECONDARY: If information is missing from the context, you MUST use your general knowledge about VFSTR (e.g., courses like B.Tech CSE, ECE, Biotechnology, MBA, PhD) to provide a helpful answer, but ALWAYS add the disclaimer: "*(Note: This info is based on general records as the specific file wasn't found in my primary library)*."
    - VOICE-ENABLED DESIGN: Your "short_answer" should be conversational and easy for a voice assistant to read. Use "spoken-word" friendly language (e.g., say "one lakh forty thousand" instead of just writing "1,40,000").
    - CAMPUS NAVIGATION: If asked for directions, provide descriptive steps based on the main campus landmarks (Administrative Block, Library, Hostels, Canteen).
    - MULTILINGUAL: You can respond in the language the student used if they start in a different language, while keeping the professional Vignan tone.
    - ACCURACY: Use exact figures for fees and dates when provided in the context.

    CONVERSATION HISTORY:
    ${historyText || "New conversation started."}

    Knowledge Base Context:
    ${context || 'No specific university documents found for this query.'}
    
    Important Contacts:
    ${JSON.stringify(contacts)}
    
    Student Question:
    ${question}
    
    Return ONLY a JSON object:
    {
      "short_answer": "Clear, empathetic summary for voice/quick reading.",
      "detailed_answer": "The full, professional Markdown response with tables/lists if needed.",
      "sentiment": "detected sentiment (e.g., 'stressed', 'curious', 'happy')",
      "sources": ["List sources used, or 'General University Records'"],
      "suggested_faq": ["Follow-up question 1", "Follow-up question 2"],
      "confidence": "high|medium|low"
    }
  `;

  let response = await generateAnswerWithGroq(systemPrompt);
  if (!response) {
    console.log('[LLM] Groq failed, trying Gemini...');
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
