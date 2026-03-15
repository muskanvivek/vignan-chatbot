/**
 * Splits text into meaningful chunks, prioritizing double newlines (paragraphs),
 * then single newlines, then sentences, and finally character count.
 */
const splitIntoChunks = (text, chunkSize = 1000, chunkOverlap = 200) => {
  if (!text) return [];

  const cleanText = text.replace(/\s+/g, ' ').trim();
  const chunks = [];
  let startIndex = 0;

  while (startIndex < cleanText.length) {
    let endIndex = startIndex + chunkSize;

    if (endIndex >= cleanText.length) {
      chunks.push(cleanText.slice(startIndex));
      break;
    }

    // Try to find a good breaking point in the overlap region
    const overlapSearchArea = cleanText.slice(endIndex - chunkOverlap, endIndex);
    
    // Look for sentence endings (. ! ?)
    let breakPoint = -1;
    const sentenceEndings = /[.!?]\s/g;
    let match;
    while ((match = sentenceEndings.exec(overlapSearchArea)) !== null) {
      breakPoint = match.index + 1;
    }

    if (breakPoint !== -1) {
      endIndex = (endIndex - chunkOverlap) + breakPoint;
    } else {
      // If no sentence ending, look for space
      const lastSpace = overlapSearchArea.lastIndexOf(' ');
      if (lastSpace !== -1) {
        endIndex = (endIndex - chunkOverlap) + lastSpace;
      }
    }

    chunks.push(cleanText.slice(startIndex, endIndex).trim());
    startIndex = endIndex - (chunkOverlap / 2); // Ensure some overlap for the next chunk
  }

  return chunks.filter(c => c.length > 20); // Filter out tiny fragments
};

module.exports = { splitIntoChunks };
