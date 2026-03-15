const splitIntoChunks = (text, chunkSize = 1200, chunkOverlap = 250) => {
  if (!text) return [];

  // Aggressive cleaning while keeping structure
  const cleanText = text.replace(/[ ]{2,}/g, ' ').trim();
  const chunks = [];
  let startIndex = 0;

  while (startIndex < cleanText.length) {
    let endIndex = startIndex + chunkSize;

    if (endIndex >= cleanText.length) {
      chunks.push(cleanText.slice(startIndex).trim());
      break;
    }

    // Prioritize structural breaks like [Table End] or paragraph ends
    const structuralBreak = cleanText.slice(endIndex - chunkOverlap, endIndex).lastIndexOf('[Table End]');
    if (structuralBreak !== -1) {
      endIndex = (endIndex - chunkOverlap) + structuralBreak + 11; // Include "[Table End]"
    } else {
      // Fallback to sentence or paragraph endings
      const overlapSearchArea = cleanText.slice(endIndex - chunkOverlap, endIndex);
      const sentenceEndings = /[.!?]\s/g;
      let breakPoint = -1;
      let match;
      while ((match = sentenceEndings.exec(overlapSearchArea)) !== null) {
        breakPoint = match.index + 1;
      }

      if (breakPoint !== -1) {
        endIndex = (endIndex - chunkOverlap) + breakPoint;
      } else {
        const lastSpace = overlapSearchArea.lastIndexOf(' ');
        if (lastSpace !== -1) {
          endIndex = (endIndex - chunkOverlap) + lastSpace;
        }
      }
    }

    chunks.push(cleanText.slice(startIndex, endIndex).trim());
    startIndex = endIndex - (chunkOverlap / 2); 
  }

  return chunks.filter(c => c.length > 30);
};

module.exports = { splitIntoChunks };
