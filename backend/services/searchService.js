const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Performs a real-time search on the web (Google/Bing via scraping or API)
 * as a final fallback for the Vignan AI Assistant.
 */
const performLiveWebSearch = async (query) => {
  try {
    console.log(`[Search] Performing live web search for: "${query}"`);
    
    // We target the university domain specifically for accuracy
    const searchQuery = `${query} Vignan University official info`;
    // Use a different search URL or parameters to avoid 429
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&num=5`;
    
    const { data } = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.google.com/'
      },
      timeout: 8000
    });

    const $ = cheerio.load(data);
    let results = [];

    // Google search results are usually in 'div.g' or similar
    // We try to be more flexible with selectors
    $('.g, .kvH3mc, .tF2Cxc').each((i, el) => {
      if (results.length < 3) {
        const title = $(el).find('h3').text();
        const snippet = $(el).find('.VwiC3b, .MUS9nd, .itY46e').text();
        if (title && snippet) {
          results.push(`[Source: University Web] ${title}: ${snippet}`);
        }
      }
    });

    if (results.length === 0) {
      // Try a secondary selector for mobile-like results
      $('div[data-hveid]').each((i, el) => {
        if (results.length < 3) {
          const text = $(el).text();
          if (text.length > 100 && text.toLowerCase().includes('vignan')) {
            results.push(`[Source: University Snippet] ${text.substring(0, 300)}...`);
          }
        }
      });
    }

    return results.join('\n\n');
  } catch (error) {
    console.error('[Search] Web search fallback failed:', error.message);
    // Return a message that indicates we're working on it
    return "I am currently unable to fetch real-time web results due to high traffic. Please check our official FAQs or try again in a moment.";
  }
};

module.exports = { performLiveWebSearch };
