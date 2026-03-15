const pdf = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');

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
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = "Please extract all the text from this document. Maintain the structure and tables if any.";
      
      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: buffer.toString('base64'),
            mimeType: "application/pdf"
          }
        }
      ]);

      const response = await result.response;
      text = response.text();
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
