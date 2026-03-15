const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const DEFAULT_GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-flash'];
const GEMINI_RETRY_DELAY_MS = Number(process.env.GEMINI_RETRY_DELAY_MS || 10 * 60 * 1000);
let geminiBackoffUntil = 0;

const isGeminiCriticalError = (message = '') => {
  const lower = String(message).toLowerCase();
  return lower.includes('quota exceeded') || lower.includes('api key not found') || lower.includes('api_key_invalid');
};

const shouldSkipGemini = () => Date.now() < geminiBackoffUntil;

const markGeminiBackoff = () => {
  geminiBackoffUntil = Date.now() + GEMINI_RETRY_DELAY_MS;
  console.warn(`[Translate] Gemini disabled temporarily for ${Math.round(GEMINI_RETRY_DELAY_MS / 1000)}s due to critical API error`);
};

const getGeminiModels = () => {
  const configuredModels = (process.env.GEMINI_MODELS || '')
    .split(',')
    .map(model => model.trim())
    .filter(Boolean);

  return configuredModels.length > 0 ? configuredModels : DEFAULT_GEMINI_MODELS;
};

const translateWithGeminiModels = async (prompt) => {
  if (shouldSkipGemini()) {
    return null;
  }

  const models = getGeminiModels();

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const translated = response.text().trim();
      if (translated && translated.length > 0) {
        return translated;
      }
    } catch (error) {
      console.warn(`[Translate] Gemini model ${modelName} failed: ${error.message}`);
      if (isGeminiCriticalError(error.message)) {
        markGeminiBackoff();
        break;
      }
    }
  }

  return null;
};

const translateWithGemini = async (text, from, to) => {
  try {
    const prompt = `Act as a professional translator. Translate the following text from ${from} to ${to}.
    Only provide the translated text. Do not include any explanations or extra characters.
    
    TEXT TO TRANSLATE:
    "${text}"`;

    const translated = await translateWithGeminiModels(prompt);
    
    // If translation returned empty or just the prompt, return null to trigger fallback
    if (!translated || translated.length < 1) return null;
    return translated;
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
    const translatedText = response?.data?.translatedText;
    return (translatedText && translatedText.trim().length > 0) ? translatedText : text;
  } catch (error) {
    console.warn(`[Translate] All services failed: ${error.message}. Returning original text.`);
    return text;
  }
};

module.exports = { translate };
