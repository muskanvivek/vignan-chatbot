const { pipeline } = require('@xenova/transformers');

let embeddingPipeline;

const getEmbeddingPipeline = async () => {
  if (!embeddingPipeline) {
    embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return embeddingPipeline;
};

const generateEmbedding = async (text) => {
  try {
    const extractor = await getEmbeddingPipeline();
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  } catch (error) {
    console.error('Embedding generation failed:', error);
    throw error;
  }
};

module.exports = { generateEmbedding };
