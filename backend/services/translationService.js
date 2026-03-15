const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const translateWithGemini = async (text, from, to) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Translate the following text from ${from} to ${to}. Only return the translated text without any explanations:\n\n${text}`;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (err) {
    console.error('[Translate] Gemini translation failed:', err.message);
    return null;
  }
};

const translate = async (text, from = 'en', to = 'en') => {
  // Normalize language names/codes
  const fromCode = from === 'English' ? 'en' : from;
  const toCode = to === 'English' ? 'en' : to;

  if (fromCode === toCode || !text) return text;
  
  // Prefer Gemini for translation as it is much faster and more accurate
  console.log(`[Translate] Translating (${fromCode} -> ${toCode}) using Gemini...`);
  const geminiResult = await translateWithGemini(text, fromCode, toCode);
  if (geminiResult) return geminiResult;

  // Fallback to LibreTranslate
  try {
    const apiUrl = process.env.LIBRETRANSLATE_API_URL || 'https://libretranslate.de';
    console.log(`[Translate] Falling back to ${apiUrl}...`);
    
    const response = await axios.post(`${apiUrl}/translate`, {
      q: text,
      source: fromCode,
      target: toCode,
      format: 'text'
    }, { timeout: 5000 });
    return response.data.translatedText;
  } catch (error) {
    console.warn(`[Translate] All services failed: ${error.message}. Returning original text.`);
    return text;
  }
};

module.exports = { translate };
