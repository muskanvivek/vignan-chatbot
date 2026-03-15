const pdf = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');

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
  console.warn(`[PDF] Gemini disabled temporarily for ${Math.round(GEMINI_RETRY_DELAY_MS / 1000)}s due to critical API error`);
};

const getGeminiModels = () => {
  const configuredModels = (process.env.GEMINI_MODELS || '')
    .split(',')
    .map(model => model.trim())
    .filter(Boolean);

  return configuredModels.length > 0 ? configuredModels : DEFAULT_GEMINI_MODELS;
};

const extractWithGeminiModels = async (genAI, payload) => {
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
      const text = response.text();
      if (text && text.trim().length > 0) {
        console.log(`[PDF] OCR succeeded with Gemini model: ${modelName}`);
        return text;
      }
    } catch (error) {
      lastError = error;
      console.warn(`[PDF] Gemini model ${modelName} failed: ${error.message}`);
      if (isGeminiCriticalError(error.message)) {
        markGeminiBackoff();
        break;
      }
    }
  }

  throw lastError || new Error('All configured Gemini models failed for OCR');
};

/**
 * Extracts text from a PDF buffer. 
 * If the PDF is image-based (scanned), it uses Gemini Pro Vision to perform OCR.
 */
const extractTextFromPDF = async (buffer) => {
  let text = '';
  
  try {
    // 1. Try standard text extraction first
    const data = await pdf(buffer);
    text = data.text.trim();
  } catch (err) {
    console.warn('[PDF] Standard extraction failed, will attempt AI OCR:', err.message);
  }

  // 2. If extracted text is very short or failed, it's likely a scanned PDF or complex layout
  if (text.length < 100) {
    try {
      console.log('[PDF] Attempting AI-powered OCR fallback...');
      
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

      const prompt = "Please extract all the text from this document. Maintain the structure and tables if any.";

      text = await extractWithGeminiModels(genAI, [
        prompt,
        {
          inlineData: {
            data: buffer.toString('base64'),
            mimeType: "application/pdf"
          }
        }
      ]);
      console.log('[PDF] AI-powered OCR successful');
    } catch (ocrError) {
      console.error('[PDF] AI-powered OCR also failed:', ocrError.message);
      // If we have some text from step 1, we return it even if OCR failed
      if (!text) throw ocrError;
    }
  }

  return text;
};

module.exports = { extractTextFromPDF };
