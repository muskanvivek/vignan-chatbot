const { handleChat } = require('../services/ragService');
const { translate } = require('../services/translationService');
const Conversation = require('../models/Conversation');

const chat = async (req, res) => {
  const { question, language = 'en', history = [] } = req.body;
  console.log(`[Chat] Incoming question: "${question}" in ${language}. History length: ${history.length}`);
  
  try {
    // 1. Translate question to English if necessary
    console.log('[Chat] Step 1: Translating question...');
    const englishQuestion = await translate(question, language, 'en');
    console.log(`[Chat] Question translated: "${englishQuestion}"`);
    
    // 2. Perform RAG pipeline with history
    console.log('[Chat] Step 2: Performing RAG pipeline...');
    const answerData = await handleChat(englishQuestion, history);
    console.log('[Chat] RAG pipeline completed successfully');
    
    // 3. Translate detailed answer back to user language
    console.log('[Chat] Step 3: Translating response back...');
    let translatedDetailedAnswer = await translate(answerData.detailed_answer, 'en', language);
    let translatedShortAnswer = await translate(answerData.short_answer, 'en', language);
    
    // Fallback to original English if translation is empty
    if (!translatedDetailedAnswer || translatedDetailedAnswer.trim().length === 0) {
      console.warn('[Chat] Translation returned empty, falling back to English');
      translatedDetailedAnswer = answerData.detailed_answer;
    }
    if (!translatedShortAnswer || translatedShortAnswer.trim().length === 0) {
      translatedShortAnswer = answerData.short_answer;
    }
    
    // 4. Update the answerData with translated text
    const response = {
      ...answerData,
      short_answer: translatedShortAnswer,
      detailed_answer: translatedDetailedAnswer,
      translated_answer: translatedDetailedAnswer
    };
    
    // 5. Store conversation
    console.log('[Chat] Step 5: Storing conversation...');
    await Conversation.create({ question, answer: response, language });
    
    console.log('[Chat] Processing finished. Sending response.');
    res.json(response);
  } catch (error) {
    console.error('[Chat] FATAL ERROR:', error.message);
    console.error(error.stack);
    res.status(500).json({ error: error.message });
  }
};

module.exports = { chat };
